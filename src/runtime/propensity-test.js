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
import * as PropensityApi from '../api/propensity-api';
import {Event, SubscriptionState} from '../api/logger-api';
import {PageConfig} from '../model/page-config';
import {PropensityServer} from './propensity-server';
import {ClientEventManager} from './client-event-manager';
import {Logger} from './logger';

describes.realWin('Propensity', {}, env => {
  let win;
  let config;
  let propensity;
  let eventManager;
  let fakeDeps;
  let eventListener;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig('pub1', true);
    eventManager = new ClientEventManager();
    fakeDeps = {
      eventManager: () => eventManager,
    };
    sandbox
      .stub(ClientEventManager.prototype, 'registerEventListener')
      .callsFake(listener => (eventListener = listener));
    sandbox
      .stub(ClientEventManager.prototype, 'logEvent')
      .callsFake(event => eventListener(event));
    propensity = new Propensity(
      win,
      config,
      eventManager,
      new Logger(fakeDeps)
    );
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

  it('should send events to logger', () => {
    const sentEvent = {
      name: Event.IMPRESSION_PAYWALL,
    };
    let receivedEvent = null;
    sandbox
      .stub(Logger.prototype, 'sendEvent')
      .callsFake(event => (receivedEvent = event));
    propensity.sendEvent(sentEvent);
    expect(receivedEvent).to.deep.equal(sentEvent);
  });

  it('should return propensity score from server', () => {
    const scoreDetails = [
      {
        score: 42,
        bucketed: false,
      },
    ];
    sandbox.stub(PropensityServer.prototype, 'getPropensity').callsFake(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            'header': {'ok': true},
            'body': {'scores': scoreDetails},
          });
        }, 10);
      });
    }, 10);
    return propensity.getPropensity().then(propensityScore => {
      expect(propensityScore).to.not.be.null;
      expect(propensityScore.header).to.not.be.null;
      expect(propensityScore.header.ok).to.be.true;
      expect(propensityScore.body).to.not.be.null;
      expect(propensityScore.body.scores).to.not.be.null;
      expect(propensityScore.body.scores[0].score).to.equal(42);
    });
  });
});
