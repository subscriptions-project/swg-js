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
import {SubscribeResponse} from '../api/subscribe-response';
import {acceptPortResult} from '../utils/activity-utils';
import {parseUrl} from '../utils/url';

const PAY_URL =
    '$frontend$/subscribewithgoogleclientui/pay';

const PAY_CONFIRM_IFRAME_URL =
    '$frontend$/subscribewithgoogleclientui/payconfirmiframe';

const PAY_REQUEST_ID = 'swg-pay';


/**
 * The flow to initiate payment process.
 */
export class PayStartFlow {

  /**
   * @param {!../model/deps.DepsDef} deps
   * @param {string} sku
   */
  constructor(deps, sku) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private {string} */
    this.sku_ = sku;
  }

  /**
   * Starts the payments flow.
   * @return {!Promise}
   */
  start() {
    this.activityPorts_.open(
        PAY_REQUEST_ID, PAY_URL, '_blank', {
          // TODO(dvoytenko): confirm and set arguments.
        }, {});
    return Promise.resolve();
  }
}


/**
 * The flow for successful payments completion.
 */
export class PayCompleteFlow {

  /**
   * @param {!../model/deps.DepsDef} deps
   */
  static configurePending(deps) {
    deps.activities().onResult(PAY_REQUEST_ID, port => {
      return validatePayResponse(port).then(response => {
        new PayCompleteFlow(deps).start();
        deps.callbacks().triggerSubscribeResponse(Promise.resolve(response));
      }, reason => {
        deps.callbacks().triggerSubscribeResponse(Promise.reject(reason));
        throw reason;
      });
    });
  }

  /**
   * @param {!../model/deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!../runtime/callbacks.Callbacks} */
    this.callbacks_ = deps.callbacks();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ =
        new ActivityIframeView(
            this.win_,
            this.activityPorts_,
            PAY_CONFIRM_IFRAME_URL,
            {
              'publicationId': deps.pageConfig().getPublicationId(),
            });
  }

  /**
   * Starts the payments completion flow.
   * @return {!Promise}
   */
  start() {
    this.activityIframeView_.acceptResult().then(() => {
      // The flow is complete.
      this.dialogManager_.completeView(this.activityIframeView_);
    });
    return this.dialogManager_.openView(this.activityIframeView_);
  }
}


/**
 * @param {!web-activities/activity-ports.ActivityPort} port
 * @return {!Promise<!SubscribeResponse>}
 * @package Visible for testing only.
 */
export function validatePayResponse(port) {
  return acceptPortResult(
      port,
      parseUrl(PAY_URL).origin,
      // TODO(dvoytenko): support payload decryption.
      /* requireOriginVerified */ true,
      /* requireSecureChannel */ true)
      .then(data => new SubscribeResponse(data));
}
