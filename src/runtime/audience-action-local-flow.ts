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

import {AnalyticsEvent} from '../proto/api_messages';
import {
  AudienceActionFlow,
  TYPE_NEWSLETTER_SIGNUP,
  TYPE_REWARDED_AD,
} from './audience-action-flow';
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
import {ClientEventManager} from './client-event-manager';
import {Constants} from '../utils/constants';
import {Deps} from './deps';
import {Message} from '../proto/api_messages';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';
import {addQueryParam} from '../utils/url';
import {createElement, removeElement} from '../utils/dom';
import {feUrl} from './services';
import {msg} from '../utils/i18n';
import {parseUrl} from '../utils/url';
import {serviceUrl} from './services';
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

interface AudienceActionConfig {
  publication?: {
    name?: string;
  };
  rewardedAdParameters?: {
    adunit?: string;
    customMessage?: string;
  };
  optInParameters?: {
    title: string;
    body: string;
    promptPreference?: string;
    codeSnippet?: string;
  };
}

// Default timeout for waiting on ready callback.
const GPT_TIMEOUT_MS = 3000;
const PREFERENCE_PUBLISHER_PROVIDED_PROMPT =
  'PREFERENCE_PUBLISHER_PROVIDED_PROMPT';

/**
 * An audience action local flow will show a dialog prompt to a reader, asking them
 * to complete an action for potentially free, additional metered entitlements.
 */
export class AudienceActionLocalFlow implements AudienceActionFlow {
  private readonly prompt_: HTMLElement;
  private readonly wrapper_: HTMLElement;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly doc_: Document;
  private readonly fetcher_: XhrFetcher;
  private readonly eventManager_: ClientEventManager;
  // Used by rewarded ads to check if the ready callback has been called.
  private rewardedReadyCalled_ = false;
  // Ad slot used to host the rewarded ad.
  private rewardedSlot_?: googletag.Slot;
  // Used to render the rewarded ad, returned from the ready callback.
  private makeRewardedVisible_?: () => void;
  // Used for testing.
  // @ts-ignore
  private rewardedTimout_: Promise<boolean> | null = null;

  constructor(
    private readonly deps_: Deps,
    private readonly params_: AudienceActionLocalParams,
    private readonly gptTimeoutMs_: number = GPT_TIMEOUT_MS
  ) {
    this.clientConfigManager_ = deps_.clientConfigManager();

    this.doc_ = deps_.doc().getRootNode();

    this.prompt_ = createElement(this.doc_, 'div', {});

    this.wrapper_ = this.createWrapper_();

    this.fetcher_ = new XhrFetcher(deps_.win());

    this.eventManager_ = deps_.eventManager();
  }

  private createWrapper_(): HTMLElement {
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

    shadow.appendChild(this.prompt_);

    return wrapper;
  }

  private renderErrorView_() {
    // TODO: mhkawano - Make closeable.
    // TODO: mhkawano - Make look nicer.
    this.prompt_./*OK*/ innerHTML = ERROR_HTML;
  }

  private renderLoadingView_() {
    setImportantStyles(this.prompt_, {
      'height': '100%',
      'display': 'flex',
      'display-flex-direction': 'column',
    });
    this.prompt_./*OK*/ innerHTML = LOADING_HTML;
  }

  private async initPrompt_() {
    if (this.params_.action === TYPE_REWARDED_AD) {
      await this.initRewardedAdWall_();
    } else if (this.params_.action === TYPE_NEWSLETTER_SIGNUP) {
      await this.initNewsletterSignup_();
    } else {
      this.renderErrorView_();
    }
  }

  private async initNewsletterSignup_() {
    //TODO: chuyangwang - Log impression.
    const config = await this.getConfig_();

    const validNewsletterSignupParams =
      config?.optInParameters?.codeSnippet &&
      config?.optInParameters?.promptPreference ===
        PREFERENCE_PUBLISHER_PROVIDED_PROMPT;

    if (validNewsletterSignupParams) {
      this.renderOptinPrompt_(config?.optInParameters?.codeSnippet);
    } else {
      //TODO: chuyangwang - Log Error.
    }
  }

  private renderOptinPrompt_(codeSnippet?: string) {
    if (!codeSnippet || !codeSnippet.includes('form')) {
      ////TODO: chuyangwang - Log Error.
    } else {
      //TODO: chuyangwang - set prompt to be at the right position.
      this.prompt_./*OK*/ innerHTML = codeSnippet;
      const shadowRoot = this.wrapper_.shadowRoot;
      if (shadowRoot) {
        const form = shadowRoot.querySelector('form');
        if (form) {
          form.addEventListener('submit', this.formSubmit_.bind(this));
        } else {
          //TODO: chuyangwang - Log Error.
        }
      } else {
        //TODO: chuyangwang - Log Error.
      }
    }
  }

  private formSubmit_() {
    //TODO: chuyangwang - verify email being submitted.
    this.complete_();
  }

