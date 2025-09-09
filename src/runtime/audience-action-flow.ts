/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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
 *
 * An audience action flow will show a dialog prompt to a reader, asking them
 * to complete an action for potentially free, additional metered entitlements.
 *
 * An action flow can potentially assign a new user token so if we complete one,
 * we should:
 * 1) Store the new user token
 * 2) Clear any existing entitlements stored on the page
 * 3) Re-fetch entitlements which may potentially provide access to the page
 * 4) Close the prompt that initiated the flow.
 */

import {ActionToIframeMapping, parseUrl} from '../utils/url';
import {ActivityIframeView} from '../ui/activity-iframe-view';
import {
  AlreadySubscribedResponse,
  AnalyticsEvent,
  CompleteAudienceActionResponse,
  CtaMode,
  EntitlementsResponse,
  RewardedAdAlternateActionRequest,
  RewardedAdLoadAdRequest,
  RewardedAdLoadAdResponse,
  RewardedAdViewAdRequest,
  SurveyDataTransferRequest,
} from '../proto/api_messages';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfigManager} from './client-config-manager';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {EntitlementsManager} from './entitlements-manager';
import {I18N_STRINGS} from '../i18n/strings';
import {InterventionResult} from '../api/available-intervention';
import {InterventionType} from '../api/intervention-type';
import {Message} from '../proto/api_messages';
import {ProductType} from '../api/subscriptions';
import {PromptPreference} from './intervention';
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';
import {addQueryParam} from '../utils/url';
import {feArgs, feUrl} from './services';
import {getQueryParam} from '../utils/url';
import {handleSurveyDataTransferRequest} from '../utils/survey-utils';
import {msg} from '../utils/i18n';
import {serviceUrl} from './services';
import {setImportantStyles} from '../utils/style';
import {showAlreadyOptedInToast} from '../utils/cta-utils';

export interface AudienceActionFlow {
  start: () => Promise<void>;
  showNoEntitlementFoundToast: () => void;
}

const TIMEOUT_MS = 5000;

const AUDIENCE_ACTION_TYPES_VALUES = [
  InterventionType.TYPE_BYO_CTA,
  InterventionType.TYPE_REGISTRATION_WALL,
  InterventionType.TYPE_NEWSLETTER_SIGNUP,
  InterventionType.TYPE_REWARDED_AD,
  InterventionType.TYPE_REWARDED_SURVEY,
] as const;

export type AudienceActionType = (typeof AUDIENCE_ACTION_TYPES_VALUES)[number];

const values = AUDIENCE_ACTION_TYPES_VALUES as ReadonlyArray<InterventionType>;

export function isAudienceActionType(
  actionType: InterventionType
): actionType is AudienceActionType {
  return values.includes(actionType);
}

export interface AudienceActionIframeParams {
  action: AudienceActionType;
  configurationId?: string;
  preference?: PromptPreference;
  onCancel?: () => void;
  autoPromptType?: AutoPromptType;
  onResult?: (result: InterventionResult) => Promise<boolean> | boolean;
  isClosable?: boolean;
  calledManually: boolean;
  shouldRenderPreview?: boolean;
  suppressToast?: boolean;
  onAlternateAction?: () => void;
  onSignIn?: () => void;
}

const autopromptTypeToProductTypeMapping: {
  [key in AutoPromptType]?: ProductType;
} = {
  [AutoPromptType.SUBSCRIPTION]: ProductType.SUBSCRIPTION,
  [AutoPromptType.SUBSCRIPTION_LARGE]: ProductType.SUBSCRIPTION,
  [AutoPromptType.CONTRIBUTION]: ProductType.UI_CONTRIBUTION,
  [AutoPromptType.CONTRIBUTION_LARGE]: ProductType.UI_CONTRIBUTION,
};

const DEFAULT_PRODUCT_TYPE = ProductType.SUBSCRIPTION;

const placeholderPatternForEmail = /<ph name="EMAIL".+?\/ph>/g;

