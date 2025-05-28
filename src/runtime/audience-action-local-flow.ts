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
import {AudienceActionFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {
  BACK_TO_HOME_HTML,
  ERROR_HTML,
  LOADING_HTML,
  OPT_IN_CLOSE_BUTTON_HTML,
  REWARDED_AD_CLOSE_BUTTON_HTML,
  REWARDED_AD_HTML,
  REWARDED_AD_SIGN_IN_HTML,
  REWARDED_AD_SUPPORT_HTML,
  REWARDED_AD_THANKS_HTML,
} from './audience-action-local-ui';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {EntitlementsManager} from './entitlements-manager';
import {InterventionResult} from '../api/available-intervention';
import {InterventionType} from '../api/intervention-type';
import {Message} from '../proto/api_messages';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';
import {addQueryParam} from '../utils/url';
import {createElement, removeElement} from '../utils/dom';
import {feUrl} from './services';
import {htmlEscape} from 'safevalues';
import {msg} from '../utils/i18n';
import {parseUrl} from '../utils/url';
import {serviceUrl} from './services';
import {setImportantStyles} from '../utils/style';
import {setStyle} from '../utils/style';
import {warn} from '../utils/log';

export interface AudienceActionLocalParams {
  action: InterventionType;
  configurationId?: string;
  onCancel?: () => void;
  autoPromptType?: AutoPromptType;
  onResult?: (result: InterventionResult) => Promise<boolean> | boolean;
  isClosable?: boolean;
  monetizationFunction?: () => void;
  calledManually: boolean;
  shouldRenderPreview?: boolean;
  onAlternateAction?: () => void;
  onSignIn?: () => void;
}

interface AudienceActionConfig {
  publication?: {
    name?: string;
    revenueModel?: {
      subscriptions?: boolean;
      contributions?: boolean;
      premonetization?: boolean;
    };
  };
  rewardedAdParameters?: {
    adunit?: string;
    customMessage?: string;
  };
  optInParameters?: {
    title: string;
    body: string;
    promptPreference?: string;
    rawCodeSnippet?: string;
  };
}

interface CompleteAudienceActionResponse {
  updated?: boolean;
  alreadyCompleted?: boolean;
  swgUserToken?: string;
}

// Default timeout for waiting on ready callback.
const GPT_TIMEOUT_MS = 10000;
// Default timeout to auto-dismiss the rewarded ad thanks prompt
const THANKS_TIMEOUT_MS = 3000;
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
  private readonly entitlementsManager_: EntitlementsManager;
  // Ad slot used to host the rewarded ad.
  private rewardedSlot_?: googletag.Slot;
  // Used to render the rewarded ad, returned from the ready callback.
  private makeRewardedVisible_?: () => void;
  private rewardedAdTimeout_?: NodeJS.Timeout;
  // Used for focus trap.
  private bottomSentinal_!: HTMLElement;
  private config?: AudienceActionConfig;
  // Rewarded ad callback handlers.
  private readonly rewardedSlotReadyHandler;
  private readonly rewardedSlotClosedHandler;
  private readonly rewardedSlotGrantedHandler;
  private readonly slotRenderEndedHandler;

  constructor(
    private readonly deps_: Deps,
    private readonly params_: AudienceActionLocalParams,
    private readonly gptTimeoutMs_: number = GPT_TIMEOUT_MS,
    private readonly thanksTimeoutMs_: number = THANKS_TIMEOUT_MS
  ) {
    this.clientConfigManager_ = deps_.clientConfigManager();

    this.doc_ = deps_.doc().getRootNode();

    this.prompt_ = this.createPrompt_();

    this.wrapper_ = this.createWrapper_();

    this.fetcher_ = new XhrFetcher(deps_.win());

    this.eventManager_ = deps_.eventManager();

    this.entitlementsManager_ = deps_.entitlementsManager();

    this.rewardedSlotReadyHandler = this.rewardedSlotReady_.bind(this);
    this.rewardedSlotClosedHandler = this.rewardedSlotClosed_.bind(this);
    this.rewardedSlotGrantedHandler = this.rewardedSlotGranted_.bind(this);
    this.slotRenderEndedHandler = this.slotRenderEnded_.bind(this);
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
      'pointer-events': 'auto',
      'position': 'fixed',
      'right': '0',
      'transition': 'opacity 0.5s',
      'top': '0',
      'width': '100%',
      'z-index': '2147483646',
    });

    if (!!this.params_.isClosable) {
      wrapper.onclick = this.close.bind(this);
    }

    const shadow = wrapper.attachShadow({mode: 'open'});

    const topSentinal = createElement(
      this.doc_,
      'audience-action-top-sentinal',
      {
        'tabindex': '0',
      }
    );
    topSentinal.addEventListener('focus', this.focusLast_.bind(this));

    this.bottomSentinal_ = createElement(
      this.doc_,
      'audience-action-bottom-sentinal',
      {
        'tabindex': '0',
      }
    );
    this.bottomSentinal_.addEventListener('focus', this.focusFirst_.bind(this));

    shadow.appendChild(topSentinal);
    shadow.appendChild(this.prompt_);
    shadow.appendChild(this.bottomSentinal_);

    return wrapper;
  }

  private createPrompt_(): HTMLElement {
    const prompt = createElement(this.doc_, 'div', {});
    setImportantStyles(prompt, {
      'height': '100%',
      'display': 'flex',
      'display-flex-direction': 'column',
      'pointer-events': 'none',
    });
    prompt.onclick = (e) => {
      e.stopPropagation();
    };
    return prompt;
  }

  private renderErrorView_() {
    this.prompt_./*OK*/ innerHTML = ERROR_HTML;
  }

  private bailoutPrompt_() {
    if (!this.params_.isClosable && !this.params_.monetizationFunction) {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.IMPRESSION_REWARDED_AD_ERROR
      );
    }
    this.cleanUpGoogletag();
    this.params_.onCancel?.();
    this.params_.monetizationFunction?.();
    this.triggerRewardedAdOnResultCallback(
      /* rendered */ false,
      /* rewardGranted */ false
    );
  }

  private renderLoadingView_() {
    this.prompt_./*OK*/ innerHTML = LOADING_HTML;
  }

  private async initPrompt_() {
    if (this.params_.action === InterventionType.TYPE_REWARDED_AD) {
      await this.initRewardedAdWall_();
    } else if (
      this.params_.action === InterventionType.TYPE_NEWSLETTER_SIGNUP
    ) {
      await this.initNewsletterSignup_();
    } else {
      this.params_.onCancel?.();
      if (!this.params_.isClosable) {
        this.renderErrorView_();
        this.lock_();
      }
    }
  }

  private async initNewsletterSignup_() {
    this.renderLoadingView_();
    this.lock_();
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN
    );
    const config = await this.getConfig_();
    const codeSnippet = config?.optInParameters?.rawCodeSnippet;

    const validNewsletterSignupParams =
      codeSnippet &&
      config?.optInParameters?.promptPreference ===
        PREFERENCE_PUBLISHER_PROVIDED_PROMPT;

    if (validNewsletterSignupParams) {
      this.renderOptInPrompt_(codeSnippet);
    } else {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CONFIG_ERROR
      );
      this.renderErrorView_();
    }
  }

  private renderOptInPrompt_(codeSnippet: string) {
    const optInPrompt = createElement(this.doc_, 'div', {});
    const closeHtml = this.getCloseButtonOrEmptyHtml_(OPT_IN_CLOSE_BUTTON_HTML);
    optInPrompt./*OK*/ innerHTML = closeHtml.concat(codeSnippet);
    const form = optInPrompt.querySelector('form');

    if (form && this.wrapper_) {
      setImportantStyles(optInPrompt, {
        'background-color': 'white',
        'border': 'none',
        'border-top-left-radius': '20px',
        'border-top-right-radius': '20px',
        'bottom': '0',
        'left': '50%',
        'max-height': '90%',
        'max-width': '100%',
        'pointer-events': 'auto',
        'position': 'fixed',
        'overflow': 'auto',
        'text-align': 'center',
        'transform': 'translate(-50%, 0)',
        'z-index': '2147483646',
      });
      optInPrompt.onclick = (e) => {
        e.stopPropagation();
      };
      this.wrapper_.shadowRoot?.removeChild(this.prompt_);
      this.wrapper_.shadowRoot?.appendChild(optInPrompt);
      this.focusOnOptinPrompt_();
      optInPrompt
        .querySelector('.opt-in-close-button')
        ?.addEventListener('click', this.closeOptInPrompt_.bind(this));
      form.addEventListener('submit', this.formSubmit_.bind(this));
    } else {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CODE_SNIPPET_ERROR
      );
      this.renderErrorView_();
    }
  }

  private focusOnOptinPrompt_() {
    // Move the bottomSentinal element after any focusable inputs.
    this.wrapper_.shadowRoot?.appendChild(this.bottomSentinal_);
    const focusable = this.getFocusableInput_();
    if (focusable.length > 0) {
      (this.getFocusableInput_()[0] as HTMLElement).focus();
    }
  }

  private async formSubmit_() {
    //TODO: chuyangwang - verify email being submitted.

    // Hide prompt before closing the prompt.
    setImportantStyles(this.wrapper_, {'opacity': '0'});
    // Wait for form submit request to send before closing the prompt.
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT
    );
    await this.complete_();

    await this.delay_(1000);
    // Close the prompt.
    this.unlock_();
  }

  private async delay_(time: number) {
    return new Promise((res) => this.deps_.win().setTimeout(res, time));
  }

  private closeOptInPrompt_() {
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE
    );

    if (this.params_.isClosable) {
      this.unlock_();
      this.params_.onCancel?.();
    }
  }

  private isSubscription(): boolean {
    return (
      this.params_.autoPromptType === AutoPromptType.SUBSCRIPTION ||
      this.params_.autoPromptType === AutoPromptType.SUBSCRIPTION_LARGE ||
      // Check the revenue model as backup
      // TODO: b/374764869 - rework how autoPromptType is determined
      (!this.params_.autoPromptType &&
        !!this.config?.publication?.revenueModel?.subscriptions)
    );
  }

  private isContribution(): boolean {
    return (
      this.params_.autoPromptType === AutoPromptType.CONTRIBUTION ||
      this.params_.autoPromptType === AutoPromptType.CONTRIBUTION_LARGE ||
      // Check the revenue model as backup
      // TODO: b/374764869 - rework how autoPromptType is determined
      (!this.params_.autoPromptType &&
        !!this.config?.publication?.revenueModel?.contributions)
    );
  }

  private async checkGoogletagAvailable_(): Promise<boolean> {
    const window = this.deps_.win();
    // Shortcut the check if there is a fake api loaded
    if (!!window.googletag?.apiReady && !window.googletag?.getVersion()) {
      return false;
    }
    // Race aginst the command queue to confirm that it has been loaded
    return new Promise((res) => {
      const timeout = setTimeout(() => res(false), this.gptTimeoutMs_);
      window.googletag = window.googletag || {cmd: []};
      window.googletag.cmd.push(() => {
        clearTimeout(timeout);
        res(true);
      });
    });
  }

  private async initRewardedAdWall_() {
    this.eventManager_.logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_FLOW_INIT);
    const [config, googletagAvailable] = await Promise.all([
      this.getConfig_(),
      this.checkGoogletagAvailable_(),
    ]);
    if (!googletagAvailable) {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_REWARDED_AD_GPT_MISSING_ERROR
      );
      this.bailoutPrompt_();
      return;
    }
    const validRewardedAdParams =
      config?.rewardedAdParameters?.adunit &&
      config?.rewardedAdParameters?.customMessage &&
      config?.publication?.name;
    if (!validRewardedAdParams) {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_REWARDED_AD_CONFIG_ERROR
      );
      this.bailoutPrompt_();
      return;
    }
    this.config = config;
    // Setup callback for googletag init.
    const googletag = this.deps_.win().googletag;
    googletag.cmd.push(this.initRewardedAdSlot_.bind(this));
    // There is no good method of checking that gpt.js is working correctly.
    // This timeout allows us to sanity check and error out if things are not
    // working correctly.
    this.rewardedAdTimeout_ = setTimeout(() => {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_REWARDED_AD_GPT_ERROR
      );
      this.bailoutPrompt_();
    }, this.gptTimeoutMs_);
  }

  private initRewardedAdSlot_() {
    const googletag = this.deps_.win().googletag;

    this.rewardedSlot_ = googletag.defineOutOfPageSlot(
      this.config!.rewardedAdParameters!.adunit!,
      googletag.enums.OutOfPageFormat.REWARDED
    );

    if (!this.rewardedSlot_) {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_REWARDED_AD_PAGE_ERROR
      );
      this.bailoutPrompt_();
      return;
    }
    this.rewardedSlot_.addService(googletag.pubads());
    googletag
      .pubads()
      .addEventListener('rewardedSlotReady', this.rewardedSlotReadyHandler);
    googletag
      .pubads()
      .addEventListener('rewardedSlotClosed', this.rewardedSlotClosedHandler);
    googletag
      .pubads()
      .addEventListener('rewardedSlotGranted', this.rewardedSlotGrantedHandler);
    googletag
      .pubads()
      .addEventListener('slotRenderEnded', this.slotRenderEndedHandler);
    googletag.enableServices();
    googletag.display(this.rewardedSlot_);
    googletag.pubads().refresh([this.rewardedSlot_]);
  }

  /**
   * Called when rendering the slot has ended. Used to determine if a slot was
   * filled.
   */
  private slotRenderEnded_(event: googletag.events.SlotRenderEndedEvent) {
    if (event.slot === this.rewardedSlot_! && event.isEmpty) {
      clearTimeout(this.rewardedAdTimeout_);
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_REWARDED_AD_NOT_FILLED
      );
      warn('Rewarded ad slot could not be filled');
      this.bailoutPrompt_();
    }
  }

  /**
   * When gpt.js is ready to show an ad, we replace the loading view and wire up
   * the buttons.
   */
  private rewardedSlotReady_(
    rewardedAd: googletag.events.RewardedSlotReadyEvent
  ) {
    clearTimeout(this.rewardedAdTimeout_);
    this.makeRewardedVisible_ = rewardedAd.makeRewardedVisible;

    const isPremonetization = !this.isContribution() && !this.isSubscription();

    const language = this.clientConfigManager_.getLanguage();

    // verified existance in initRewardedAdWall_
    const publication = htmlEscape(this.config!.publication!.name!).toString();
    const closeButtonHtml = this.getCloseButtonOrEmptyHtml_(
      REWARDED_AD_CLOSE_BUTTON_HTML
    );
    // verified existance in initRewardedAdWall_
    const message = htmlEscape(
      this.config!.rewardedAdParameters!.customMessage!
    ).toString();
    const viewad = msg(SWG_I18N_STRINGS['VIEW_AN_AD'], language)!;

    const support =
      this.isSubscription() || !!this.params_.onAlternateAction
        ? msg(SWG_I18N_STRINGS['SUBSCRIBE'], language)!
        : msg(SWG_I18N_STRINGS['CONTRIBUTE'], language)!;

    const supportHtml =
      !this.params_.onAlternateAction && isPremonetization
        ? ''
        : REWARDED_AD_SUPPORT_HTML.replace('$SUPPORT_MESSAGE$', support);

    const signin =
      this.isSubscription() || !!this.params_.onSignIn
        ? msg(SWG_I18N_STRINGS['ALREADY_A_SUBSCRIBER'], language)!
        : msg(SWG_I18N_STRINGS['ALREADY_A_CONTRIBUTOR'], language)!;

    const signinHtml =
      !this.params_.onSignIn && isPremonetization
        ? ''
        : REWARDED_AD_SIGN_IN_HTML.replace('$SIGN_IN_MESSAGE$', signin);

    this.prompt_./*OK*/ innerHTML = REWARDED_AD_HTML.replace(
      '$TITLE$',
      publication
    )
      .replace('$EXIT$', closeButtonHtml)
      .replace('$MESSAGE$', message)
      .replace('$VIEW_AN_AD$', viewad)
      .replace('$SUPPORT_BUTTON$', supportHtml)
      .replace('$SIGN_IN_BUTTON$', signinHtml);

    this.prompt_
      .querySelector('.rewarded-ad-support-button')
      ?.addEventListener('click', this.supportRewardedAdWall_.bind(this));
    this.prompt_
      .querySelector('.rewarded-ad-view-ad-button')
      ?.addEventListener('click', this.viewRewardedAdWall_.bind(this));
    this.prompt_
      .querySelector('.rewarded-ad-close-button')
      ?.addEventListener('click', this.closeRewardedAdWall_.bind(this));
    this.prompt_
      .querySelector('.rewarded-ad-sign-in-button')
      ?.addEventListener('click', this.signinRewardedAdWall_.bind(this));
    this.lock_();
    this.focusRewardedAds_();
    // TODO: mhkawano - EVENT_REWARDED_AD_READY and IMPRESSION_REWARDED_AD are redundant.
    this.eventManager_.logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_READY);
    this.eventManager_.logSwgEvent(AnalyticsEvent.IMPRESSION_REWARDED_AD);
  }

  private rewardedSlotClosed_() {
    this.cleanUpGoogletag();
    if (this.params_.isClosable) {
      this.unlock_();
      this.params_.onCancel?.();
    }
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD,
      /* isFromUserAction */ true
    );
    this.triggerRewardedAdOnResultCallback(
      /* rendered */ true,
      /* rewardGranted */ false
    );
  }

  private async rewardedSlotGranted_(
    event: googletag.events.RewardedSlotGrantedEvent
  ) {
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
    const timeout = setTimeout(this.unlock_.bind(this), this.thanksTimeoutMs_);
    closeButton.item(0)?.addEventListener('click', () => {
      clearTimeout(timeout);
      this.unlock_();
    });
    this.cleanUpGoogletag();
    this.eventManager_.logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_GRANTED);
    this.focusRewardedAds_();
    this.triggerRewardedAdOnResultCallback(
      /* rendered */ true,
      /* rewardGranted */ true,
      event?.payload?.amount,
      event?.payload?.type
    );
    await this.complete_();
  }

  private closeRewardedAdWall_() {
    this.cleanUpGoogletag();
    this.unlock_();
    this.params_.onCancel?.();
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_CLOSE,
      /* isFromUserAction */ true
    );
    this.triggerRewardedAdOnResultCallback(
      /* rendered */ true,
      /* rewardGranted */ false
    );
  }

  private supportRewardedAdWall_() {
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_SUPPORT,
      /* isFromUserAction */ true
    );
    this.params_.onCancel?.();
    this.unlock_();
    this.cleanUpGoogletag();
    if (!!this.params_.onAlternateAction) {
      this.params_.onAlternateAction();
    } else {
      this.params_.monetizationFunction!();
    }
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
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_SIGN_IN,
      /* isFromUserAction */ true
    );
    if (!!this.params_.onSignIn) {
      this.params_.onCancel?.();
      this.unlock_();
      this.cleanUpGoogletag();
      this.params_.onSignIn();
    } else {
      this.deps_.callbacks().triggerLoginRequest({linkRequested: false});
    }
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
      ['previewEnabled', (!!this.params_.shouldRenderPreview).toString()],
    ];

    const url = this.buildEndpointUrl_('getactionconfigurationui', queryParams);
    return await this.fetcher_.fetchCredentialedJson(url);
  }

  private async complete_() {
    if (!!this.params_.shouldRenderPreview) {
      return;
    }
    const swgUserToken = await this.deps_
      .storage()
      .get(StorageKeys.USER_TOKEN, true);
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
    const response = (await this.fetcher_.sendPost(
      url,
      emptyMessage
    )) as unknown as CompleteAudienceActionResponse;
    if (response.updated) {
      this.entitlementsManager_.clear();
      if (response.swgUserToken) {
        await this.deps_
          .storage()
          .set(StorageKeys.USER_TOKEN, response.swgUserToken, true);
      }
      const now = Date.now().toString();
      await this.deps_
        .storage()
        .set(StorageKeys.READ_TIME, now, /*useLocalStorage=*/ false);
      await this.entitlementsManager_.getEntitlements();
    }
    // TODO: mhkawano - else log error
  }

  private lock_() {
    this.doc_.documentElement.appendChild(this.wrapper_);
    setStyle(this.doc_.body, 'overflow', 'hidden');
    this.wrapper_.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(this.wrapper_, {'opacity': '1.0'});
  }

  private unlock_() {
    removeElement(this.wrapper_);
    setStyle(this.doc_.body, 'overflow', '');
  }

  private focusRewardedAds_() {
    (this.prompt_.querySelector('.rewarded-ad-prompt')! as HTMLElement).focus();
  }

  private focusFirst_() {
    const focusable = this.getFocusable_();
    (focusable[1] as HTMLElement).focus();
  }

  private focusLast_() {
    const focusable = this.getFocusable_();
    (focusable[focusable.length - 2] as HTMLElement).focus();
  }

  private getFocusable_() {
    return this.wrapper_!.shadowRoot!.querySelectorAll(
      'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
    );
  }

  private getFocusableInput_() {
    return this.wrapper_!.shadowRoot!.querySelectorAll('input, textarea');
  }

  async start() {
    await this.initPrompt_();
  }

  private getCloseButtonOrEmptyHtml_(html: string) {
    const language = this.clientConfigManager_.getLanguage();
    if (!this.params_.isClosable) {
      if (this.params_.action === InterventionType.TYPE_NEWSLETTER_SIGNUP) {
        return '';
      }
      const backToHomeText = msg(
        SWG_I18N_STRINGS['BACK_TO_HOMEPAGE'],
        language
      )!;
      return BACK_TO_HOME_HTML.replace(
        '$BACK_TO_HOME_TEXT$',
        backToHomeText
      ).replace(
        '$BACK_TO_HOME_LINK$',
        parseUrl(this.deps_.win().location.href).origin
      );
    } else {
      const closeButtonDescription = msg(
        SWG_I18N_STRINGS['CLOSE_BUTTON_DESCRIPTION'],
        language
      )!;
      return html.replace('$CLOSE_BUTTON_DESCRIPTION$', closeButtonDescription);
    }
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
    if (this.params_.action === InterventionType.TYPE_REWARDED_AD) {
      this.closeRewardedAdWall_();
    } else if (
      this.params_.action === InterventionType.TYPE_NEWSLETTER_SIGNUP
    ) {
      this.closeOptInPrompt_();
    }
  }

  private cleanUpGoogletag() {
    const googletag = this.deps_.win().googletag;
    if (this.rewardedSlot_) {
      googletag?.destroySlots?.([this.rewardedSlot_!]);
    }
    const pubads = googletag?.pubads?.();
    pubads?.removeEventListener?.(
      'rewardedSlotReady',
      this.rewardedSlotReadyHandler
    );
    pubads?.removeEventListener?.(
      'rewardedSlotClosed',
      this.rewardedSlotClosedHandler
    );
    pubads?.removeEventListener?.(
      'rewardedSlotGranted',
      this.rewardedSlotGrantedHandler
    );
    pubads?.removeEventListener?.(
      'slotRenderEnded',
      this.slotRenderEndedHandler
    );
  }

  private triggerRewardedAdOnResultCallback(
    rendered: boolean,
    rewardGranted: boolean,
    reward?: number,
    type?: string
  ) {
    this.params_.onResult?.({
      configurationId: this.params_.configurationId,
      data: {
        rendered,
        rewardGranted,
        reward,
        type,
      },
    });
  }
}
