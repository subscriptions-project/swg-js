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

import {AnalyticsEvent} from '../proto/api_messages';
import {Event} from '../api/logger-api';

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

/** @const {!Object<number,?Event>} */
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
 * @param {!AnalyticsEvent} analyticsEvent
 * @returns {?Event}
 */
export function analyticsEventToPublisherEvent(analyticsEvent) {
  return AnalyticsEventToPublisherEvent[analyticsEvent];
}
