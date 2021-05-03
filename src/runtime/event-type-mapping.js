/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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

import {AnalyticsEvent, EntitlementResult} from '../proto/api_messages';
import {Event} from '../api/logger-api';
import {
  PublisherEntitlementEvent,
  SubscriptionFlows,
} from '../api/subscriptions';

/** @const {!Object<string,AnalyticsEvent>} */
const PublisherEventToAnalyticsEvent = {
  [Event.IMPRESSION_PAYWALL]: AnalyticsEvent.IMPRESSION_PAYWALL,
  [Event.IMPRESSION_AD]: AnalyticsEvent.IMPRESSION_AD,
  [Event.IMPRESSION_OFFERS]: AnalyticsEvent.IMPRESSION_OFFERS,
  [Event.ACTION_SUBSCRIPTIONS_LANDING_PAGE]:
    AnalyticsEvent.ACTION_SUBSCRIPTIONS_LANDING_PAGE,
  [Event.ACTION_OFFER_SELECTED]: AnalyticsEvent.ACTION_OFFER_SELECTED,
  [Event.ACTION_PAYMENT_FLOW_STARTED]:
    AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
  [Event.ACTION_PAYMENT_COMPLETED]: AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
  [Event.EVENT_CUSTOM]: AnalyticsEvent.EVENT_CUSTOM,
};

/** @const {!Object<?AnalyticsEvent,?Event>} */
const AnalyticsEventToPublisherEvent = {
  [AnalyticsEvent.UNKNOWN]: null,
  [AnalyticsEvent.IMPRESSION_PAYWALL]: Event.IMPRESSION_PAYWALL,
  [AnalyticsEvent.IMPRESSION_AD]: Event.IMPRESSION_AD,
  [AnalyticsEvent.IMPRESSION_OFFERS]: Event.IMPRESSION_OFFERS,
  [AnalyticsEvent.IMPRESSION_SUBSCRIBE_BUTTON]: null,
  [AnalyticsEvent.IMPRESSION_SMARTBOX]: null,
  [AnalyticsEvent.ACTION_SUBSCRIBE]: null,
  [AnalyticsEvent.ACTION_PAYMENT_COMPLETE]: Event.ACTION_PAYMENT_COMPLETED,
  [AnalyticsEvent.ACTION_ACCOUNT_CREATED]: null,
  [AnalyticsEvent.ACTION_ACCOUNT_ACKNOWLEDGED]: null,
  [AnalyticsEvent.ACTION_SUBSCRIPTIONS_LANDING_PAGE]:
    Event.ACTION_SUBSCRIPTIONS_LANDING_PAGE,
  [AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED]:
    Event.ACTION_PAYMENT_FLOW_STARTED,
  [AnalyticsEvent.ACTION_OFFER_SELECTED]: Event.ACTION_OFFER_SELECTED,
  [AnalyticsEvent.EVENT_PAYMENT_FAILED]: null,
  [AnalyticsEvent.EVENT_CUSTOM]: Event.EVENT_CUSTOM,
};

/** @const {!Object<string,?Array<AnalyticsEvent>>} */
const ShowcaseEntitlemenntToAnalyticsEvents = {
  // Events related to content being potentially unlockable
  [PublisherEntitlementEvent.EVENT_SHOWCASE_METER_OFFERED]: [
    AnalyticsEvent.EVENT_HAS_METERING_ENTITLEMENTS,
    AnalyticsEvent.EVENT_OFFERED_METER,
  ],

  // Events related to content being unlocked
  [PublisherEntitlementEvent.EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION]: [
    AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
  ],
  [PublisherEntitlementEvent.EVENT_SHOWCASE_UNLOCKED_BY_METER]: [
    AnalyticsEvent.EVENT_HAS_METERING_ENTITLEMENTS,
    AnalyticsEvent.EVENT_UNLOCKED_BY_METER,
  ],
  [PublisherEntitlementEvent.EVENT_SHOWCASE_UNLOCKED_FREE_PAGE]: [
    AnalyticsEvent.EVENT_UNLOCKED_FREE_PAGE,
  ],

  // Events requiring user action to unlock content
  [PublisherEntitlementEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL]: [
    AnalyticsEvent.EVENT_NO_ENTITLEMENTS,
    AnalyticsEvent.IMPRESSION_REGWALL,
    AnalyticsEvent.IMPRESSION_SHOWCASE_REGWALL,
  ],

  // Events requiring subscription to unlock content
  [PublisherEntitlementEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_PAYWALL]: [
    AnalyticsEvent.EVENT_NO_ENTITLEMENTS,
    AnalyticsEvent.IMPRESSION_PAYWALL,
  ],
  [PublisherEntitlementEvent.EVENT_SHOWCASE_INELIGIBLE_PAYWALL]: [
    // TODO(b/181690059): Create showcase ineligible AnalyticsEvent
    AnalyticsEvent.IMPRESSION_PAYWALL,
  ],
};

