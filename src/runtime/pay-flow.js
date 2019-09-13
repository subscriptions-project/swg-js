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
import {AnalyticsEvent, EventParams} from '../proto/api_messages';
import {JwtHelper} from '../utils/jwt';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {
  ProductType,
  SubscriptionFlows,
  WindowOpenMode,
} from '../api/subscriptions';
import {UserData} from '../api/user-data';
import {feArgs, feUrl} from './services';
import {isCancelError} from '../utils/errors';
import {parseJson, tryParseJson} from '../utils/json';

/**
 * String values input by the publisher are mapped to the number values.
 * @type {!Object<string, number>}
 */
export const ReplaceSkuProrationModeMapping = {
  // The replacement takes effect immediately, and the remaining time will
  // be prorated and credited to the user. This is the current default
  // behavior.
  'IMMEDIATE_WITH_TIME_PRORATION': 1,
};

/**
 * The flow to initiate payment process.
 */
export class PayStartFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.SubscriptionRequest|string} skuOrSubscriptionRequest
   * @param {!../api/subscriptions.ProductType} productType
   */
  constructor(
    deps,
    skuOrSubscriptionRequest,
    productType = ProductType.SUBSCRIPTION
  ) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!./pay-client.PayClient} */
    this.payClient_ = deps.payClient();

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = deps.pageConfig();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!../api/subscriptions.SubscriptionRequest} */
    this.subscriptionRequest_ =
      typeof skuOrSubscriptionRequest == 'string'
        ? {'skuId': skuOrSubscriptionRequest}
        : skuOrSubscriptionRequest;

    /**@private @const {!ProductType} */
    this.productType_ = productType;

    /** @private @const {!../runtime/analytics-service.AnalyticsService} */
    this.analyticsService_ = deps.analytics();

    /** @private @const {!../runtime/client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();

    // Map the proration mode to the enum value (if proration exists).
    this.prorationMode = this.subscriptionRequest_.replaceSkuProrationMode;
    this.prorationEnum = 0;
    if (this.prorationMode) {
      this.prorationEnum = ReplaceSkuProrationModeMapping[this.prorationMode];
    } else if (this.subscriptionRequest_.oldSku) {
      this.prorationEnum =
        ReplaceSkuProrationModeMapping['IMMEDIATE_WITH_TIME_PRORATION'];
    }
  }

  /**
   * Starts the payments flow.
   * @return {!Promise}
   */
  start() {
    // Add the 'publicationId' key to the subscriptionRequest_ object.
    const swgPaymentRequest = Object.assign({}, this.subscriptionRequest_, {
      'publicationId': this.pageConfig_.getPublicationId(),
    });

    if (this.prorationEnum) {
      swgPaymentRequest.replaceSkuProrationMode = this.prorationEnum;
    }

    // Start/cancel events.
    this.deps_
      .callbacks()
      .triggerFlowStarted(
        SubscriptionFlows.SUBSCRIBE,
        this.subscriptionRequest_
      );
    // TODO(chenshay): Create analytics for 'replace subscription'.
    this.analyticsService_.setSku(this.subscriptionRequest_.skuId);
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
      true
    );
    this.payClient_.start(
      {
        'apiVersion': 1,
        'allowedPaymentMethods': ['CARD'],
        'environment': '$payEnvironment$',
        'playEnvironment': '$playEnvironment$',
        'swg': swgPaymentRequest,
        'i': {
          'startTimeMs': Date.now(),
          'googleTransactionId': this.analyticsService_.getTransactionId(),
          'productType': this.productType_,
        },
      },
      {
        forceRedirect:
          this.deps_.config().windowOpenMode == WindowOpenMode.REDIRECT,
      }
    );
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
    /** @const @type {./client-event-manager.ClientEventManager} */
    const eventManager = deps.eventManager();

    deps.payClient().onResponse(payPromise => {
      deps.entitlementsManager().blockNextNotification();
      const flow = new PayCompleteFlow(deps);
      const promise = validatePayResponse(
        deps,
        payPromise,
        flow.complete.bind(flow)
      );
      deps.callbacks().triggerSubscribeResponse(promise);
      return promise.then(
        response => {
          eventManager.logSwgEvent(
            AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
            true
          );
          flow.start(response);
        },
        reason => {
          if (isCancelError(reason)) {
            deps.callbacks().triggerFlowCanceled(SubscriptionFlows.SUBSCRIBE);
          } else {
            deps
              .eventManager()
              .logSwgEvent(AnalyticsEvent.EVENT_PAYMENT_FAILED, false);
            deps.jserror().error('Pay failed', reason);
          }
          throw reason;
        }
      );
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

    /** @private @const {!../components/activities.ActivityPorts} */
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

    /** @private @const {!../runtime/client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();
  }

  /**
   * Starts the payments completion flow.
   * @param {!SubscribeResponse} response
   * @return {!Promise}
   */
  start(response) {
    if (!this.analyticsService_.getSku()) {
      // This is a redirect response. Extract the SKU if possible.
      this.analyticsService_.addLabels(['redirect']);
      const sku = parseSkuFromPurchaseDataSafe(response.purchaseData);
      if (sku) {
        this.analyticsService_.setSku(sku);
      }
    }

    this.eventManager_.logSwgEvent(
      AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
      true
    );
    this.deps_.entitlementsManager().reset(true);
    this.response_ = response;
    // TODO(dianajing): find a way to specify whether response is a subscription update
    const args = {
      'publicationId': this.deps_.pageConfig().getPublicationId(),
      'productType': this.response_['productType'],
      // 'isSubscriptionUpdate': !!response.oldSku,
    };
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    if (response.userData && response.entitlements) {
      args['idToken'] = response.userData.idToken;
      this.deps_
        .entitlementsManager()
        .pushNextEntitlements(response.entitlements.raw);
    } else {
      args['loginHint'] = response.userData && response.userData.email;
    }
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/payconfirmiframe'),
      feArgs(args),
      /* shouldFadeBody */ true
    );
    this.activityIframeView_.onMessageDeprecated(data => {
      if (data['entitlements']) {
        this.deps_
          .entitlementsManager()
          .pushNextEntitlements(/** @type {string} */ (data['entitlements']));
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
    this.eventManager_.logSwgEvent(AnalyticsEvent.ACTION_ACCOUNT_CREATED, true);
    this.deps_.entitlementsManager().unblockNextNotification();
    this.readyPromise_.then(() => {
      this.activityIframeView_.messageDeprecated({'complete': true});
    });
    return this.activityIframeView_
      .acceptResult()
      .catch(() => {
        // Ignore errors.
      })
      .then(() => {
        this.eventManager_.logSwgEvent(
          AnalyticsEvent.ACTION_ACCOUNT_ACKNOWLEDGED,
          true
        );
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
    // 1) We log against a random TX ID which is how we track a specific user
    //    anonymously.
    // 2) If there was a redirect to gPay, we may have lost our stored TX ID.
    // 3) Pay service is supposed to give us the TX ID it logged against.

    const hasLogged = deps.analytics().getHasLogged();
    let eventType = AnalyticsEvent.UNKNOWN;
    let eventParams = undefined;
    if (typeof data !== 'object' || !data['googleTransactionId']) {
      // If gPay doesn't give us a TX ID it means that something may
      // be wrong.  If we previously logged then we are at least continuing to
      // log against the same TX ID.  If we didn't previously log then we have
      // lost all connection to the events that preceded the payment event and
      // we at least want to know why that data was lost.
      eventParams = new EventParams();
      eventParams.setHadLogged(hasLogged);
      eventType = AnalyticsEvent.EVENT_GPAY_NO_TX_ID;
    } else {
      const oldTxId = deps.analytics().getTransactionId();
      const newTxId = data['googleTransactionId'];

      if (!hasLogged) {
        // This is the expected case for full redirects.  It may be happening
        // unexpectedly at other times too though and we want to be aware of it
        // if it does.
        deps.analytics().setTransactionId(newTxId);
        eventType = AnalyticsEvent.EVENT_GPAY_CANNOT_CONFIRM_TX_ID;
      } else {
        if (oldTxId === newTxId) {
          // This is the expected case for non-redirect pay events
          eventType = AnalyticsEvent.EVENT_CONFIRM_TX_ID;
        } else {
          // This is an unexpected case: gPay rejected our TX ID and created
          // its own.  Log the gPay TX ID but keep our logging consistent.
          eventParams = new EventParams();
          eventParams.setGpayTransactionId(newTxId);
          eventType = AnalyticsEvent.EVENT_CHANGED_TX_ID;
        }
      }
    }
    deps.eventManager().logSwgEvent(eventType, true, eventParams);
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
  let productType = null;
  if (data) {
    if (typeof data == 'string') {
      raw = /** @type {string} */ (data);
    } else {
      // Assume it's a json object in the format:
      // `{integratorClientCallbackData: "..."}` or `{swgCallbackData: "..."}`.
      const json = /** @type {!Object} */ (data);
      if ('productType' in data) {
        productType = data['productType'];
      }
      if ('swgCallbackData' in json) {
        swgData = /** @type {!Object} */ (json['swgCallbackData']);
      } else if ('integratorClientCallbackData' in json) {
        raw = json['integratorClientCallbackData'];
      }
    }
  }
  if (!productType) {
    productType = ProductType.SUBSCRIPTION;
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
    productType,
    completeHandler
  );
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

/**
 * @param {!PurchaseData} purchaseData
 * @return {?string}
 */
function parseSkuFromPurchaseDataSafe(purchaseData) {
  const json = tryParseJson(purchaseData.raw);
  return (json && json['productId']) || null;
}
