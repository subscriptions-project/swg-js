/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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
import {
  PayStartFlow,
  PayCompleteFlow,
} from './pay-flow';
import {assert} from '../utils/log';

const OFFERS_URL =
    '$frontend$/subscribewithgoogleclientui/offersiframe$frontendDebug$';


/**
 * The class for Offers flow.
 *
 */
export class OffersFlow {

  /**
   * @param {!../model/deps.DepsDef} deps
   */
  constructor(deps) {

    /** @private @const {!../model/deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!HTMLDocument} */
    this.document_ = this.win_.document;

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        OFFERS_URL,
        {
          'productId': deps.pageConfig().getProductId(),
          'publisherId': deps.pageConfig().getPublisherId(),
          'publicationId': deps.pageConfig().getPublisherId(),  // MIGRATE
          'label': deps.pageConfig().getProductId(),  // MIGRATE
        },
        /* shouldFadeBody */ true
    );

    PayCompleteFlow.configurePending(this.deps_);
  }

  /**
   * Starts the offers flow.
   * @return {!Promise}
   */
  start() {
    // If result is due to OfferSelection, redirect to payments.
    this.activityIframeView_.acceptResult().then(result => {
      this.dialogManager_.completeView(this.activityIframeView_);
      assert(result.secureChannel, 'The channel is not secured');
      const data = result.data;
      if (!data) {
        return;
      }
      if (data['alreadySubscribed']) {
        this.deps_.callbacks().triggerLoginRequest();
        return;
      }
      const skuId = data['sku'] || data['skuId'] || '';
      if (skuId) {
        return new PayStartFlow(this.deps_, skuId).start();
      }
    });
    return this.dialogManager_.openView(this.activityIframeView_);
  }
}
