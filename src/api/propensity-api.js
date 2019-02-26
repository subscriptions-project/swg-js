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
  NON_SUBSCRIBER: 'no',
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
  // user has seen an ad
  // the json block can provide the name of the ad campaign
  // for example; {'name': 'fall_ad'}
  IMPRESSION_AD: 'ad_shown',
  // user has been shown a list of available offers
  // the json block will provide a list of skus/products displayed
  // and the source, indicating why the user was shown the offer
  // for example; {'offers'; ['basic-monthly', 'premium-weekly'],
  //               'source': 'paywall'}
  IMPRESSION_OFFERS: 'offers_shown',
  // user has selected an offer
  // the json block can provide the product selected
  // for example; {'product': 'basic-monthly'}
  ACTION_OFFER_SELECTION: 'offer_selected',
  // user has started payment flow
  // the json block can provide the product selected
  // for example; {'product': 'basic-monthly'}
  ACTION_PURCHASE_FLOW_STARTED: 'payment_flow_start',
  // user subscription has been cancelled
  // the json block can provide the reason for failure
  // for example; {'reason': 'user_exit'}
  ACTION_PURCHASE_FLOW_CANCELLED: 'payment_flow_cancelled',
  // custom publisher event
  // the json block can provide the event name for the custom event
  // for example; {'name': 'email_signup'}
  EVENT_CUSTOM: 'custom',
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
   * A json object of depth '1' must be provided if the user is
   * a subscriber indicating what they paid for. For example;
   * {'product': ['basic-monthly', 'audio-weekly']}
   * @param {SubscriptionState} state
   * @param {?Object} jsonEntitlements
   */
  initSession(state, jsonEntitlements) {}

   /**
   * Returns the propensity of a user to subscribe
   * The string should be a valid string from PropensityType
   * If no type is provided, generic score is returned
   * @param {?PropensityType=} type
   * @return {?Promise<number>}
   */
  getPropensity(type) {}

   /**
   * Send user events to the DRX server
   * Event should be valid string in Events
   * JSON block of depth '1' provides event parameters
   * @param {Event} userEvent
   * @param {?Object} jsonParams
   */
   event(userEvent, jsonParams) {}

   /**
    * Provide user consent to enable ad personalization
    * @param {boolean} userConsent
    */
   enablePersonalization(userConsent) {}
}
