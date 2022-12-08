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

import {
  AccountCreationRequest,
  EntitlementsResponse,
} from '../proto/api_messages';
import {ActivityIframeView} from '../ui/activity-iframe-view';
import {AnalyticsEvent, EventParams} from '../proto/api_messages';
import {Constants} from '../utils/constants';
import {JwtHelper} from '../utils/jwt';
import {
  ProductType,
  SubscriptionFlows,
  WindowOpenMode,
} from '../api/subscriptions';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {UserData} from '../api/user-data';
import {feArgs, feUrl} from './services';
import {getPropertyFromJsonString, parseJson} from '../utils/json';
import {getSwgMode} from './services';
import {isCancelError} from '../utils/errors';
import {parseUrl} from '../utils/url';

/**
 * Subscribe with Google request to pass to payments.
 *  @typedef {{
 *    skuId: string,
 *    oldSku: (string|undefined),
 *    replaceSkuProrationMode: (number|undefined),
 *    paymentRecurrence: (number|undefined),
 *    swgVersion: (string|undefined),
 *    metadata: (Object|undefined)
 * }}
 */
export let SwgPaymentRequest;

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

export const RecurrenceMapping = {
  'AUTO': 1,
  'ONE_TIME': 2,
};

/**
 * @param {string} sku
 * @param {?string=} subscriptionFlow
 * @return {!EventParams}
 */
function getEventParams(sku, subscriptionFlow = null) {
  return new EventParams([, , , , sku, , , subscriptionFlow]);
}

/**
 * The flow to initiate payment process.
 */
