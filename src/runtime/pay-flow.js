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
import {JwtHelper} from '../utils/jwt';
import {
  PurchaseData,
  SubscribeResponse,
} from '../api/subscribe-response';
import {UserData} from '../api/user-data';
import {Xhr} from '../utils/xhr';
import {acceptPortResult} from '../utils/activity-utils';
import {parseJson} from '../utils/json';
import {feArgs, feOrigin, feUrl} from './services';

const PAY_REQUEST_ID = 'swg-pay';


/**
 * The flow to initiate payment process.
 */
export class PayStartFlow {

  /**
   * @param {!../utils/preconnect.Preconnect} pre
   */
  static preconnect(pre) {
    pre.prefetch(feUrl('/pay'));
  }

  /**
   * @param {!./deps.DepsDef} deps
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
        PAY_REQUEST_ID,
        feUrl('/pay'),
        '_blank',
        feArgs({
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': '$payEnvironment$',
          'playEnvironment': '$playEnvironment$',
          'swg': {
            'publicationId': this.pageConfig_.getPublicationId(),
            'skuId': this.sku_,
          },
        }), {});
    return Promise.resolve();
  }
}


/**
 * The flow for successful payments completion.
 */
export class PayCompleteFlow {

  /**
   * @param {!./deps.DepsDef} deps
   */
  static configurePending(deps) {
    deps.activities().onResult(PAY_REQUEST_ID, port => {
      deps.entitlementsManager().blockNextNotification();
      const flow = new PayCompleteFlow(deps);
      const promise = validatePayResponse(
          deps.win(), port, flow.complete.bind(flow));
      deps.callbacks().triggerSubscribeResponse(promise);
      return promise.then(response => {
        flow.start(response);
      });
    });
  }

  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!../runtime/callbacks.Callbacks} */
    this.callbacks_ = deps.callbacks();

    /** @private {?ActivityIframeView} */
    this.activityIframeView_ = null;

    /** @private {?SubscribeResponse} */
    this.response_ = null;

    /** @private {?Promise} */
    this.readyPromise_ = null;
  }

  /**
   * Starts the payments completion flow.
   * @param {!SubscribeResponse} response
   * @return {!Promise}
   */
  start(response) {
    this.deps_.entitlementsManager().reset(true);
    this.response_ = response;
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/payconfirmiframe'),
        feArgs({
          'publicationId': this.deps_.pageConfig().getPublicationId(),
          'loginHint': response.userData && response.userData.email,
        }),
        /* shouldFadeBody */ true);
    this.activityIframeView_.acceptResult().then(() => {
      // The flow is complete.
      this.dialogManager_.completeView(this.activityIframeView_);
    });
    this.readyPromise_ = this.dialogManager_.openView(this.activityIframeView_);
    return this.readyPromise_;
  }

  /**
   * @return {!Promise}
   */
  complete() {
    this.deps_.entitlementsManager().unblockNextNotification();
    this.readyPromise_.then(() => {
      this.activityIframeView_.message({'complete': true});
    });
    return this.activityIframeView_.acceptResult().catch(() => {
      // Ignore errors.
    }).then(() => {
      this.deps_.entitlementsManager().setToastShown(true);
    });
  }
}


/**
  *@param {!Window} win
 * @param {!web-activities/activity-ports.ActivityPort} port
 * @param {function():!Promise} completeHandler
 * @return {!Promise<!SubscribeResponse>}
 * @package Visible for testing only.
 */
export function validatePayResponse(win, port, completeHandler) {
  return acceptPortResult(
      port,
      feOrigin(),
      // TODO(dvoytenko): support payload decryption.
      /* requireOriginVerified */ false,
      /* requireSecureChannel */ false)
      .then(data => {
        if (data['redirectEncryptedCallbackData']) {
          const xhr = new Xhr(win);
          const url = getDecryptionUrl(data['environment']);
          const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
            method: 'post',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
            body: data['redirectEncryptedCallbackData'],
            mode: 'cors',
          });
          return xhr.fetch(url, init).then(response => response.json());
        }
        return data;
      }).then(data => parseSubscriptionResponse(data, completeHandler));
}


/**
 * @param {*} data
 * @param {function():!Promise} completeHandler
 * @return {!SubscribeResponse}
 */
export function parseSubscriptionResponse(data, completeHandler) {
  let swgData = null;
  let raw = null;
  if (data) {
    if (typeof data == 'string') {
      raw = /** @type {string} */ (data);
    } else {
      // Assume it's a json object in the format:
      // `{integratorClientCallbackData: "..."}` or `{swgCallbackData: "..."}`.
      const json = /** @type {!Object} */ (data);
      if ('swgCallbackData' in json) {
        swgData = /** @type {!Object} */ (json['swgCallbackData']);
      } else if ('integratorClientCallbackData' in json) {
        raw = json['integratorClientCallbackData'];
      }
    }
  }
  if (raw && !swgData) {
    raw = atob(raw);
    if (raw) {
      const parsed = parseJson(raw);
      swgData = parsed['swgCallbackData'];
    }
  }
  if (!swgData) {
    throw new Error('unexpected payment response');
  }
  raw = JSON.stringify(/** @type {!JsonObject} */ (swgData));
  return new SubscribeResponse(
      raw,
      parsePurchaseData(swgData),
      parseUserData(swgData),
      completeHandler);
}

/**
   * Returns the decryption url to be used to decrypt the encrypted payload.
   *
   * @param {!string} environment
   * @return {!string} The decryption url
   */
function getDecryptionUrl(environment) {
  if (environment == 'PRODUCTION') {
    return 'https://pay.google.com/gp/p/apis/buyflow/process';
  }
  return 'https://pay.sandbox.google.com/gp/p/apis/buyflow/process';
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
