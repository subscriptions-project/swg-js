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

import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
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
  describe('promises', () => {
    let eventMan;
    let resolver;
    let rejector;
    let counter;
    beforeEach(() => {
      eventMan = new ClientEventManager(
        new Promise((resolve, reject) => {
          rejector = reject;
          resolver = resolve;
        })
      );
      counter = 0;
      eventMan.registerEventListener(() => counter++);
      eventMan.logEvent(DEFAULT_EVENT);
      //ensure it has not logged yet
      expect(counter).to.equal(0);
    });

    it('should not log events until its promise is resolved', function*() {
      let counter2 = 0;

      eventMan.registerEventListener(() => counter2++);
      eventMan.logEvent(DEFAULT_EVENT);
      //ensure it has not logged yet
      expect(counter).to.equal(0);
      expect(counter2).to.equal(0);

      resolver();
      yield eventMan.lastAction_;
      //ensure it logged both events after we called resolver and yielded
      expect(counter).to.equal(counter2);

      //If this test is flaky it means sometimes event manager is logging
      //despite the promise not being resolved (which is a problem).
    });

    it('should not log events if promise rejected', function*() {
      rejector();
      yield eventMan.lastAction_;
      expect(counter).to.equal(0);
    });
  });

  describe('error handling', () => {
    let eventMan;
    let errorReceived;

    const errorSent = new Error(errorSent);

    beforeEach(() => {
      errorReceived = null;
      eventMan = new ClientEventManager(RESOLVED_PROMISE);
      sandbox.stub(console, 'log', err => {
        errorReceived = err;
      });
    });

    describe('invalid events', () => {
      let errorCount;
      let matchedExpected;
      let expected;
      let event;

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

      beforeEach(() => {
        errorCount = 0;
        matchedExpected = 0;
        event = {};
        Object.assign(event, DEFAULT_EVENT);
      });

      it('should allow valid events', () => {
        tryIt();
        expect(errorCount).to.equal(0);
        expect(matchedExpected).to.equal(0);
      });

      it('should validate event type', () => {
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
      });

      it('should validate event originator', () => {
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
      });

      it('should validate isFromUserAction', () => {
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
      });

      it('should validate additionalParameters', () => {
        event.additionalParameters = BAD_VALUE;
        expected =
          'Event has an invalid additionalParameters(' + BAD_VALUE + ')';
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
      });

      it('should not allow null events', () => {
        event = null;
        expected = 'Event must be a valid object';
        tryIt();
        expect(errorCount).to.equal(1);
        expect(matchedExpected).to.equal(1);
      });
    });

    it('should log listener errors to the console', function*() {
      eventMan.registerEventListener(() => {
        throw errorSent;
      });

      eventMan.logEvent(DEFAULT_EVENT);
      yield eventMan.lastAction_;
      expect(errorReceived).to.equal(errorSent);
    });

    it('should log filterer errors to the console', function*() {
      eventMan.registerEventFilterer(() => {
        throw errorSent;
      });
      eventMan.logEvent(DEFAULT_EVENT);
      yield eventMan.lastAction_;
      expect(errorReceived).to.equal(errorSent);
    });
  });

  describe('event management', () => {
    let eventMan;
    let counter;

    beforeEach(() => {
      eventMan = new ClientEventManager(RESOLVED_PROMISE);
      counter = 0;
      eventMan.registerEventListener(() => counter++);
    });

    it('should be able to listen for events', function*() {
      //verify it supports 1 listener

      eventMan.logEvent(DEFAULT_EVENT);
      yield eventMan.lastAction_;
      expect(counter).to.equal(1);

      //verify it supports multiple listeners
      eventMan.registerEventListener(() => counter++);
      eventMan.logEvent(DEFAULT_EVENT);
      yield eventMan.lastAction_;
      expect(counter).to.equal(3);
    });

    it('should be able to filter out some events', function*() {
      //filter out the default origin
      eventMan.registerEventFilterer(event =>
        event.eventOriginator === DEFAULT_ORIGIN
          ? EventManagerApi.FilterResult.CANCEL_EVENT
          : EventManagerApi.FilterResult.PROCESS_EVENT
      );

      //ensure the default origin is filtered out
      eventMan.logEvent(DEFAULT_EVENT);
      yield eventMan.lastAction_;
      expect(counter).to.equal(0);

      //ensure the other origin is not filtered out
      DEFAULT_EVENT.eventOriginator = OTHER_ORIGIN;
      eventMan.logEvent(DEFAULT_EVENT);
      yield eventMan.lastAction_;
      expect(counter).to.equal(1);
      eventMan.eventOriginator = DEFAULT_ORIGIN;
    });
  });
});
