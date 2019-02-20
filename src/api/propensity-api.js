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

export const SubscriptionStates = {
  // user's subscription state not known
  UNKNOWN: 'na',
  // user is not a subscriber
  NON_SUBSCRIBER: 'no',
  // user is a subscriber
  SUBSCRIBER: 'yes',
  // user subscription has expired
  PAST_SUBSCRIBER: 'ex',
};

export const Events = {
  // user hits a paywall
  IMPRESSION_PAYWALL: 'paywall',
  // user has subscribed
  IMPRESSION_SUBSCRIBED: 'subscribed',
  // user's subscription has expired
  IMPRESSION_EXPIRED: 'expired',
  // user has seen an ad
  IMPRESSION_AD: 'ad_impression',
  // user has been shown a list of available offers
  IMPRESSION_OFFER: 'offer_impression',
  // user has selected an offer
  ACTION_OFFER_SELECTION: 'offer_selection',
  // user has started payment flow, before redirect to checkout page
  ACTION_PAY: 'checkout',
  // user registration with a new account creation
  ACTION_ACCOUNT_CREATED: 'create_account',
  // user login before redirect
  ACTION_LOGIN: 'login',
  // user subscription cancelation
  ACTION_CANCELLED: 'cancelled',
  // custom event
  EVENT_CUSTOM: 'custom',
};

export const PropensityType = {
  GENERAL: 'general',
  PAYWALL: 'paywall',
}

/**
 * @interface
 */
export class PropensityApi {

   /**
   * Provide user subscription state upon discovery
   * @param {string} state
   */
  initSession(state) {}

   /**
   * Returns the propensity of a user to subscribe
   * @param {string=} type
   * @return {?Promise<number>}
   */
  getPropensity(type) {}

   /**
   * Send user events to the DRX server
   * @param {string} userEvent
   * @param {?Object} jsonParams
   */
   event(userEvent, jsonParams) {}
}
