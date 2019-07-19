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
import * as LoggerApi from '../api/logger-api';
import {ClientEvent} from '../api/client-event-manager-api';
import {EventOriginator} from '../proto/api_messages';
import * as PropensityApi from '../api/propensity-api';
import {AnalyticsEvent} from '../proto/api_messages';

/**
 * @implements {LoggerApi}
 */
export class Logger {
  /*
   * @param {!../client-event-manager/ClientEventManager} eventManager
   */
  constructor(eventManager) {
    /** @private @const {!../client-event-manager/ClientEventManager} */
    this.eventManager_ = eventManager;
  }

  /**
   * @param {LoggerApi.Event} event
   * @override
   */
  sendEvent(event) {
    const propensityEvent = /** @type {PropensityApi.Event} */(event.name);
    const clientEventType = propensityEventToAnalyticsEvent(propensityEvent);
    const clientEvent = /** @type {ClientEvent} */ (
        {
          eventType: clientEventType,
          eventOriginator: EventOriginator.PROPENSITY_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
      }
    );
    this.eventManager_.logEvent(clientEvent);
  }

  /**
   * @param {LoggerApi.SubscriptionState} state
   * @param {?JsonObject} jsonProducts
   */
  sendSubscriptionState(state, jsonProducts) {
    // TODO(sohanirao): Add Subscription state event
    // IMPRESSION_SUBSCRIPTION_STATE
    const clientEventType = AnalyticsEvent.IMPRESSION_SMARTBOX;
    const clientEvent = /** @type {ClientEvent} */ (
        {
          eventType: clientEventType,
          eventOriginator: EventOriginator.PROPENSITY_CLIENT,
          isFromUserAction: false,
          additionalParameters: {'state': state, 'product': jsonProducts['product']},
      }
    );
    this.eventManager_.logEvent(clientEvent);
  }
}