interface DirectCompleteAudienceActionResponse {
  updated?: boolean;
  alreadyCompleted?: boolean;
  swgUserToken?: string;
}

/**
 * The flow to initiate and manage handling an audience action.
 */
export class AudienceActionIframeFlow implements AudienceActionFlow {
  private readonly productType_: ProductType;
  private readonly dialogManager_: DialogManager;
  private readonly entitlementsManager_: EntitlementsManager;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly activityIframeView_: ActivityIframeView;
  private readonly fetcher: XhrFetcher;
  private showRewardedAd?: () => void;
  private disposeAd?: () => void;
  private rewardedAdSlot?: googletag.Slot;
  private rewardedAdTimeout?: NodeJS.Timeout;
  private readonly rewardedSlotReadyHandler;
  private readonly rewardedSlotClosedHandler;
  private readonly rewardedSlotGrantedHandler;
  private readonly slotRenderEndedHandler;

  constructor(
    private readonly deps_: Deps,
    private readonly params_: AudienceActionIframeParams
  ) {
    this.productType_ = params_.autoPromptType
      ? autopromptTypeToProductTypeMapping[params_.autoPromptType]!
      : DEFAULT_PRODUCT_TYPE;

    this.dialogManager_ = deps_.dialogManager();

    this.entitlementsManager_ = deps_.entitlementsManager();

    this.clientConfigManager_ = deps_.clientConfigManager();

    this.fetcher = new XhrFetcher(deps_.win());

    this.rewardedSlotReadyHandler = this.rewardedSlotReady.bind(this);
    this.rewardedSlotClosedHandler = this.rewardedSlotClosed.bind(this);
    this.rewardedSlotGrantedHandler = this.rewardedSlotGranted.bind(this);
    this.slotRenderEndedHandler = this.slotRenderEnded.bind(this);

    const iframeParams: {[key: string]: string} = {
      'origin': parseUrl(deps_.win().location.href).origin,
      'configurationId': this.params_.configurationId || '',
      'isClosable': (!!params_.isClosable).toString(),
      'calledManually': params_.calledManually.toString(),
      'previewEnabled': (!!params_.shouldRenderPreview).toString(),
    };
    if (this.clientConfigManager_.shouldForceLangInIframes()) {
      iframeParams['hl'] = this.clientConfigManager_.getLanguage();
    }
    if (this.params_.onAlternateAction) {
      iframeParams['onaa'] = 'true';
    }
    if (this.params_.onSignIn) {
      iframeParams['onsi'] = 'true';
    }
    this.activityIframeView_ = new ActivityIframeView(
      deps_.win(),
      deps_.activities(),
      feUrl(ActionToIframeMapping[params_.action], iframeParams),
      feArgs({
        'supportsEventManager': true,
        'productType': this.productType_,
        'windowHeight': deps_.win()./* OK */ innerHeight,
      }),
      /* titleLang */ this.clientConfigManager_.getLanguage(),
      /* shouldFadeBody */ true
    );
    // Disables interaction with prompt if rendering for preview.
    if (
      !!params_.shouldRenderPreview &&
      params_.action !== InterventionType.TYPE_BYO_CTA
    ) {
      setImportantStyles(this.activityIframeView_.getElement(), {
        'pointer-events': 'none',
      });
    }
  }

  /**
   * Starts the flow for the suggested audience action.
   */
  start(): Promise<void> {
    this.activityIframeView_.on(CompleteAudienceActionResponse, (response) =>
      this.handleCompleteAudienceActionResponse_(response)
    );

    this.activityIframeView_.on(SurveyDataTransferRequest, (request) =>
      handleSurveyDataTransferRequest(
        request,
        this.deps_,
        this.activityIframeView_,
        this.params_.configurationId!,
        CtaMode.CTA_MODE_POPUP,
        this.params_.onResult
      )
    );

    this.activityIframeView_.on(
      AlreadySubscribedResponse,
      this.handleLinkRequest_.bind(this)
    );

    this.activityIframeView_.on(
      RewardedAdLoadAdRequest,
      this.handleRewardedAdLoadAdRequest.bind(this)
    );

    this.activityIframeView_.on(
      RewardedAdViewAdRequest,
      this.handleRewardedAdViewAdRequest.bind(this)
    );

    this.activityIframeView_.on(
      RewardedAdAlternateActionRequest,
      this.handleRewardedAdAlternateActionRequest.bind(this)
    );

    this.activityIframeView_.onCancel(() => {
      this.params_.onCancel?.();
      this.cleanUpGoogletag();
      this.disposeAd?.();
    });

    return this.dialogManager_.openView(
      this.activityIframeView_,
      /* hidden */ false,
      /* dialogConfig */ {
        shouldDisableBodyScrolling: true,
        closeOnBackgroundClick: !!this.params_.isClosable,
      }
    );
  }

