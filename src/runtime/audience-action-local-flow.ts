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
import {AutoPromptType} from '../api/basic-subscriptions'; // @ts-ignore
import {ClientConfigManager} from './client-config-manager';
import {Deps} from './deps';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Toast} from '../ui/toast';
import {createElement, removeElement} from '../utils/dom';
import {feUrl} from './services';
import {msg} from '../utils/i18n';
import {setImportantStyles} from '../utils/style';

// Helper for syntax highlighting.
const html = String.raw;
const css = String.raw;

// Error view for prompts that fail to init.
// TODO: mhkawano - Update once UX finished.
const ERROR_CSS = css`
  .prompt {
    width: 600px;
    height: 200px;
    background: white;
    pointer-events: auto !important;
    text-align: center;
  }
`;

const ERROR_HTML = html`
  <style>
    ${ERROR_CSS}
  </style>
  <div class="closePromptArea"></div>
  <div class="prompt">Something went wrong.</div>
`;

// Rewarded ad wall prompt css and html.
// TODO: mhkawano - replace with circle animation loading.
const LOADING_CSS = css`
  .prompt {
    width: 600px;
    background: white;
    pointer-events: auto !important;
    font-size: 200%;
    padding: 1rem;
  }
`;

const LOADING_HTML = html`
  <style>
    ${LOADING_CSS}
  </style>
  <div class="prompt">Loading...</div>
`;

// Rewarded ad wall prompt css and html.
// TODO: mhkawano - update when UX is done.
const REWARDED_AD_CSS = css`
  .prompt {
    width: 600px;
    background: white;
    pointer-events: auto !important;
    font-size: 200%;
    padding: 1rem;
  }
`;

const REWARDED_AD_HTML = html`
  <style>
    ${REWARDED_AD_CSS}
  </style>
  <div class="prompt">
    <div class="closePromptArea"></div>
    <p>Support us by watching this ad</p>
    <input type="button" class="watchAdButton" value="Watch ad" />
    <input type="button" class="supportButton" value="Donate/Subscribe" />
    <input type="button" class="signinButton" value="Sign-in" />
  </div>
`;

export interface AudienceActionLocalParams {
  action: string;
  configurationId?: string;
  onCancel?: () => void;
  autoPromptType?: AutoPromptType;
  onResult?: (result: {}) => Promise<boolean> | boolean;
  isClosable?: boolean;
  monetizationFunction?: () => void;
}

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
  private rewardedResolve_: any;
  // Ad slot used to host the rewarded ad.
  private rewardedSlot_: any;

  constructor(
    private readonly deps_: Deps,
    private readonly params_: AudienceActionLocalParams
  ) {
    this.clientConfigManager_ = deps_.clientConfigManager();

    this.doc_ = this.deps_.doc().getRootNode();

    this.prompt_ = this.createPrompt_();

    this.wrapper_ = this.prompt_.then(this.createWrapper_.bind(this));
  }

  private async createPrompt_(): Promise<HTMLElement> {
    let prompt;
    if (this.params_.action === 'TYPE_REWARDED_AD') {
      prompt = await this.renderAndInitRewardedAdWall_();
    } else {
      prompt = await this.renderErrorView_();
    }
    setImportantStyles(prompt, {
      'position': 'fixed',
      'left': '50%',
      'bottom': '20px',
      'transform': 'translateX(-50%)',
      'margin': '0 auto',
    });
    return prompt;
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
    if (this.params_.isClosable) {
      const closePromptButton = createElement(this.doc_, 'input', {
        'type': 'button',
        'class': 'watchAdButton',
        'value': 'Close prompt',
      });
      closePromptButton.addEventListener('click', async () => {
        const wrapper = await this.wrapper_;
        removeElement(wrapper);
        if (this.params_.onCancel) {
          this.params_.onCancel();
        }
      });
      prompt
        .getElementsByClassName('closeArea')
        .item(0)
        ?.appendChild(closePromptButton);
    }
    return prompt;
  }

  private async renderAndInitRewardedAdWall_(): Promise<HTMLElement> {
    // Setup callback for googletag init.
    const googletag = this.deps_.win().googletag || {cmd: []};
    googletag.cmd.push(this.initRewardedAdWall_.bind(this));

    // Initially return loading view.
    const prompt = createElement(this.doc_, 'div', {});
    prompt./*OK*/ innerHTML = LOADING_HTML;
    return prompt;
  }

  private async initRewardedAdWall_() {
    // TODO: mhkawano - Get actoin config.

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

    const googletag = this.deps_.win().googletag || {cmd: []};
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
      setTimeout(() => {
        if (!this.rewardedReadyCalled_) {
          googletag.destroySlots([this.rewardedSlot_]);
          resolve(false);
        }
      }, 3000);
    } else {
      resolve(false);
    }
  }

  /**
   * When gpt.js is ready to show an ad, we replace the loading view and wire up the buttons.
   */
  private async rewardedSlotReady_(event: any) {
    this.rewardedReadyCalled_ = true;

    const googletag = this.deps_.win().googletag || {cmd: []};
    const prompt = await this.prompt_;
    const wrapper = await this.wrapper_;

    prompt./*OK*/ innerHTML = REWARDED_AD_HTML;

    const watchAdButton = prompt.getElementsByClassName('watchAdButton');
    watchAdButton.item(0)?.addEventListener('click', async () => {
      setImportantStyles(wrapper, {'display': 'none'});
      watchAdButton.item(0)?.remove();
      event.makeRewardedVisible();
    });

    if (this.params_.isClosable) {
      const closePromptButton = createElement(this.doc_, 'input', {
        'type': 'button',
        'class': 'watchAdButton',
        'value': 'Close prompt',
      });
      closePromptButton.addEventListener('click', async () => {
        removeElement(wrapper);
        googletag.destroySlots([this.rewardedSlot_]);
        if (this.params_.onCancel) {
          this.params_.onCancel();
        }
      });
      prompt
        .getElementsByClassName('closeArea')
        .item(0)
        ?.appendChild(closePromptButton);
    }

    const supportButton = prompt.getElementsByClassName('supportButton');
    if (this.params_.monetizationFunction) {
      supportButton.item(0)?.addEventListener('click', async () => {
        removeElement(wrapper);
        googletag.destroySlots([this.rewardedSlot_]);
        // TODO: mhkawano - suppress the monetizatoin function graypane fade-in animation.
        this.params_.monetizationFunction!();
      });
    }

    const signinButton = prompt.getElementsByClassName('signinButton');
    signinButton.item(0)?.addEventListener('click', async () => {
      this.deps_.callbacks().triggerLoginRequest({linkRequested: false});
      // close the prompt and destory the ad slot if entitlements are found
    });
    this.rewardedResolve_(true);
  }

  private async rewardedSlotClosed_() {
    const googletag = this.deps_.win().googletag || {cmd: []};
    const wrapper = await this.wrapper_;
    googletag.destroySlots([this.rewardedSlot_]);
    if (this.params_.isClosable) {
      removeElement(wrapper);
      if (this.params_.onCancel) {
        this.params_.onCancel();
      }
    } else {
      setImportantStyles(wrapper, {'display': 'block'});
    }
  }

  private async rewardedSlotGranted_() {
    const googletag = this.deps_.win().googletag || {cmd: []};
    const wrapper = await this.wrapper_;
    removeElement(wrapper);
    googletag.destroySlots([this.rewardedSlot_]);
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
