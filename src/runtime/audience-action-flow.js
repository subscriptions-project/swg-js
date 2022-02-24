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
 *  fallback: (function()|undefined),
 *  autoPromptType: (AutoPromptType|undefined)
 * }}
 */
export let AudienceActionParams;

const actionToIframeMapping = {
  'TYPE_REGISTRATION_WALL': '/regwalliframe',
  'TYPE_NEWSLETTER_SIGNUP': '/newsletteriframe',
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

    /** @private @const {!Promise<?ActivityIframeView>} */
    this.activityIframeViewPromise_ = deps
      .storage()
      .get(Constants.USER_TOKEN, true)
      .then((token) => {
        return new ActivityIframeView(
          deps.win(),
          deps.activities(),
          this.getUrl_(deps.pageConfig(), deps.win(), token),
          feArgs({
            'supportsEventManager': true,
            'productType': this.productType_,
          }),
          /* shouldFadeBody */ true
        );
      });

    /** @private {?ActivityIframeView} */
    this.activityIframeView_ = null;
  }

  /**
   * Starts the flow for the suggested audience action.
   * @public
   * @return {!Promise}
   */
  start() {
    return this.activityIframeViewPromise_.then((activityIframeView) => {
      if (!activityIframeView) {
        return Promise.resolve();
      }

      activityIframeView.on(CompleteAudienceActionResponse, (response) =>
        this.handleCompleteAudienceActionResponse_(response)
      );

      activityIframeView.on(
        AlreadySubscribedResponse,
        this.handleLinkRequest_.bind(this)
      );

      const {fallback} = this.params_;
      if (fallback) {
        /**
         * For a subscription publication, we need to show
         * what would have been the original prompt if the
         * user indicated they do not want to complete an action.
         */
        activityIframeView.onCancel(fallback);
      }

      this.activityIframeView_ = activityIframeView;
      return this.dialogManager_.openView(activityIframeView);
    });
  }

  /**
   * Builds a URL to access the appropriate iframe path
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {!Window} win
   * @param {?string} userToken
   * @private
   * @return {string}
   */
  getUrl_(pageConfig, win, userToken) {
    const path = actionToIframeMapping[this.params_.action];

    return feUrl(path, {
      'publicationId': pageConfig.getPublicationId(),
      'origin': parseUrl(win.location.href).origin,
      'sut': userToken ? userToken : '',
    });
  }

  /**
   * On a successful response from the dialog, we should:
   * 1) Store the updated user token
   * 2) Clear existing entitlements from the page
   * 3) Re-fetch entitlements which may potentially provide access to the page
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
    } else {
      this.showAlreadyOptedInToast_();
    }
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
   * Shows the toast of 'no entitlement found' on activity iFrame view.
   * @public
   */
  showNoEntitlementFoundToast() {
    if (this.activityIframeView_) {
      this.activityIframeView_.execute(new EntitlementsResponse());
    }
  }
}