  /**
   * On a successful response from the dialog, we should:
   * 1) Store the updated user token
   * 2) Clear existing entitlements from the page
   * 3) Update READ_TIME in local storage to indicate that entitlements may have changed recently
   * 4) Re-fetch entitlements which may potentially provide access to the page
   */
  private async handleCompleteAudienceActionResponse_(
    response: CompleteAudienceActionResponse
  ) {
    const {onResult, configurationId} = this.params_;
    this.dialogManager_.completeView(this.activityIframeView_);
    const userToken = response.getSwgUserToken();
    await this.updateEntitlements(userToken);
    if (this.isOptIn(this.params_.action) && onResult) {
      onResult({
        configurationId,
        data: {
          email: response.getUserEmail(),
          displayName: response.getDisplayName(),
          givenName: response.getGivenName(),
          familyName: response.getFamilyName(),
          termsAndConditionsConsent: response.getTermsAndConditionsConsent(),
        },
      });
    }

    if (!this.params_.suppressToast) {
      if (response.getActionCompleted()) {
        this.showSignedInToast_(response.getUserEmail() ?? '');
      } else if (response.getAlreadyCompleted()) {
        showAlreadyOptedInToast(
          this.params_.action,
          this.clientConfigManager_.getLanguage(),
          this.deps_
        );
      } else {
        this.showFailedOptedInToast_();
      }
    }
  }

  private showSignedInToast_(userEmail: string): void {
    const lang = this.clientConfigManager_.getLanguage();
    let customText = '';
    switch (this.params_.action) {
      case InterventionType.TYPE_REGISTRATION_WALL:
        customText = msg(I18N_STRINGS.REGWALL_ACCOUNT_CREATED, lang).replace(
          placeholderPatternForEmail,
          userEmail
        );
        break;
      case InterventionType.TYPE_NEWSLETTER_SIGNUP:
        customText = msg(I18N_STRINGS.NEWSLETTER_SIGNED_UP, lang).replace(
          placeholderPatternForEmail,
          userEmail
        );
        break;
      default:
        // Do not show toast for other types.
        return;
    }
    new Toast(
      this.deps_,
      feUrl('/toastiframe', {
        flavor: 'custom',
        customText,
      })
    ).open();
  }

  private isOptIn(action: string): boolean {
    return (
      action === InterventionType.TYPE_NEWSLETTER_SIGNUP ||
      action === InterventionType.TYPE_REGISTRATION_WALL
    );
  }

  private showFailedOptedInToast_(): void {
    const lang = this.clientConfigManager_.getLanguage();
    let customText = '';
    switch (this.params_.action) {
      case InterventionType.TYPE_REGISTRATION_WALL:
        customText = msg(I18N_STRINGS.REGWALL_REGISTER_FAILED, lang);
        break;
      case InterventionType.TYPE_NEWSLETTER_SIGNUP:
        customText = msg(I18N_STRINGS.NEWSLETTER_SIGN_UP_FAILED, lang);
        break;
      default:
        // Do not show toast for other types.
        return;
    }

    new Toast(
      this.deps_,
      feUrl('/toastiframe', {
        flavor: 'custom',
        customText,
      })
    ).open();
  }

