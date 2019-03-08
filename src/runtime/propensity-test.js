/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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
    }).to.throw('Entitlements not provided for subscribed users');
    expect(() => {
      const entitlements = {};
      entitlements['product'] = 'basic-monthly';
      propensity.sendSubscriptionState(
          PropensityApi.SubscriptionState.SUBSCRIBER, entitlements);
    }).not.throw('Entitlements not provided for subscribed users');
  });

  it('should provide valid event', () => {
    expect(() => {
      propensity.sendEvent(PropensityApi.Event.IMPRESSION_PAYWALL);
    }).to.not.throw('Invalid user event provided');
    expect(() => {
      propensity.sendEvent('user-redirect');
    }).to.throw('Invalid user event provided');
  });

  it('should request valid propensity type', () => {
    expect(() => {
      propensity.getPropensity(PropensityApi.PropensityType.GENERAL);
    }).to.not.throw(/Invalid propensity type requested/);
    expect(() => {
      propensity.getPropensity('paywall-specific');
    }).to.throw(/Invalid propensity type requested/);
  });
});
