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
   * Optionally configugures the runtime with non-default properties. See
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
   * @return {!Promise<!Entitlements>}
   */
  getEntitlements() {}

  /**
   * Set the subscribe callback.
   * @param {function(!Promise<!Entitlements>)} callback
   */
  setOnEntitlementsResponse(callback) {}

  /**
   * Returns a set of offers.
   * @param {{
   *   productId: (string|undefined),
   * }=} opt_options
   * @return {!Promise<!Array<!Offer>>}
   */
  getOffers(opt_options) {}

  /**
   * Starts the Offers flow.
   * @param {!OffersRequest=} opt_options
   */
  showOffers(opt_options) {}

  /**
   * Show subscription option.
   * @param {!OffersRequest=} opt_options
   */
  showSubscribeOption(opt_options) {}

  /**
   * Show abbreviated offers.
   * @param {!OffersRequest=} opt_options
   */
  showAbbrvOffer(opt_options) {}

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
   * Starts the deferred account creation flow.
   * See `DeferredAccountCreationRequest` for more details.
   * @param {?DeferredAccountCreationRequest=} opt_options
   * @return {!Promise<!DeferredAccountCreationResponse>}
   */
  completeDeferredAccountCreation(opt_options) {}

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
   */
  linkAccount() {}

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
   * Creates an element with the SwG button style and the provided callback.
   * The default theme is "light".
   *
   * @param {!ButtonOptions|function()} optionsOrCallback
   * @param {function()=} opt_callback
   * @return {!Element}
   */
  createButton(optionsOrCallback, opt_callback) {}

  /**
   * Attaches the SwG button style and the provided callback to an existing
   * DOM element. The default theme is "light".
   *
   * @param {!Element} button
   * @param {!ButtonOptions|function()} optionsOrCallback
   * @param {function()=} opt_callback
   */
  attachButton(button, optionsOrCallback, opt_callback) {}
}


/** @enum {string} */
export const SubscriptionFlows = {
  SHOW_OFFERS: 'showOffers',
  SHOW_ABBRV_OFFER: 'showAbbrvOffer',
  SUBSCRIBE: 'subscribe',
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
 *
 * @typedef {{
 *   windowOpenMode: (!WindowOpenMode|undefined),
 * }}
 */
export let Config;


/**
 * @enum {string}
 */
export const WindowOpenMode = {
  AUTO: 'auto',
  REDIRECT: 'redirect',
};


/**
 * @return {!Config}
 */
export function defaultConfig() {
  return {
    windowOpenMode: WindowOpenMode.AUTO,
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
 * @return {!Promise<SaveSbuscriptionRequest> | !SaveSubscriptionRequest} request
 */
export let SaveSubscriptionRequestCallback;

/**
 * Properties:
 * - theme: "light" or "dark". Default is "light".
 *
 * @typedef {{
 *   theme: string,
 * }}
 */
export let ButtonOptions;