  private handleLinkRequest_(response: AlreadySubscribedResponse): void {
    if (this.params_.onSignIn) {
      this.params_.onSignIn();
    } else if (response.getSubscriberOrMember()) {
      this.deps_.callbacks().triggerLoginRequest({linkRequested: false});
    }
  }

  private handleRewardedAdLoadAdRequest(request: RewardedAdLoadAdRequest) {
    if (
      this.params_.preference ===
      PromptPreference.PREFERENCE_ADSENSE_REWARDED_AD
    ) {
      const adsbygoogle = this.deps_.win().adsbygoogle;
      if (!adsbygoogle) {
        this.deps_
          .eventManager()
          .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_ADSENSE_MISSING_ERROR);
        this.sendRewardedAdLoadAdResponse(false);
        return;
      }
      adsbygoogle?.push({
        params: {
          'google_adtest': getQueryParam('google_adtest', this.deps_),
          'google_tag_origin': 'rrm',
          'google_reactive_ad_format': 11,
          'google_wrap_fullscreen_ad': true,
          'google_video_play_muted': false,
          'google_acr': this.showASRewardedAd.bind(this),
        },
      });
    } else {
      const googletag = this.deps_.win().googletag;
      if (!googletag) {
        this.deps_
          .eventManager()
          .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_GPT_MISSING_ERROR);
        this.sendRewardedAdLoadAdResponse(false);
        return;
      }
      googletag.cmd.push(() => this.setUpRewardedAd(request.getAdUnit()));
    }

    this.rewardedAdTimeout = setTimeout(
      this.handleRewardedAdLoadAdRequestTimeout.bind(this),
      TIMEOUT_MS
    );
  }

  private handleRewardedAdLoadAdRequestTimeout() {
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_GPT_ERROR);
    this.sendRewardedAdLoadAdResponse(false);
  }

  private showASRewardedAd(rewardedAd?: {
    show?: CallableFunction;
    disposeAd?: () => void;
  }) {
    clearTimeout(this.rewardedAdTimeout);
    if (!rewardedAd?.show) {
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_NOT_FILLED);
      this.sendRewardedAdLoadAdResponse(false);
    }
    this.showRewardedAd = () =>
      rewardedAd!.show!(this.handleASRewardedAdResult.bind(this));
    this.disposeAd = rewardedAd?.disposeAd;
    this.sendRewardedAdLoadAdResponse(true);
  }

  private async handleASRewardedAdResult(result: {
    status?: string;
    reward?: {type?: string; amount?: number};
  }) {
    if (result.status === 'viewed') {
      await this.rewardedAdGrant(result?.reward?.amount, result?.reward?.type);
    } else {
      this.rewardedSlotClosed();
    }
  }

  private setUpRewardedAd(adunit: string | null) {
    const googletag = this.deps_.win().googletag;
    this.rewardedAdSlot = googletag.defineOutOfPageSlot(
      adunit!,
      googletag.enums.OutOfPageFormat.REWARDED
    );
    if (!this.rewardedAdSlot) {
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_PAGE_ERROR);
      this.sendRewardedAdLoadAdResponse(false);
      return;
    }
    const pubads = googletag.pubads();
    this.rewardedAdSlot.addService(pubads);
    pubads.addEventListener('rewardedSlotReady', this.rewardedSlotReadyHandler);
    pubads.addEventListener(
      'rewardedSlotClosed',
      this.rewardedSlotClosedHandler
    );
    pubads.addEventListener(
      'rewardedSlotGranted',
      this.rewardedSlotGrantedHandler
    );
    pubads.addEventListener('slotRenderEnded', this.slotRenderEndedHandler);
    googletag.enableServices();
    googletag.display(this.rewardedAdSlot);
    pubads.refresh([this.rewardedAdSlot]);
  }

  private rewardedSlotReady(
    rewardedAd: googletag.events.RewardedSlotReadyEvent
  ) {
    clearTimeout(this.rewardedAdTimeout);
    this.showRewardedAd = rewardedAd.makeRewardedVisible;
    this.sendRewardedAdLoadAdResponse(true);
  }

  private rewardedSlotClosed() {
    this.cleanUpGoogletag();
    this.deps_
      .eventManager()
      .logSwgEvent(
        AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD,
        /* isFromUserAction */ true
      );
    if (this.params_.onAlternateAction) {
      this.params_.onAlternateAction();
    }
    this.dialogManager_.completeView(this.activityIframeView_);
    this.params_.onResult?.({
      configurationId: this.params_.configurationId,
      data: {
        rendered: true,
        rewardGranted: false,
      },
    });
  }

  private async rewardedSlotGranted(
    event?: googletag.events.RewardedSlotGrantedEvent
  ) {
    this.cleanUpGoogletag();
    await this.rewardedAdGrant(event?.payload?.amount, event?.payload?.type);
  }

  private async rewardedAdGrant(amount?: number, type?: string) {
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_GRANTED);
    this.params_.onResult?.({
      configurationId: this.params_.configurationId,
      data: {
        rendered: true,
        rewardGranted: true,
        reward: amount,
        type,
      },
    });
    this.dialogManager_.completeView(this.activityIframeView_);
    await this.completeAudienceAction();
  }

  private slotRenderEnded(event: googletag.events.SlotRenderEndedEvent) {
    if (event.slot === this.rewardedAdSlot && event.isEmpty) {
      clearTimeout(this.rewardedAdTimeout);
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_NOT_FILLED);
      this.sendRewardedAdLoadAdResponse(false);
    }
  }

  private sendRewardedAdLoadAdResponse(success: boolean) {
    const response = new RewardedAdLoadAdResponse();
    response.setSuccess(success);
    this.activityIframeView_.execute(response);
    if (!success) {
      this.params_.onResult?.({
        configurationId: this.params_.configurationId,
        data: {
          rendered: false,
          rewardGranted: false,
        },
      });
    }
  }

  private handleRewardedAdViewAdRequest() {
    this.showRewardedAd?.();
  }

  private handleRewardedAdAlternateActionRequest() {
    if (this.params_.onAlternateAction) {
      this.params_.onAlternateAction();
    }
  }

  private cleanUpGoogletag() {
    const googletag = this.deps_.win().googletag;
    if (this.rewardedAdSlot) {
      googletag?.destroySlots?.([this.rewardedAdSlot]);
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

  private async completeAudienceAction() {
    const swgUserToken = await this.deps_
      .storage()
      .get(StorageKeys.USER_TOKEN, true);
    const queryParams = [
      ['sut', swgUserToken!],
      ['configurationId', this.params_.configurationId!],
      ['audienceActionType', this.params_.action],
    ];
    const publicationId = this.deps_.pageConfig().getPublicationId();
    const baseUrl = `/publication/${encodeURIComponent(
      publicationId
    )}/completeaudienceaction`;
    const url = queryParams.reduce(
      (url, [param, value]) => addQueryParam(url, param, value),
      serviceUrl(baseUrl)
    );

    // Empty message send as part of the post.
    const emptyMessage: Message = {
      toArray: () => [],
      label: String,
    };
    const response = (await this.fetcher.sendPost(
      url,
      emptyMessage
    )) as unknown as DirectCompleteAudienceActionResponse;
    if (response.updated) {
      await this.updateEntitlements(response.swgUserToken);
    }
    // TODO: mhkawano - else log error
  }

  private async updateEntitlements(swgUserToken?: string | null) {
    this.entitlementsManager_.clear();
    if (swgUserToken) {
      await this.deps_
        .storage()
        .set(StorageKeys.USER_TOKEN, swgUserToken, true);
    }
    const now = Date.now().toString();
    await this.deps_
      .storage()
      .set(StorageKeys.READ_TIME, now, /*useLocalStorage=*/ false);
    await this.entitlementsManager_.getEntitlements();
  }

  /**
   * Shows the toast of 'no entitlement found' on activity iFrame view.
   */
  showNoEntitlementFoundToast(): void {
    this.activityIframeView_.execute(new EntitlementsResponse());
  }
}
