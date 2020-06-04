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
import {ClientEventManager} from './client-event-manager';
import {Event, SubscriptionState} from '../api/logger-api';
import {Logger} from './logger';
import {PageConfig} from '../model/page-config';
import {Propensity} from './propensity';
import {PropensityServer} from './propensity-server';
import {XhrFetcher} from './fetcher';

describes.realWin('Logger', {}, (env) => {
  let win;
  let pageConfig;
  let logger;
  let eventManager;
  let propensityServerListener;
  let thrownError;
  let fakeDeps;
  let fetcher;
  const config = {};

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1', true);
    eventManager = new ClientEventManager(Promise.resolve());
    fetcher = new XhrFetcher(win);

    // We aren't testing event manager - this suppresses the promises.
    sandbox
      .stub(eventManager, 'registerEventListener')
      .callsFake((listener) => (propensityServerListener = listener));
    sandbox.stub(eventManager, 'logEvent').callsFake((event) => {
      try {
        propensityServerListener(event);
      } catch (e) {
        thrownError = e;
      }
    });

    config.enablePropensity = true;

    fakeDeps = {
      eventManager: () => eventManager,
      pageConfig: () => pageConfig,
      config: () => config,
    };
    logger = new Logger(fakeDeps);

    // This ensures propensity server is listening.
    new Propensity(win, fakeDeps, fetcher);
  });

  describe('subscription state', () => {
    describe('validation', () => {
      const productsOrSkus = {'product': 'basic-monthly'};

      let receivedEvent;

      beforeEach(() => {
        sandbox
          .stub(PropensityServer.prototype, 'sendSubscriptionState')
          .callsFake(() => {});

        receivedEvent = null;
        propensityServerListener = (event) => (receivedEvent = event);
      });

      it('subscription state is validated', () => {
        expect(() => {
          logger.sendSubscriptionState('past');
        }).to.throw('Invalid subscription state provided');

        expect(() => {
          logger.sendSubscriptionState(SubscriptionState.UNKNOWN);
        }).to.not.throw();
      });

      it('productsOrSkus are required for subscribed users', () => {
        const subscriptionStates = [
          SubscriptionState.SUBSCRIBER,
          SubscriptionState.PAST_SUBSCRIBER,
        ];
        for (const subscriptionState of subscriptionStates) {
          expect(() => {
            logger.sendSubscriptionState(subscriptionState);
          }).to.throw(
            'Entitlements must be provided for users with' +
              ' active or expired subscriptions'
          );
        }
      });

      it('productsOrSkus must be an object', () => {
        expect(() => {
          const productsOrSkus = ['basic-monthly'];
          logger.sendSubscriptionState(
            SubscriptionState.SUBSCRIBER,
            productsOrSkus
          );
        }).to.throw(/Entitlements must be an Object/);
      });

      it('productsOrSkus for subscribed users', () => {
        const subscriptionStates = [
          SubscriptionState.SUBSCRIBER,
          SubscriptionState.PAST_SUBSCRIBER,
        ];
        for (const subscriptionState of subscriptionStates) {
          logger.sendSubscriptionState(subscriptionState, productsOrSkus);
          expect(receivedEvent.additionalParameters.state).to.equal(
            subscriptionState
          );
        }
      });
    });

    it('should send subscription state', async () => {
      let subscriptionState = null;
      sandbox
        .stub(PropensityServer.prototype, 'sendSubscriptionState')
        .callsFake((state) => (subscriptionState = state));
      logger.sendSubscriptionState(SubscriptionState.UNKNOWN);
      await logger.eventManagerPromise_;
      expect(subscriptionState).to.equal(SubscriptionState.UNKNOWN);
    });

    it('should report server errors', async () => {
      const SENT_ERR = new Error('publisher not allowlisted');
      //note that actual event manager will cause the error to be logged to the
      //console instead of being immediately thrown.
      sandbox.stub(fetcher, 'fetch').callsFake(() => {
        throw SENT_ERR;
      });
      logger.sendSubscriptionState(SubscriptionState.UNKNOWN);
      await logger.eventManagerPromise_;
      expect(thrownError).to.equal(SENT_ERR);
    });
  });

  describe('sendEvent', () => {
    let receivedEvent;

    beforeEach(() => {
      receivedEvent = null;
      propensityServerListener = (event) => (receivedEvent = event);
    });

    it('should send events to event manager', async () => {
      logger.sendEvent({
        name: Event.IMPRESSION_PAYWALL,
      });
      await logger.eventManagerPromise_;
      expect(receivedEvent).to.deep.equal({
        eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
        eventOriginator: EventOriginator.PUBLISHER_CLIENT,
        isFromUserAction: undefined,
        additionalParameters: null,
      });
    });

    describe('validation and defaults', () => {
      describe('name', () => {
        it('should reject invalid values', async () => {
          expect(() =>
            logger.sendEvent({
              name: 'invalid name',
            })
          ).to.throw('Invalid user event provided(invalid name)');
        });

        it('should allow valid values', async () => {
          // Ensure it takes a valid enum with nothing else and fills in
          // appropriate defaults for other values.
          logger.sendEvent({
            name: Event.IMPRESSION_PAYWALL,
          });
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: undefined,
            additionalParameters: null,
          });
        });
      });

      describe('active', () => {
        it('should set default', async () => {
          // Ensure it respects the active flag.
          logger.sendEvent({
            name: Event.IMPRESSION_OFFERS,
          });
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: undefined,
            additionalParameters: null,
          });
        });

        it('should allow valid `active` values and set is_active', async () => {
          const validValues = [null, true, false];
          for (const active of validValues) {
            logger.sendEvent({
              name: Event.IMPRESSION_OFFERS,
              active,
            });
            expect(receivedEvent).to.deep.equal({
              eventType: AnalyticsEvent.IMPRESSION_OFFERS,
              eventOriginator: EventOriginator.PUBLISHER_CLIENT,
              isFromUserAction: active,
              additionalParameters:
                active != null ? {'is_active': active} : active,
            });
          }
        });

        it('should handle invalid `active` values', async () => {
          const invalidValues = ['hey', 1];
          for (const active of invalidValues) {
            expect(() =>
              logger.sendEvent({
                name: Event.IMPRESSION_OFFERS,
                active,
              })
            ).to.throw('Event active must be a boolean');
          }
        });

        it('should allow `data` along with `active` flag', async () => {
          const active = true;
          const data = {'someData': 1};
          logger.sendEvent({
            name: Event.IMPRESSION_OFFERS,
            data,
            active,
          });
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: true,
            additionalParameters: {'someData': 1, 'is_active': active},
          });
        });
      });

      describe('data', () => {
        it('should reject invalid values', () => {
          const data = 'all_offers';
          expect(() =>
            logger.sendEvent({
              name: Event.IMPRESSION_OFFERS,
              data,
            })
          ).to.throw('Event data must be an Object(all_offers)');
        });

        it('should allow valid values', async () => {
          const data = {'someData': 1};
          logger.sendEvent({
            name: Event.IMPRESSION_OFFERS,
            data,
          });
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: undefined,
            additionalParameters: data,
          });
        });

        it('should set default', async () => {
          logger.sendEvent({
            name: Event.IMPRESSION_OFFERS,
          });
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: undefined,
            additionalParameters: null,
          });
        });
      });
    });
  });
});
