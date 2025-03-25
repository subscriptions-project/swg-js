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

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {
  AlreadySubscribedResponse,
  AnalyticsEvent,
  CompleteAudienceActionResponse,
  EntitlementsResponse,
  EventOriginator,
  SurveyDataTransferRequest,
  SurveyDataTransferResponse,
} from '../proto/api_messages';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfigManager} from './client-config-manager';
import {
  Constants,
  StorageKeys,
  StorageKeysWithoutPublicationIdSuffix,
} from '../utils/constants';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {EntitlementsManager} from './entitlements-manager';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {InterventionResult} from '../api/available-intervention';
import {ProductType} from '../api/subscriptions';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Storage} from './storage';
import {Toast} from '../ui/toast';
import {feArgs, feUrl} from './services';
import {msg} from '../utils/i18n';
import {parseUrl} from '../utils/url';
import {setImportantStyles} from '../utils/style';
import {warn} from '../utils/log';

export interface AudienceActionFlow {
  start: () => Promise<void>;
  showNoEntitlementFoundToast: () => void;
}

export interface AudienceActionIframeParams {
  action: string;
  configurationId?: string;
  onCancel?: () => void;
  autoPromptType?: AutoPromptType;
  onResult?: (result: InterventionResult) => Promise<boolean> | boolean;
  isClosable?: boolean;
  calledManually: boolean;
  shouldRenderPreview?: boolean;
  suppressToast?: boolean;
}

// TODO: mhkawano - replace these consts in the project with these
// Action types returned by the article endpoint
export const TYPE_REGISTRATION_WALL = 'TYPE_REGISTRATION_WALL';
export const TYPE_NEWSLETTER_SIGNUP = 'TYPE_NEWSLETTER_SIGNUP';
export const TYPE_REWARDED_SURVEY = 'TYPE_REWARDED_SURVEY';
export const TYPE_REWARDED_AD = 'TYPE_REWARDED_AD';
export const TYPE_BYO_CTA = 'TYPE_BYO_CTA';

const actionToIframeMapping: {[key: string]: string} = {
  TYPE_REGISTRATION_WALL: '/regwalliframe',
  TYPE_NEWSLETTER_SIGNUP: '/newsletteriframe',
  TYPE_REWARDED_SURVEY: '/surveyiframe',
  TYPE_BYO_CTA: '/byoctaiframe',
};

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

/**
 * The flow to initiate and manage handling an audience action.
 */
export class AudienceActionIframeFlow implements AudienceActionFlow {
  private readonly productType_: ProductType;
  private readonly dialogManager_: DialogManager;
  private readonly entitlementsManager_: EntitlementsManager;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly storage_: Storage;
  private readonly activityIframeView_: ActivityIframeView;

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

    this.storage_ = deps_.storage();

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
    this.activityIframeView_ = new ActivityIframeView(
      deps_.win(),
      deps_.activities(),
      feUrl(actionToIframeMapping[params_.action], iframeParams),
      feArgs({
        'supportsEventManager': true,
        'productType': this.productType_,
        'windowHeight': deps_.win()./* OK */ innerHeight,
      }),
      /* shouldFadeBody */ true
    );
    // Disables interaction with prompt if rendering for preview.
    if (!!params_.shouldRenderPreview && params_.action !== TYPE_BYO_CTA) {
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
      this.handleSurveyDataTransferRequest_(request)
    );

    this.activityIframeView_.on(
      AlreadySubscribedResponse,
      this.handleLinkRequest_.bind(this)
    );