export class PayStartFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.SubscriptionRequest} subscriptionRequest
   * @param {!../api/subscriptions.ProductType} productType
   */
  constructor(
    deps,
    subscriptionRequest,
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
    this.subscriptionRequest_ = subscriptionRequest;

    /**@private @const {!ProductType} */
    this.productType_ = productType;

    /** @private @const {!../runtime/analytics-service.AnalyticsService} */
    this.analyticsService_ = deps.analytics();

    /** @private @const {!../runtime/client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();

    /** @private @const {!../runtime/client-config-manager.ClientConfigManager} */
    this.clientConfigManager_ = deps.clientConfigManager();
  }

  /**
   * Starts the payments flow.
   * @return {!Promise}
   */
  async start() {
    // Get the paySwgVersion for buyflow.
    const clientConfig = await this.clientConfigManager_.getClientConfig();
    this.start_(clientConfig.paySwgVersion);
  }

  /**
   * Starts the payments flow for the given version.
   * @param {!string=} paySwgVersion
   * @return {!Promise}
   */
  start_(paySwgVersion) {
    const /** @type {SwgPaymentRequest} */ swgPaymentRequest = {
        'skuId': this.subscriptionRequest_['skuId'],
        'publicationId': this.pageConfig_.getPublicationId(),
      };

    if (paySwgVersion) {
      swgPaymentRequest['swgVersion'] = paySwgVersion;
    }

    if (this.subscriptionRequest_['oldSku']) {
      swgPaymentRequest['oldSku'] = this.subscriptionRequest_['oldSku'];
      // Map the proration mode to the enum value (if proration exists).
      const prorationMode =
        this.subscriptionRequest_['replaceSkuProrationMode'];
      if (prorationMode) {
        swgPaymentRequest['replaceSkuProrationMode'] =
          ReplaceSkuProrationModeMapping[prorationMode];
      } else {
        swgPaymentRequest['replaceSkuProrationMode'] =
          ReplaceSkuProrationModeMapping['IMMEDIATE_WITH_TIME_PRORATION'];
      }
      this.analyticsService_.setSku(swgPaymentRequest['oldSku']);
    }

    // Assign one-time recurrence enum if applicable
    if (this.subscriptionRequest_['oneTime']) {
      swgPaymentRequest['paymentRecurrence'] = RecurrenceMapping['ONE_TIME'];
    }

    // Assign additional metadata if available.
    if (this.subscriptionRequest_['metadata']) {
      swgPaymentRequest['metadata'] = this.subscriptionRequest_['metadata'];
    }

    // Start/cancel events.
    const flow =
      this.productType_ == ProductType.UI_CONTRIBUTION
        ? SubscriptionFlows.CONTRIBUTE
        : SubscriptionFlows.SUBSCRIBE;

    this.deps_.callbacks().triggerFlowStarted(flow, this.subscriptionRequest_);

    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
      true,
      getEventParams(swgPaymentRequest['skuId'])
    );
    PayCompleteFlow.waitingForPayClient_ = true;
    this.payClient_.start(
      /** @type {!PaymentDataRequest} */
      ({
        'apiVersion': 1,
        'allowedPaymentMethods': ['CARD'],
        'environment': getSwgMode().payEnv,
        'playEnvironment': getSwgMode().playEnv,
        'swg': swgPaymentRequest,
        'i': {
          'startTimeMs': Date.now(),
          'productType': this.productType_,
        },
      }),
      {
        forceRedirect:
          this.deps_.config().windowOpenMode == WindowOpenMode.REDIRECT,
        // SwG basic and TwG flows do not support native.
        forceDisableNative: paySwgVersion == '2' || paySwgVersion == '3',
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

    deps.payClient().onResponse(async (payPromise) => {
      deps.entitlementsManager().blockNextNotification();
      const flow = new PayCompleteFlow(deps);
      const promise = validatePayResponse(
        deps,
        payPromise,
        flow.complete.bind(flow)
      );
      deps.callbacks().triggerPaymentResponse(promise);

      try {
        const response = await promise;
        const sku = parseSkuFromPurchaseDataSafe(response.purchaseData);
        deps.analytics().setSku(sku || '');
        eventManager.logSwgEvent(
          AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
          true,
          getEventParams(
            sku || '',
            response.productType == ProductType.UI_CONTRIBUTION
              ? SubscriptionFlows.CONTRIBUTE
              : SubscriptionFlows.SUBSCRIBE
          )
        );
        flow.start(response);
      } catch (reason) {
        if (isCancelError(reason)) {
          const productType = /** @type {!Object} */ (reason)['productType'];
          const flow =
            productType == ProductType.UI_CONTRIBUTION
              ? SubscriptionFlows.CONTRIBUTE
              : SubscriptionFlows.SUBSCRIBE;
          deps.callbacks().triggerFlowCanceled(flow);
          deps
            .eventManager()
            .logSwgEvent(AnalyticsEvent.ACTION_USER_CANCELED_PAYFLOW, true);
        } else {
          deps
            .eventManager()
            .logSwgEvent(AnalyticsEvent.EVENT_PAYMENT_FAILED, false);
          deps.jserror().error('Pay failed', /** @type {!Error} */ (reason));
          throw reason;
        }
      }
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

    /** @private {?Promise} */
    this.readyPromise_ = null;

    /** @private @const {!../runtime/analytics-service.AnalyticsService} */
    this.analyticsService_ = deps.analytics();

    /** @private @const {!../runtime/client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();

    /** @private @const {!../runtime/client-config-manager.ClientConfigManager} */
    this.clientConfigManager_ = deps.clientConfigManager();

    /** @private {?string} */
    this.sku_ = null;
  }

  /**
   * Starts the payments completion flow.
   * @param {{
   *   productType: string,
   *   oldSku: ?string,
   *   paymentRecurrence: ?number,
   * }} response
   * @return {!Promise}
   */
  async start(response) {
    this.sku_ = parseSkuFromPurchaseDataSafe(response.purchaseData);
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
      true,
      getEventParams(this.sku_ || '')
    );
    this.deps_.entitlementsManager().reset(true);
    // TODO(dianajing): future-proof isOneTime flag
    const args = {
      'publicationId': this.deps_.pageConfig().getPublicationId(),
      'productType': response['productType'],
      'isSubscriptionUpdate': !!response['oldSku'],
      'isOneTime': !!response['paymentRecurrence'],
    };

    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    if (response.userData && response.entitlements) {
      args['idToken'] = response.userData.idToken;
      this.deps_
        .entitlementsManager()
        .pushNextEntitlements(response.entitlements.raw);
      // Persist swgUserToken in local storage
      if (response.swgUserToken) {
        this.deps_
          .storage()
          .set(Constants.USER_TOKEN, response.swgUserToken, true);
      }
    } else {
      args['loginHint'] = response.userData && response.userData.email;
    }

    const /* {!Object<string, string>} */ urlParams = {};
    if (args.productType === ProductType.VIRTUAL_GIFT) {
      Object.assign(urlParams, {
        productType: args.productType,
        publicationId: args.publicationId,
        offerId: this.sku_,
        origin: parseUrl(this.win_.location.href).origin,
        isPaid: true,
        checkOrderStatus: true,
      });
      if (response.requestMetadata) {
        urlParams.canonicalUrl = response.requestMetadata.contentId;
        urlParams.isAnonymous = response.requestMetadata.anonymous;
        args['contentTitle'] = response.requestMetadata.contentTitle;
      }

      // Add feArgs to be passed via activities.
      if (response.swgUserToken) {
        args.swgUserToken = response.swgUserToken;
      }
      const orderId = parseOrderIdFromPurchaseDataSafe(response.purchaseData);
      if (orderId) {
        args.orderId = orderId;
      }
    }
    if (this.clientConfigManager_.shouldForceLangInIframes()) {
      urlParams.hl = this.clientConfigManager_.getLanguage();
    }
    const confirmFeUrl = feUrl('/payconfirmiframe', urlParams);

    const clientConfig = await this.clientConfigManager_.getClientConfig();

    args['useUpdatedConfirmUi'] = clientConfig.useUpdatedOfferFlows;
    args['skipAccountCreationScreen'] = clientConfig.skipAccountCreationScreen;
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      confirmFeUrl,
      feArgs(args),
      /* shouldFadeBody */ true
    );
    this.activityIframeView_.on(
      EntitlementsResponse,
      this.handleEntitlementsResponse_.bind(this)
    );

    this.activityIframeView_.acceptResult().then(() => {
      // The flow is complete.
      this.dialogManager_.completeView(this.activityIframeView_);
    });

    this.readyPromise_ = this.dialogManager_.openView(this.activityIframeView_);

    this.readyPromise_.then(() => {
      this.deps_
        .callbacks()
        .triggerPayConfirmOpened(
          /** @type {!ActivityIframeView} */ (this.activityIframeView_)
        );
    });
  }

  /**
   * @param {!EntitlementsResponse} response
   * @private
   */
  handleEntitlementsResponse_(response) {
    const jwt = response.getJwt();
    if (jwt) {
      this.deps_.entitlementsManager().pushNextEntitlements(jwt);
    }
  }

  /**
   * @return {!Promise}
   */
  async complete() {
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_ACCOUNT_CREATED,
      true,
      getEventParams(this.sku_ || '')
    );

    const now = Date.now().toString();
    this.deps_
      .storage()
      .set(Constants.READ_TIME, now, /*useLocalStorage=*/ false);

    this.deps_.entitlementsManager().unblockNextNotification();

    const clientConfig = await this.clientConfigManager_.getClientConfig();

    await this.readyPromise_;

    // Skip account creation screen if requested (needed for AMP)
    if (!clientConfig.skipAccountCreationScreen) {
      const accountCompletionRequest = new AccountCreationRequest();
      accountCompletionRequest.setComplete(true);
      this.activityIframeView_.execute(accountCompletionRequest);
    }

    try {
      await this.activityIframeView_.acceptResult();
    } catch (err) {
      // Ignore errors.
    }

    if (!clientConfig.skipAccountCreationScreen) {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.ACTION_ACCOUNT_ACKNOWLEDGED,
        true,
        getEventParams(this.sku_ || '')
      );
    }

    this.deps_.entitlementsManager().setToastShown(true);
  }
}

