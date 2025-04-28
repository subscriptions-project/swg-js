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
import {ActivityPorts} from '../components/activities';
import {AnalyticsEvent, EventParams} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {Entitlements} from '../api/entitlements';
import {JwtHelper} from '../utils/jwt';
import {PageConfig} from '../model/page-config';
import {PayClient, PaymentCancelledError} from './pay-client';
import {
  PaymentData,
  SwgCallbackData,
} from '../../third_party/gpay/src/payjs_async';
import {
  ProductType,
  SubscriptionFlows,
  SubscriptionRequest,
  WindowOpenMode,
} from '../api/subscriptions';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {StorageKeys} from '../utils/constants';
import {UserData} from '../api/user-data';
import {feArgs, feUrl} from './services';
import {getPropertyFromJsonString} from '../utils/json';
import {getSwgMode} from './services';
import {isCancelError} from '../utils/errors';

/**
 * Subscribe with Google request to pass to payments.
 */
export interface SwgPaymentRequest {
  skuId: string;
  publicationId?: string;
  oldSku?: string;
  replaceSkuProrationMode?: number;
  paymentRecurrence?: number;
  swgVersion?: string;
  metadata?: object;
}

/**
 * String values input by the publisher are mapped to the number values.
 */
export const ReplaceSkuProrationModeMapping: {[key: string]: number} = {
  // The replacement takes effect immediately, and the remaining time will
  // be prorated and credited to the user. This is the current default
  // behavior.
  'IMMEDIATE_WITH_TIME_PRORATION': 1,
};

export const RecurrenceMapping = {
  'AUTO': 1,
  'ONE_TIME': 2,
};

function getEventParams(
  sku: string,
  subscriptionFlow: string | null = null
): EventParams {
  return new EventParams([, , , , sku, , , subscriptionFlow]);
}

/**
 * The flow to initiate payment process.
 */
export class PayStartFlow {
  private readonly analyticsService_: AnalyticsService;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly eventManager_: ClientEventManager;
  private readonly pageConfig_: PageConfig;
  private readonly payClient_: PayClient;

  constructor(
    private readonly deps_: Deps,
    private readonly subscriptionRequest_: SubscriptionRequest,
    private readonly productType_: ProductType = ProductType.SUBSCRIPTION
  ) {
    this.payClient_ = deps_.payClient();

    this.pageConfig_ = deps_.pageConfig();

    this.analyticsService_ = deps_.analytics();

    this.eventManager_ = deps_.eventManager();

    this.clientConfigManager_ = deps_.clientConfigManager();
  }

  /**
   * Starts the payments flow.
   */
  async start(): Promise<void> {
    // Get the paySwgVersion for buyflow.
    const clientConfig = await this.clientConfigManager_.getClientConfig();
    this.start_(clientConfig.useUpdatedOfferFlows, clientConfig.paySwgVersion);
  }

  /**
   * Starts the payments flow for the given version.
   */
  private start_(
    usePayFlow: boolean | undefined,
    paySwgVersion?: string
  ): void {
    const swgPaymentRequest: SwgPaymentRequest = {
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
    this.eventManager_.logSwgEvent(
      usePayFlow
        ? AnalyticsEvent.ACTION_PAY_PAYMENT_FLOW_STARTED
        : AnalyticsEvent.ACTION_PLAY_PAYMENT_FLOW_STARTED,
      true
    );

    PayCompleteFlow.waitingForPayClient = true;
    this.payClient_.start(
      {
        'apiVersion': 1,
        'allowedPaymentMethods': ['CARD'],
        'environment': getSwgMode().payEnv,
        'playEnvironment': getSwgMode().playEnv,
        'swg': swgPaymentRequest,
        'i': {
          'startTimeMs': Date.now(),
          'productType': this.productType_,
        },
      },
      {
        forceRedirect:
          this.deps_.config().windowOpenMode == WindowOpenMode.REDIRECT,
        // SwG basic does not support native.
        forceDisableNative: paySwgVersion == '2',
      }
    );
  }
}

/**
 * The flow for successful payments completion.
 */
export class PayCompleteFlow {
  static waitingForPayClient = false;

