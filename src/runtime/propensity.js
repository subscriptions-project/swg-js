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
import {PropensityServer} from './propensity-server';
import {isObject} from '../utils/types';

/**
 * @implements {PropensityApi.PropensityApi}
 */
export class Propensity {

  /**
   * @param {!Window} win
   * @param {!../model/page-config.PageConfig} pageConfig
   */
  constructor(win, pageConfig) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private {PropensityServer} */
    this.propensityServer_ = new PropensityServer(win,
        pageConfig.getPublicationId());
  }

  /** @override */
  sendSubscriptionState(state, jsonEntitlements) {
    if (!Object.values(PropensityApi.SubscriptionState).includes(state)) {
      throw new Error('Invalid subscription state provided');
    }
    if ((PropensityApi.SubscriptionState.SUBSCRIBER == state ||
         PropensityApi.SubscriptionState.PAST_SUBSCRIBER == state)
        && !jsonEntitlements) {
      throw new Error('Entitlements must be provided for users with'
          + ' active or expired subscriptions');
    }
    if (jsonEntitlements && !isObject(jsonEntitlements)) {
      throw new Error('Entitlements must be an Object');
    }
    let entitlements = null;
    if (jsonEntitlements) {
      entitlements = JSON.stringify(jsonEntitlements);
    }
    this.propensityServer_.sendSubscriptionState(state, entitlements);
  }

  /** @override */
  getPropensity(type) {
    if (type && !Object.values(PropensityApi.PropensityType).includes(type)) {
      throw new Error('Invalid propensity type requested');
    }
    if (!type) {
      type = PropensityApi.PropensityType.GENERAL;
    }
    return this.propensityServer_.getPropensity(this.win_.document.referrer,
        type);
  }

  /** @override */
  sendEvent(userEvent) {
    if (!Object.values(PropensityApi.Event).includes(userEvent.name)) {
      throw new Error('Invalid user event provided');
    }
    if (userEvent.data && !isObject(userEvent.data)) {
      throw new Error('Event data must be an Object');
    }
    // TODO(sohanirao, mborof): Idenfity the new interface with event
    // manager and update the lines below to adhere to that interface
    let paramString = null;
    if (userEvent.data) {
      paramString = JSON.stringify(userEvent.data);
    }
    this.propensityServer_.sendEvent(userEvent.name, paramString);
  }
}
