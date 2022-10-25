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
import {Event, SubscriptionState} from '../api/logger-api';
import {isBoolean, isEnumValue, isObject} from '../utils/types';
import {publisherEventToAnalyticsEvent} from './event-type-mapping';

/**
 * @implements {../api/logger-api.LoggerApi}
 */
export class Logger {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!../api/client-event-manager-api.ClientEventManagerApi} */
    this.eventManager_ = deps.eventManager();
  }

  /** @override */
  sendSubscriptionState(state, jsonProducts) {
    if (!isEnumValue(SubscriptionState, state)) {
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
    this.eventManager_.logEvent(
      {
        eventType: AnalyticsEvent.EVENT_SUBSCRIPTION_STATE,
        eventOriginator: EventOriginator.PUBLISHER_CLIENT,
        isFromUserAction: null,
        additionalParameters: {
          state,
          productsOrSkus,
        },
      },
      /* eventParams */ {}
    );
  }

  /** @override */
  sendEvent(userEvent) {
    let data = null;
    if (
      !isEnumValue(Event, userEvent.name) ||
      !publisherEventToAnalyticsEvent(userEvent.name)
    ) {
      throw new Error('Invalid user event provided(' + userEvent.name + ')');
    }

    if (userEvent.data) {
      if (!isObject(userEvent.data)) {
        throw new Error('Event data must be an Object(' + userEvent.data + ')');
      } else {
        data = Object.assign({}, data, userEvent.data);
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
        eventType: publisherEventToAnalyticsEvent(userEvent.name),
        eventOriginator: EventOriginator.PUBLISHER_CLIENT,
        isFromUserAction: userEvent.active,
        additionalParameters: data,
      },
      /* eventParams */ {}
    );
  }
}
