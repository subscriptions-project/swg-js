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
import * as PropensityApi from '../api/propensity-api';
/**
 * @implements {PropensityApi}
 */
export class Propensity {

  constructor(win, pageConfig, fetcher) {
    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = pageConfig;
    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private {?string} */
    this.state_ = null;
  }

  /** @override */
  initSession(state, entitlements) {
    if (!Object.values(PropensityApi.SubscriptionState).includes(state)) {
      throw new Error('Invalid subscription state provided');
    }
    if (PropensityApi.SubscriptionState.SUBSCRIBER == state && !entitlements) {
      throw new Error('Entitlements not provided for subscribed users')
    }
    this.state_ = state;
    // TODO(sohanirao): inform server of subscription state
  }

  /** @override */
  getPropensity(type) {
    const propensityToSubscribe = undefined;
    if (type && !Object.values(PropensityApi.PropensityType).includes(type)) {
      throw new Error('Invalid propensity type requested');
    }
    // TODO(sohanirao): request propensity from server
    return Promise.resolve(propensityToSubscribe);
  }

  /** @override */
  event(userEvent, jsonParams) {
    if (!Object.values(PropensityApi.Event).includes(userEvent)) {
      throw new Error('Invalid user event provided');
    }
    // TODO(sohanirao): send event and params if necessary
    // TODO(sohanirao): determine if event updates subscription
    //                  state and inform server of new state
  }
}
