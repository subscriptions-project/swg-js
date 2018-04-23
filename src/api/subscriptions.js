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
   * @param {function(!LoginRequest)} callback
   */
  setOnLoginRequest(callback) {}

  /**
   * @param {function()} callback
   */
  setOnLinkComplete(callback) {}

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
  * @param {!SaveSubscriptionRequest} request
  * @return {!Promise<boolean>} status or promise of status of request
  */
  saveSubscription(request) {}

  /**
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
  SHOW_SUBSCRIBE_OPTION: 'showSubscribeOption',
  SHOW_ABBRV_OFFER: 'showAbbrvOffer',
  SUBSCRIBE: 'subscribe',
  LINK_ACCOUNT: 'linkAccount',
};


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
 * @typedef {{
 *   token: string,
 * }}
 */
export let SaveSubscriptionRequest;

/**
 * Properties:
 * - theme: "light" or "dark". Default is "light".
 *
 * @typedef {{
 *   theme: string,
 * }}
 */
export let ButtonOptions;
