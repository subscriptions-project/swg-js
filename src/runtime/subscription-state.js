/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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
 * Subscription metering.
 * TODO(dparikh): "quotaMax" is not available at:
 * https://docs.google.com/document/d/1PrNTKzpkFja8LA27tHeqqG8hm918aI5wPI41Ykc1lBE/edit#heading=h.12wjaxir6me2
 * @typedef {{
 *   quotaLeft: number,
 *   quotaMax: number,
 *   quotaPeriod: string,
 *   display: boolean
 * }}
 */
export let SubscriptionMetering;


/**
 * Subscription status.
 * @typedef {{
 *   healthy: boolean,
 *   entitlementId: string,
 *   types: (!Array<string>|undefined),
 *   source: string
 * }}
 */
export let SubscriptionStatus;


/**
 * Subscription details and Offer response from Offers API.
 * Includes:
 *   - Is user Logged-in to Google
 *   - Is user a subscriber and healthy status
 *   - metering data
 *   - Abbreviated offers related to the publisher  // TODO(dparikh): Confirm
 *   - Offers related to the publisher
 *
 * @typedef {{
 *   access: boolean,
 *   subscriber: (SubscriptionStatus|undefined),
 *   metering: (SubscriptionMetering|undefined),
 *   abbreviatedOffers: (!Array<!Object>|undefined),
 *   offer: (!Array<!JsonObject>|undefined)
 * }}
 */
export let SubscriptionResponse;


/**
 * Class to expose state related to subscriptions. This class is passed
 * around to various steps of the subscription flow to maintain state. This
 * class is also responsible for serializing and de-serializing the state from
 * storage.
 */
export class SubscriptionState {

  /**
   * @param  {!Window} win
   */
  constructor(win) {
    this.win = win;

    /** @private {Array<JsonObject>} */
    this.offers_ = null;

    /** @type {boolean} */
    this.access_ = false;
  }

  /**
   * @param {Array<JsonObject>} offers
   */
  setOffers(offers) {
    this.offers_ = offers;
  }

  /**
   * @return {Array<JsonObject>}
   */
  getOffers() {
    return this.offers_;
  }

  /**
   * @param {boolean} access
   */
  setAccess(access) {
    this.access_ = this.access_ || access;
  }

  /**
   * @return {boolean}
   */
  getAccess() {
    return this.access_;
  }

  getChosenOffer() {
    // TODO(avimehta): Below we choose the blob from first offer. In reality,
    // user choice should determine this.
    return this.offers_[0];
  }

  getMetering() {
    throw new Error('Not implemented yet.');
  }
}
