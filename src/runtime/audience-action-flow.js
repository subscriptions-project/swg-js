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
import {Constants} from '../utils/constants';
import {EntitlementsResponse} from '../proto/api_messages';
import {feArgs, feUrl} from './services';
import {parseUrl} from '../utils/url';

/**
 * @typedef {{
 *  action: (string|undefined),
 *  fallback: (function()|undefined)
 * }}
 */
export let AudienceActionParams;

const actionToIframeMapping = {
  'TYPE_REGISTRATION_WALL': '/regwalliframe',
  'TYPE_NEWSLETTER_SIGNUP': '/newsletteriframe',
};

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

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!./entitlements-manager.EntitlementsManager} */
    this.entitlementsManager_ = deps.entitlementsManager();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      deps.win(),
      deps.activities(),
      this.getUrl_(deps.pageConfig(), deps.win()),
      feArgs({
        'supportsEventManager': true,
        'isClosable': true,
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

    this.activityIframeView_.on(
      EntitlementsResponse,
      this.handleEntitlementsResponse_.bind(this)
    );

    const {fallback} = this.params_;
    if (fallback) {
      /**
       * For a subscription publication, we need to show
       * what would have been the original prompt if the
       * user indicated they do not want to complete an action.
       */
      this.activityIframeView_.onCancel(fallback);
    }

    return this.dialogManager_.openView(this.activityIframeView_);
  }

  /**
   * Builds a URL to access the appropriate iframe path
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {!Window} win
   * @private
   * @return {string}
   */
  getUrl_(pageConfig, win) {
    const path = actionToIframeMapping[this.params_.action];

    return feUrl(path, {
      'publicationId': pageConfig.getPublicationId(),
      'origin': parseUrl(win.location.href).origin,
    });
  }

  /**
   * On a successful response from the dialog, we should:
   * 1) Store the updated user token
   * 2) Clear existing entitlements from the page
   * 3) Re-fetch entitlements which may potentially provide access to the page
   * @param {EntitlementsResponse} response
   * @private
   */
  handleEntitlementsResponse_(response) {
    this.dialogManager_.completeView(this.activityIframeView_);
    this.entitlementsManager_.clear();
    const userToken = response.getSwgUserToken();
    if (userToken) {
      this.deps_.storage().set(Constants.USER_TOKEN, userToken, true);
    }
    this.entitlementsManager_.getEntitlements();
  }
}
