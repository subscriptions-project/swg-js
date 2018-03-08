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
   * Starts the Offers flow.
   */
  showOffers() {}

  /**
   * Show subscription option.
   */
  showSubscribeOption() {}

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
}


/**
 * @typedef {{
 *   linkRequested: boolean,
 * }}
 */
export let LoginRequest;
