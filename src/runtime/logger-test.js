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
import {Propensity} from './propensity';
import {Event, SubscriptionState} from '../api/logger-api';
import {PageConfig} from '../model/page-config';
import {PropensityServer} from './propensity-server';
import {ClientEventManager} from './client-event-manager';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {XhrFetcher} from './fetcher';
import {Logger} from './logger';
import {setExperiment} from './experiments';
import {ExperimentFlags} from './experiment-flags';

describes.realWin('Logger', {}, env => {
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

    //we aren't testing event manager - this suppresses the promises
    sandbox
      .stub(eventManager, 'registerEventListener')
      .callsFake(listener => (propensityServerListener = listener));
    sandbox.stub(eventManager, 'logEvent').callsFake(event => {
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

    // Allow swg events
    setExperiment(win, ExperimentFlags.LOG_SWG_TO_PROPENSITY, true);
    //this ensures propensity server is listening
    new Propensity(win, fakeDeps, fetcher);
  });

  describe('subscription state', () => {
    describe('validation', () => {
      const errSubscState = 'Invalid subscription state provided';
      const errEntitlements =
        'Entitlements must be provided for users with' +
        ' active or expired subscriptions';
      const productsOrSkus = {'product': 'basic-monthly'};

      beforeEach(() => {
        sandbox
          .stub(PropensityServer.prototype, 'sendSubscriptionState')
          .callsFake(() => {});
      });

      it('subscription state', () => {
        expect(() => {
          logger.sendSubscriptionState('past');
        }).to.throw(errSubscState);

        expect(() => {
          logger.sendSubscriptionState(SubscriptionState.UNKNOWN);
        }).to.not.throw(errSubscState);
      });

      it('productsOrSkus for subscribed users', () => {
        expect(() => {
          logger.sendSubscriptionState(SubscriptionState.SUBSCRIBER);
        }).to.throw(errEntitlements);
        expect(() => {
          logger.sendSubscriptionState(SubscriptionState.PAST_SUBSCRIBER);
        }).to.throw(errEntitlements);

        expect(() => {
          logger.sendSubscriptionState(
            SubscriptionState.SUBSCRIBER,
            productsOrSkus
          );
        }).not.throw(errEntitlements);

        expect(() => {
          logger.sendSubscriptionState(
            SubscriptionState.PAST_SUBSCRIBER,
            productsOrSkus
          );
        }).not.throw(errEntitlements);

        expect(() => {
          const productsOrSkus = ['basic-monthly'];
          logger.sendSubscriptionState(
            SubscriptionState.SUBSCRIBER,
            productsOrSkus
          );
        }).throw(/Entitlements must be an Object/);
      });
    });

    it('should send subscription state', async function() {
      let subscriptionState = null;
      sandbox
        .stub(PropensityServer.prototype, 'sendSubscriptionState')
        .callsFake(state => (subscriptionState = state));
      logger.sendSubscriptionState(SubscriptionState.UNKNOWN);
      await logger.eventManagerPromise_;
      expect(subscriptionState).to.equal(SubscriptionState.UNKNOWN);
    });

    it('should report server errors', async function() {
      const SENT_ERR = new Error('publisher not whitelisted');
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
      propensityServerListener = event => (receivedEvent = event);
    });

    it('should send events to event manager', async function() {
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
      let hasError;

      const testSend = async function(event) {
        try {
          hasError = false;
          receivedEvent = null;
          logger.sendEvent(event);
          await logger.eventManagerPromise_;
        } catch (e) {
          hasError = true;
        }
      };

      describe('name', () => {
        it('should reject invalid', async function() {
          //ensure it rejects invalid Propensity.Event enum values
          testSend({
            name: 'invalid name',
          });
          expect(hasError).to.be.true;
          expect(receivedEvent).to.be.null;
        });

        it('should allow valid', async function() {
          //ensure it takes a valid enum with nothing else and fills in
          //appropriate defaults for other values
          await testSend({
            name: Event.IMPRESSION_PAYWALL,
          });
          expect(hasError).to.be.false;
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: undefined,
            additionalParameters: null,
          });
        });
      });

      describe('active', () => {
        it('should set default', async function() {
          //ensure it respects the active flag
          await testSend({
            name: Event.IMPRESSION_OFFERS,
          });
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: undefined,
            additionalParameters: null,
          });
        });

        it('should allow valid and set is_active', async function() {
          await testSend({
            name: Event.IMPRESSION_OFFERS,
            active: null,
          });
          expect(hasError).to.be.false;
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: null,
            additionalParameters: null,
          });

          await testSend({
            name: Event.IMPRESSION_OFFERS,
            active: true,
          });
          expect(hasError).to.be.false;
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: true,
            additionalParameters: {'is_active': true},
          });

          await testSend({
            name: Event.IMPRESSION_OFFERS,
            active: false,
          });
          expect(hasError).to.be.false;
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: false,
            additionalParameters: {'is_active': false},
          });
        });

        it('should reject invalid', async function() {
          await testSend({
            name: Event.IMPRESSION_OFFERS,
            active: 'BAD STRING',
          });
          expect(hasError).to.be.true;
          expect(receivedEvent).to.be.null;
        });
      });

      describe('data', () => {
        it('should reject invalid', () => {
          //ensure it rejects invalid data objects
          testSend({
            name: Event.IMPRESSION_OFFERS,
            data: 'all_offers',
          });
          expect(hasError).to.be.true;
          expect(receivedEvent).to.be.null;
        });

        it('should allow valid', async function() {
          const data = {'someData': 1};
          //ensure it rejects invalid data objects
          await testSend({
            name: Event.IMPRESSION_OFFERS,
            data,
          });
          expect(hasError).to.be.false;
          expect(receivedEvent).to.deep.equal({
            eventType: AnalyticsEvent.IMPRESSION_OFFERS,
            eventOriginator: EventOriginator.PUBLISHER_CLIENT,
            isFromUserAction: undefined,
            additionalParameters: data,
          });
        });

        it('should set default', async function() {
          //ensure it rejects invalid data objects
          await testSend({
            name: Event.IMPRESSION_OFFERS,
          });
          expect(hasError).to.be.false;
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
