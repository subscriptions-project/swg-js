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

import {AnalyticsEvent,EventOriginator} from '../proto/api_messages';
import * as EventManagerApi from '../api/client-event-manager-api';
import {ClientEventManager} from './client-event-manager';

const DEFAULT_TYPE = AnalyticsEvent.IMPRESSION_AD;
const DEFAULT_ORIGIN = EventOriginator.SWG_CLIENT;
const OTHER_TYPE = AnalyticsEvent.ACTION_PAYMENT_COMPLETE;
const OTHER_ORIGIN = EventOriginator.AMP_CLIENT;
const BAD_VALUE = 'I should throw an error';
const RESOLVED_PROMISE = Promise.resolve();

/** @type {!EventManagerApi.ClientEvent} */
const DEFAULT_EVENT = {
  eventType: DEFAULT_TYPE,
  eventOriginator: DEFAULT_ORIGIN,
  isFromUserAction: null,
  additionalParameters: {},
};

describes.sandboxed('EventManager', {}, () => {
  it('should throw an error for invalid events', () => {
    /** @type {!EventManagerApi.ClientEvent} */
    let event = {
      eventType: DEFAULT_TYPE,
      eventOriginator: DEFAULT_ORIGIN,
      isFromUserAction: null,
      additionalParameters: {},
    };
    const eventMan = new ClientEventManager(RESOLVED_PROMISE);

    let errorCount = 0;
    let matchedExpected = 0;
    let expected;
    const tryIt = () => {
      try {
        eventMan.logEvent(event);
      } catch (e) {
        errorCount++;
        if (e.message === expected) {
          matchedExpected++;
        }
      }
    };

    tryIt();
    expect(errorCount).to.equal(0);
    expect(matchedExpected).to.equal(0);

    //validate event type
    event.eventType = BAD_VALUE;
    expected = 'Event has an invalid eventType(' + BAD_VALUE + ')';
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
    event.eventType = null;
    expected = 'Event has an invalid eventType(' + null + ')';
    tryIt();
    expect(errorCount).to.equal(2);
    expect(matchedExpected).to.equal(2);
    event.eventType = OTHER_TYPE;
    tryIt();
    expect(errorCount).to.equal(2);
    event.eventType = DEFAULT_TYPE;

    //validate event originator
    errorCount = 0;
    matchedExpected = 0;
    event.eventOriginator = BAD_VALUE;
    expected = 'Event has an invalid eventOriginator(' + BAD_VALUE + ')';
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
    event.eventOriginator = null;
    expected = 'Event has an invalid eventOriginator(' + null + ')';
    tryIt();
    expect(errorCount).to.equal(2);
    expect(matchedExpected).to.equal(2);
    event.eventOriginator = OTHER_ORIGIN;
    tryIt();
    expect(errorCount).to.equal(2);
    expect(matchedExpected).to.equal(2);
    event.eventOriginator = DEFAULT_ORIGIN;

    //validate isFromUserAction
    errorCount = 0;
    matchedExpected = 0;
    event.isFromUserAction = BAD_VALUE;
    expected = 'Event has an invalid isFromUserAction(' + BAD_VALUE + ')';
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
    event.isFromUserAction = true;
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
    event.isFromUserAction = false;
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
    event.isFromUserAction = null;

    //validate additionalParameters
    errorCount = 0;
    matchedExpected = 0;
    event.additionalParameters = BAD_VALUE;
    expected = 'Event has an invalid additionalParameters(' + BAD_VALUE + ')';
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
    event.additionalParameters = null;
    expected = 'Event has an invalid additionalParameters(' + null + ')';
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
    event.additionalParameters = {IAmValid: 5};
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
    event.additionalParameters = {};

    //validate null object
    errorCount = 0;
    matchedExpected = 0;
    event = null;
    expected = 'Event must be a valid object';
    tryIt();
    expect(errorCount).to.equal(1);
    expect(matchedExpected).to.equal(1);
  });

  it('should be able to listen for events', function*() {
    const eventMan = new ClientEventManager(RESOLVED_PROMISE);
    let receivedEventsCount = 0;
    const callback = () => receivedEventsCount++;

    //verify it supports 1 listener
    eventMan.registerEventListener(callback);
    eventMan.logEvent(DEFAULT_EVENT);
    yield eventMan.lastAction_;
    expect(receivedEventsCount).to.equal(1);

    //verify it supports multiple listeners
    eventMan.registerEventListener(callback);
    eventMan.logEvent(DEFAULT_EVENT);
    yield eventMan.lastAction_;
    expect(receivedEventsCount).to.equal(3);
  });

  it('should be able to filter out some events', function*() {
    const eventMan = new ClientEventManager(RESOLVED_PROMISE);
    let receivedEventsCount = 0;
    const callback = () => receivedEventsCount++;
    eventMan.registerEventListener(callback);

    //filter out the default origin
    eventMan.registerEventFilterer(event =>
      event.eventOriginator === DEFAULT_ORIGIN ?
          EventManagerApi.FilterResult.CANCEL_EVENT :
          EventManagerApi.FilterResult.PROCESS_EVENT
    );

    //ensure the default origin is filtered out
    eventMan.logEvent(DEFAULT_EVENT);
    yield eventMan.lastAction_;
    expect(receivedEventsCount).to.equal(0);

    //ensure the other origin is not filtered out
    DEFAULT_EVENT.eventOriginator = OTHER_ORIGIN;
    eventMan.logEvent(DEFAULT_EVENT);
    yield eventMan.lastAction_;
    expect(receivedEventsCount).to.equal(1);
    eventMan.eventOriginator = DEFAULT_ORIGIN;
  });

  it('should not log events until its promise is resolved', function*() {
    let resolver = null;
    const eventMan = new ClientEventManager(
        new Promise(resolve => resolver = resolve)
    );

    let counter1 = 0;
    let counter2 = 0;

    eventMan.registerEventListener(() => counter1++);
    eventMan.logEvent(DEFAULT_EVENT);
    //ensure it has not logged yet
    expect(counter1).to.equal(0);

    eventMan.registerEventListener(() => counter2++);
    eventMan.logEvent(DEFAULT_EVENT);
    //ensure it has not logged yet
    expect(counter1).to.equal(0);
    expect(counter2).to.equal(0);

    resolver();
    yield eventMan.lastAction_;
    //ensure it logged both events after we called resolver and yielded
    expect(counter1).to.equal(counter2);

    //If this test is flaky it means sometimes event manager is logging despite
    //the promise not being resolved (which is a problem).
  });

  it('should not log events if promise rejected', function*() {
    let rejector = null;
    const eventMan = new ClientEventManager(
        new Promise((resolveUnused, reject) => rejector = reject)
    );

    let counter = 0;

    eventMan.registerEventListener(() => counter++);
    eventMan.logEvent(DEFAULT_EVENT);
    expect(counter).to.equal(0);

    rejector();
    yield eventMan.lastAction_;
    expect(counter).to.equal(0);
  });
});
