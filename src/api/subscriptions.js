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

import {Entitlements} from './entitlements';
import {Offer} from './offer';
import {
  DeferredAccountCreationRequest,
  DeferredAccountCreationResponse,
} from './deferred-account-creation';
import {SubscribeResponse} from './subscribe-response';
import {PropensityApi} from './propensity-api';
import {LoggerApi} from './logger-api';
import { ExperimentFlags } from '../runtime/experiment-flags';

/**
 * @interface
 */
export class Subscriptions {
  /**
   * Optionally initializes the subscriptions runtime with publication or
   * product ID. If not called, the runtime will look for the initialization
   * parameters in the page's markup.
   * @param {string} productOrPublicationId
   */
  init(productOrPublicationId) {}

  /**
   * Optionally configures the runtime with non-default properties. See
   * `Config` definition for details.
   * @param {!Config} config
   */
  configure(config) {}

  /**
   * Starts the entitlement flow.
   */
  start() {}

  /**
   * Resets the entitlements that can be fetched again.
   */
  reset() {}

  /**
   * Resets the entitlements and clears all of the caches.
   */
  clear() {}

  /**
   * @param {?string=} encryptedDocumentKey
   * @return {!Promise<!Entitlements>}
   */
  getEntitlements(encryptedDocumentKey) {}

  /**
   * Set the subscribe callback.
   * @param {function(!Promise<!Entitlements>)} callback
   */
  setOnEntitlementsResponse(callback) {}

  /**
   * Returns a set of offers.
   * @param {{
   *   productId: (string|undefined),
   * }=} options
   * @return {!Promise<!Array<!Offer>>}
   */
  getOffers(options) {}

  /**
   * Starts the Offers flow.
   * @param {!OffersRequest=} options
   */
  showOffers(options) {}

  /**
   * Starts the Offers flow for a subscription update.
   * @param {!OffersRequest=} options
   */
  showUpdateOffers(options) {}

  /**
   * Show subscription option.
   * @param {!OffersRequest=} options
   */
  showSubscribeOption(options) {}

  /**
   * Show abbreviated offers.
   * @param {!OffersRequest=} options
   */
  showAbbrvOffer(options) {}

  /**
   * Show contribution options for the users to select from.
   * The options are grouped together by periods (Weekly, Monthly, etc.).
   * User can select the amount to contribute to from available options
   * to the publisher. These options are based on the SKUs defined in the Play
   * console for a given publication.
   * Each SKU has Amount, Period, SKUId and other attributes.
   * @param {!OffersRequest=} options
   */
  showContributionOptions(options) {}

  /**
   * Set the callback for the native subscribe request. Setting this callback
   * triggers the "native" option in the offers flow.
   * @param {function()} callback
   */
  setOnNativeSubscribeRequest(callback) {}

  /**
   * Set the subscribe complete callback.
   * @param {function(!Promise<!SubscribeResponse>)} callback
   */
  setOnSubscribeResponse(callback) {}

  /**
   * Starts subscription purchase flow.
   * @param {string} sku
   */
  subscribe(sku) {}

  /**
   * Starts subscription purchase flow.
   * @param {SubscriptionRequest} subscriptionRequest
   */
  updateSubscription(subscriptionRequest) {}

  /**
   * Set the contribution complete callback.
   * @param {function(!Promise<!SubscribeResponse>)} callback
   */
  setOnContributionResponse(callback) {}

  /**
   * Set the payment complete callback.
   * @param {function(!Promise<!SubscribeResponse>)} callback
   */
  setOnPaymentResponse(callback) {}

  /**
   * Starts contributions purchase flow.
   * @param {string|SubscriptionRequest} skuOrSubscriptionRequest
   */
  contribute(skuOrSubscriptionRequest) {}

  /**
   * Starts the deferred account creation flow.
   * See `DeferredAccountCreationRequest` for more details.
   * @param {?DeferredAccountCreationRequest=} options
   * @return {!Promise<!DeferredAccountCreationResponse>}
   */
  completeDeferredAccountCreation(options) {}

  /**
   * @param {function(!LoginRequest)} callback
   */
  setOnLoginRequest(callback) {}

  /**
   * Starts the login prompt flow.
   * @return {!Promise}
   */
  showLoginPrompt() {}

  /**
   * Starts the login notification flow.
   * @return {!Promise}
   */
  showLoginNotification() {}

