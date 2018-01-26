/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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
          'publicationId': deps.pageConfig().getPublicationId(),
          'label': deps.pageConfig().getLabel(),
        });

    PayCompleteFlow.configurePending(this.deps_);
  }

  /**
   * Starts the offers flow.
   * @return {!Promise}
   */
  start() {
    // If result is due to OfferSelection, redirect to payments.
    this.activityIframeView_.acceptResult().then(result => {
      if (result.ok && result.originVerified && result.secureChannel) {
        const skuId = result.data && result.data['skuId'] || '';
        if (skuId) {
          return new PayStartFlow(this.deps_, skuId).start();
        } else {
          throw new Error('Missing skuId!');
        }
      }
    });
    return this.dialogManager_.openView(this.activityIframeView_);
  }
}
