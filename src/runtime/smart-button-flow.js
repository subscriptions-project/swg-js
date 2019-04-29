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
import {Theme} from './button-api';
import {OffersFlow} from './offers-flow';
import {SubscriptionFlows} from '../api/subscriptions';
import {feArgs, feUrl} from './services';


/**
 * The class for Offers flow.
 */
export class SmartSubscriptionButtonFlow {

  /**
   * @param {!./deps.DepsDef} deps
   * @param {!Element} container
   * @param {boolean} isReadyToPay
   * @param {!../api/subscriptions.ButtonOptions|undefined} options
   */
  constructor(deps, container, isReadyToPay, options) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!Element} */
    this.container_ = container;

    /** @private @const {boolean} */
    this.isReadyToPay_ = isReadyToPay;

    /** @private @const {string} */
    this.theme_ = options && options.theme || Theme.LIGHT;

    /** @private {boolean} */
    this.isClosable_ = options && options.isClosable || false;
    if (this.isClosable_ == undefined) {
      this.isClosable_ = false;  // Default is to hide Close button.
    }

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/smartboxiframe'),
        feArgs({
          'productId': deps.pageConfig().getProductId(),
          'publicationId': deps.pageConfig().getPublicationId(),
          'isReadyToPay': this.isReadyToPay_,
          'theme': this.theme_,
          'lang': options && options.lang || 'en',
        }),
        /* shouldFadeBody */ false);
  }

  /**
   * Starts the smart button subscription button flow.
   * @return {!Promise}
   */
  start() {
    this.setContainerStyle();

    // Start/cancel events.
    this.deps_.callbacks().triggerFlowStarted(
        SubscriptionFlows.SMART_SUBSCRIPTION_BUTTON);
    this.activityIframeView_.onCancel(() => {
      this.deps_.callbacks().triggerFlowCanceled(
          SubscriptionFlows.SMART_SUBSCRIPTION_BUTTON);
    });

    // If result is due to OfferSelection, redirect to payments.
    this.activityIframeView_.onMessage(result => {
      if (result['viewOffers']) {  // TODO: Change attribute name.
        const options = {
          isClosable: this.isClosable_,
        };
        new OffersFlow(this.deps_, options).start();
        return;
      }
    });
    /**
     * TODO
     * ----
     * Add the newly created "this.activityIframeView_" to "this.container_"
     * Also, need to fetch and pass "isReadyToPay" and "signedIn" flags.
     */

    // Rendering this only for demo/test purpose. This iframe should be rendered
    // directly within "this.container_".
    return this.dialogManager_.openView(
        this.activityIframeView_, /* hidden */ true, this.container_);
  }

  /**
   *
   */
  setContainerStyle() {

    // TODO: For testing purpose only.
    this.container_.style.cssText =
        'height:120px;width:100%;background-color: #fff;position:relative';
  }
}
