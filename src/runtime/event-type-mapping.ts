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
import {ShowcaseEvent, SubscriptionFlows} from '../api/subscriptions';

const PublisherEventToAnalyticsEvent: {[key in Event]: AnalyticsEvent} = {
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

const AnalyticsEventToPublisherEvent: {[key in AnalyticsEvent]?: Event | null} =
  {
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

const ShowcaseEvents: {[key in ShowcaseEvent]: AnalyticsEvent[]} = {
  // Events related to content being potentially unlockable
  [ShowcaseEvent.EVENT_SHOWCASE_METER_OFFERED]: [
    AnalyticsEvent.EVENT_HAS_METERING_ENTITLEMENTS,
    AnalyticsEvent.EVENT_OFFERED_METER,
  ],

  // Events related to content being unlocked
  [ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION]: [
    AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
  ],
  [ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_METER]: [
    AnalyticsEvent.EVENT_HAS_METERING_ENTITLEMENTS,
    AnalyticsEvent.EVENT_UNLOCKED_BY_METER,
  ],
  [ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_FREE_PAGE]: [
    AnalyticsEvent.EVENT_UNLOCKED_FREE_PAGE,
  ],

  // Events requiring user action to unlock content
  [ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL]: [
    AnalyticsEvent.EVENT_NO_ENTITLEMENTS,
    AnalyticsEvent.IMPRESSION_REGWALL,
    AnalyticsEvent.IMPRESSION_SHOWCASE_REGWALL,
  ],

  // Events requiring subscription to unlock content
  [ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_PAYWALL]: [
    AnalyticsEvent.EVENT_NO_ENTITLEMENTS,
    AnalyticsEvent.IMPRESSION_PAYWALL,
  ],
  [ShowcaseEvent.EVENT_SHOWCASE_INELIGIBLE_PAYWALL]: [
    AnalyticsEvent.EVENT_INELIGIBLE_PAYWALL,
    AnalyticsEvent.EVENT_NO_ENTITLEMENTS,
  ],
};

const AnalyticsEventToEntitlementResult: {
  [key in AnalyticsEvent]?: EntitlementResult;
} = {
  [AnalyticsEvent.IMPRESSION_REGWALL]: EntitlementResult.LOCKED_REGWALL,
  [AnalyticsEvent.EVENT_UNLOCKED_BY_METER]: EntitlementResult.UNLOCKED_METER,
  [AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION]:
    EntitlementResult.UNLOCKED_SUBSCRIBER,
  [AnalyticsEvent.EVENT_UNLOCKED_FREE_PAGE]: EntitlementResult.UNLOCKED_FREE,
  [AnalyticsEvent.IMPRESSION_PAYWALL]: EntitlementResult.LOCKED_PAYWALL,
  [AnalyticsEvent.EVENT_INELIGIBLE_PAYWALL]:
    EntitlementResult.INELIGIBLE_PAYWALL,
};

interface GoogleAnalyticsEvent {
  eventCategory: string;
  eventAction: string;
  eventLabel: string;
  nonInteraction: boolean;
}

function createGoogleAnalyticsEvent(
  eventCategory: string,
  eventAction: string,
  eventLabel: string,
  nonInteraction: boolean
): GoogleAnalyticsEvent {
  return {
    eventCategory,
    eventAction,
    eventLabel,
    nonInteraction,
  };
}

export const AnalyticsEventToGoogleAnalyticsEvent: {
  [key in AnalyticsEvent]?: GoogleAnalyticsEvent;
} = {
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
  [AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK]:
    createGoogleAnalyticsEvent(
      'NTG subscription',
      'marketing modal click',
      '',
      false
    ),
  [AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT]:
    createGoogleAnalyticsEvent(
      'NTG subscription',
      'marketing modal impression',
      '',
      true
    ),
  [AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLICK]:
    createGoogleAnalyticsEvent(
      'NTG membership',
      'marketing modal click',
      '',
      false
    ),
  [AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT]:
    createGoogleAnalyticsEvent(
      'NTG membership',
      'membership modal impression',
      '',
      true
    ),
  [AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN]: createGoogleAnalyticsEvent(
    'NTG newsletter',
    'newsletter modal impression',
    '',
    true
  ),
  [AnalyticsEvent.EVENT_NEWSLETTER_OPTED_IN]: createGoogleAnalyticsEvent(
    'NTG newsletter',
    'newsletter signup',
    'success',
    false
  ),
  [AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN]:
    createGoogleAnalyticsEvent(
      'NTG newsletter',
      'newsletter modal impression',
      '',
      true
    ),
  [AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT]:
    createGoogleAnalyticsEvent(
      'NTG newsletter',
      'newsletter signup',
      'success',
      false
    ),
  [AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN]: createGoogleAnalyticsEvent(
    'NTG account',
    'registration modal impression',
    '',
    true
  ),
  [AnalyticsEvent.EVENT_REGWALL_OPTED_IN]: createGoogleAnalyticsEvent(
    'NTG account',
    'registration',
    'success',
    false
  ),
  [AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER]: createGoogleAnalyticsEvent(
    '',
    'survey submission',
    '',
    false
  ),
  [AnalyticsEvent.IMPRESSION_BYO_CTA]: createGoogleAnalyticsEvent(
    '',
    'custom cta modal impression',
    '',
    true
  ),
  [AnalyticsEvent.ACTION_BYO_CTA_BUTTON_CLICK]: createGoogleAnalyticsEvent(
    '',
    'custom cta click',
    '',
    false
  ),
};

export const SubscriptionSpecificAnalyticsEventToGoogleAnalyticsEvent: {
  [key in AnalyticsEvent]?: GoogleAnalyticsEvent;
} = {
  [AnalyticsEvent.ACTION_PAYMENT_COMPLETE]: createGoogleAnalyticsEvent(
    'NTG subscription',
    'submit',
    'success',
    false
  ),
};

export const ContributionSpecificAnalyticsEventToGoogleAnalyticsEvent: {
  [key in AnalyticsEvent]?: GoogleAnalyticsEvent;
} = {
  [AnalyticsEvent.ACTION_PAYMENT_COMPLETE]: createGoogleAnalyticsEvent(
    'NTG membership',
    'submit',
    'success',
    false
  ),
};

/**
 * Converts a propensity event enum into an analytics event enum.
 */
export function publisherEventToAnalyticsEvent(
  propensityEvent: Event
): AnalyticsEvent {
  return PublisherEventToAnalyticsEvent[propensityEvent];
}

/**
 * Converts an analytics event enum into a propensity event enum.
 */
export function analyticsEventToPublisherEvent(
  analyticsEvent: AnalyticsEvent | null
): Event | null {
  return (
    (analyticsEvent && AnalyticsEventToPublisherEvent[analyticsEvent]) || null
  );
}

/**
 * Converts a publisher entitlement event enum into an array analytics events.
 */
export function showcaseEventToAnalyticsEvents(
  event: ShowcaseEvent
): AnalyticsEvent[] {
  return ShowcaseEvents[event] || [];
}

export function analyticsEventToEntitlementResult(event: AnalyticsEvent) {
  return AnalyticsEventToEntitlementResult[event];
}

/**
 * Converts an analytics event enum into a Google Analytics event object.
 */
export function analyticsEventToGoogleAnalyticsEvent(
  event: AnalyticsEvent | null,
  subscriptionFlow: string
): GoogleAnalyticsEvent | void {
  if (!event) {
    return;
  }

  let gaEvent: GoogleAnalyticsEvent | undefined;
  if (subscriptionFlow === SubscriptionFlows.SUBSCRIBE) {
    gaEvent = SubscriptionSpecificAnalyticsEventToGoogleAnalyticsEvent[event];
  } else if (subscriptionFlow === SubscriptionFlows.CONTRIBUTE) {
    gaEvent = ContributionSpecificAnalyticsEventToGoogleAnalyticsEvent[event];
  }
  return gaEvent || AnalyticsEventToGoogleAnalyticsEvent[event];
}
