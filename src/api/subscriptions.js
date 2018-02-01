/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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


/**
 * @interface
 */
export class Subscriptions {

  /**
   * Starts the entitlement flow.
   */
  start() {}

  /**
   * Resets the entitlements that can be fetched again.
   */
  reset() {}

  /**
   * @return {!Promise<?./entitlements.Entitlements>}
   */
  getEntitlements() {}

  /**
   * Set the subscribe callback.
   * @param {function(!Promise<?./entitlements.Entitlements>)} callback
   */
  setOnEntitlementsResponse(callback) {}

  /**
   * Starts the Offers flow.
   */
  showOffers() {}

  /**
   * Set the subscribe callback.
   * @param {function(!Promise<!./subscribe-response.SubscribeResponse>)} callback
   */
  setOnSubscribeResponse(callback) {}

  /**
   * Starts subscription purchase flow.
   * @param {string} sku
   */
  subscribe(sku) {}

  /**
   * @param {function()} callback
   */
  setOnLoginRequest(callback) {}

  /**
   * @param {function(!Promise)} callback
   */
  setOnLinkComplete(callback) {}

  /**
   * Starts the Account linking flow.
   * TODO(dparikh): decide if it's only exposed for testing or PROD purposes.
   */
  linkAccount() {}
}
