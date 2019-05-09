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

import {AnalyticsEvent,EventOriginator} from '../proto/api_messages';
import {
  SwgClientEvent, SwgClientEventManager, ShouldFilter,
} from './swg-client-event-manager';

const DEFAULT_TYPE = AnalyticsEvent.IMPRESSION_AD;
const DEFAULT_ORIGIN = EventOriginator.SWG_CLIENT;
const DEFAULT_EVENT = new SwgClientEvent(DEFAULT_TYPE, DEFAULT_ORIGIN);
const OTHER_TYPE = AnalyticsEvent.ACTION_PAYMENT_COMPLETE;
const OTHER_ORIGIN = EventOriginator.AMP_CLIENT;
const BAD_VALUE = 'I should throw an error';
const EventManager = new SwgClientEventManager();

describes.sandboxed('SwgClientEvent', {}, () => {
  it('should respect properties that have been set', () => {
    const event = new SwgClientEvent(DEFAULT_TYPE, DEFAULT_ORIGIN);
    expect(event.getEventType()).to.equal(DEFAULT_TYPE);
    expect(event.getEventOrigin()).to.equal(DEFAULT_ORIGIN);
    expect(event.getIsFromUserAction()).to.be.null;

    event.setEventType(OTHER_TYPE);
    event.setEventOrigin(OTHER_ORIGIN);
    event.setIsFromUserAction(true);
    event.setAdditionalParameters({aValue: 45});

    expect(event.getEventType()).to.equal(OTHER_TYPE);
    expect(event.getEventOrigin()).to.equal(OTHER_ORIGIN);
    expect(event.getIsFromUserAction()).to.be.true;
    expect(event.getAdditionalParameters().aValue).to.equal(45);

    event.setIsFromUserAction(null);
    expect(event.getIsFromUserAction()).to.be.null;
  });

  it('should have a working copy constructor', () => {
    const event =
        new SwgClientEvent(DEFAULT_TYPE, DEFAULT_ORIGIN, {aValue: 45});
    event.setIsFromUserAction(true);

    //ensure copy works
    const event2 = event.copy();
    expect(event2.getEventType()).to.equal(DEFAULT_TYPE);
    expect(event2.getEventOrigin()).to.equal(DEFAULT_ORIGIN);
    expect(event2.getIsFromUserAction()).to.be.true;
    expect(event2.getAdditionalParameters().aValue).to.equal(45);

    //ensure it is a different object
    event.setEventType(OTHER_TYPE);
    event.setEventOrigin(OTHER_ORIGIN);
    event.setIsFromUserAction(false);
    event.setAdditionalParameters({aValue: 46});

    expect(event.getEventType()).to.equal(OTHER_TYPE);
    expect(event.getEventOrigin()).to.equal(OTHER_ORIGIN);
    expect(event.getIsFromUserAction()).to.be.false;
    expect(event2.getEventType()).to.equal(DEFAULT_TYPE);
    expect(event2.getEventOrigin()).to.equal(DEFAULT_ORIGIN);
    expect(event2.getIsFromUserAction()).to.be.true;

    //ensure the references to additional parameters are different
    expect(event.getAdditionalParameters().aValue).to.equal(46);
    expect(event2.getAdditionalParameters().aValue).to.equal(45);
  });

  it('should not let you set bad values', () => {
    let errorCount = 0;
    const tryIt = callback => {
      try {
        callback();
      } catch (e) {
        errorCount++;
      }
    };
    tryIt(() => new SwgClientEvent(BAD_VALUE, DEFAULT_ORIGIN));
    tryIt(() => new SwgClientEvent(DEFAULT_TYPE, BAD_VALUE));
    const event = DEFAULT_EVENT.copy();
    tryIt(() => event.setEventType(BAD_VALUE));
    tryIt(() => event.setEventOrigin(BAD_VALUE));
    tryIt(() => event.setIsFromUserAction(BAD_VALUE));
    tryIt(() => event.setAdditionalParameters(null));
    tryIt(() => event.setAdditionalParameters(BAD_VALUE));
    expect(errorCount).to.equal(7);
  });
});

describes.sandboxed('EventManager', {}, () => {
  it('should be able to listen for events', () => {
    let receivedEventsCount = 0;
    const callback = () => receivedEventsCount++;

    //verify it can listen to 1
    EventManager.addListener(callback);
    EventManager.logEvent(DEFAULT_EVENT);
    expect(receivedEventsCount).to.equal(1);

    //verify it can listen to 2 at the same time
    EventManager.addListener(callback);
    EventManager.logEvent(DEFAULT_EVENT);
    expect(receivedEventsCount).to.equal(3);
    EventManager.clear();
  });

  it('should be able to filter out some events', () => {
    let receivedEventsCount = 0;
    const callback = () => receivedEventsCount++;

    //filter out the default origin
    EventManager.addFilterer(event => event.getEventOrigin() === DEFAULT_ORIGIN
        ? ShouldFilter.STOP_EXECUTING : ShouldFilter.CONTINUE_EXECUTING
    );
    EventManager.addListener(callback);
    EventManager.logEvent(DEFAULT_EVENT);
    //ensure the filtering is respected
    expect(receivedEventsCount).to.equal(0);

    //ensure it passes through the filter
    EventManager.logEvent(
        new SwgClientEvent(DEFAULT_TYPE, OTHER_ORIGIN));
    expect(receivedEventsCount).to.equal(1);
    EventManager.clear();
  });

  it('should not allow you to pass in bad values', () => {
    const sentEvent = DEFAULT_EVENT.copy();
    let errorCount = 0;
    const tryIt = callback => {
      try {
        callback();
      } catch (e) {
        errorCount++;
      }
    };

    sentEvent.eventOrigin_ = BAD_VALUE;
    tryIt(() => EventManager.logEvent(sentEvent));
    sentEvent.setEventOrigin(DEFAULT_ORIGIN);

    sentEvent.eventType_ = BAD_VALUE;
    tryIt(() => EventManager.logEvent(sentEvent));
    sentEvent.setEventOrigin(DEFAULT_ORIGIN);
    expect(errorCount).to.equal(2);

  });
});
