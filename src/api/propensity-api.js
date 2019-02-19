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

export const SubscriptionStates = ['na', 'no', 'yes', 'ex'];

export const Events = [
  'paywall', 'subscribed', 'expired', 'cancelled', 'ad_shown', 'offer_shown', 'custom',
];

export const PropensityType = ['general', 'paywall'];

/**
 * @interface
 */
export class PropensityApi {

   /**
   * Provide user subscription state upon discovery
   * @param {string} state
   */
  initSession(state) {}

   /**
   * Returns the propensity of a user to subscribe
   * @param {string=} type
   * @return {?Promise<number>}
   */
  getPropensity(type) {}

   /**
   * Send user events to the DRX server
   * @param {string} userEvent
   * @param {?Object} jsonParams
   */
   event(userEvent, jsonParams) {}
}
