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
import {
  AnalyticsEventToGoogleAnalyticsEvent,
  ContributionSpecificAnalyticsEventToGoogleAnalyticsEvent,
  SubscriptionSpecificAnalyticsEventToGoogleAnalyticsEvent,
  analyticsEventToEntitlementResult,
  analyticsEventToGoogleAnalyticsEvent,
  analyticsEventToPublisherEvent,
  publisherEventToAnalyticsEvent,
  showcaseEventToAnalyticsEvents,
} from './event-type-mapping';
import {Event} from '../api/logger-api';
import {ShowcaseEvent, SubscriptionFlows} from '../api/subscriptions';

describes.realWin('Publisher and analytics events', () => {
  it('publisher to analytics to publisher should be identical', () => {
    // Ensure all publisher events convert to analytics events and back.
    for (const publisherEvent of Object.values(Event)) {
      const analyticsEvent = publisherEventToAnalyticsEvent(publisherEvent);
      expect(analyticsEvent).to.not.be.null;
      expect(analyticsEvent).to.not.be.undefined;

      const publisherEvent2 = analyticsEventToPublisherEvent(analyticsEvent);
      expect(publisherEvent2).to.equal(publisherEvent);
    }
  });

  it('analytics to publisher to analytics should be identical', () => {
    for (const analyticsEvent of Object.values(AnalyticsEvent)) {
      const publisherEvent = analyticsEventToPublisherEvent(analyticsEvent);

      // Not all analytics events convert to publisher events - this is OK.
      if (publisherEvent == null) {
        continue;
      }

      // But all analytics events that convert to publisher events should also
      // be able to convert back.
      expect(publisherEventToAnalyticsEvent(publisherEvent)).to.equal(
        analyticsEvent
      );
    }
  });
});

describes.realWin('showcaseEventToAnalyticsEvents', () => {
  it('all types mapped', () => {
    for (const publisherEvent in ShowcaseEvent) {
      const converted = showcaseEventToAnalyticsEvents(
        ShowcaseEvent[publisherEvent]
      );
      expect(converted && converted.length > 0).to.be.true;
      for (let x = 0; x < converted.length; x++) {
        expect(converted[x]).to.not.be.null;
      }
    }
  });
});

describes.realWin('analyticsEventToEntitlementResult', () => {
  let mapped;

  beforeEach(() => {
    mapped = {};
    for (const event in AnalyticsEvent) {
      const result = analyticsEventToEntitlementResult(AnalyticsEvent[event]);
      // Not all analytics events are mapped
      if (!result) {
        continue;
      }
      // Each EntitlementResult should only be mapped to once
      expect(mapped[result]).to.be.undefined;
      mapped[result] = (mapped[result] || 0) + 1;
    }
  });

  it('not allow the same EntitlementResult to be mapped to twice', () => {
    // The beforeEach will fail
  });

  it('map every EntitlementResult except the unknown value', () => {
    for (const key in EntitlementResult) {
      // Ignore numerical keys from TypeScript's reverse mapping.
      // https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings
      if (!isNaN(key)) {
        continue;
      }

      const result = EntitlementResult[key];
      // Every EntitlementResult should be mapped except the unknown value
      if (result == EntitlementResult.UNKNOWN_ENTITLEMENT_RESULT) {
        continue;
      }
      expect(mapped[result]).to.not.be.undefined;
    }
  });
});

describes.realWin('analyticsEventToGoogleAnalyticsEvent', () => {
  it('not allow the same event to be mapped to twice', () => {
    const mapped = {};
    for (const event in AnalyticsEvent) {
      const result = analyticsEventToGoogleAnalyticsEvent(
        AnalyticsEvent[event]
      );
      // Not all analytics events are mapped
      if (result === undefined) {
        continue;
      }
      expect(typeof result).to.be.equal('object');
      const resultString = JSON.stringify(result);
      // Each Google Analytics event should only be mapped to once
      expect(mapped[resultString]).to.be.undefined;
      mapped[resultString] = (mapped[resultString] || 0) + 1;
    }
  });

  it('uses subscriptionFlow param correclty on "subscription"', () => {
    const actual = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      SubscriptionFlows.SUBSCRIBE
    );
    const expected =
      SubscriptionSpecificAnalyticsEventToGoogleAnalyticsEvent[
        AnalyticsEvent.ACTION_PAYMENT_COMPLETE
      ];
    expect(actual).to.be.equal(expected);
  });

  it('uses subscriptionFlow param correclty on "contribution"', () => {
    const actual = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      SubscriptionFlows.CONTRIBUTE
    );
    const expected =
      ContributionSpecificAnalyticsEventToGoogleAnalyticsEvent[
        AnalyticsEvent.ACTION_PAYMENT_COMPLETE
      ];
    expect(actual).to.be.equal(expected);
  });

  it('should fallback to general mapping when subscriptionFlow passed in and event not specific', () => {
    const actual = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.IMPRESSION_OFFERS,
      SubscriptionFlows.SUBSCRIBE
    );
    const expected =
      AnalyticsEventToGoogleAnalyticsEvent[AnalyticsEvent.IMPRESSION_OFFERS];
    expect(actual).to.be.equal(expected);
  });

  it('should get contribution offers impressions on "contribution"', () => {
    const actual = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      SubscriptionFlows.CONTRIBUTE
    );
    const expected =
      AnalyticsEventToGoogleAnalyticsEvent[
        AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS
      ];
    expect(actual).to.be.equal(expected);
  });
});
