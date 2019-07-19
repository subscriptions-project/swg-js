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
import {LoggerApi} from './logger-api';

/**
 * @enum {string}
 */
export const SubscriptionState = {
  // user's subscription state not known.
  UNKNOWN: 'unknown',
  // user is not a subscriber.
  NON_SUBSCRIBER: 'non_subscriber',
  // user is a subscriber.
  SUBSCRIBER: 'subscriber',
  // user's subscription has expired.
  PAST_SUBSCRIBER: 'past_subscriber',
}

/**
 * Subscription related events. Listed below are enum strings that
 * represent events related to Subscription flow. Event parameters
 * that provide more context about the event are sent as a JSON
 * block of depth 1 in the sendEvent() API call.
 * @enum {string}
 */
export const Event = {
  /**
   * IMPRESSION_PAYWALL event.
   * User hits a paywall.
   * Every impression should be qualified as active or passive.
   * The field 'active' of PropensityEvent, which carries this
   * event, must be set to true or false to indicate this.
   * If the user has run out of metering, and that’s why was shown
   * a paywall, that would be a passive impression of the paywall.
   * For example:
   * const propensityEvent = {
   *  name: 'paywall',
   *  active: false,
   * }
   */
  IMPRESSION_PAYWALL: 'paywall',
  /**
   * IMPRESSION_AD event.
   * User has been shown a subscription ad.
   * Every impression should be qualified as active or passive.
   * The field 'active' of PropensityEvent, which carries this
   * event, must be set to true or false to indicate this.
   * The JSON block can provide the name of the subscription ad
   * creative or campaign. Ad impressions are usually passive.
   * const propensityEvent = {
   *   name: 'ad_shown',
   *   active: false,
   *   data: {'ad_name': 'fall_ad'}
   * }
   */
  IMPRESSION_AD: 'ad_shown',
  /**
   * IMPRESSION_OFFERS event.
   * User has been shown a list of available offers for subscription.
   * Every impression should be qualified as active or passive.
   * The field 'active' of PropensityEvent, which carries this
   * event, must be set to true or false to indicate this.
   * The JSON block can provide a list of products displayed,
   * and the source to indicate why the user was shown the offer.
   * Note: source is not the same as referrer.
   * In the cases below, the user took action before seeing the offers,
   * and therefore considered active impression.
   * For example:
   * const propensityEvent = {
   *   name: 'offers_shown',
   *   active: true,
   *   data: {'offers': ['basic-monthly', 'premium-weekly'],
   *           'source': 'ad-click'}
   * }
   * For example:
   * const propensityEvent = {
   *   name: 'offers_shown',
   *   active: true,
   *   data: {'offers': ['basic-monthly', 'premium-weekly'],
   *           'source': ‘navigate-to-offers-page’}
   * }
   * If the user was shown the offers as a result of paywall metering
   * expiration, it is considered a passive impression.
   * For example:
   * const propensityEvent = {
   *   name: 'offers_shown',
   *   active: false,
   *   data: {'offers': ['basic-monthly', 'premium-weekly'],
   *           'source': ‘paywall-metering-expired’}
   * }
   */
  IMPRESSION_OFFERS: 'offers_shown',
  /**
   * ACTION_SUBSCRIPTIONS_LANDING_PAGE event.
   * User has taken the action to arrive at a landing page of the
   * subscription workflow. The landing page should satisfy one of
   * the following conditions and hence be a part of the funnel to
   * get the user to subscribe:
   * - have a button to navigate the user to an offers page, (in
   *   this case, the next event will be IMPRESSION_OFFERS, with
   *   parameter 'source' as subscriptions-landing-page and
   *   'is_active' set to true),
   * - show offers the user can select, (in this case, the next
   *   event will be IMPRESSION_OFFERS, with a parameter 'source'
   *   as navigate-to-offers-page and 'is_active' set to true),
   * - provide a way to start the payment flow for a specific offer.
   *   (in this case, the next event will be ACTION_OFFER_SELECTED
   *   or ACTION_PAYMENT_FLOW_STARTED depending on if that button
   *   took the user to a checkout page on the publishers site or
   *   directly started the payment flow).
   * The field 'active' of PropensityEvent, which carries this
   * event, must be set to true since this is a user action.
   * The JSON block with this event can provide additional information
   * such as the source, indicating what caused the user to navigate
   * to this page.
   * For example:
   * const propensityEvent = {
   *   name: 'subscriptions_landing_page',
   *   active: true,
   *   data: {'source': 'marketing_via_email'}
   * }
   */
  ACTION_SUBSCRIPTIONS_LANDING_PAGE: 'subscriptions_landing_page',
  /**
   * ACTION_OFFER_SELECTED event.
   * User has selected an offer.
   * The field 'active' of PropensityEvent, which carries this
   * event, must be set to true since this is a user action.
   * The JSON block can provide the product selected.
   * For example: {
   *   name: 'offer_selected',
   *   active: true,
   *   data: {product': 'basic-monthly'}
   * }
   * When offer selection starts the payment flow directly,
   * use the next event ACTION_PAYMENT_FLOW_STARTED instead.
   */
  ACTION_OFFER_SELECTED: 'offer_selected',
  /**
   * ACTION_PAYMENT_FLOW_STARTED event.
   * User has started payment flow.
   * The field 'active' of PropensityEvent, which carries this
   * event, must be set to true since this is a user action.
   * The JSON block can provide the product selected.
   * For example:
   * const propensityEvent = {
   *   name: 'payment_flow_started',
   *   active: true,
   *   data: {product': 'basic-monthly'}
   * }
   */
  ACTION_PAYMENT_FLOW_STARTED: 'payment_flow_start',
  /**
   * ACTION_PAYMENT_COMPLETED.
   * User has made the payment for a subscription.
   * The field 'active' of PropensityEvent, which carries this
   * event, must be set to true since this is a user action.
   * The JSON block can provide the product user paid for.
   * For example:
   * const propensityEvent = {
   *   name: 'payment_complete',
   *   active: true,
   *   data: {product': 'basic-monthly'}
   * }
   */
  ACTION_PAYMENT_COMPLETED: 'payment_complete',
  /**
   * EVENT_CUSTOM: custom publisher event.
   * The field 'active' of PropensityEvent, which carries this
   * event, must be set to true or false depending on if the event
   * was generated as a result of a user action.
   * The JSON block can provide the event name for the custom event.
   * For example:
   * const propensityEvent = {
   *   name: 'custom',
   *   active: true,
   *   data: {
   *     'event_name': 'social_share',
   *     'platform_used': 'whatsapp'
   *   }
   *  }
   */
  EVENT_CUSTOM: 'custom',
}