/** @private {boolean} */
PayCompleteFlow.waitingForPayClient_ = false;

/**
 * @param {!./deps.DepsDef} deps
 * @param {!Promise<!Object>} payPromise
 * @param {function():!Promise} completeHandler
 * @return {!Promise<!SubscribeResponse>}
 */
async function validatePayResponse(deps, payPromise, completeHandler) {
  const wasRedirect = !PayCompleteFlow.waitingForPayClient_;
  PayCompleteFlow.waitingForPayClient_ = false;
  const data = await payPromise;
  // 1) We log against a random TX ID which is how we track a specific user
  //    anonymously.
  // 2) If there was a redirect to gPay, we may have lost our stored TX ID.
  // 3) Pay service is supposed to give us the TX ID it logged against.
  let eventType = AnalyticsEvent.UNKNOWN;
  let eventParams = undefined;
  if (typeof data !== 'object' || !data['googleTransactionId']) {
    // If gPay doesn't give us a TX ID it means that something may
    // be wrong.  If we previously logged then we are at least continuing to
    // log against the same TX ID.  If we didn't previously log then we have
    // lost all connection to the events that preceded the payment event and
    // we at least want to know why that data was lost.
    eventParams = new EventParams();
    eventParams.setHadLogged(!wasRedirect);
    eventType = AnalyticsEvent.EVENT_GPAY_NO_TX_ID;
  } else {
    const oldTxId = deps.analytics().getTransactionId();
    const newTxId = data['googleTransactionId'];

    if (wasRedirect) {
      // This is the expected case for full redirects.  It may be happening
      // unexpectedly at other times too though and we want to be aware of
      // it if it does.
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
  let productType = ProductType.SUBSCRIPTION;
  let oldSku = null;
  let paymentRecurrence = null;
  let requestMetadata = null;

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
      if ('paymentRequest' in data) {
        const swgObj = data['paymentRequest']['swg'] || {};
        oldSku = swgObj['oldSku'];
        paymentRecurrence = swgObj['paymentRecurrence'];
        requestMetadata = swgObj['metadata'];
        productType =
          (data['paymentRequest']['i'] || {})['productType'] ||
          ProductType.SUBSCRIPTION;
      }
      // Set productType if paymentRequest is not present, which happens
      // if the pay flow was opened in redirect mode.
      else if ('productType' in data) {
        productType = data['productType'];
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
    productType,
    completeHandler,
    oldSku,
    swgData['swgUserToken'],
    paymentRecurrence,
    requestMetadata
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
  return /** @type {?string} */ (
    getPropertyFromJsonString(purchaseData.raw, 'productId') || null
  );
}

/**
 * @param {!PurchaseData} purchaseData
 * @return {?string}
 */
function parseOrderIdFromPurchaseDataSafe(purchaseData) {
  return /** @type {?string} */ (
    getPropertyFromJsonString(purchaseData.raw, 'orderId') || null
  );
}
