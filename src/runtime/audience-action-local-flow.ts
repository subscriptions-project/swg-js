/**
 * Copyright 2023 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AudienceActionFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {
  CLOSE_BUTTON_HTML,
  CONTRIBUTION_ICON,
  ERROR_HTML,
  LOADING_HTML,
  REWARDED_AD_HTML,
  REWARDED_AD_THANKS_HTML,
  SUBSCRIPTION_ICON,
} from './audience-action-local-ui';
import {ClientConfigManager} from './client-config-manager';
import {Deps} from './deps';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Toast} from '../ui/toast';
import {createElement, removeElement} from '../utils/dom';
import {feUrl} from './services';
import {msg} from '../utils/i18n';
import {setImportantStyles} from '../utils/style';

export interface AudienceActionLocalParams {
  action: string;
  configurationId?: string;
  onCancel?: () => void;
  autoPromptType?: AutoPromptType;
  onResult?: (result: {}) => Promise<boolean> | boolean;
  isClosable?: boolean;
  monetizationFunction?: () => void;
}

// Default timeout for waiting on ready callback.
const GPT_TIMEOUT_MS = 3000;
const CHECK_ENTITLEMENTS_REQUEST_ID = 'CHECK_ENTITLEMENTS';

/**
 * An audience action local flow will show a dialog prompt to a reader, asking them
 * to complete an action for potentially free, additional metered entitlements.
 */
export class AudienceActionLocalFlow implements AudienceActionFlow {
  private readonly prompt_: Promise<HTMLElement>;
  private readonly wrapper_: Promise<HTMLElement>;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly doc_: Document;
  // Used by rewarded ads to check if the ready callback has been called.
  private rewardedReadyCalled_ = false;
  // Resolve function to signal that the ready callback has finished executing.
  private rewardedResolve_?: (value: boolean) => void;
  // Ad slot used to host the rewarded ad.
  private rewardedSlot_?: googletag.Slot;
  // Used to render the rewarded ad, returned from the ready callback
  private makeRewardedVisible_?: () => void;

  constructor(
    private readonly deps_: Deps,
    private readonly params_: AudienceActionLocalParams,
    private readonly gptTimeoutMs_: number = GPT_TIMEOUT_MS
  ) {
    this.clientConfigManager_ = deps_.clientConfigManager();

    this.doc_ = this.deps_.doc().getRootNode();

    this.prompt_ = this.createPrompt_();

    this.wrapper_ = this.prompt_.then(this.createWrapper_.bind(this));
  }

  private async createPrompt_(): Promise<HTMLElement> {
    if (this.params_.action === 'TYPE_REWARDED_AD') {
      return this.renderAndInitRewardedAdWall_();
    } else {
      return this.renderErrorView_();
    }
  }

  private async createWrapper_(prompt: HTMLElement): Promise<HTMLElement> {
    const wrapper = createElement(this.doc_, 'div', {
      'class': 'audience-action-local-wrapper',
    });

    setImportantStyles(wrapper, {
      'all': 'unset',
      'background-color': 'rgba(32, 33, 36, 0.6)',
      'border': 'none',
      'bottom': '0',
      'height': '100%',
      'left': '0',
      'opacity': '0',
      'pointer-events': 'none',
      'position': 'fixed',
      'right': '0',
      'transition': 'opacity 0.5s',
      'top': '0',
      'width': '100%',
      'z-index': '2147483646',
    });

    const shadow = wrapper.attachShadow({mode: 'open'});

    shadow.appendChild(prompt);

    return wrapper;
  }

  private async renderErrorView_(): Promise<HTMLElement> {
    const prompt = createElement(this.doc_, 'div', {});
    return this.makeErrorView(prompt);
  }

  private makeErrorView(prompt: HTMLElement): HTMLElement {
    prompt./*OK*/ innerHTML = ERROR_HTML;
    return prompt;
  }

  private async renderAndInitRewardedAdWall_(): Promise<HTMLElement> {
    // Setup callback for googletag init.
    const googletag = this.deps_.win().googletag;
    googletag.cmd.push(this.initRewardedAdWall_.bind(this));

    const prompt = createElement(this.doc_, 'div', {});
    setImportantStyles(prompt, {
      'height': '100%',
      'display': 'flex',
      'display-flex-direction': 'column',
    });

    prompt./*OK*/ innerHTML = LOADING_HTML;

    return prompt;
  }

  private async initRewardedAdWall_() {
    // TODO: mhkawano - Get action config.
    // TODO: mhkawano - support premon.

    // Init gpt.js
    const initGptPromise = new Promise<boolean>(this.initGpt_.bind(this));
    const initSuccess = await initGptPromise;

    // Replace with error view if init fails.
    // TODO: mhkawano - Make closeable.
    if (!initSuccess) {
      const prompt = await this.prompt_;
      this.makeErrorView(prompt);
    }
  }

  private initGpt_(resolve: (result: boolean) => void) {
    // Save resolve so that it can be called in rewardedSlotReady_.
    this.rewardedResolve_ = resolve;

    const googletag = this.deps_.win().googletag;
    this.rewardedSlot_ = googletag.defineOutOfPageSlot(
      '/22639388115/rewarded_web_example',
      googletag.enums.OutOfPageFormat.REWARDED
    );

    if (this.rewardedSlot_) {
      this.rewardedSlot_.addService(googletag.pubads());
      googletag
        .pubads()
        .addEventListener(
          'rewardedSlotReady',
          this.rewardedSlotReady_.bind(this)
        );
      googletag
        .pubads()
        .addEventListener(
          'rewardedSlotClosed',
          this.rewardedSlotClosed_.bind(this)
        );
      googletag
        .pubads()
        .addEventListener(
          'rewardedSlotGranted',
          this.rewardedSlotGranted_.bind(this)
        );
      googletag.enableServices();
      googletag.display(this.rewardedSlot_);

      // gpt.js has no way of knowing that an ad unit is invalid besides checking that rewardedSlotReady is called. Error out after 3 seconds of waiting.
      setTimeout(this.rewardedAdTimeout_.bind(this), this.gptTimeoutMs_);
    } else {
      resolve(false);
    }
  }

