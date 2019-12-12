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
 */

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {AnalyticsEvent} from '../proto/api_messages';
import {DeferredAccountCreationResponse} from '../api/deferred-account-creation';
import {JwtHelper} from '../utils/jwt';
import {PayCompleteFlow} from './pay-flow';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {SubscriptionFlows} from '../api/subscriptions';
import {UserData} from '../api/user-data';
import {feArgs, feUrl} from './services';
import {isCancelError} from '../utils/errors';

/**
 * The flow to initiate deferred account process.
 * See `Subscriptions.completeDeferredAccountCreation` API.
 */
export class DeferredAccountFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {?../api/deferred-account-creation.DeferredAccountCreationRequest} options
   */
  constructor(deps, options) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private {?ActivityIframeView} */
    this.activityIframeView_ = null;

    /** @private {?Promise} */
    this.openPromise_ = null;

    /** @type {!../api/deferred-account-creation.DeferredAccountCreationRequest} */
    const defaultOptions = {
      entitlements: null,
      consent: true,
    };
    /** @private @const {!../api/deferred-account-creation.DeferredAccountCreationRequest} */
    this.options_ = Object.assign(defaultOptions, options || {});
  }

  /**
   * Starts the deferred account flow.
   * @return {!Promise<!DeferredAccountCreationResponse>}
   */
  start() {
    const entitlements = this.options_.entitlements;

    // For now, entitlements are required to be present and have the Google
    // token. This is strictly not required for the implementation. But it's
    // preferrable API-wise at this time.
    if (!entitlements || !entitlements.getEntitlementForSource('google')) {
      throw new Error('No entitlements with "google" source');
    }

    // Start/cancel events.
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.COMPLETE_DEFERRED_ACCOUNT_CREATION);

    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/recoveriframe'),
      feArgs({
        'publicationId': this.deps_.pageConfig().getPublicationId(),
        'productId': this.deps_.pageConfig().getProductId(),
        'entitlements': (entitlements && entitlements.raw) || null,
        'consent': this.options_.consent,
      }),
      /* shouldFadeBody */ true
    );

    this.openPromise_ = this.dialogManager_.openView(this.activityIframeView_);
    return this.activityIframeView_.acceptResult().then(
      result => {
        // The consent part is complete.
        return this.handleConsentResponse_(
          /** @type {!Object} */ (result.data)
        );
      },
      reason => {
        if (isCancelError(reason)) {
          this.deps_
            .callbacks()
            .triggerFlowCanceled(
              SubscriptionFlows.COMPLETE_DEFERRED_ACCOUNT_CREATION
            );
        } else {
          this.dialogManager_.completeView(this.activityIframeView_);
        }
        throw reason;
      }
    );
  }

  /**
   * @param {!Object} data
   * @return {!DeferredAccountCreationResponse}
   * @private
   */
  handleConsentResponse_(data) {
    this.deps_.entitlementsManager().blockNextNotification();

    // Parse the response.
    const entitlementsJwt = data['entitlements'];
    const idToken = data['idToken'];
    const productType = data['productType'];
    const entitlements = this.deps_
      .entitlementsManager()
      .parseEntitlements({'signedEntitlements': entitlementsJwt});
    const userData = new UserData(
      idToken,
      /** @type {!Object} */ (new JwtHelper().decode(idToken))
    );
    const purchaseDataList = data['purchaseDataList']
      ? data['purchaseDataList'].map(
          pd => new PurchaseData(pd['data'], pd['signature'])
        )
      : [
          // TODO(dvoytenko): cleanup/deprecate.
          new PurchaseData(
            data['purchaseData']['data'],
            data['purchaseData']['signature']
          ),
        ];

    // For now, we'll use the `PayCompleteFlow` as a "creating account" flow.
    // But this can be eventually implemented by the same iframe.
    const creatingFlow = new PayCompleteFlow(this.deps_);
    const completeHandler = creatingFlow.complete.bind(creatingFlow);

    const response = new DeferredAccountCreationResponse(
      entitlements,
      userData,
      purchaseDataList,
      completeHandler
    );

    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.ACTION_NEW_DEFERRED_ACCOUNT, true);

    // Start the "sync" flow.
    creatingFlow.start(
      new SubscribeResponse(
        '', // raw field doesn't matter in this case
        purchaseDataList[0],
        userData,
        entitlements,
        productType,
        () => Promise.resolve() // completeHandler doesn't matter in this case
      )
    );
    return response;
  }
}