    const {onCancel} = this.params_;
    if (onCancel) {
      this.activityIframeView_.onCancel(onCancel);
    }

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
  private handleCompleteAudienceActionResponse_(
    response: CompleteAudienceActionResponse
  ): void {
    const {onResult, configurationId} = this.params_;
    this.dialogManager_.completeView(this.activityIframeView_);
    this.entitlementsManager_.clear();
    const userToken = response.getSwgUserToken();
    if (userToken) {
      this.deps_.storage().set(StorageKeys.USER_TOKEN, userToken, true);
    }
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
        this.showAlreadyOptedInToast_();
      } else {
        this.showFailedOptedInToast_();
      }
    }
    const now = Date.now().toString();
    this.deps_
      .storage()
      .set(StorageKeys.READ_TIME, now, /*useLocalStorage=*/ false);
    this.entitlementsManager_.getEntitlements();
  }

  private showSignedInToast_(userEmail: string): void {
    const lang = this.clientConfigManager_.getLanguage();
    let customText = '';
    switch (this.params_.action) {
      case 'TYPE_REGISTRATION_WALL':
        customText = msg(
          SWG_I18N_STRINGS.REGWALL_ACCOUNT_CREATED_LANG_MAP,
          lang
        )!.replace(placeholderPatternForEmail, userEmail);
        break;
      case 'TYPE_NEWSLETTER_SIGNUP':
        customText = msg(
          SWG_I18N_STRINGS.NEWSLETTER_SIGNED_UP_LANG_MAP,
          lang
        )!.replace(placeholderPatternForEmail, userEmail);
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
      action === TYPE_NEWSLETTER_SIGNUP || action === TYPE_REGISTRATION_WALL
    );
  }

  private showAlreadyOptedInToast_(): void {
    let urlParams;
    switch (this.params_.action) {
      case 'TYPE_REGISTRATION_WALL':
        // Show 'Signed in as abc@gmail.com' toast on the pub page.
        urlParams = {
          flavor: 'basic',
        };
        break;
      case 'TYPE_NEWSLETTER_SIGNUP':
        const lang = this.clientConfigManager_.getLanguage();
        const customText = msg(
          SWG_I18N_STRINGS.NEWSLETTER_ALREADY_SIGNED_UP_LANG_MAP,
          lang
        )!;
        urlParams = {
          flavor: 'custom',
          customText,
        };
        break;
      default:
        // Do not show toast for other types.
        return;
    }
    new Toast(this.deps_, feUrl('/toastiframe', urlParams)).open();
  }

  private showFailedOptedInToast_(): void {
    const lang = this.clientConfigManager_.getLanguage();
    let customText = '';
    switch (this.params_.action) {
      case 'TYPE_REGISTRATION_WALL':
        customText = msg(
          SWG_I18N_STRINGS.REGWALL_REGISTER_FAILED_LANG_MAP,
          lang
        )!;
        break;
      case 'TYPE_NEWSLETTER_SIGNUP':
        customText = msg(
          SWG_I18N_STRINGS.NEWSLETTER_SIGN_UP_FAILED_LANG_MAP,
          lang
        )!;
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
    if (response.getSubscriberOrMember()) {
      this.deps_.callbacks().triggerLoginRequest({linkRequested: false});
    }
  }

  private async handleSurveyDataTransferRequest_(
    request: SurveyDataTransferRequest
  ): Promise<void> {
    const dataTransferSuccess = await this.attemptSurveyDataTransfer(request);
    if (dataTransferSuccess) {
      this.deps_
        .eventManager()
        .logSwgEvent(
          AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
          /* isFromUserAction */ true
        );
    } else {
      this.deps_
        .eventManager()
        .logSwgEvent(
          AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
          /* isFromUserAction */ false
        );
    }
    const surveyDataTransferResponse = new SurveyDataTransferResponse();
    const isPpsEligible = request.getStorePpsInLocalStorage();

    if (isPpsEligible) {
      await this.storePpsValuesFromSurveyAnswers(request);
    }

    surveyDataTransferResponse.setSuccess(dataTransferSuccess);
    this.activityIframeView_.execute(surveyDataTransferResponse);
  }

  /**
   * Attempts to log survey data.
   */
  private async attemptSurveyDataTransfer(
    request: SurveyDataTransferRequest
  ): Promise<boolean> {
    // @TODO(justinchou): execute callback with setOnInterventionComplete
    // then check for success
    const {onResult} = this.params_;
    if (onResult) {
      try {
        return await onResult({
          configurationId: this.params_.configurationId,
          data: request,
        });
      } catch (e) {
        warn(`[swg.js] Exception in publisher provided logging callback: ${e}`);
        return false;
      }
    }
    return this.logSurveyDataToGoogleAnalytics(request);
  }

  /**
   * Populates localStorage with PPS configuration parameters based on
   * SurveyDataTransferRequest.
   **/
  private async storePpsValuesFromSurveyAnswers(
    request: SurveyDataTransferRequest
  ): Promise<void> {
    const iabAudienceKey = StorageKeysWithoutPublicationIdSuffix.PPS_TAXONOMIES;
    // PPS value field is optional and category may not be populated
    // in accordance to IAB taxonomies.
    const ppsConfigParams = request
      .getSurveyQuestionsList()!
      .flatMap((question) => question.getSurveyAnswersList())
      .map((answer) => answer?.getPpsValue())
      .filter((ppsValue) => ppsValue !== null);

    const existingIabTaxonomy = await this.storage_.get(
      iabAudienceKey,
      /* useLocalStorage= */ true
    );
    let existingIabTaxonomyValues: string[] = [];
    try {
      const parsedExistingIabTaxonomyValues = JSON.parse(
        existingIabTaxonomy!
      )?.[Constants.PPS_AUDIENCE_TAXONOMY_KEY]?.values;
      existingIabTaxonomyValues = Array.isArray(parsedExistingIabTaxonomyValues)
        ? parsedExistingIabTaxonomyValues
        : [];
    } catch (e) {
      // Ignore error since it defaults to empty array.
    }

    const iabTaxonomyValues = Array.from(
      new Set(ppsConfigParams.concat(existingIabTaxonomyValues))
    );
    const iabTaxonomy = {
      [Constants.PPS_AUDIENCE_TAXONOMY_KEY]: {values: iabTaxonomyValues},
    };

    await Promise.resolve(
      this.storage_.set(
        iabAudienceKey,
        JSON.stringify(iabTaxonomy),
        /* useLocalStorage= */ true
      )
    );
    // TODO(caroljli): clearcut event logging
  }

  /*
   * Logs SurveyDataTransferRequest to Google Analytics, which contains payload to surface as dimensions in Google Analytics (GA4, UA, GTM).
   * Returns whether or not logging was successful.
   */
  private logSurveyDataToGoogleAnalytics(
    request: SurveyDataTransferRequest
  ): boolean {
    if (
      !GoogleAnalyticsEventListener.isGaEligible(this.deps_) &&
      !GoogleAnalyticsEventListener.isGtagEligible(this.deps_) &&
      !GoogleAnalyticsEventListener.isGtmEligible(this.deps_)
    ) {
      return false;
    }
    request.getSurveyQuestionsList()?.map((question) => {
      const event = {
        eventType: AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: true,
        additionalParameters: null,
      };
      question.getSurveyAnswersList()?.map((answer) => {
        const eventParams = {
          googleAnalyticsParameters: {
            // Custom dimensions.
            'survey_question': question.getQuestionText() || '',
            'survey_question_category': question.getQuestionCategory() || '',
            'survey_answer': answer.getAnswerText() || '',
            'survey_answer_category': answer.getAnswerCategory() || '',
            // GA4 Default dimensions.
            'content_id': question.getQuestionCategory() || '',
            'content_group': question.getQuestionText() || '',
            'content_type': answer.getAnswerText() || '',
            // UA Default dimensions.
            // TODO(yeongjinoh): Remove default dimensions once beta publishers
            // complete migration to GA4.
            'event_category': question.getQuestionCategory() || '',
            'event_label': answer.getAnswerText() || '',
          },
        };
        this.deps_.eventManager().logEvent(event, eventParams);
      });
    });
    return true;
  }

  /**
   * Shows the toast of 'no entitlement found' on activity iFrame view.
   */
  showNoEntitlementFoundToast(): void {
    this.activityIframeView_.execute(new EntitlementsResponse());
  }
}
