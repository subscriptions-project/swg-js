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
  /**
   * user hits a paywall. Every impression should be qualified
   * as active or passive. If the user has run out of metering,
   * and that’s why was shown a paywall, that would be a passive
   * impression of the paywall.
   * for example; {‘is_active’: false}
   */
  IMPRESSION_PAYWALL: 'paywall',
  /**
   * user has seen an ad the json block can provide the name of
   * the ad campaign.
   * for example; {'name': 'fall_ad', 'is_active': false }
   */
  IMPRESSION_AD: 'ad_shown',
  /**
   * user has been shown a list of available offers.
   * the json block will provide a list of products displayed,
   * indication of active or passive impression,
   * and the source, indicating why the user was shown the offer
   * (note that source is not the same as referrer)
   * In the cases below, the user took action before seeing the offers,
   * and therefore considered active impression
   * for example; {'offers': ['basic-monthly', 'premium-weekly'],
   *               'source': 'ad-click',
                  ‘is_ative’: true}
   * for example; {‘offers’: [‘basic-monthly’, ‘premium-weekly’],
   *              ‘source’: ‘navigate_to_offers_page’,
   *              ‘is_active’: true }
   * If the user was shown the offers as a result of paywall metering
   * expiration, it is considered a passive impression.
   * for example; {‘offers’: [‘basic-monthly’],
   *               ‘source’: ‘paywall-metering-expired’,
   *             ‘is_active’: false}
   * If the user navigated to a landing page that was not a part of
   * the funnel related to subscribing to the publisher’s content,
   * then the impression of offers shown on the landing page is
   * considered passive.
   * for example; {‘offers’: [‘basic-weekly’, ‘premium-annually’],
   *               ‘source’: ‘landing-page’,
   *               ‘is_active’: false}
   */
  IMPRESSION_OFFERS: 'offers_shown',
  /**
   * This event corresponds to an action taken by the user to go
   * to a landing page. The landing page must satisfy one of the
   * following conditions and hence be a part of the funnel to get
   * the user to subscribe:
   * - have a button to navigate the user to an offers page, or
   * - show offers the user can select, or
   * - provide a way to start the payment flow for a specific offer
   * The json block with this event can provide additional information
   * such as the source, indicating what caused the user to navigate
   * to this page.
   * for example; {‘source’: ‘marketing_via_email’}
   */
 ACTION_LANDING_PAGE: 'landing_page',
  /**
   * user has selected an offer the json block can provide the product
   * selected
   * for example; {'product': 'basic-monthly'}
   */
  ACTION_OFFER_SELECTED: 'offer_selected',
  /**
   * user has started payment flow
   * the json block can provide the product selected
   * for example; {'product': 'basic-monthly'}
   */
  ACTION_PAYMENT_FLOW_STARTED: 'payment_flow_start',
  /** user has made the payment for a subscription
   * the json block can provide the product user paid for
   * for example; {'product': 'basic-monthly'}
   */
  ACTION_PAYMENT_COMPLETED: 'payment_complete',
  /**
   * custom publisher event,
   * the json block can provide the event name for the custom event
   * for example; {'name': 'email_signup'}
   */
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
