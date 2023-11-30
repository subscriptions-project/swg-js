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
import {ArticleExperimentFlags} from './experiment-flags';
import {
  AudienceActionFlow,
  TYPE_NEWSLETTER_SIGNUP,
  TYPE_REWARDED_AD,
} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {
  CONTRIBUTION_ICON,
  ERROR_HTML,
  LOADING_HTML,
  OPT_IN_CLOSE_BUTTON_HTML,
  REWARDED_AD_CLOSE_BUTTON_HTML,
  REWARDED_AD_HTML,
  REWARDED_AD_SIGN_IN_HTML,
  REWARDED_AD_SUPPORT_HTML,
  REWARDED_AD_THANKS_HTML,
  SUBSCRIPTION_ICON,
} from './audience-action-local-ui';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Constants} from '../utils/constants';
import {Deps} from './deps';
import {EntitlementsManager} from './entitlements-manager';
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
import {setStyle} from '../utils/style';

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
// Default re-try count for detecting gpt.js
const DETECT_GPT_RETRIES = 10;
// Default re-try interval for detecting gpt.js
const DETECT_GPT_RETRIES_MS = 500;
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
  private articleExpFlags_?: string[];

  constructor(
    private readonly deps_: Deps,
    private readonly params_: AudienceActionLocalParams,
    private readonly gptTimeoutMs_: number = GPT_TIMEOUT_MS,
    private readonly thanksTimeoutMs_: number = THANKS_TIMEOUT_MS,
    private readonly detectGptRetries_: number = DETECT_GPT_RETRIES,
    private readonly detectGptRetriesMs_: number = DETECT_GPT_RETRIES_MS
  ) {
    this.clientConfigManager_ = deps_.clientConfigManager();

    this.doc_ = deps_.doc().getRootNode();

    this.prompt_ = createElement(this.doc_, 'div', {});

    this.wrapper_ = this.createWrapper_();

    this.fetcher_ = new XhrFetcher(deps_.win());

    this.eventManager_ = deps_.eventManager();

    this.entitlementsManager_ = deps_.entitlementsManager();
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
      'z-index': '2147483647',
    });

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

  private renderErrorView_() {
    // TODO: mhkawano - Make closeable.
    // TODO: mhkawano - Make look nicer.
    this.prompt_./*OK*/ innerHTML = ERROR_HTML;
  }

  private bailoutPrompt_() {
    if (this.params_.isClosable || this.params_.monetizationFunction) {
      if (this.rewardedSlot_) {
        const googletag = this.deps_.win().googletag;
        googletag.destroySlots([this.rewardedSlot_!]);
      }
      this.params_.onCancel?.();
      this.unlock_();
      this.params_.monetizationFunction?.();
    } else {
      this.renderErrorView_();
    }
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
      this.bailoutPrompt_();
    }
  }

  private async initNewsletterSignup_() {
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
    await this.delay_(1000);
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT
    );
    // Close the prompt.
    this.unlock_();
    await this.complete_();
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

  private isSubscription() {
    return (
      this.params_.autoPromptType == AutoPromptType.SUBSCRIPTION ||
      this.params_.autoPromptType == AutoPromptType.SUBSCRIPTION_LARGE
    );
  }

  private isContribution() {
    return (
      this.params_.autoPromptType == AutoPromptType.CONTRIBUTION ||
      this.params_.autoPromptType == AutoPromptType.CONTRIBUTION_LARGE
    );
  }

  private async googletagReady_(): Promise<boolean> {
    if (this.params_.isClosable) {
      return !!this.deps_.win().googletag.apiReady;
    }
    for (let i = 0; i < this.detectGptRetries_; i++) {
      if (this.deps_.win().googletag?.apiReady !== undefined) {
        return this.deps_.win().googletag.apiReady;
      }
      await new Promise((r) => setTimeout(r, this.detectGptRetriesMs_));
    }
    return false;
  }

  private async checkGoogletagAvailable_(): Promise<boolean> {
    const googletagReady = await this.googletagReady_();
    return googletagReady && !!this.deps_.win().googletag?.getVersion();
  }

  private async initRewardedAdWall_() {
    // TODO: mhkawano - Come up with new event for total rewarded ad views.
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

    // Setup callback for googletag init.
    const googletag = this.deps_.win().googletag;
    googletag.cmd.push(() => {
      this.initRewardedAdSlot_(config);
    });

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

  private initRewardedAdSlot_(config: AudienceActionConfig) {
    const googletag = this.deps_.win().googletag;

    this.rewardedSlot_ = googletag.defineOutOfPageSlot(
      config.rewardedAdParameters!.adunit!,
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
    googletag.pubads().refresh([this.rewardedSlot_]);
  }

  /**
   * When gpt.js is ready to show an ad, we replace the loading view and wire up
   * the buttons.
   */
  private rewardedSlotReady_(
    rewardedAd: googletag.events.RewardedSlotReadyEvent,
    config: AudienceActionConfig
  ) {
    clearTimeout(this.rewardedAdTimeout_);
    this.makeRewardedVisible_ = rewardedAd.makeRewardedVisible;

    const isPremonetization = !this.isContribution() && !this.isSubscription();

    // TODO: mhkawnao - Escape user provided strings. For Alpha it will be
    //                  specified by us so we don't need to do it yet.
    // TODO: mhkawnao - Support priority actions
    const language = this.clientConfigManager_.getLanguage();

    // verified existance in initRewardedAdWall_
    const publication = config.publication!.name!;
    const closeHtml = this.getCloseButtonOrEmptyHtml_(
      REWARDED_AD_CLOSE_BUTTON_HTML
    );
    const icon = this.isSubscription() ? SUBSCRIPTION_ICON : CONTRIBUTION_ICON;
    // verified existance in initRewardedAdWall_
    const message = config.rewardedAdParameters!.customMessage!;
    const prioritySwaped = !!this.articleExpFlags_?.includes(
      ArticleExperimentFlags.REWARDED_ADS_PRIORITY_ENABLED
    );
    const viewad = msg(SWG_I18N_STRINGS['VIEW_AN_AD'], language)!;
    const support = this.isContribution()
      ? msg(SWG_I18N_STRINGS['CONTRIBUTE'], language)!
      : msg(SWG_I18N_STRINGS['SUBSCRIBE'], language)!;
    // TODO: mhkawano - make seperate elements for each button variation
    const supportHtml = isPremonetization
      ? ''
      : REWARDED_AD_SUPPORT_HTML.replace(
          '$SUPPORT_MESSAGE$',
          prioritySwaped ? viewad : support
        );

    const signinHtml = isPremonetization
      ? ''
      : REWARDED_AD_SIGN_IN_HTML.replace(
          '$SIGN_IN_MESSAGE$',
          this.isContribution()
            ? msg(SWG_I18N_STRINGS['ALREADY_A_CONTRIBUTOR'], language)!
            : msg(SWG_I18N_STRINGS['ALREADY_A_SUBSCRIBER'], language)!
        );

    this.prompt_./*OK*/ innerHTML = REWARDED_AD_HTML.replace(
      '$TITLE$',
      publication
    )
      .replace('$REWARDED_AD_CLOSE_BUTTON_HTML$', closeHtml)
      .replace('$ICON$', icon)
      .replace('$MESSAGE$', message)
      .replace('$VIEW_AN_AD$', prioritySwaped ? support : viewad)
      .replace('$SUPPORT_BUTTON$', supportHtml)
      .replace('$SIGN_IN_BUTTON$', signinHtml);

    if (prioritySwaped) {
      this.prompt_
        .querySelector('.rewarded-ad-support-button')
        ?.addEventListener('click', this.viewRewardedAdWall_.bind(this));
      this.prompt_
        .querySelector('.rewarded-ad-view-ad-button')
        ?.addEventListener('click', this.supportRewardedAdWall_.bind(this));
    } else {
      this.prompt_
        .querySelector('.rewarded-ad-support-button')
        ?.addEventListener('click', this.supportRewardedAdWall_.bind(this));
      this.prompt_
        .querySelector('.rewarded-ad-view-ad-button')
        ?.addEventListener('click', this.viewRewardedAdWall_.bind(this));
    }
    this.prompt_
      .querySelector('.rewarded-ad-close-button')
      ?.addEventListener('click', this.closeRewardedAdWall_.bind(this));
    this.prompt_
      .querySelector('.rewarded-ad-sign-in-button')
      ?.addEventListener('click', this.signinRewardedAdWall_.bind(this));
    this.focusRewardedAds_();
    // TODO: mhkawano - EVENT_REWARDED_AD_READY and IMPRESSION_REWARDED_AD are redundant.
    this.eventManager_.logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_READY);
    this.eventManager_.logSwgEvent(AnalyticsEvent.IMPRESSION_REWARDED_AD);
  }

  private rewardedSlotClosed_() {
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([this.rewardedSlot_]);
    if (this.params_.isClosable) {
      this.unlock_();
      this.params_.onCancel?.();
    }
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD,
      /* isFromUserAction */ true
    );
  }

  private async rewardedSlotGranted_() {
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
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([this.rewardedSlot_!]);
    this.eventManager_.logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_GRANTED);
    this.focusRewardedAds_();
    await this.complete_();
  }

  private closeRewardedAdWall_() {
    this.unlock_();
    const googletag = this.deps_.win().googletag;
    googletag.destroySlots([this.rewardedSlot_!]);
    this.params_.onCancel?.();
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_REWARDED_AD_CLOSE,
      /* isFromUserAction */ true
    );
  }

  private supportRewardedAdWall_() {
    if (this.params_.isClosable) {
      this.params_.onCancel?.();
    }
    this.unlock_();
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
    const response = (await this.fetcher_.sendPost(
      url,
      emptyMessage
    )) as unknown as CompleteAudienceActionResponse;
    if (response.updated) {
      this.entitlementsManager_.clear();
      if (response.swgUserToken) {
        await this.deps_
          .storage()
          .set(Constants.USER_TOKEN, response.swgUserToken, true);
      }
      const now = Date.now().toString();
      await this.deps_
        .storage()
        .set(Constants.READ_TIME, now, /*useLocalStorage=*/ false);
      await this.entitlementsManager_.getEntitlements();
    }
    // TODO: mhkawano - else log error
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
    const article = await this.entitlementsManager_.getArticle();
    this.articleExpFlags_ =
      this.entitlementsManager_.parseArticleExperimentConfigFlags(article);
    this.renderLoadingView_();
    this.doc_.documentElement.appendChild(this.wrapper_);
    setStyle(this.doc_.body, 'overflow', 'hidden');
    this.wrapper_.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(this.wrapper_, {'opacity': '1.0'});
    await this.initPrompt_();
  }

  private getCloseButtonOrEmptyHtml_(html: string) {
    const initialPromptIsClosable =
      this.params_.action === TYPE_REWARDED_AD &&
      !!this.articleExpFlags_?.includes(
        ArticleExperimentFlags.REWARDED_ADS_ALWAYS_BLOCKING_ENABLED
      );
    if (!this.params_.isClosable || initialPromptIsClosable) {
      return '';
    }
    const language = this.clientConfigManager_.getLanguage();
    const closeButtonDescription = msg(
      SWG_I18N_STRINGS['CLOSE_BUTTON_DESCRIPTION'],
      language
    )!;
    return html.replace('$CLOSE_BUTTON_DESCRIPTION$', closeButtonDescription);
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
    this.unlock_();
    if (this.rewardedSlot_) {
      const googletag = this.deps_.win().googletag;
      googletag.destroySlots([this.rewardedSlot_]);
    }
  }
}
