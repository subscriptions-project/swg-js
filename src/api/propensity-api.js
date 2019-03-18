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
 * Subscription related events. A JSON block of depth 1 describing
 * the event can be sent as a parameter in the sendEvent() API call
 * to provide more context about the event. Listed below are enum
 * enum strings to specify events and corresponding JSON keys to
 * populate as parameters when an event is sent in the API.
 * @enum {string}
 */
export const Event = {
  /**
   * IMPRESSION_PAYWALL event.
   * User hits a paywall.
   * Every impression should be qualified as active or passive.
   * If the user has run out of metering, and that’s why was shown
   * a paywall, that would be a passive impression of the paywall.
   * For example; {‘is_active’: false}
   */
  IMPRESSION_PAYWALL: 'paywall',
  /**
   * IMPRESSION_AD event
   * User has seen an ad.
   * Every impression should be qualified as active or passive.
   * The json block can provide the name of the ad campaign.
   * Ad impressions are usually passive.
   * For example; {'name': 'fall_ad', 'is_active': false }
   */
  IMPRESSION_AD: 'ad_shown',
  /**
   * IMPRESSION_OFFERS event.
   * User has been shown a list of available offers for subscription.
   * Every impression should be qualified as active or passive.
   * The json block will provide a list of products displayed,
   * and the source, indicating why the user was shown the offer
   * (note that source is not the same as referrer)
   * In the cases below, the user took action before seeing the offers,
   * and therefore considered active impression.
   * For example; {'offers': ['basic-monthly', 'premium-weekly'],
   *               'source': 'ad-click',
                  ‘is_ative’: true}
   * For example; {‘offers’: [‘basic-monthly’, ‘premium-weekly’],
   *              ‘source’: ‘navigate-to-offers-page’,
   *              ‘is_active’: true }
   * If the user was shown the offers as a result of paywall metering
   * expiration, it is considered a passive impression.
   * For example; {‘offers’: [‘basic-monthly’],
   *               ‘source’: ‘paywall-metering-expired’,
   *               ‘is_active’: false}
   * If the user navigated to a landing page that was not a part of
   * the funnel related to subscribing to the publisher’s content,
   * then the impression of offers shown on the landing page is
   * considered passive.
   * For example; {‘offers’: [‘basic-weekly’, ‘premium-annually’],
   *               ‘source’: ‘landing-page’,
   *               ‘is_active’: false}
   * If the user navigated to a subscriptions landing page that is
   * a part of the funnel related to subscribing to the publisher’s
   * content, then the impression of offers shown on this landing
   * page is considered active.
   * For example; {‘offers’: [‘basic-weekly’, ‘premium-annually’],
   *               ‘source’: ‘subscriptions-landing-page’,
   *               ‘is_active’: true}
   */
  IMPRESSION_OFFERS: 'offers_shown',
  /**
   * ACTION_SUBSCRIPTIONS_LANDING_PAGE event: describing the event
   * that corresponds to an action taken by the user to go
   * to a landing page. The landing page must satisfy one of the
   * following conditions and hence be a part of the funnel to get
   * the user to subscribe:
   * - have a button to navigate the user to an offers page, (in
   *   this case, the next event will be IMPRESSION_OFFERS, with
   *   parameter 'source' as subscriptions-landing-page and
   *   'is_active' will be set to true)
   * - show offers the user can select, (in this case, the next
   *   event will be IMPRESSION_OFFERS, with a parameter 'source'
   *   as navigate-to-offers-page and 'is_active' set to true)
   * - provide a way to start the payment flow for a specific offer.
   *   (in this case, the next event will be ACTION_OFFER_SELECTED
   *   or ACTION_PAYMENT_FLOW_STARTED depending on if that button
   *   took the user to a checkout page on the publishers site or
   *   directly started the payment flow)
   * The json block with this event can provide additional information
   * such as the source, indicating what caused the user to navigate
   * to this page.
   * for example; {‘source’: ‘marketing_via_email’}
   */
  ACTION_SUBSCRIPTIONS_LANDING_PAGE: 'subscriptions_anding_page',
  /**
   * ACTION_OFFER_SELECTED event: describing the event when
   * the user has selected an offer the json block can provide
   * the product selected.
   * for example; {'product': 'basic-monthly'}
   * When offer selection starts the payment flow directly,
   * use the next event ACTION_PAYMENT_FLOW_STARTED instead.
   */
  ACTION_OFFER_SELECTED: 'offer_selected',
  /**
   * ACTION_PAYMENT_FLOW_STARTED event: describing the event when
   * the user has started payment flow
   * the json block can provide the product selected
   * For example; {'product': 'basic-monthly'}
   */
  ACTION_PAYMENT_FLOW_STARTED: 'payment_flow_start',
  /**
   * ACTION_PAYMENT_COMPLETED event: describing the event when
   * the user has made the payment for a subscription
   * the json block can provide the product user paid for
   * For example; {'product': 'basic-monthly'}
   */
  ACTION_PAYMENT_COMPLETED: 'payment_complete',
  /**
   * EVENT_CUSTOM: custom publisher event,
   * the json block can provide the event name for the custom event
   * For example; {'name': 'email_signup'}
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
 * Properties:
 * - result: Required. When available, provides the propensity score of the
 *       requested type with a number in the range [0-100], indicating the
 *       likelihood of a user to subscribe
 *       Note: 80 is more likely than 20, but that does not imply that the
 *       likelihood is 4 times as much. Mapping of the score value to the
 *       statistical probability of a user to subscribe is not accurate at
 *       time. If there are any errors which prevented the server from
 *       generating and providing a valid score, it will be a string
 *       describing why score was not available
 *
 *  @typedef {{
 *    result: (number|string)
 * }}
 */
export let Body;

/**
 * Properties:
 * - ok: Required. true, if propensity score is available, false otherwise
 *
 *  @typedef {{
 *    ok: boolean,
 * }}
 */
export let Header;

/**
 * Properties:
 * - header: Required. Provides the header of the Score response
 * - body: Required. Provides the body of the Score response
 *
 *  @typedef {{
 *    header: Header,
 *    body: Body,
 * }}
 */
export let PropensityScore;

/**
 * @interface
 */
export class PropensityApi {
  /**
   * Provide user subscription state upon initial discovery.
   * A user may have active subscriptions to some products
   * and expired subscriptions to others. Make one API call
   * per subscription state and provide a corresponding
   * list of products with a json object of depth 1.
   * For example:
   *     {'product': ['basic-monthly', 'audio-weekly']}
   * Each call to this API should have the first argument
   * as a valid string from the enum SubscriptionState.
   * @param {SubscriptionState} state
   * @param {?JsonObject} jsonEntitlements
   */
  sendSubscriptionState(state, jsonEntitlements) {}

  /**
   * Send a single user event.
   * Event should be valid string in Events.
   * JSON block of depth '1' provides event parameters.
   * The guideline to create this JSON block that describes
   * the event is provided against each enum listed in
   * the Event space.
   * @param {Event} userEvent
   * @param {?JsonObject} jsonParams
   */
   sendEvent(userEvent, jsonParams) {}

  /**
   * Returns the propensity of a user to subscribe.
   * The argument should be a valid string from PropensityType.
   * If no type is provided, generic score is returned.
   * @param {PropensityType=} type
   * @return {?Promise<!PropensityScore>}
   */
  getPropensity(type) {}
}
