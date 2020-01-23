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

import * as EventManagerApi from '../api/client-event-manager-api';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {ClientEventManager} from './client-event-manager';
import {tick} from '../../test/tick';

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
  describe('configuration', () => {
    let eventManager;
    let indicateConfigurationSucceeded;
    let indicateConfigurationFailed;
    let events;

    beforeEach(() => {
      eventManager = new ClientEventManager(
        new Promise((resolve, reject) => {
          indicateConfigurationSucceeded = resolve;
          indicateConfigurationFailed = reject;
        })
      );
      events = [];
      eventManager.registerEventListener(e => events.push(e));
    });

    it('should not log events before configuration succeeds', async () => {
      // Request event log.
      eventManager.logEvent(DEFAULT_EVENT);

      // Event should not be logged.
      await tick();
      expect(events).to.deep.equal([]);
    });

    it('should log events after configuration succeeds', async () => {
      // Request event log.
      eventManager.logEvent(DEFAULT_EVENT);

      indicateConfigurationSucceeded();

      // Event should be logged.
      await tick();
      expect(events).to.deep.equal([DEFAULT_EVENT]);
    });

    it('should not log events if configuration fails', async () => {
      // Request event log.
      eventManager.logEvent(DEFAULT_EVENT);

      indicateConfigurationFailed();

      // Event should not be logged.
      await tick();
      expect(events).to.deep.equal([]);
    });
  });

  describe('error handling', () => {
    let eventManager;

    beforeEach(() => {
      eventManager = new ClientEventManager(RESOLVED_PROMISE);
    });

    describe('invalid events', () => {
      it('should allow valid events', () => {
        expect(() => eventManager.logEvent(DEFAULT_EVENT)).to.not.throw();
      });

      it('should handle invalid eventType values', () => {
        const invalidValues = [BAD_VALUE, null];

        invalidValues.forEach(eventType => {
          const event = Object.assign({}, DEFAULT_EVENT, {
            eventType,
          });
          expect(() => eventManager.logEvent(event)).to.throw(
            `Event has an invalid eventType(${eventType})`
          );
        });
      });

      it('should handle valid eventType values', () => {
        const validValues = [OTHER_TYPE];

        validValues.forEach(eventType => {
          const event = Object.assign({}, DEFAULT_EVENT, {
            eventType,
          });
          expect(() => eventManager.logEvent(event)).not.to.throw();
        });
      });

      it('should handle invalid eventOriginator values', () => {
        const invalidValues = [BAD_VALUE, null];

        invalidValues.forEach(eventOriginator => {
          const event = Object.assign({}, DEFAULT_EVENT, {
            eventOriginator,
          });
          expect(() => eventManager.logEvent(event)).to.throw(
            `Event has an invalid eventOriginator(${eventOriginator})`
          );
        });
      });

      it('should handle valid eventOriginator values', () => {
        const validValues = [OTHER_ORIGIN, DEFAULT_ORIGIN];

        validValues.forEach(eventOriginator => {
          const event = Object.assign({}, DEFAULT_EVENT, {
            eventOriginator,
          });
          expect(() => eventManager.logEvent(event)).to.not.throw();
        });
      });

      it('should handle invalid isFromUserAction values', () => {
        const invalidValues = [BAD_VALUE];

        invalidValues.forEach(isFromUserAction => {
          const event = Object.assign({}, DEFAULT_EVENT, {
            isFromUserAction,
          });
          expect(() => eventManager.logEvent(event)).to.throw(
            `Event has an invalid isFromUserAction(${isFromUserAction})`
          );
        });
      });

      it('should handle valid isFromUserAction values', () => {
        const validValues = [true, false, null];

        validValues.forEach(isFromUserAction => {
          const event = Object.assign({}, DEFAULT_EVENT, {
            isFromUserAction,
          });
          expect(() => eventManager.logEvent(event)).to.not.throw();
        });
      });

      it('should handle invalid additionalParameters values', () => {
        const invalidValues = [BAD_VALUE];

        invalidValues.forEach(additionalParameters => {
          const event = Object.assign({}, DEFAULT_EVENT, {
            additionalParameters,
          });
          expect(() => eventManager.logEvent(event)).to.throw(
            `Event has an invalid additionalParameters(${additionalParameters})`
          );
        });
      });

      it('should handle valid additionalParameters values', () => {
        // @REVIEWER: Should `null` be a valid value?
        // The previous version of this test seemed to suggest it shouldn't be.
        const validValues = [{IAmValid: 5}, null];

        validValues.forEach(additionalParameters => {
          const event = Object.assign({}, DEFAULT_EVENT, {
            additionalParameters,
          });
          expect(() => eventManager.logEvent(event)).to.not.throw();
        });
      });

      it('should not allow null events', () => {
        expect(() => eventManager.logEvent(null)).to.throw(
          'Event must be a valid object'
        );
      });
    });

    describe('logs to console', () => {
      const DEFAULT_ERROR = new Error('Default error.');

      let logStub;

      beforeEach(() => {
        logStub = sandbox.stub(console, 'log');
      });

      it('should log listener errors to the console', async () => {
        eventManager.registerEventListener(() => {
          throw DEFAULT_ERROR;
        });

        eventManager.logEvent(DEFAULT_EVENT);
        await tick();

        expect(logStub).to.have.been.calledWith(DEFAULT_ERROR);
      });

      it('should log filterer errors to the console', async () => {
        eventManager.registerEventFilterer(() => {
          throw DEFAULT_ERROR;
        });

        eventManager.logEvent(DEFAULT_EVENT);
        await tick();

        expect(logStub).to.have.been.calledWith(DEFAULT_ERROR);
      });
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

    it('should be able to listen for events', async () => {
      //verify it supports 1 listener

      eventMan.logEvent(DEFAULT_EVENT);
      await eventMan.lastAction_;
      expect(counter).to.equal(1);

      //verify it supports multiple listeners
      eventMan.registerEventListener(() => counter++);
      eventMan.logEvent(DEFAULT_EVENT);
      await eventMan.lastAction_;
      expect(counter).to.equal(3);
    });

    it('should be able to filter out some events', async () => {
      //filter out the default origin
      eventMan.registerEventFilterer(event =>
        event.eventOriginator === DEFAULT_ORIGIN
          ? EventManagerApi.FilterResult.CANCEL_EVENT
          : EventManagerApi.FilterResult.PROCESS_EVENT
      );

      //ensure the default origin is filtered out
      eventMan.logEvent(DEFAULT_EVENT);
      await eventMan.lastAction_;
      expect(counter).to.equal(0);

      //ensure the other origin is not filtered out
      DEFAULT_EVENT.eventOriginator = OTHER_ORIGIN;
      eventMan.logEvent(DEFAULT_EVENT);
      await eventMan.lastAction_;
      expect(counter).to.equal(1);
      eventMan.eventOriginator = DEFAULT_ORIGIN;
    });
  });

  describe('helpers', () => {
    let eventMan;

    beforeEach(() => {
      eventMan = new ClientEventManager(RESOLVED_PROMISE);
    });

    it('should identify publisher events', () => {
      const testIsPublisherEvent = function(originator, isPublisherEvent) {
        DEFAULT_EVENT.eventOriginator = originator;
        expect(ClientEventManager.isPublisherEvent(DEFAULT_EVENT)).to.equal(
          isPublisherEvent
        );
      };
      testIsPublisherEvent(EventOriginator.SWG_CLIENT, false);
      testIsPublisherEvent(EventOriginator.SWG_SERVER, false);
      testIsPublisherEvent(EventOriginator.UNKNOWN_CLIENT, false);
      testIsPublisherEvent(EventOriginator.AMP_CLIENT, true);
      testIsPublisherEvent(EventOriginator.PROPENSITY_CLIENT, true);
      testIsPublisherEvent(EventOriginator.PUBLISHER_CLIENT, true);
    });

    describe('logSwgEvent', () => {
      let event;
      beforeEach(() => {
        sandbox
          .stub(ClientEventManager.prototype, 'logEvent')
          .callsFake(evt => (event = evt));
      });

      it('should have appropriate defaults', () => {
        eventMan.logSwgEvent(AnalyticsEvent.ACTION_ACCOUNT_CREATED);
        expect(event).to.deep.equal({
          eventType: AnalyticsEvent.ACTION_ACCOUNT_CREATED,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
        });
      });

      it('should respect isFromUserAction', () => {
        const testIsFromUserAction = function(isFromUserAction) {
          eventMan.logSwgEvent(
            AnalyticsEvent.ACTION_ACCOUNT_CREATED,
            isFromUserAction
          );
          expect(event).to.deep.equal({
            eventType: AnalyticsEvent.ACTION_ACCOUNT_CREATED,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction,
            additionalParameters: null,
          });
        };
        testIsFromUserAction(true);
        testIsFromUserAction(false);
        testIsFromUserAction(null);
      });

      it('should respect additionalParameters', () => {
        const testAdditionalParams = function(additionalParameters) {
          eventMan.logSwgEvent(
            AnalyticsEvent.ACTION_ACCOUNT_CREATED,
            null,
            additionalParameters
          );
          expect(event).to.deep.equal({
            eventType: AnalyticsEvent.ACTION_ACCOUNT_CREATED,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction: null,
            additionalParameters,
          });
        };
        testAdditionalParams({});
        testAdditionalParams(null);
        testAdditionalParams({fig: true});
      });
    });
  });
});
