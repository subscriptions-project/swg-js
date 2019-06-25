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
import {isObject,isEnumValue} from '../utils/types';
import {EventOriginator} from '../proto/api_messages';
import {propensityEventToAnalyticsEvent} from './propensity-type-mapping';
import {isBoolean} from '../utils/types';

/**
 * @implements {PropensityApi.PropensityApi}
 */
export class Propensity {

  /**
   * @param {!Window} win
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {!../api/client-event-manager-api.ClientEventManagerApi} eventManager
   * @param {!function():boolean} logSwgEventsCallback
   */
  constructor(win, pageConfig, eventManager, logSwgEventsCallback) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private {PropensityServer} */
    this.propensityServer_ = new PropensityServer(win,
        pageConfig.getPublicationId(), eventManager, logSwgEventsCallback);

    /** @private @const {!../api/client-event-manager-api.ClientEventManagerApi} */
    this.eventManager_ = eventManager;
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
    const analyticsEvent = propensityEventToAnalyticsEvent(userEvent.name);
    let data = null;
    if (!isEnumValue(PropensityApi.Event, userEvent.name)
        || !analyticsEvent) {
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

    this.eventManager_.logEvent({
      eventType: analyticsEvent,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: userEvent.active,
      additionalParameters: data,
    });
  }
}
