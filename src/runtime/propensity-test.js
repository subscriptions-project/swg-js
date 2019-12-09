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
import * as PropensityApi from '../api/propensity-api';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {ClientEventManager} from './client-event-manager';
import {Event, SubscriptionState} from '../api/logger-api';
import {PageConfig} from '../model/page-config';
import {Propensity} from './propensity';
import {PropensityServer} from './propensity-server';
import {XhrFetcher} from './fetcher';

describes.realWin('Propensity', {}, env => {
  let win;
  let propensity;
  let pageConfig;
  let eventManager;
  const fakeDeps = {
    pageConfig: () => pageConfig,
    eventManager: () => eventManager,
  };

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1', true);
    eventManager = new ClientEventManager();
    // Note: tests here don't use the fetcher (that's in propensity-server-test)
    propensity = new Propensity(win, fakeDeps, new XhrFetcher(win));
  });

  it('should provide valid subscription state', () => {
    //don't actually send data to the server
    sandbox
      .stub(PropensityServer.prototype, 'sendSubscriptionState')
      .callsFake(() => {});

    expect(() => {
      propensity.sendSubscriptionState(SubscriptionState.UNKNOWN);
    }).to.not.throw('Invalid subscription state provided');
    expect(() => {
      propensity.sendSubscriptionState('past');
    }).to.throw('Invalid subscription state provided');
  });

  it('should provide productsOrSkus for subscribed users', () => {
    //don't actually send data to the server
    sandbox
      .stub(PropensityServer.prototype, 'sendSubscriptionState')
      .callsFake(() => {});

    expect(() => {
      propensity.sendSubscriptionState(SubscriptionState.SUBSCRIBER);
    }).to.throw(
      'Entitlements must be provided for users with' +
        ' active or expired subscriptions'
    );
    expect(() => {
      propensity.sendSubscriptionState(SubscriptionState.PAST_SUBSCRIBER);
    }).to.throw(
      'Entitlements must be provided for users with' +
        ' active or expired subscriptions'
    );
    expect(() => {
      const productsOrSkus = {};
      productsOrSkus['product'] = 'basic-monthly';
      propensity.sendSubscriptionState(
        SubscriptionState.SUBSCRIBER,
        productsOrSkus
      );
    }).not.throw(
      'Entitlements must be provided for users with' +
        ' active or expired subscriptions'
    );
    expect(() => {
      const productsOrSkus = {};
      productsOrSkus['product'] = 'basic-monthly';
      propensity.sendSubscriptionState(
        SubscriptionState.PAST_SUBSCRIBER,
        productsOrSkus
      );
    }).not.throw(
      'Entitlements must be provided for users with' +
        ' active or expired subscriptions'
    );
    expect(() => {
      const productsOrSkus = ['basic-monthly'];
      propensity.sendSubscriptionState(
        SubscriptionState.SUBSCRIBER,
        productsOrSkus
      );
    }).throw(/Entitlements must be an Object/);
  });

  it('should request valid propensity type', () => {
    //don't make actual request to the server
    sandbox
      .stub(PropensityServer.prototype, 'getPropensity')
      .callsFake(() => {});

    expect(() => {
      propensity.getPropensity(PropensityApi.PropensityType.GENERAL);
    }).to.not.throw(/Invalid propensity type requested/);
    expect(() => {
      propensity.getPropensity('paywall-specific');
    }).to.throw(/Invalid propensity type requested/);
  });

  it('should send subscription state', () => {
    let subscriptionState = null;
    sandbox
      .stub(PropensityServer.prototype, 'sendSubscriptionState')
      .callsFake(state => {
        subscriptionState = state;
      });
    expect(() => {
      propensity.sendSubscriptionState(SubscriptionState.UNKNOWN);
    }).to.not.throw('Invalid subscription state provided');
    expect(subscriptionState).to.equal(SubscriptionState.UNKNOWN);
  });

  it('should report server errors', () => {
    sandbox
      .stub(PropensityServer.prototype, 'sendSubscriptionState')
      .callsFake(() => {
        throw new Error('publisher not whitelisted');
      });
    expect(() => {
      propensity.sendSubscriptionState(SubscriptionState.UNKNOWN);
    }).to.throw('publisher not whitelisted');
  });

  it('should send events to event manager', () => {
    let eventSent = null;
    sandbox
      .stub(ClientEventManager.prototype, 'logEvent')
      .callsFake(event => (eventSent = event));
    propensity.sendEvent({
      name: Event.IMPRESSION_PAYWALL,
    });
    expect(eventSent).to.deep.equal({
      eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: undefined,
      additionalParameters: null,
    });
  });

  it('should validate events sent to it and set appropriate defaults', () => {
    let hasError;
    let receivedEvent;

    sandbox.stub(ClientEventManager.prototype, 'logEvent').callsFake(event => {
      receivedEvent = event;
    });

    const testSend = event => {
      try {
        hasError = false;
        receivedEvent = null;
        propensity.sendEvent(event);
      } catch (e) {
        hasError = true;
      }
    };

    //ensure it rejects invalid Propensity.Event enum values
    testSend({
      name: 'invalid name',
    });
    expect(hasError).to.be.true;
    expect(receivedEvent).to.be.null;

    //ensure it takes a valid enum with nothing else and fills in appropriate
    //defaults for other values
    testSend({
      name: Event.IMPRESSION_PAYWALL,
    });
    expect(hasError).to.be.false;
    expect(receivedEvent).to.deep.equal({
      eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: undefined,
      additionalParameters: null,
    });

    //ensure it respects the active flag
    testSend({
      name: Event.IMPRESSION_OFFERS,
    });
    expect(receivedEvent).to.deep.equal({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: undefined,
      additionalParameters: null,
    });

    testSend({
      name: Event.IMPRESSION_OFFERS,
      active: null,
    });
    expect(hasError).to.be.false;
    expect(receivedEvent).to.deep.equal({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });

    testSend({
      name: Event.IMPRESSION_OFFERS,
      active: true,
    });
    expect(hasError).to.be.false;
    expect(receivedEvent).to.deep.equal({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: true,
      additionalParameters: {'is_active': true},
    });

    testSend({
      name: Event.IMPRESSION_OFFERS,
      active: false,
    });
    expect(hasError).to.be.false;
    expect(receivedEvent).to.deep.equal({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: false,
      additionalParameters: {'is_active': false},
    });

    //ensure it rejects invalid data objects
    testSend({
      name: Event.IMPRESSION_OFFERS,
      active: true,
      data: 'all_offers',
    });
    expect(hasError).to.be.true;
    expect(receivedEvent).to.be.null;
  });

  it('should return propensity score from server', async () => {
    const scoreDetails = [
      {
        score: 42,
        bucketed: false,
      },
    ];
    sandbox.stub(PropensityServer.prototype, 'getPropensity').callsFake(
      () =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              'header': {'ok': true},
              'body': {'scores': scoreDetails},
            });
          }, 10);
        }),
      10
    );

    const propensityScore = await propensity.getPropensity();
    expect(propensityScore).to.not.be.null;
    expect(propensityScore.header).to.not.be.null;
    expect(propensityScore.header.ok).to.be.true;
    expect(propensityScore.body).to.not.be.null;
    expect(propensityScore.body.scores).to.not.be.null;
    expect(propensityScore.body.scores[0].score).to.equal(42);
  });
});
