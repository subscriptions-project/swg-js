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
import {ClientEventManager} from './client-event-manager';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';

describes.realWin('Propensity', {}, env => {
  let win;
  let config;
  let propensity;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig('pub1', true);
    propensity = new Propensity(win, config, new ClientEventManager());
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

  it('should send events to event manager', () => {
    let eventSent = null;
    const params = /** @type {JsonObject} */ ({
      'source': 'email',
    });
    sandbox.stub(ClientEventManager.prototype, 'logEvent',
        event => eventSent = event);
    propensity.sendEvent({
      name: PropensityApi.Event.IMPRESSION_PAYWALL,
      active: false,
      data: params,
    });
    expect(eventSent).to.deep.equal({
      eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: false,
      additionalParameters: {
        'source': 'email',
      },
    });
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

  it('should convert all propensity events to analytics events', () => {
    let eventSent = null;
    const params = /** @type {JsonObject} */ ({
      'source': 'user-action',
      'is_active': false,
    });
    sandbox.stub(ClientEventManager.prototype, 'logEvent',
        event => eventSent = event);

    for (const k in PropensityApi.Event) {
      const propEvent = PropensityApi.Event[k];
      eventSent = null;
      propensity.sendEvent({
        name: propEvent,
        active: false,
        data: params,
      });
      expect(eventSent).to.not.be.null;
      expect(eventSent.eventType).to.not.be.null;
      let expected = null;

      switch (propEvent) {
        case PropensityApi.Event.IMPRESSION_PAYWALL:
          expected = AnalyticsEvent.IMPRESSION_PAYWALL;
          break;
        case PropensityApi.Event.IMPRESSION_AD:
          expected = AnalyticsEvent.IMPRESSION_AD;
          break;
        case PropensityApi.Event.IMPRESSION_OFFERS:
          expected = AnalyticsEvent.IMPRESSION_OFFERS;
          break;
        case PropensityApi.Event.ACTION_SUBSCRIPTIONS_LANDING_PAGE:
          expected = AnalyticsEvent.ACTION_SUBSCRIPTIONS_LANDING_PAGE;
          break;
        case PropensityApi.Event.ACTION_OFFER_SELECTED:
          expected = AnalyticsEvent.ACTION_OFFER_SELECTED;
          break;
        case PropensityApi.Event.ACTION_PAYMENT_FLOW_STARTED:
          expected = AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED;
          break;
        case PropensityApi.Event.ACTION_PAYMENT_COMPLETED:
          expected = AnalyticsEvent.ACTION_PAYMENT_COMPLETE;
          break;
        case PropensityApi.Event.EVENT_CUSTOM:
          expected = AnalyticsEvent.EVENT_CUSTOM;
          break;
        default:
          expect(false).to.be.true; //add your event type above
          break;
      }
      if (expected !== null) {
        expect(eventSent.eventType).to.equal(expected);
      }
    }
  });
});
