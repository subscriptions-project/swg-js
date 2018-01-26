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
import {Dialog} from '../components/dialog';
import {
  PayStartFlow,
  PayCompleteFlow,
} from './pay-flow';

/**
 * @const {string}
 * TODO(diparikh): Replace correct URL for each env.
 */
const offersUrl = '$frontend$/subscribewithgoogleclientui/offersiframe';

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

    /** @private @const {!Dialog} */
    this.dialog_ = new Dialog(this.win_);

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        offersUrl,
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
      const skuId = (result.data && result.data.skuId) ? result.data.skuId : '';
      if (result.ok && result.originVerified && result.secureChannel
          && skuId != '') {
        return new PayStartFlow(this.deps_, result.data.skuId).start();
      } else {
        throw new Error('Unable to proceed');
      }
    });

    return this.dialog_.open().then(() => {
      return this.dialog_.openView(this.activityIframeView_);
    });
  }
}