  private async initRewardedAdWall_() {
    this.eventManager_.logSwgEvent(AnalyticsEvent.IMPRESSION_REWARDED_AD);

    const config = await this.getConfig_();

    const validRewardedAdParams =
      config?.rewardedAdParameters?.adunit &&
      config?.rewardedAdParameters?.customMessage &&
      config?.publication?.name;
    if (validRewardedAdParams) {
      // Setup callback for googletag init.
      const googletag = this.deps_.win().googletag;
      googletag.cmd.push(() => {
        this.initRewardedAdSlot_(config);
      });

      // There is no good method of checking that gpt.js is working correctly.
      // This timeout allows us to sanity check and error out if things are not
      // working correctly.
      this.rewardedTimout_ = new Promise((resolve) => {
        setTimeout(() => {
          this.rewardedAdTimeout_(resolve);
        }, this.gptTimeoutMs_);
      });
    } else {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_REWARDED_AD_CONFIG_ERROR
      );
      this.renderErrorView_();
    }
  }

  private initRewardedAdSlot_(config: AudienceActionConfig) {
    const googletag = this.deps_.win().googletag;

    this.rewardedSlot_ = googletag.defineOutOfPageSlot(
      config.rewardedAdParameters!.adunit!,
      googletag.enums.OutOfPageFormat.REWARDED
    );

    if (this.rewardedSlot_) {
      this.rewardedSlot_.addService(googletag.pubads());
      googletag
        .pubads()
        .addEventListener(
          'rewardedSlotReady',
          (event: googletag.events.RewardedSlotReadyEvent) =>
            this.rewardedSlotReady_(event, config!)
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
    } else {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_REWARDED_AD_PAGE_ERROR
      );
      this.renderErrorView_();
    }
  }

  private rewardedAdTimeout_(resolve: (value: boolean) => void) {
    if (!this.rewardedReadyCalled_) {
      const googletag = this.deps_.win().googletag;
      this.renderErrorView_();
      googletag.destroySlots([this.rewardedSlot_!]);
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_REWARDED_AD_GPT_ERROR
      );
      resolve(true);
      // TODO: mhkawano - Launch payflow if monetized, cancel if not.
    }
    resolve(false);
  }

  /**
   * When gpt.js is ready to show an ad, we replace the loading view and wire up
   * the buttons.
   */
  private rewardedSlotReady_(
    rewardedAd: googletag.events.RewardedSlotReadyEvent,
    config: AudienceActionConfig
  ) {
    this.rewardedReadyCalled_ = true;
    this.makeRewardedVisible_ = rewardedAd.makeRewardedVisible;

    const isContribution =
      this.params_.autoPromptType == AutoPromptType.CONTRIBUTION ||
      this.params_.autoPromptType == AutoPromptType.CONTRIBUTION_LARGE;

    // TODO: mhkawnao - Escape user provided strings. For Alpha it will be
    //                  specified by us so we don't need to do it yet.
    // TODO: mhkawnao - Support priority actions
    // TODO: mhkawnao - Support premonetization
    const language = this.clientConfigManager_.getLanguage();

    // verified existance in initRewardedAdWall_
    const publication = config.publication!.name!;
    const closeButtonDescription = msg(
      SWG_I18N_STRINGS['CLOSE_BUTTON_DESCRIPTION'],
      language
    )!;
    const closeHtml = this.params_.isClosable
      ? CLOSE_BUTTON_HTML.replace(
          '$CLOSE_BUTTON_DESCRIPTION$',
          closeButtonDescription
        )
      : '';
    const icon = isContribution ? CONTRIBUTION_ICON : SUBSCRIPTION_ICON;
    // verified existance in initRewardedAdWall_
    const message = config.rewardedAdParameters!.customMessage!;
    const viewad = 'View an ad';
    const support = isContribution
      ? msg(SWG_I18N_STRINGS['CONTRIBUTE'], language)!
      : msg(SWG_I18N_STRINGS['SUBSCRIBE'], language)!;
    const signin = isContribution
      ? msg(SWG_I18N_STRINGS['ALREADY_A_CONTRIBUTOR'], language)!
      : msg(SWG_I18N_STRINGS['ALREADY_A_SUBSCRIBER'], language)!;

    this.prompt_./*OK*/ innerHTML = REWARDED_AD_HTML.replace(
      '$TITLE$',
      publication
    )
      .replace('$CLOSE_BUTTON_HTML$', closeHtml)
      .replace('$ICON$', icon)
      .replace('$MESSAGE$', message)
      .replace('$VIEW_AN_AD$', viewad)
      .replace('$SUPPORT_BUTTON$', support)
      .replace('$SIGN_IN_BUTTON$', signin);

    this.prompt_
      .querySelector('.rewarded-ad-close-button')
      ?.addEventListener('click', this.closeRewardedAdWall_.bind(this));
    this.prompt_
      .querySelector('.rewarded-ad-support-button')
      ?.addEventListener('click', this.supportRewardedAdWall_.bind(this));
    this.prompt_
      .querySelector('.rewarded-ad-view-ad-button')
      ?.addEventListener('click', this.viewRewardedAdWall_.bind(this));
    this.prompt_
      .querySelector('.rewarded-ad-sign-in-button')
      ?.addEventListener('click', this.signinRewardedAdWall_.bind(this));

    this.eventManager_.logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_READY);
  }

  private rewardedSlotClosed_() {
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([this.rewardedSlot_]);
    if (this.params_.isClosable) {
      removeElement(this.wrapper_);
      if (this.params_.onCancel) {
        this.params_.onCancel();
      }
    }
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD,
      /* isFromUserAction */ true
    );
  }

  private rewardedSlotGranted_() {
    const language = this.clientConfigManager_.getLanguage();
    const closeButtonDescription = msg(
      SWG_I18N_STRINGS['CLOSE_BUTTON_DESCRIPTION'],
      language
    )!;
    const thanksMessage = msg(
      SWG_I18N_STRINGS['THANKS_FOR_VIEWING_THIS_AD'],
      language
    )!;
    this.prompt_./*OK*/ innerHTML = REWARDED_AD_THANKS_HTML.replace(
      '$CLOSE_BUTTON_DESCRIPTION$',
      closeButtonDescription
    ).replace('$THANKS_FOR_VIEWING_THIS_AD$', thanksMessage);

    const closeButton = this.prompt_.getElementsByClassName(
      'rewarded-ad-close-button'
    );
    closeButton.item(0)?.addEventListener('click', () => {
      removeElement(this.wrapper_);
    });
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([this.rewardedSlot_!]);
    this.eventManager_.logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_GRANTED);
    this.complete_();
  }

  private closeRewardedAdWall_() {
    removeElement(this.wrapper_);
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([this.rewardedSlot_!]);
    if (this.params_.onCancel) {
      this.params_.onCancel();
    }
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_CLOSE,
      /* isFromUserAction */ true
    );
  }

  private supportRewardedAdWall_() {
    removeElement(this.wrapper_);
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([this.rewardedSlot_!]);
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_SUPPORT,
      /* isFromUserAction */ true
    );
    this.params_.monetizationFunction!();
  }

  private viewRewardedAdWall_() {
    const viewButton = this.prompt_.getElementsByClassName(
      'rewarded-ad-view-ad-button'
    );
    viewButton.item(0)?.setAttribute('disabled', 'true');
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_VIEW,
      /* isFromUserAction */ true
    );
    this.makeRewardedVisible_!();
  }

  private signinRewardedAdWall_() {
    this.deps_.callbacks().triggerLoginRequest({linkRequested: false});
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_SIGN_IN,
      /* isFromUserAction */ true
    );
  }

  private buildEndpointUrl_(endpoint: string, queryParams: string[][]): string {
    const publicationId = this.deps_.pageConfig().getPublicationId();
    const baseUrl = `/publication/${encodeURIComponent(
      publicationId
    )}/${endpoint}`;
    const url = queryParams.reduce(
      (url, [param, value]) => addQueryParam(url, param, value),
      serviceUrl(baseUrl)
    );
    return url;
  }

  private async getConfig_(): Promise<AudienceActionConfig> {
    const queryParams = [
      ['publicationId', this.deps_.pageConfig().getPublicationId()],
      // TODO: mhkawano - configurationId should not be optional
      ['configurationId', this.params_.configurationId!],
      ['origin', parseUrl(this.deps_.win().location.href).origin],
    ];

    const url = this.buildEndpointUrl_('getactionconfigurationui', queryParams);
    return await this.fetcher_.fetchCredentialedJson(url);
  }

  private async complete_() {
    const swgUserToken = await this.deps_
      .storage()
      .get(Constants.USER_TOKEN, true);
    const queryParams = [
      // TODO: mhkawano - check and error out if swgUserToken is null
      ['sut', swgUserToken!],
      // TODO: mhkawano - configurationId should not be optional
      ['configurationId', this.params_.configurationId!],
      ['audienceActionType', this.params_.action],
    ];
    const url = this.buildEndpointUrl_('completeaudienceaction', queryParams);
    // Empty message send as part of the post.
    const emptyMessage: Message = {
      toArray: () => [],
      label: String,
    };
    this.fetcher_.sendPost(url, emptyMessage);
    // TODO: mhkawano - log error
    // TODO: mhkawano - handle entitlement consumption logic on completion
    // ex: this.entitlementsManager_.getEntitlements();
  }

  async start() {
    this.renderLoadingView_();
    this.doc_.body.appendChild(this.wrapper_);
    this.wrapper_.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(this.wrapper_, {'opacity': '1.0'});
    await this.initPrompt_();
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

  close() {
    removeElement(this.wrapper_);
    if (this.rewardedSlot_) {
      const googletag = this.deps_.win().googletag;
      googletag.destroySlots([this.rewardedSlot_]);
    }
  }
}