  /**
   * @param {function()} callback
   */
  setOnLinkComplete(callback) {}

  /**
   * @param {!Promise} accountPromise Publisher's promise to lookup account.
   * @return {!Promise}
   */
  waitForSubscriptionLookup(accountPromise) {}

  /**
   * Starts the Account linking flow.
   * TODO(dparikh): decide if it's only exposed for testing or PROD purposes.
   * @param {{ampReaderId: (string|undefined)}=} params
   */
  linkAccount(params) {}

  /**
   * Notifies the client that a flow has been started. The name of the flow
   * is passed as the callback argument. The flow name corresponds to the
   * method name in this interface, such as "showOffers", or "subscribe".
   * See `SubscriptionFlows` for the full list.
   *
   * Also see `setOnFlowCanceled` method.
   *
   * @param {function({flow: string, data: !Object})} callback
   */
  setOnFlowStarted(callback) {}

  /**
   * Notifies the client that a flow has been canceled. The name of the flow
   * is passed as the callback argument. The flow name corresponds to the
   * method name in this interface, such as "showOffers", or "subscribe".
   * See `SubscriptionFlows` for the full list.
   *
   * Notice that some of the flows, such as "subscribe", could additionally
   * have their own "cancel" events.
   *
   * Also see `setOnFlowStarted` method.
   *
   * @param {function({flow: string, data: !Object})} callback
   */
  setOnFlowCanceled(callback) {}

  /**
   * Starts the save subscriptions flow.
   * @param {!SaveSubscriptionRequestCallback} requestCallback
   * @return {!Promise} a promise indicating flow is started
   */
  saveSubscription(requestCallback) {}

  /**
   * Creates an element with the SwG button style and the provided callback.
   * The default theme is "light".
   *
   * @param {!ButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {!Element}
   */
  createButton(optionsOrCallback, callback) {}

  /**
   * Attaches the SwG button style and the provided callback to an existing
   * DOM element. The default theme is "light".
   *
   * @param {!Element} button
   * @param {!ButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   */
  attachButton(button, optionsOrCallback, callback) {}

  /**
   * Attaches smartButton element and the provided callback.
   * The default theme is "light".
   *
   * @param {!Element} button
   * @param {!SmartButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   */
  attachSmartButton(button, optionsOrCallback, callback) {}

  /**
   * Retrieves the propensity module that provides APIs to
   * get propensity scores based on user state and events
   * @return {!Promise<PropensityApi>}
   */
  getPropensityModule() {}

  /** @return {!Promise<LoggerApi>} */
  getLogger() {}
}

/** @enum {string} */
export const SubscriptionFlows = {
  SHOW_OFFERS: 'showOffers',
  SHOW_SUBSCRIBE_OPTION: 'showSubscribeOption',
  SHOW_ABBRV_OFFER: 'showAbbrvOffer',
  SHOW_CONTRIBUTION_OPTIONS: 'showContributionOptions',
  SUBSCRIBE: 'subscribe',
  CONTRIBUTE: 'contribute',
  COMPLETE_DEFERRED_ACCOUNT_CREATION: 'completeDeferredAccountCreation',
  LINK_ACCOUNT: 'linkAccount',
  SHOW_LOGIN_PROMPT: 'showLoginPrompt',
  SHOW_LOGIN_NOTIFICATION: 'showLoginNotification',
};

/**
 * Configuration properties:
 * - windowOpenMode - either "auto" or "redirect". The "redirect" value will
 *   force redirect flow for any window.open operation, including payments.
 *   The "auto" value either uses a redirect or a popup flow depending on
 *   what's possible on a specific environment. Defaults to "auto".
 * - enableSwgAnalytics - if set to true then events logged by the publisher's
 *   client will be sent to Google's SwG analytics service.  This information is
 *   used to compare the effectiveness of Google's buy-flow events to those
 *   generated by the publisher's client code.  This includes events sent to
 *   both PropensityApi and LoggerApi.
 * - enablePropensity - If true events from the logger api are sent to the
 *   propensity server.  Note events from the legacy propensity endpoint are
 *   always sent.
 * @typedef {{
 *   experiments: (!Array<string>|undefined),
 *   windowOpenMode: (!WindowOpenMode|undefined),
 *   analyticsMode: (!AnalyticsMode|undefined),
 *   enableSwgAnalytics: (boolean|undefined),
 *   enablePropensity: (boolean|undefined),
 * }}
 */