  static configurePending(deps: Deps): void {
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

        const clientConfig = await deps.clientConfigManager().getClientConfig();
        if (clientConfig.useUpdatedOfferFlows) {
          eventManager.logSwgEvent(
            AnalyticsEvent.EVENT_PAY_PAYMENT_COMPLETE,
            true
          );
        }
        if (response.productType == ProductType.UI_CONTRIBUTION) {
          eventManager.logSwgEvent(
            AnalyticsEvent.EVENT_CONTRIBUTION_PAYMENT_COMPLETE,
            true,
            getEventParams(sku || '', SubscriptionFlows.CONTRIBUTE)
          );
        } else if (response.productType == ProductType.SUBSCRIPTION) {
          eventManager.logSwgEvent(
            AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE,
            true,
            getEventParams(sku || '', SubscriptionFlows.SUBSCRIBE)
          );
        }
        flow.start(response);
      } catch (err) {
        const reason = err as PaymentCancelledError;
        if (isCancelError(reason as Error)) {
          const productType = reason['productType'];
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
          deps.jserror().error('Pay failed', reason as Error);
          throw reason;
        }
      }
    });
  }

  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly eventManager_: ClientEventManager;
  private readonly clientConfigManager_: ClientConfigManager;

  private activityIframeView_: ActivityIframeView | null = null;
  private readyPromise_: Promise<void> | null = null;
  private sku_: string | null = null;

  constructor(private readonly deps_: Deps) {
    this.win_ = deps_.win();

    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();

    this.eventManager_ = deps_.eventManager();

    this.clientConfigManager_ = deps_.clientConfigManager();
  }

  /**
   * Starts the payments completion flow.
   */
  async start(response: SubscribeResponse): Promise<void> {
    this.sku_ = parseSkuFromPurchaseDataSafe(response.purchaseData);
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
      true,
      getEventParams(this.sku_ || '')
    );
    this.deps_.entitlementsManager().reset(true);
    // TODO(dianajing): future-proof isOneTime flag
    const args: {[key: string]: string | boolean | undefined} = {
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
          .set(StorageKeys.USER_TOKEN, response.swgUserToken, true);
      }
    } else {
      args['loginHint'] = response.userData?.email;
    }

    const urlParams: {[key: string]: string} = {};
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
      this.deps_.callbacks().triggerPayConfirmOpened(this.activityIframeView_!);
    });
  }

  private handleEntitlementsResponse_(response: EntitlementsResponse): void {
    const jwt = response.getJwt();
    if (jwt) {
      this.deps_.entitlementsManager().pushNextEntitlements(jwt);
    }
  }

  async complete(): Promise<void> {
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_ACCOUNT_CREATED,
      true,
      getEventParams(this.sku_ || '')
    );

    const now = Date.now().toString();
    this.deps_
      .storage()
      .set(StorageKeys.READ_TIME, now, /*useLocalStorage=*/ false);

    this.deps_.entitlementsManager().unblockNextNotification();

    const clientConfig = await this.clientConfigManager_.getClientConfig();

    await this.readyPromise_;

    // Skip account creation screen if requested (needed for AMP)
    if (!clientConfig.skipAccountCreationScreen) {
      const accountCompletionRequest = new AccountCreationRequest();
      accountCompletionRequest.setComplete(true);
      this.activityIframeView_!.execute(accountCompletionRequest);
    }

    try {
      await this.activityIframeView_!.acceptResult();
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

async function validatePayResponse(
  deps: Deps,
  payPromise: Promise<PaymentData>,
  completeHandler: () => Promise<void>
): Promise<SubscribeResponse> {
  const wasRedirect = !PayCompleteFlow.waitingForPayClient;
  PayCompleteFlow.waitingForPayClient = false;
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

export function parseSubscriptionResponse(
  deps: Deps,
  data: PaymentData,
  completeHandler: () => Promise<void>
): SubscribeResponse {
  let swgData: SwgCallbackData | null = null;
  let raw: string | null = null;
  let productType = ProductType.SUBSCRIPTION;
  let oldSku = null;
  let paymentRecurrence = null;
  let requestMetadata = null;

  if (data) {
    if (typeof data === 'string') {
      raw = data;
    } else {
      // Assume it's a json object in the format:
      // `{integratorClientCallbackData: "..."}` or `{swgCallbackData: "..."}`.
      const json = data;
      if (json['swgCallbackData']) {
        swgData = json['swgCallbackData'];
      } else if (json['integratorClientCallbackData']) {
        raw = json['integratorClientCallbackData'];
      }
      if (data['paymentRequest']) {
        const swgObj = data['paymentRequest']['swg'] || {};
        oldSku = swgObj['oldSku'];
        paymentRecurrence = swgObj['paymentRecurrence'];
        requestMetadata = swgObj['metadata'];
        productType =
          data['paymentRequest']['i']?.['productType'] ||
          ProductType.SUBSCRIPTION;
      }
      // Set productType if paymentRequest is not present, which happens
      // if the pay flow was opened in redirect mode.
      else if (data['productType']) {
        productType = data['productType'];
      }
    }
  }
  if (raw && !swgData) {
    raw = atob(raw);
    if (raw) {
      const parsed = JSON.parse(raw);
      swgData = parsed['swgCallbackData'];
    }
  }
  if (!swgData) {
    throw new Error('unexpected payment response');
  }
  raw = JSON.stringify(swgData);
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

function parsePurchaseData(swgData: SwgCallbackData): PurchaseData {
  const raw = swgData['purchaseData'];
  const signature = swgData['purchaseDataSignature'];
  return new PurchaseData(raw, signature);
}

/**
 * Visible for testing.
 */
export function parseUserData(swgData: SwgCallbackData): UserData | null {
  const idToken = swgData['idToken'];
  if (!idToken) {
    return null;
  }
  const jwt = new JwtHelper().decode(idToken);
  return new UserData(idToken, jwt as {[key: string]: string});
}

/**
 * Visible for testing.
 */
export function parseEntitlements(
  deps: Deps,
  swgData: SwgCallbackData
): Entitlements | null {
  if (swgData['signedEntitlements']) {
    return deps.entitlementsManager().parseEntitlements(swgData);
  }
  return null;
}

function parseSkuFromPurchaseDataSafe(
  purchaseData: PurchaseData
): string | null {
  return (
    (getPropertyFromJsonString(purchaseData.raw, 'productId') as string) || null
  );
}
