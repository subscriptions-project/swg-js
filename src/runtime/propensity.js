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
import {Event, SubscriptionState} from '../api/logger-api';
import {EventOriginator} from '../proto/api_messages';
import {PropensityServer} from './propensity-server';
import {isBoolean} from '../utils/types';
import {isEnumValue, isObject} from '../utils/types';
import {publisherEventToAnalyticsEvent} from './event-type-mapping';

/**
 * @implements {PropensityApi.PropensityApi}
 */
export class Propensity {
  /**
   * @param {!Window} win
   * @param {!./deps.DepsDef} deps
   * @param {!./fetcher.Fetcher} fetcher
   *
   * IMPORTANT: deps may not be full initialized config and pageConfig are
   * available immediately, other function should be gated on a ready promise.
   * #TODO(jpettitt) switch refactor to take out the win and use deps to get win
   */
  constructor(win, deps, fetcher) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private {PropensityServer} */
    this.propensityServer_ = new PropensityServer(win, deps, fetcher);

    /** @private @const {!../api/client-event-manager-api.ClientEventManagerApi} */
    this.eventManager_ = deps.eventManager();
  }

  /** @override */
  sendSubscriptionState(state, jsonProducts) {
    if (!Object.values(SubscriptionState).includes(state)) {
      throw new Error('Invalid subscription state provided');
    }
    if (
      (SubscriptionState.SUBSCRIBER == state ||
        SubscriptionState.PAST_SUBSCRIBER == state) &&
      !jsonProducts
    ) {
      throw new Error(
        'Entitlements must be provided for users with' +
          ' active or expired subscriptions'
      );
    }
    if (jsonProducts && !isObject(jsonProducts)) {
      throw new Error('Entitlements must be an Object');
    }
    let productsOrSkus = null;
    if (jsonProducts) {
      productsOrSkus = JSON.stringify(jsonProducts);
    }
    this.propensityServer_.sendSubscriptionState(state, productsOrSkus);
  }

  /** @override */
  getPropensity(type) {
    if (type && !Object.values(PropensityApi.PropensityType).includes(type)) {
      throw new Error('Invalid propensity type requested');
    }
    if (!type) {
      type = PropensityApi.PropensityType.GENERAL;
    }
    return this.propensityServer_.getPropensity(
      this.win_.document.referrer,
      type
    );
  }

  /** @override */
  sendEvent(userEvent) {
    const analyticsEvent = publisherEventToAnalyticsEvent(userEvent.name);
    let data = null;
    if (!isEnumValue(Event, userEvent.name) || !analyticsEvent) {
      throw new Error('Invalid user event provided(' + userEvent.name + ')');
    }

    if (userEvent.data) {
      if (!isObject(userEvent.data)) {
        throw new Error('Event data must be an Object(' + userEvent.data + ')');
      } else {
        data = {};
        Object.assign(data, userEvent.data);
      }
    }

    if (isBoolean(userEvent.active)) {
      if (!data) {
        data = {};
      }
      Object.assign(data, {'is_active': userEvent.active});
    } else if (userEvent.active != null) {
      throw new Error('Event active must be a boolean');
    }

    this.eventManager_.logEvent(
      {
        eventType: analyticsEvent,
        eventOriginator: EventOriginator.PROPENSITY_CLIENT,
        isFromUserAction: userEvent.active,
        additionalParameters: data,
      },
      /* eventParams */ {}
    );
  }
}