export let Config;

/**
 * @enum {number}
 */
export const AnalyticsMode = {
  DEFAULT: 0,
  IMPRESSIONS: 1,
};

/**
 * @enum {string}
 */
export const WindowOpenMode = {
  AUTO: 'auto',
  REDIRECT: 'redirect',
};

/**
 * @enum {string}
 */
export const ReplaceSkuProrationMode = {
  // The replacement takes effect immediately, and the remaining time will
  // be prorated and credited to the user. This is the current default
  // behavior.
  IMMEDIATE_WITH_TIME_PRORATION: 'IMMEDIATE_WITH_TIME_PRORATION',
};

/**
 * The Offers/Contributions UI is rendered differently based on the
 * ProductType. The ProductType parameter is passed to the Payments flow, and
 * then passed back to the Payments confirmation page to render messages/text
 * based on the ProductType.
 * @enum {string}
 */
export const ProductType = {
  SUBSCRIPTION: 'SUBSCRIPTION',
  UI_CONTRIBUTION: 'UI_CONTRIBUTION',
};

/**
 * @return {!Config}
 */
export function defaultConfig() {
  return {
    experiments: [ExperimentFlags.METERING],
    windowOpenMode: WindowOpenMode.AUTO,
    analyticsMode: AnalyticsMode.DEFAULT,
    enableSwgAnalytics: false,
    enablePropensity: false,
  };
}

/**
 * Properties:
 * - skus - a list of SKUs to return from the defined or default list. The
 *   order is preserved.
 * - list - a predefined list of SKUs. Use of this property is uncommon.
 *   Possible values are "default" and "amp". Default is "default".
 * - isClosable - a boolean value to determine whether the view is closable.
 *
 * @typedef {{
 *   skus: (!Array<string>|undefined),
 *   list: (string|undefined),
 *   isClosable: (boolean|undefined),
 * }}
 */
export let OffersRequest;

/**
 * @typedef {{
 *   linkRequested: boolean,
 * }}
 */
export let LoginRequest;

/**
 * Properties:
 * - one and only one of "token" or "authCode"
 * AuthCode reference: https://developers.google.com/actions/identity/oauth2-code-flow
 * Token reference: https://developers.google.com/actions/identity/oauth2-implicit-flow
 * @typedef {{
 *   token: (string|undefined),
 *   authCode: (string|undefined),
 * }}
 */
export let SaveSubscriptionRequest;

/**
 * Callback for retrieving subscription request
 *
 * @callback SaveSubscriptionRequestCallback
 * @return {!Promise<SaveSubscriptionRequest> | !SaveSubscriptionRequest} request
 */
export let SaveSubscriptionRequestCallback;

/**
 * Properties:
 * - lang: Sets the button SVG and title. Default is "en".
 * - theme: "light" or "dark". Default is "light".
 *
 * @typedef {{
 *   theme: (string|undefined),
 *   lang: (string|undefined),
 * }}
 */
export let ButtonOptions;

/**
 * Properties:
 * - lang: Sets the button SVG and title. Default is "en".
 * - theme: "light" or "dark". Default is "light".
 * - messageTextColor: Overrides theme color for message text. (ex: "#09f")
 *
 * @typedef {{
 *   theme: (string|undefined),
 *   lang: (string|undefined),
 *   messageTextColor: (string|undefined),
 * }}
 */
export let SmartButtonOptions;

/**
 * Properties:
 * - sku: Required. Sku to add to the user's subscriptions.
 * - oldSku: Optional. This is if you want to replace one sku with another. For
 *  example, if a user wants to upgrade or downgrade their current subscription.
 * - prorationMode: Optional. When replacing a subscription you can decide on a
 *  specific proration mode to charge the user.
 *  The default is IMMEDIATE_WITH_TIME_PRORATION.
 * - oneTime: Optional. When a user chooses a contribution, they have the option
 *  to make it non-recurring.
 *
 *  @typedef {{
 *    skuId: string,
 *    oldSku: (string|undefined),
 *    replaceSkuProrationMode: (ReplaceSkuProrationMode|undefined),
 *    oneTime: (boolean|undefined),
 * }}
 */
export let SubscriptionRequest;