  private async rewardedAdTimeout_() {
    if (!this.rewardedReadyCalled_) {
      const googletag = this.deps_.win().googletag;
      googletag.destroySlots([this.rewardedSlot_!]);
      this.rewardedResolve_!(false);
      // TODO: mhkawano - Launch payflow if monetized, cancel if not.
    }
  }

  /**
   * When gpt.js is ready to show an ad, we replace the loading view and wire up the buttons.
   */
  private async rewardedSlotReady_(
    rewardedAd: googletag.events.RewardedSlotReadyEvent
  ) {
    this.rewardedReadyCalled_ = true;
    this.makeRewardedVisible_ = rewardedAd.makeRewardedVisible;
    const prompt = await this.prompt_;

    const isContribution =
      this.params_.autoPromptType == AutoPromptType.CONTRIBUTION ||
      this.params_.autoPromptType == AutoPromptType.CONTRIBUTION_LARGE;

    // TODO: mhkawano - Provide internationalization.
    // TODO: mhkawnao - Escape user provided strings.
    // TODO: mhkawano - Fetch message and publication name from backend.
    // TODO: mhkawnao - Support priority actions
    // TODO: mhkawnao - Support premonetization
    const publication = 'The Daily News';
    const closeHtml = this.params_.isClosable ? CLOSE_BUTTON_HTML : '';
    const icon = isContribution ? CONTRIBUTION_ICON : SUBSCRIPTION_ICON;
    const message = isContribution
      ? `To support ${publication}, view an ad or contribute`
      : 'To access this article, subscribe or view an ad';
    const viewad = 'View an ad';
    const support = isContribution ? 'Contribute' : 'Subscribe';
    const signin = isContribution
      ? 'Already a contributor?'
      : 'Already a subscriber?';

    prompt./*OK*/ innerHTML = REWARDED_AD_HTML.replace('$TITLE$', publication)
      .replace('$CLOSE_BUTTON_HTML$', closeHtml)
      .replace('$ICON$', icon)
      .replace('$MESSAGE$', message)
      .replace('$VIEW_AN_AD$', viewad)
      .replace('$SUPPORT_BUTTON$', support)
      .replace('$SIGN_IN_BUTTON$', signin);

    prompt
      .querySelector('.rewarded-ad-close-button')
      ?.addEventListener('click', this.closeRewardedAdWall_.bind(this));
    prompt
      .querySelector('.rewarded-ad-support-button')
      ?.addEventListener('click', this.supportRewardedAdWall_.bind(this));
    prompt
      .querySelector('.rewarded-ad-view-ad-button')
      ?.addEventListener('click', this.viewRewardedAdWall_.bind(this));
    prompt
      .querySelector('.rewarded-ad-sign-in-button')
      ?.addEventListener('click', this.signinRewardedAdWall_.bind(this));

    this.rewardedResolve_!(true);
  }

  private async rewardedSlotClosed_() {
    const googletag = this.deps_.win().googletag;
    const wrapper = await this.wrapper_;
    googletag.destroySlots([this.rewardedSlot_]);
    if (this.params_.isClosable) {
      removeElement(wrapper);
      if (this.params_.onCancel) {
        this.params_.onCancel();
      }
    }
  }

  private async rewardedSlotGranted_() {
    const prompt = await this.prompt_;
    prompt./*OK*/ innerHTML = REWARDED_AD_THANKS_HTML;

    const closeButton = prompt.getElementsByClassName(
      'rewarded-ad-close-button'
    );
    closeButton.item(0)?.addEventListener('click', async () => {
      removeElement(await this.wrapper_);
    });
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([await this.rewardedSlot_!]);
  }

  private async closeRewardedAdWall_() {
    removeElement(await this.wrapper_);
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([await this.rewardedSlot_!]);
    if (this.params_.onCancel) {
      this.params_.onCancel();
    }
  }

  private async supportRewardedAdWall_() {
    removeElement(await this.wrapper_);
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([await this.rewardedSlot_!]);
    this.params_.monetizationFunction!();
  }

  private async viewRewardedAdWall_() {
    const prompt = await this.prompt_;
    const viewButton = prompt.getElementsByClassName(
      'rewarded-ad-view-ad-button'
    );
    viewButton.item(0)?.setAttribute('disabled', 'true');

    this.makeRewardedVisible_!();
  }

  private async signinRewardedAdWall_() {
    this.deps_
      .activities()
      .onResult(
        CHECK_ENTITLEMENTS_REQUEST_ID,
        this.closeRewardedAdWall_.bind(this)
      );
    this.deps_.callbacks().triggerLoginRequest({linkRequested: false});
  }

  async start() {
    const wrapper = await this.wrapper_;
    this.doc_.body.appendChild(wrapper);
    wrapper.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(wrapper, {'opacity': '1.0'});
  }

  showNoEntitlementFoundToast() {
    const language = this.clientConfigManager_.getLanguage();
    const customText = msg(
      SWG_I18N_STRINGS['NO_MEMBERSHIP_FOUND_LANG_MAP'],
      language
    )!;
    new Toast(
      this.deps_,
      feUrl('/toastiframe', {
        flavor: 'custom',
        customText,
      })
    ).open();
  }
}
