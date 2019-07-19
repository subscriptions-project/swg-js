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
import {
  PropensityEvent,
  SubscriptionState as PropensitySubscriptionState,
} from './propensity-api';

export const Event = PropensityEvent;
export const SubscriptionState = PropensitySubscriptionState;

/**
 * @interface
 */
export class LoggerApi {
/**
   * Send user subscription state upon initial discovery.
   * A user may have active subscriptions to some products
   * and expired subscriptions to others. Make one API call
   * per subscription state and provide a corresponding
   * list of products with a json object of depth 1.
   * For example:
   *     {'product': ['product1', 'product2']}
   * Each call to this API should have the first argument
   * as a valid string from the enum SubscriptionState.
   * @param {SubscriptionState} state
   * @param {?JsonObject} jsonProducts
   */
  sendSubscriptionState(state, jsonProducts) {}

  /**
   * Send a single user event.
   * @param {Event} userEvent
   */
   sendEvent(userEvent) {}
}