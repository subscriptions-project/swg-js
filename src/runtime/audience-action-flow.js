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
  CompleteAudienceActionResponse,
  EntitlementsResponse,
  SurveyDataTransferRequest,
  SurveyDataTransferResponse,
} from '../proto/api_messages';
import {AutoPromptType} from '../api/basic-subscriptions';
import {Constants} from '../utils/constants';
import {ProductType} from '../api/subscriptions';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Toast} from '../ui/toast';
import {feArgs, feUrl} from './services';
import {msg} from '../utils/i18n';
import {parseUrl} from '../utils/url';

/**
 * @typedef {{
 *  action: (string|undefined),
 *  onCancel: (function()|undefined),
 *  autoPromptType: (AutoPromptType|undefined)
 * }}
 */
export let AudienceActionParams;

const actionToIframeMapping = {
  'TYPE_REGISTRATION_WALL': '/regwalliframe',
  'TYPE_NEWSLETTER_SIGNUP': '/newsletteriframe',
  'TYPE_REWARDED_SURVEY': '/surveyiframe',
};

const autopromptTypeToProductTypeMapping = {
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
export class AudienceActionFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!AudienceActionParams} params
   */
  constructor(deps, params) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!AudienceActionParams} */
    this.params_ = params;

    /** @private @const {!ProductType} */
    this.productType_ = params.autoPromptType
      ? autopromptTypeToProductTypeMapping[params.autoPromptType]
      : DEFAULT_PRODUCT_TYPE;

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!./entitlements-manager.EntitlementsManager} */
    this.entitlementsManager_ = deps.entitlementsManager();

    /** @private @const {?./client-config-manager.ClientConfigManager} */
    this.clientConfigManager_ = deps.clientConfigManager();

    /** @private {?ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      deps.win(),
      deps.activities(),
      feUrl(actionToIframeMapping[this.params_.action], {
        'origin': parseUrl(deps.win().location.href).origin,
      }),
      feArgs({
        'supportsEventManager': true,
        'productType': this.productType_,
      }),
      /* shouldFadeBody */ true
    );
  }

  /**
   * Starts the flow for the suggested audience action.
   * @public
   * @return {!Promise}
   */
  start() {
    if (!this.activityIframeView_) {
      return Promise.resolve();
    }

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
      }
    );
  }

  /**
   * On a successful response from the dialog, we should:
   * 1) Store the updated user token
   * 2) Clear existing entitlements from the page
   * 3) Update READ_TIME in local storage to indicate that entitlements may have changed recently
   * 4) Re-fetch entitlements which may potentially provide access to the page
   * @param {CompleteAudienceActionResponse} response
   * @private
   */
  handleCompleteAudienceActionResponse_(response) {
    this.dialogManager_.completeView(this.activityIframeView_);
    this.entitlementsManager_.clear();
    const userToken = response.getSwgUserToken();
    if (userToken) {
      this.deps_.storage().set(Constants.USER_TOKEN, userToken, true);
    }
    if (response.getActionCompleted()) {
      this.showSignedInToast_(response.getUserEmail() ?? '');
    } else if (response.getAlreadyCompleted()) {
      this.showAlreadyOptedInToast_();
    } else {
      this.showFailedOptedInToast_();
    }
    const now = Date.now().toString();
    this.deps_
      .storage()
      .set(Constants.READ_TIME, now, /*useLocalStorage=*/ false);
    this.entitlementsManager_.getEntitlements();
  }

  /**
   * @param {string} userEmail
   * @private
   */
  showSignedInToast_(userEmail) {
    const lang = this.clientConfigManager_.getLanguage();
    let customText = '';
    if (this.params_.action === 'TYPE_REGISTRATION_WALL') {
      customText = msg(
        SWG_I18N_STRINGS.REGWALL_ACCOUNT_CREATED_LANG_MAP,
        lang
      ).replace(placeholderPatternForEmail, userEmail);
    } else if (this.params_.action === 'TYPE_NEWSLETTER_SIGNUP') {
      customText = msg(
        SWG_I18N_STRINGS.NEWSLETTER_SIGNED_UP_LANG_MAP,
        lang
      ).replace(placeholderPatternForEmail, userEmail);
    }
    new Toast(
      this.deps_,
      feUrl('/toastiframe', {
        flavor: 'custom',
        customText,
      })
    ).open();
  }

  /** @private */
  showAlreadyOptedInToast_() {
    if (this.params_.action === 'TYPE_REGISTRATION_WALL') {
      // Show 'Signed in as abc@gmail.com' toast on the pub page.
      new Toast(
        this.deps_,
        feUrl('/toastiframe', {
          flavor: 'basic',
        })
      ).open();
    } else if (this.params_.action === 'TYPE_NEWSLETTER_SIGNUP') {
      const lang = this.clientConfigManager_.getLanguage();
      const customText = msg(
        SWG_I18N_STRINGS.NEWSLETTER_ALREADY_SIGNED_UP_LANG_MAP,
        lang
      );
      new Toast(
        this.deps_,
        feUrl('/toastiframe', {
          flavor: 'custom',
          customText,
        })
      ).open();
    }
  }

  /** @private */
  showFailedOptedInToast_() {
    const lang = this.clientConfigManager_.getLanguage();
    const customText = msg(
      this.params_.action === 'TYPE_REGISTRATION_WALL'
        ? SWG_I18N_STRINGS.REGWALL_REGISTER_FAILED_LANG_MAP
        : SWG_I18N_STRINGS.NEWSLETTER_SIGN_UP_FAILED_LANG_MAP,
      lang
    );
    new Toast(
      this.deps_,
      feUrl('/toastiframe', {
        flavor: 'custom',
        customText,
      })
    ).open();
  }

  /**
   * @param {AlreadySubscribedResponse} response
   * @private
   */
  handleLinkRequest_(response) {
    if (response.getSubscriberOrMember()) {
      this.deps_.callbacks().triggerLoginRequest({linkRequested: false});
    }
  }

  /**
   * @param {SurveyDataTransferRequest} request
   * @private
   */
  // eslint-disable-next-line no-unused-vars
  handleSurveyDataTransferRequest_(request) {
    // @TODO(justinchou): execute callback with setOnInterventionComplete
    // then check for success
    const gaLoggingSuccess = this.logSurveyDataToGoogleAnalytics(request);
    const surveyDataTransferResponse = new SurveyDataTransferResponse();
    surveyDataTransferResponse.setSuccess(gaLoggingSuccess);
    this.activityIframeView_.execute(surveyDataTransferResponse);
  }

  /**
   * Logs SurveyDataTransferRequest to Google Analytics. Returns boolean
   * for whether or not logging was successful.
   * @param {SurveyDataTransferRequest} request
   * @return {boolean}
   * @private
   */
  logSurveyDataToGoogleAnalytics(request) {
    const gtag = this.deps_.win().gtag;
    if (typeof gtag !== 'function') {
      return false;
    }
    request.getSurveyQuestionsList().map((question) => {
      const answer = question.getSurveyAnswersList()[0];
      gtag('event', 'survey submission', {
        'event_category': 'survey',
        'survey_question_category': question.getQuestionCategory(),
        'survey_question': question.getQuestionText(),
        'survey_answer_category': answer.getAnswerCategory() || null,
        'survey_answer': answer.getAnswerText() || null,
      });
    });
    return true;
  }

  /**
   * Shows the toast of 'no entitlement found' on activity iFrame view.
   * @public
   */
  showNoEntitlementFoundToast() {
    if (this.activityIframeView_) {
      this.activityIframeView_.execute(new EntitlementsResponse());
    }
  }
}
