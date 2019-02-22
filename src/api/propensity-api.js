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

/**
 * @enum {string}
 */
export const SubscriptionState = {
  // user's subscription state not known
  UNKNOWN: 'na',
  // user is not a subscriber
  NON_SUBSCRIBER: 'na',
  // user is a subscriber
  SUBSCRIBER: 'yes',
  // user subscription has expired
  PAST_SUBSCRIBER: 'ex',
}

/**
 * @enum {string}
 */
export const Event = {
  // user hits a paywall
  IMPRESSION_PAYWALL: 'paywall',
  // user has subscribed
  IMPRESSION_SUBSCRIBED: 'subscribed',
  // user's subscription has expired
  IMPRESSION_EXPIRED: 'expired',
  // user has seen an ad
  IMPRESSION_AD: 'ad_shown',
  // user has been shown a list of available offers
  IMPRESSION_OFFER: 'offers_shown',
  // user has selected an offer
  ACTION_OFFER_SELECTION: 'offer_selected',
  // user has started payment flow, before redirect to checkout page
  ACTION_SUBSCRIBE: 'checkout',
  // user registration with a new account creation
  ACTION_ACCOUNT_CREATED: 'create_account',
  // user logs in to the publisher site
  ACTION_LOGIN: 'login',
  // user subscription has been cancelled
  ACTION_CANCELLED: 'cancelled',
  // custom publisher event
  EVENT_CUSTOM: 'pub_custom',
}

/**
 * @enum {string}
 */
export const PropensityType = {
  // Propensity score for a user to subscribe to a publication
  GENERAL: 'general',
  // Propensity score when blocked access to content by paywall
  PAYWALL: 'paywall',
}

/**
 * @interface
 */
export class PropensityApi {

   /**
   * Provide user subscription state upon discovery
   * The state should be a valid string from SubscriptionState
   * A concatenated list of products the user is entitled to
   * @param {SubscriptionState} state
   * @param {?string=} entitlements
   */
  initSession(state, entitlements) {}

   /**
   * Returns the propensity of a user to subscribe
   * The string should be a valid string from PropensityType
   * If no type is provided, generic score is provided
   * An optional list of products may be provided for which
   * the propensity score is requested
   * @param {?PropensityType=} type
   * @param {?Array<!string>} products
   * @return {?Promise<number>}
   */
  getPropensity(type, products) {}

   /**
   * Send user events to the DRX server
   * Event should be valid string in Events
   * Additional context can be provided in JSON object format
   * @param {Event} userEvent
   * @param {?Object} jsonParams
   */
   event(userEvent, jsonParams) {}

   /**
    * Provide user consent to enable ad personalization
    * @param {boolean} userConsent
    */
   enablePersonalization() {}
}