/**
 * @enum {string}
 */
export const PropensityType = {
  // Propensity score for a user to subscribe to a publication.
  GENERAL: 'general',
  // Propensity score when blocked access to content by paywall.
  PAYWALL: 'paywall',
}

/**
 * The Propensity Score
 * - value: Required. A number that indicates the propensity to subscribe.
 * - bucketed: Required. Indicates if the score is a raw score [1-100] or bucketed[1-20].
 *
 * @typedef {{
 *   value: number,
 *   bucketed: boolean,
 * }}
 */
export let Score;

/**
 * Propensity Score Detail
 * Properties:
 * - product: Required. Indicates the publication_id:product_id for which the score is provided.
 * - score: Optional. When score is available, this field contains the propensity score for this product.
 * - error: Optional. When no score is avaialble, a string provides the error message.
 *
 * @typedef {{
 *   product: string,
 *   score: ?Score,
 *   error: ?string,
 * }}
 */
export let ScoreDetail;

/**
 * The Body field of the Propensity Score.
 * Properties:
 * - scores: Optional, an array of scores. When header indicates so, atleast one score is available.
 * - error: Optional, string describing why, if no scores were provided by the server.
 *
 *  @typedef {{
 *    scores: ?Array<ScoreDetail>,
 *    error: ?string,
 * }}
 */
export let Body;

/**
 * The Header of the Propensity Score.
 * Properties:
 * - ok: Required. true, if propensity score is available, false otherwise.
 *
 *  @typedef {{
 *    ok: boolean,
 * }}
 */
export let Header;

/**
 * The Propensity Score.
 * Properties:
 * - header: Required. Provides the header of the Score response.
 * - body: Required. Provides the body of the Score response.
 *
 *  @typedef {{
 *    header: Header,
 *    body: Body,
 * }}
 */
export let PropensityScore;

/**
 * Propensity Event
 * Properties:
 * - name: Required. Name should be valid string in Event.
 * - active: Required. A boolean that indicates whether the
 *         user took some action to participate in the flow
 *         that generated this event. For impression event,
 *         this is set to true if is_active field would be
 *         set to true, as described in documentation for
 *         enum Event. Otherwise, set this field to false.
 *         For action events, this field must always be set
 *         to true. The caller must always set this field.
 * - data: Optional. JSON block of depth '1' provides event
 *         parameters. The guideline to create this JSON block
 *         that describes the event is provided against each
 *         enum listed in the Event enum above.
 *
 *  @typedef {{
 *    name: string,
 *    active: boolean,
 *    data: ?JsonObject,
 * }}
 */
export let PropensityEvent;

/**
 * @interface
 */
export class PropensityApi extends LoggerApi{
  /**
   * Send user subscription state upon initial discovery.
   * A user may have active subscriptions to some products
   * and expired subscriptions to others. Make one API call
   * per subscription state and provide a corresponding
   * list of products with a json object of depth 1.
   * For example:
   *     {'product': ['product1', 'product2']}
   * Each call to this API should have the first argument
   * as a valid string from the enum SubscriptionState.
   * @param {SubscriptionState} state
   * @param {?JsonObject} jsonProducts
   * @override
   */
  sendSubscriptionState(state, jsonProducts) {}

  /**
   * Send a single user event.
   * @param {PropensityEvent} userEvent
   * @override
   */
   sendEvent(userEvent) {}

  /**
   * Get the propensity of a user to subscribe based on the type.
   * The argument should be a valid string from PropensityType.
   * If no type is provided, GENERAL score is returned.
   * @param {PropensityType=} type
   * @return {?Promise<!PropensityScore>}
   */
  getPropensity(type) {}
}