/** @const {!Object<?AnalyticsEvent,?Event>} */
const AnalyticsEventToEntitlementResult = {
  [AnalyticsEvent.IMPRESSION_REGWALL]: EntitlementResult.LOCKED_REGWALL,
  [AnalyticsEvent.EVENT_UNLOCKED_BY_METER]: EntitlementResult.UNLOCKED_METER,
  [AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION]:
    EntitlementResult.UNLOCKED_SUBSCRIBER,
  [AnalyticsEvent.EVENT_UNLOCKED_FREE_PAGE]: EntitlementResult.UNLOCKED_FREE,
  [AnalyticsEvent.IMPRESSION_PAYWALL]: EntitlementResult.LOCKED_PAYWALL,
};

/**
 * @param {!string} eventCategory
 * @param {!string} eventAction
 * @param {!string} eventLabel
 * @param {!boolean} nonInteraction
 * @returns {!Object}
 */
const createGoogleAnalyticsEvent = (
  eventCategory,
  eventAction,
  eventLabel,
  nonInteraction
) => ({
  eventCategory,
  eventAction,
  eventLabel,
  nonInteraction,
});

/** @const {!Object<?AnalyticsEvent,?Object>} */
export const AnalyticsEventToGoogleAnalyticsEvent = {
  [AnalyticsEvent.IMPRESSION_OFFERS]: createGoogleAnalyticsEvent(
    'NTG paywall',
    'paywall modal impression',
    '',
    true
  ),
  [AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS]: createGoogleAnalyticsEvent(
    'NTG membership',
    'offer impressions',
    '',
    true
  ),

  [AnalyticsEvent.ACTION_OFFER_SELECTED]: createGoogleAnalyticsEvent(
    'NTG paywall',
    'click',
    '',
    false
  ),
  [AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK]: createGoogleAnalyticsEvent(
    'NTG subscription',
    'marketing modal click',
    '',
    false
  ),
  [AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT]: createGoogleAnalyticsEvent(
    'NTG subscription',
    'marketing modal impression',
    '',
    true
  ),
  [AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLICK]: createGoogleAnalyticsEvent(
    'NTG membership',
    'marketing modal click',
    '',
    false
  ),
  [AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT]: createGoogleAnalyticsEvent(
    'NTG membership',
    'membership modal impression',
    '',
    true
  ),
};

/** @const {!Object<?AnalyticsEvent,?Object>} */
export const SubscriptionSpecificAnalyticsEventToGoogleAnalyticsEvent = {
  [AnalyticsEvent.ACTION_PAYMENT_COMPLETE]: createGoogleAnalyticsEvent(
    'NTG subscription',
    'submit',
    'success',
    false
  ),
};

/** @const {!Object<?AnalyticsEvent,?Object>} */
export const ContributionSpecificAnalyticsEventToGoogleAnalyticsEvent = {
  [AnalyticsEvent.ACTION_PAYMENT_COMPLETE]: createGoogleAnalyticsEvent(
    'NTG membership',
    'submit',
    'success',
    false
  ),
};

/**
 * Converts a propensity event enum into an analytics event enum.
 * @param {!Event|string} propensityEvent
 * @returns {!AnalyticsEvent}
 */
export function publisherEventToAnalyticsEvent(propensityEvent) {
  return PublisherEventToAnalyticsEvent[propensityEvent];
}

/**
 * Converts an analytics event enum into a propensity event enum.
 * @param {?AnalyticsEvent} analyticsEvent
 * @returns {?Event}
 */
export function analyticsEventToPublisherEvent(analyticsEvent) {
  return AnalyticsEventToPublisherEvent[analyticsEvent];
}

/**
 * Converts a publisher entitlement event enum into an array analytics events.
 * @param {!PublisherEntitlementEvent|string} event
 * @returns {!Array<AnalyticsEvent>}
 */
export function publisherEntitlementEventToAnalyticsEvents(event) {
  return ShowcaseEntitlemenntToAnalyticsEvents[event] || [];
}

export function analyticsEventToEntitlementResult(event) {
  return AnalyticsEventToEntitlementResult[event];
}

/**
 * Converts an analytics event enum into a Google Analytics event object.
 * @param {?AnalyticsEvent} event
 * @param {string} subscriptionFlow
 * @returns {?Object}
 */
export function analyticsEventToGoogleAnalyticsEvent(event, subscriptionFlow) {
  let gaEvent = null;
  if (subscriptionFlow) {
    if (subscriptionFlow == SubscriptionFlows.SUBSCRIBE) {
      gaEvent = SubscriptionSpecificAnalyticsEventToGoogleAnalyticsEvent[event];
    } else if (subscriptionFlow == SubscriptionFlows.CONTRIBUTE) {
      gaEvent = ContributionSpecificAnalyticsEventToGoogleAnalyticsEvent[event];
    }
  }
  return gaEvent || AnalyticsEventToGoogleAnalyticsEvent[event];
}
