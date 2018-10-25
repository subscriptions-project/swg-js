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
 * The Flow goes like this:
 * a. Start Payments
 * b. Complete Payments
 * c. Create Account
 * d. Acknowledge Account
 *
 * In other words, Flow = Payments + Account Creation.
 */

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {JwtHelper} from '../utils/jwt';
import {
  PurchaseData,
  SubscribeResponse,
} from '../api/subscribe-response';
import {SubscriptionFlows, WindowOpenMode} from '../api/subscriptions';
import {UserData} from '../api/user-data';
import {feArgs, feUrl} from './services';
import {isCancelError} from '../utils/errors';
import {parseJson} from '../utils/json';
import {AnalyticsEvent} from '../proto/api_messages';

/**
 * The flow to initiate payment process.
 */
export class PayStartFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {string} sku
   * @param {string=} opt_oldSkuId
   * @param {string=} opt_replaceSkuProrationMode
   */
  constructor(deps, sku, opt_oldSkuId, opt_replaceSkuProrationMode) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!./pay-client.PayClient} */
    this.payClient_ = deps.payClient();

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = deps.pageConfig();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {string} */
    this.sku_ = sku;

    /** @private @const {string=} */
    this.oldSku_ = opt_oldSkuId || null;

    /** @private @const {string=} */
    this.replaceSkuProrationMode_ = opt_replaceSkuProrationMode || null;

    /** @private @const {!../runtime/analytics-service.AnalyticsService} */
    this.analyticsService_ = deps.analytics();
  }

  /**
   * Starts the payments flow.
   * @return {!Promise}
   */
  start() {
    // Start/cancel events.
    this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.SUBSCRIBE, {
      'sku': this.sku_,
      'oldSku': this.oldSku_,
      'prorationMode': this.replaceSkuProrationMode_,
    });
    this.analyticsService_.setSku(this.sku_);
    this.analyticsService_.logEvent(AnalyticsEvent.ACTION_SUBSCRIBE);
    this.payClient_.start({
      'apiVersion': 1,
      'allowedPaymentMethods': ['CARD'],
      'environment': '$payEnvironment$',
      'playEnvironment': '$playEnvironment$',
      'swg': {
        'publicationId': this.pageConfig_.getPublicationId(),
        'skuId': this.sku_,
        'oldSkuId': this.oldSku_,
        'replaceSkuProrationMode': this.replaceSkuProrationMode_,
      },
      'i': {
        'startTimeMs': Date.now(),
        'googleTransactionId': this.analyticsService_.getTransactionId(),
      },
    }, {
      forceRedirect:
          this.deps_.config().windowOpenMode == WindowOpenMode.REDIRECT,
    });
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
    deps.payClient().onResponse(payPromise => {
      deps.entitlementsManager().blockNextNotification();
      const flow = new PayCompleteFlow(deps);
      const promise =
          validatePayResponse(deps, payPromise, flow.complete.bind(flow));
      deps.callbacks().triggerSubscribeResponse(promise);
      return promise.then(response => {
        flow.start(response);
      }, reason => {
        if (isCancelError(reason)) {
          deps.callbacks().triggerFlowCanceled(SubscriptionFlows.SUBSCRIBE);
        }
        throw reason;
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

    /** @private {?ActivityIframeView} */
    this.activityIframeView_ = null;

    /** @private {?SubscribeResponse} */
    this.response_ = null;

    /** @private {?Promise} */
    this.readyPromise_ = null;

    /** @private @const {!../runtime/analytics-service.AnalyticsService} */
    this.analyticsService_ = deps.analytics();
  }

  /**
   * Starts the payments completion flow.
   * @param {!SubscribeResponse} response
   * @return {!Promise}
   */
  start(response) {
    this.analyticsService_.logEvent(AnalyticsEvent.ACTION_PAYMENT_COMPLETE);
    this.deps_.entitlementsManager().reset(true);
    this.response_ = response;
    const args = {
      'publicationId': this.deps_.pageConfig().getPublicationId(),
    };
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    if (response.userData && response.entitlements) {
      args['idToken'] = response.userData.idToken;
      this.deps_.entitlementsManager().pushNextEntitlements(
          response.entitlements.raw);
    } else {
      args['loginHint'] = response.userData && response.userData.email;
    }
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/payconfirmiframe'),
        feArgs(args),
        /* shouldFadeBody */ true);
    this.activityIframeView_.onMessage(data => {
      if (data['entitlements']) {
        this.deps_.entitlementsManager().pushNextEntitlements(
            /** @type {string} */ (data['entitlements']));
        return;
      }
    });
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
    this.analyticsService_.logEvent(AnalyticsEvent.ACTION_ACCOUNT_CREATED);
    this.deps_.entitlementsManager().unblockNextNotification();
    this.readyPromise_.then(() => {
      this.activityIframeView_.message({'complete': true});
    });
    return this.activityIframeView_.acceptResult().catch(() => {
      // Ignore errors.
    }).then(() => {
      this.analyticsService_.logEvent(
          AnalyticsEvent.ACTION_ACCOUNT_ACKNOWLEDGED);
      this.deps_.entitlementsManager().setToastShown(true);
    });
  }
}


/**
 * @param {!./deps.DepsDef} deps
 * @param {!Promise<!Object>} payPromise
 * @param {function():!Promise} completeHandler
 * @return {!Promise<!SubscribeResponse>}
 */
function validatePayResponse(deps, payPromise, completeHandler) {
  return payPromise.then(data => {
    if (typeof data == 'object' && data['googleTransactionId']) {
      deps.analytics().setTransactionId(data['googleTransactionId']);
    }
    return parseSubscriptionResponse(deps, data, completeHandler);
  });
}


/**
 * @param {!./deps.DepsDef} deps
 * @param {*} data
 * @param {function():!Promise} completeHandler
 * @return {!SubscribeResponse}
 */
export function parseSubscriptionResponse(deps, data, completeHandler) {
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
      parseEntitlements(deps, swgData),
      completeHandler);
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


/**
 * @param {!./deps.DepsDef} deps
 * @param {!Object} swgData
 * @return {?../api/entitlements.Entitlements}
 * @package Visible for testing.
 */
export function parseEntitlements(deps, swgData) {
  if (swgData['signedEntitlements']) {
    return deps.entitlementsManager().parseEntitlements(swgData);
  }
  return null;
}
