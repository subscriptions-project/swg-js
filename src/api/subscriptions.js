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

import {
  DeferredAccountCreationRequest,
  DeferredAccountCreationResponse,
} from './deferred-account-creation';
import {Entitlements} from './entitlements';
import {LoggerApi} from './logger-api';
import {Offer} from './offer';
import {PropensityApi} from './propensity-api';
import {SubscribeResponse} from './subscribe-response';

/**
 * @interface
 */
export class Subscriptions {
  /**
   * Optionally initializes the subscriptions runtime with publication or
   * product ID. If not called, the runtime will look for the initialization
   * parameters in the page's markup.
   * @param {string} unusedProductOrPublicationId
   */
  init(unusedProductOrPublicationId) {}

  /**
   * Optionally configures the runtime with non-default properties. See
   * `Config` definition for details.
   * @param {!Config} unusedConfig
   */
  configure(unusedConfig) {}

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
   * @param {?string=} unusedEncryptedDocumentKey
   * @return {!Promise<!Entitlements>}
   */
  getEntitlements(unusedEncryptedDocumentKey) {}

  /**
   * Set the subscribe callback.
   * @param {function(!Promise<!Entitlements>)} unusedCallback
   */
  setOnEntitlementsResponse(unusedCallback) {}

  /**
   * Returns a set of offers.
   * @param {{
   *   productId: (string|undefined),
   * }=} unusedOptions
   * @return {!Promise<!Array<!Offer>>}
   */
  getOffers(unusedOptions) {}

  /**
   * Starts the Offers flow.
   * @param {!OffersRequest=} unusedOptions
   */
  showOffers(unusedOptions) {}

  /**
   * Starts the Offers flow for a subscription update.
   * @param {!OffersRequest=} unusedOptions
   */
  showUpdateOffers(unusedOptions) {}

  /**
   * Show subscription option.
   * @param {!OffersRequest=} unusedOptions
   */
  showSubscribeOption(unusedOptions) {}

  /**
   * Show abbreviated offers.
   * @param {!OffersRequest=} unusedOptions
   */
  showAbbrvOffer(unusedOptions) {}

  /**
   * Show contribution options for the users to select from.
   * The options are grouped together by periods (Weekly, Monthly, etc.).
   * User can select the amount to contribute to from available options
   * to the publisher. These options are based on the SKUs defined in the Play
   * console for a given publication.
   * Each SKU has Amount, Period, SKUId and other attributes.
   * @param {!OffersRequest=} unusedOptions
   */
  showContributionOptions(unusedOptions) {}

  /**
   * Set the callback for the native subscribe request. Setting this callback
   * triggers the "native" option in the offers flow.
   * @param {function()} unusedOptions
   */
  setOnNativeSubscribeRequest(unusedOptions) {}

  /**
   * Set the subscribe complete callback.
   * @param {function(!Promise<!SubscribeResponse>)} unusedOptions
   */
  setOnSubscribeResponse(unusedOptions) {}

  /**
   * Starts subscription purchase flow.
   * @param {string} unusedSku
   */
  subscribe(unusedSku) {}

  /**
   * Starts subscription purchase flow.
   * @param {SubscriptionRequest} unusedSubscriptionRequest
   */
  updateSubscription(unusedSubscriptionRequest) {}

  /**
   * Set the contribution complete callback.
   * @param {function(!Promise<!SubscribeResponse>)} unusedCallback
   */
  setOnContributionResponse(unusedCallback) {}

  /**
   * Set the payment complete callback.
   * @param {function(!Promise<!SubscribeResponse>)} unusedCallback
   */
  setOnPaymentResponse(unusedCallback) {}

  /**
   * Starts contributions purchase flow.
   * @param {string|SubscriptionRequest} unusedSkuOrSubscriptionRequest
   */
  contribute(unusedSkuOrSubscriptionRequest) {}

  /**
   * Starts the deferred account creation flow.
   * See `DeferredAccountCreationRequest` for more details.
   * @param {?DeferredAccountCreationRequest=} unusedOptions
   * @return {!Promise<!DeferredAccountCreationResponse>}
   */
  completeDeferredAccountCreation(unusedOptions) {}

  /**
   * @param {function(!LoginRequest)} unusedCallback
   */
  setOnLoginRequest(unusedCallback) {}

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
   * @param {function()} unusedCallback
   */
  setOnLinkComplete(unusedCallback) {}

  /**
   * @param {!Promise} unusedAccountPromise Publisher's promise to lookup account.
   * @return {!Promise}
   */
  waitForSubscriptionLookup(unusedAccountPromise) {}

  /**
   * Starts the Account linking flow.
   * TODO(dparikh): decide if it's only exposed for testing or PROD purposes.
   * @param {{ampReaderId: (string|undefined)}=} unusedParams
   */
  linkAccount(unusedParams) {}

  /**
   * Notifies the client that a flow has been started. The name of the flow
   * is passed as the callback argument. The flow name corresponds to the
   * method name in this interface, such as "showOffers", or "subscribe".
   * See `SubscriptionFlows` for the full list.
   *
   * Also see `setOnFlowCanceled` method.
   *
   * @param {function({flow: string, data: !Object})} unusedCallback
   */
  setOnFlowStarted(unusedCallback) {}

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
   * @param {function({flow: string, data: !Object})} unusedCallback
   */
  setOnFlowCanceled(unusedCallback) {}

  /**
   * Starts the save subscriptions flow.
   * @param {!SaveSubscriptionRequestCallback} unusedCallback
   * @return {!Promise} a promise indicating flow is started
   */
  saveSubscription(unusedCallback) {}

  /**
   * Creates an element with the SwG button style and the provided callback.
   * The default theme is "light".
   *
   * @param {!ButtonOptions|function()} unusedOptionsOrCallback
   * @param {function()=} unusedCallback
   * @return {!Element}
   */
  createButton(unusedOptionsOrCallback, unusedCallback) {}

  /**
   * Attaches the SwG button style and the provided callback to an existing
   * DOM element. The default theme is "light".
   *
   * @param {!Element} unusedButton
   * @param {!ButtonOptions|function()} unusedOptionsOrCallback
   * @param {function()=} unusedCallback
   */
  attachButton(unusedButton, unusedOptionsOrCallback, unusedCallback) {}

  /**
   * Attaches smartButton element and the provided callback.
   * The default theme is "light".
   *
   * @param {!Element} unusedButton
   * @param {!SmartButtonOptions|function()} unusedOptionsOrCallback
   * @param {function()=} unusedCallback
   */
  attachSmartButton(unusedButton, unusedOptionsOrCallback, unusedCallback) {}

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
 *   gdprVendorIds: (!Array<string>|undefined),
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
