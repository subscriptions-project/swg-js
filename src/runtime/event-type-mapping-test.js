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
import {Event} from '../api/propensity-api';
import {PublisherEntitlementEvent} from '../api/subscriptions';
import {
  analyticsEventToEntitlementResult,
  analyticsEventToGoogleAnalyticsEvent,
  analyticsEventToPublisherEvent,
  publisherEntitlementEventToAnalyticsEvents,
  publisherEventToAnalyticsEvent,
} from './event-type-mapping';

describes.realWin('Logger and Propensity events', {}, () => {
  it('propensity to analytics to propensity should be identical', () => {
    let analyticsEvent;
    let propensityEvent;
    //ensure the second propensity event is identical to the first:
    //propensity event -> analytics events -> propensity event
    for (const propensityEnum in Event) {
      propensityEvent = Event[propensityEnum];
      analyticsEvent = publisherEventToAnalyticsEvent(propensityEvent);
      expect(analyticsEventToPublisherEvent(analyticsEvent)).to.equal(
        propensityEvent
      );
      expect(analyticsEvent).to.not.be.null;
      expect(analyticsEvent).to.not.be.undefined;
    }
  });

  it('analytics to propensity to analytics should be identical', () => {
    let analyticsEvent;
    let propensityEvent;
    for (const analyticsEnum in AnalyticsEvent) {
      analyticsEvent = AnalyticsEvent[analyticsEnum];
      propensityEvent = analyticsEventToPublisherEvent(analyticsEvent);
      //not all analytics events convert to propensity events - this is OK
      if (propensityEvent == null) {
        continue;
      }
      //but if the analytics event converted to the propensity event it should
      //be able to convert back to the same analytics event
      expect(publisherEventToAnalyticsEvent(propensityEvent)).to.equal(
        analyticsEvent
      );
    }
  });

  it('all publisher types mapped', () => {
    for (const publisherEvent in Event) {
      const converted = publisherEventToAnalyticsEvent(Event[publisherEvent]);
      expect(!!converted).to.be.true;
    }
  });
});

describes.realWin('publisherEntitlementEventToAnalyticsEvents', {}, () => {
  it('all types mapped', () => {
    for (const publisherEvent in PublisherEntitlementEvent) {
      const converted = publisherEntitlementEventToAnalyticsEvents(
        PublisherEntitlementEvent[publisherEvent]
      );
      expect(converted && converted.length > 0).to.be.true;
      for (let x = 0; x < converted.length; x++) {
        expect(converted[x]).to.not.be.null;
      }
    }
  });
});

describes.realWin('analyticsEventToEntitlementResult', {}, () => {
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
      const result = EntitlementResult[key];
      // Every EntitlementResult should be mapped except the unknown value
      if (result == EntitlementResult.UNKNOWN_ENTITLEMENT_RESULT) {
        continue;
      }
      expect(mapped[result]).to.not.be.undefined;
    }
  });
});


describes.realWin('analyticsEventToGoogleAnalyticsEvent', {}, () => {
  it('not allow the same event to be mapped to twice', () => {
    let mapped = {};
    for (const event in AnalyticsEvent) {
      const result = analyticsEventToGoogleAnalyticsEvent(AnalyticsEvent[event]);
      // Not all analytics events are mapped
      if (result === undefined) {
        continue;
      }
      expect(typeof result).to.be.equal('object');
      const resultString = JSON.stringify(result);
      // Each EntitlementResult should only be mapped to once
      expect(mapped[resultString]).to.be.undefined;
      mapped[resultString] = (mapped[resultString] || 0) + 1;
    }
  });
});
