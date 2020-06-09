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
    let configurationPromise;

    beforeEach(() => {
      configurationPromise = new Promise((resolve, reject) => {
        indicateConfigurationSucceeded = resolve;
        indicateConfigurationFailed = reject;
      });
      eventManager = new ClientEventManager(configurationPromise);
      events = [];
      eventManager.registerEventListener((e) => events.push(e));
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

    it('returns ready promise', () => {
      expect(eventManager.getReadyPromise()).to.equal(configurationPromise);
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

        for (const eventType of invalidValues) {
          const event = Object.assign({}, DEFAULT_EVENT, {
            eventType,
          });
          expect(() => eventManager.logEvent(event)).to.throw(
            `Event has an invalid eventType(${eventType})`
          );
        }
      });

      it('should handle valid eventType values', () => {
        const validValues = [OTHER_TYPE];

        for (const eventType of validValues) {
          const event = Object.assign({}, DEFAULT_EVENT, {
            eventType,
          });
          expect(() => eventManager.logEvent(event)).not.to.throw();
        }
      });

      it('should handle invalid eventOriginator values', () => {
        const invalidValues = [BAD_VALUE, null];

        for (const eventOriginator of invalidValues) {
          const event = Object.assign({}, DEFAULT_EVENT, {
            eventOriginator,
          });
          expect(() => eventManager.logEvent(event)).to.throw(
            `Event has an invalid eventOriginator(${eventOriginator})`
          );
        }
      });

      it('should handle valid eventOriginator values', () => {
        const validValues = [OTHER_ORIGIN, DEFAULT_ORIGIN];

        for (const eventOriginator of validValues) {
          const event = Object.assign({}, DEFAULT_EVENT, {
            eventOriginator,
          });
          expect(() => eventManager.logEvent(event)).to.not.throw();
        }
      });

      it('should handle invalid isFromUserAction values', () => {
        const invalidValues = [BAD_VALUE];

        for (const isFromUserAction of invalidValues) {
          const event = Object.assign({}, DEFAULT_EVENT, {
            isFromUserAction,
          });
          expect(() => eventManager.logEvent(event)).to.throw(
            `Event has an invalid isFromUserAction(${isFromUserAction})`
          );
        }
      });

      it('should handle valid isFromUserAction values', () => {
        const validValues = [true, false, null];

        for (const isFromUserAction of validValues) {
          const event = Object.assign({}, DEFAULT_EVENT, {
            isFromUserAction,
          });
          expect(() => eventManager.logEvent(event)).to.not.throw();
        }
      });

      it('should handle invalid additionalParameters values', () => {
        const invalidValues = [BAD_VALUE];

        for (const additionalParameters of invalidValues) {
          const event = Object.assign({}, DEFAULT_EVENT, {
            additionalParameters,
          });
          expect(() => eventManager.logEvent(event)).to.throw(
            `Event has an invalid additionalParameters(${additionalParameters})`
          );
        }
      });

      it('should handle valid additionalParameters values', () => {
        const validValues = [{IAmValid: 5}, null];

        for (const additionalParameters of validValues) {
          const event = Object.assign({}, DEFAULT_EVENT, {
            additionalParameters,
          });
          expect(() => eventManager.logEvent(event)).to.not.throw();
        }
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
    let eventManager;
    let events;

    beforeEach(() => {
      eventManager = new ClientEventManager(RESOLVED_PROMISE);
      events = [];
      eventManager.registerEventListener((event) => events.push(event));
    });

    it('throws if listener is not a function', async () => {
      expect(() => {
        eventManager.registerEventListener('Hey guys');
      }).to.throw(/must be a function/);
    });

    it('supports a single listener', async () => {
      eventManager.logEvent(DEFAULT_EVENT);
      await tick();
      expect(events).to.deep.equal([DEFAULT_EVENT]);
    });

    it('supports additional listeners', async () => {
      eventManager.registerEventListener((event) => events.push(event));

      eventManager.logEvent(DEFAULT_EVENT);
      await tick();
      expect(events).to.deep.equal([DEFAULT_EVENT, DEFAULT_EVENT]);
    });

    it('should throw if filterer is not a function', async () => {
      expect(() => {
        eventManager.registerEventFilterer(null);
      }).to.throw(/must be a function/);
    });

    it('should be able to filter out some events', async () => {
      // Filter out the default origin.
      eventManager.registerEventFilterer((event) =>
        event.eventOriginator === DEFAULT_ORIGIN
          ? EventManagerApi.FilterResult.CANCEL_EVENT
          : EventManagerApi.FilterResult.PROCESS_EVENT
      );

      // Ensure the default origin is filtered out.
      eventManager.logEvent(DEFAULT_EVENT);
      await tick();
      expect(events).to.deep.equal([]);

      // Ensure the other origin is not filtered out.
      const event = Object.assign({}, DEFAULT_EVENT, {
        eventOriginator: OTHER_ORIGIN,
      });
      eventManager.logEvent(event);
      await tick();
      expect(events).to.deep.equal([event]);
    });
  });

  describe('helpers', () => {
    let eventManager;

    beforeEach(() => {
      eventManager = new ClientEventManager(RESOLVED_PROMISE);
    });

    it('should identify publisher events', () => {
      const publisherEvents = [
        EventOriginator.AMP_CLIENT,
        EventOriginator.PROPENSITY_CLIENT,
        EventOriginator.PUBLISHER_CLIENT,
      ];
      for (const eventOriginator of publisherEvents) {
        const event = Object.assign({}, DEFAULT_EVENT, {eventOriginator});
        expect(ClientEventManager.isPublisherEvent(event)).to.equal(true);
      }
    });

    it('should identify non-publisher events', () => {
      const nonPublisherEvents = [
        EventOriginator.SWG_CLIENT,
        EventOriginator.SWG_SERVER,
        EventOriginator.UNKNOWN_CLIENT,
      ];
      for (const eventOriginator of nonPublisherEvents) {
        const event = Object.assign({}, DEFAULT_EVENT, {eventOriginator});
        expect(ClientEventManager.isPublisherEvent(event)).to.equal(false);
      }
    });

    describe('logSwgEvent', () => {
      let event;

      beforeEach(() => {
        sandbox
          .stub(ClientEventManager.prototype, 'logEvent')
          .callsFake((e) => {
            event = e;
          });
      });

      it('should have appropriate defaults', () => {
        eventManager.logSwgEvent(AnalyticsEvent.ACTION_ACCOUNT_CREATED);
        expect(event).to.deep.equal({
          eventType: AnalyticsEvent.ACTION_ACCOUNT_CREATED,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
        });
      });

      it('should respect isFromUserAction', () => {
        const possibleValues = [true, false, null];
        for (const isFromUserAction of possibleValues) {
          eventManager.logSwgEvent(
            AnalyticsEvent.ACTION_ACCOUNT_CREATED,
            isFromUserAction
          );
          expect(event).to.deep.equal({
            eventType: AnalyticsEvent.ACTION_ACCOUNT_CREATED,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction,
            additionalParameters: null,
          });
        }
      });

      it('should respect additionalParameters', () => {
        const possibleValues = [{}, null, {fig: true}];
        for (const additionalParameters of possibleValues) {
          eventManager.logSwgEvent(
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
        }
      });
    });
  });
});
