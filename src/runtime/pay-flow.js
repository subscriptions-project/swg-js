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
import {JwtHelper} from '../utils/jwt';
import {
  PurchaseData,
  SubscribeResponse,
} from '../api/subscribe-response';
import {UserData} from '../api/user-data';
import {acceptPortResult} from '../utils/activity-utils';
import {parseJson} from '../utils/json';
import {parseUrl} from '../utils/url';

const PAY_URL =
    '$frontend$/subscribewithgoogleclientui/pay$frontendDebug$';

const PAY_CONFIRM_IFRAME_URL =
    '$frontend$/subscribewithgoogleclientui/payconfirmiframe$frontendDebug$';

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

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = deps.pageConfig();

    /** @private @const {string} */
    this.sku_ = sku;
  }

  /**
   * Starts the payments flow.
   * @return {!Promise}
   */
  start() {
    // TODO(dvoytenko): switch to gpay async client.
    this.activityPorts_.open(
        PAY_REQUEST_ID, PAY_URL, '_blank', {
          'paymentRequest': {
            'apiVersion': 1,
            'allowedPaymentMethods': ['CARD'],
            'publisherId': this.pageConfig_.getPublisherId(),
            'publicationId': this.pageConfig_.getPublisherId(),  // MIGRATE
            'swg': {
              'publisherId': this.pageConfig_.getPublisherId(),
              'publicationId': this.pageConfig_.getPublisherId(),  // MIGRATE
              // TODO(dvoytenko): use 'instant' for tests if necessary.
              'skuId': this.sku_,
              // TODO(dvoytenko): configure different targets for different
              // environemnts.
              'targetId': '12649180',
            },
          },
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
      const promise = validatePayResponse(port);
      deps.callbacks().triggerSubscribeResponse(promise);
      return promise.then(() => {
        new PayCompleteFlow(deps).start();
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
              'publisherId': deps.pageConfig().getPublisherId(),
              'publicationId': deps.pageConfig().getPublisherId(),  // MIGRATE
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
      /* requireOriginVerified */ false,
      /* requireSecureChannel */ false)
      .then(data => parseSubscriptionResponse(data));
}


/**
 * @param {*} data
 * @return {!SubscribeResponse}
 */
export function parseSubscriptionResponse(data) {
  let raw = null;
  if (data) {
    if (typeof data == 'string') {
      raw = /** @type {string} */ (data);
    } else {
      // Assume it's a json object in the format:
      // `{integratorClientCallbackData: "..."}`.
      const json = /** @type {!Object} */ (data);
      raw = json['integratorClientCallbackData'];
    }
  }

  let swgData = null;
  if (raw) {
    const parsed = parseJson(atob(raw));
    swgData = parsed['swgCallbackData'];
  }
  if (!swgData) {
    throw new Error('unexpected payment response');
  }
  return new SubscribeResponse(
      raw,
      parsePurchaseData(swgData),
      parseUserData(swgData));
}


/**
 * @param {!Object} swgData
 * @return {!PurchaseData}
 */
function parsePurchaseData(swgData) {
  const raw = swgData['purchaseData'];
  const signature = swgData['purchaseDataSignature'];
  return new PurchaseData(raw, signature);
}


/**
 * @param {!Object} swgData
 * @return {?UserData}
 * @package Visible for testing.
 */
export function parseUserData(swgData) {
  const idToken = swgData['idToken'];
  if (!idToken) {
    return null;
  }
  const jwt = /** @type {!Object} */ (new JwtHelper().decode(idToken));
  return new UserData(idToken, jwt);
}
