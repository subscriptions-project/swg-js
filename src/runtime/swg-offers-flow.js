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
import {PayStartFlow} from './pay-flow';
import {SubscriptionFlows} from '../api/subscriptions';
import {feArgs, feUrl} from './services';

/**
 * The class for Offers flow.
 */
export class SwgOffersFlow {

  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.OffersRequest|undefined} options
   */
  constructor(deps, options) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    let isClosable = options && options.isClosable;
    if (isClosable == undefined) {
      isClosable = false;  // Default is to hide Close button.
    }

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/offersiframe'),
        feArgs({
          'productId': deps.pageConfig().getProductId(),
          'publicationId': deps.pageConfig().getPublicationId(),
          'showNative': deps.callbacks().hasSubscribeRequestCallback(),
          'list': options && options.list || 'default',
          'skus': options && options.skus || null,
          'isClosable': isClosable,
        }),
        /* shouldFadeBody */ true);
  }

  /**
   * Starts the offers flow or alreadySubscribed flow.
   * @return {!Promise}
   */
  start() {
    // Start/cancel events.
    this.deps_.callbacks().triggerFlowStarted(
        SubscriptionFlows.SHOW_OFFERS);
    this.activityIframeView_.onCancel(() => {
      this.deps_.callbacks().triggerFlowCanceled(
          SubscriptionFlows.SHOW_OFFERS);
    });

    // If result is due to OfferSelection, redirect to payments.
    this.activityIframeView_.onMessage(result => {
      if (result['alreadySubscribed']) {
        this.deps_.callbacks().triggerLoginRequest({
          linkRequested: !!result['linkRequested'],
        });
        return;
      }
      if (result['sku']) {
        new PayStartFlow(
            this.deps_,
            /** @type {string} */ (result['sku']))
            .start();
        return;
      }
      if (result['native']) {
        this.deps_.callbacks().triggerSubscribeRequest();
        return;
      }
    });

    return this.dialogManager_.openView(this.activityIframeView_);
  }
}
