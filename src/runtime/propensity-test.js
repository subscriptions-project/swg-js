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
import {PageConfig} from '../model/page-config';
import {PropensityServer} from './propensity-server';

describes.realWin('Propensity', {}, env => {
  let win;
  let config;
  let propensity;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig('pub1', true);
    propensity = new Propensity(win, config);
  });

  it('should provide valid subscription state', () => {
    expect(() => {
      propensity.sendSubscriptionState(PropensityApi.SubscriptionState.UNKNOWN);
    }).to.not.throw('Invalid subscription state provided');
    expect(() => {
      propensity.sendSubscriptionState('past');
    }).to.throw('Invalid subscription state provided');
  });

  it('should provide entitlements for subscribed users', () => {
    expect(() => {
      propensity.sendSubscriptionState(
          PropensityApi.SubscriptionState.SUBSCRIBER);
    }).to.throw('Entitlements must be provided for users with'
        + ' active or expired subscriptions');
    expect(() => {
      propensity.sendSubscriptionState(
          PropensityApi.SubscriptionState.PAST_SUBSCRIBER);
    }).to.throw('Entitlements must be provided for users with'
        + ' active or expired subscriptions');
    expect(() => {
      const entitlements = {};
      entitlements['product'] = 'basic-monthly';
      propensity.sendSubscriptionState(
          PropensityApi.SubscriptionState.SUBSCRIBER, entitlements);
    }).not.throw('Entitlements must be provided for users with'
        + ' active or expired subscriptions');
    expect(() => {
      const entitlements = {};
      entitlements['product'] = 'basic-monthly';
      propensity.sendSubscriptionState(
          PropensityApi.SubscriptionState.PAST_SUBSCRIBER, entitlements);
    }).not.throw('Entitlements must be provided for users with'
        + ' active or expired subscriptions');
    expect(() => {
      const entitlements = ['basic-monthly'];
      propensity.sendSubscriptionState(
          PropensityApi.SubscriptionState.SUBSCRIBER, entitlements);
    }).throw(/Entitlements must be an Object/);
  });


  it('should provide valid event', () => {
    const correctEvent = {
      name: PropensityApi.Event.IMPRESSION_PAYWALL,
      active: false,
    };
    expect(() => {
      propensity.sendEvent(correctEvent);
    }).to.not.throw('Invalid user event provided');
    const incorrectEvent = {
      name: 'user-redirect',
    };
    expect(() => {
      propensity.sendEvent(incorrectEvent);
    }).to.throw('Invalid user event provided');
    const incorrectEventParam = {
      name: PropensityApi.Event.IMPRESSION_OFFERS,
      active: true,
      data: 'all_offers',
    };
    expect(() => {
      propensity.sendEvent(incorrectEventParam);
    }).to.throw(/Event data must be an Object/);
  });

  it('should request valid propensity type', () => {
    expect(() => {
      propensity.getPropensity(PropensityApi.PropensityType.GENERAL);
    }).to.not.throw(/Invalid propensity type requested/);
    expect(() => {
      propensity.getPropensity('paywall-specific');
    }).to.throw(/Invalid propensity type requested/);
  });

  it('should send subscription state', () => {
    let subscriptionState = null;
    sandbox.stub(PropensityServer.prototype, 'sendSubscriptionState',
        state => {
          subscriptionState = state;
        });
    expect(() => {
      propensity.sendSubscriptionState(PropensityApi.SubscriptionState.UNKNOWN);
    }).to.not.throw('Invalid subscription state provided');
    expect(subscriptionState).to.equal(PropensityApi.SubscriptionState.UNKNOWN);
  });

  it('should report server errors', () => {
    sandbox.stub(PropensityServer.prototype, 'sendSubscriptionState',
        () => {
          throw new Error('publisher not whitelisted');
        });
    expect(() => {
      propensity.sendSubscriptionState(PropensityApi.SubscriptionState.UNKNOWN);
    }).to.throw('publisher not whitelisted');
  });

  it('should send event params to server', () => {
    let eventSent = null;
    let paramsSent = null;
    const params = /** @type {JsonObject} */ ({'source': 'user-action'});
    const eventParams = JSON.stringify(params);
    const propensityEvent = {
      name: PropensityApi.Event.IMPRESSION_OFFERS,
      active: false,
      data: params,
    };
    sandbox.stub(PropensityServer.prototype, 'sendEvent',
        (event, params) => {
          eventSent = event;
          paramsSent = params;
        });
    propensity.sendEvent(propensityEvent);
    expect(eventSent).to.deep.equal(propensityEvent.name);
    expect(eventParams).to.equal(paramsSent);
  });

  it('should return propensity score from server', () => {
    sandbox.stub(PropensityServer.prototype, 'getPropensity',
        () => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                'header': {'ok': true},
                'body': {'result': 42},
              });
            }, 10);
          });
        });
    return propensity.getPropensity().then(propensityScore => {
      expect(propensityScore).to.not.be.null;
      expect(propensityScore.header).to.not.be.null;
      expect(propensityScore.header.ok).to.be.true;
      expect(propensityScore.body).to.not.be.null;
      expect(propensityScore.body.result).to.equal(42);
    });
  });
});
