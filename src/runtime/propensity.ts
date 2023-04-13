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
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {Event, SubscriptionState} from '../api/logger-api';
import {EventOriginator} from '../proto/api_messages';
import {Fetcher} from './fetcher';
import {
  PropensityApi,
  PropensityScore,
  PropensityType,
} from '../api/propensity-api';
import {PropensityServer} from './propensity-server';
import {PublisherEvent} from '../api/logger-api';
import {isBoolean} from '../utils/types';
import {isEnumValue, isObject} from '../utils/types';
import {publisherEventToAnalyticsEvent} from './event-type-mapping';

export class Propensity implements PropensityApi {
  private readonly eventManager_: ClientEventManager;
  private propensityServer_: PropensityServer;

  /**
   * IMPORTANT: deps may not be full initialized config and pageConfig are
   * available immediately, other function should be gated on a ready promise.
   * #TODO(jpettitt) switch refactor to take out the win and use deps to get win
   */
  constructor(private readonly win_: Window, deps: Deps, fetcher: Fetcher) {
    this.propensityServer_ = new PropensityServer(win_, deps, fetcher);

    this.eventManager_ = deps.eventManager();
  }

  sendSubscriptionState(
    state: SubscriptionState,
    jsonProducts?: {product: string[]}
  ): void {
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

  getPropensity(type?: PropensityType): Promise<PropensityScore | null> {
    if (type && !Object.values(PropensityType).includes(type)) {
      throw new Error('Invalid propensity type requested');
    }
    if (!type) {
      type = PropensityType.GENERAL;
    }
    return this.propensityServer_.getPropensity(
      this.win_.document.referrer,
      type
    );
  }

  sendEvent(userEvent: PublisherEvent): void {
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

    this.eventManager_.logEvent({
      eventType: analyticsEvent,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: userEvent.active,
      additionalParameters: data,
    });
  }
}
