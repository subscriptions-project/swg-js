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

import {AnalyticsEvent,EventOriginator} from '../proto/api_messages';

/** @enum {number}  */
export const FilterResult = {
  /** the event is allowed to proceed to the listeners */
  CONTINUE_EXECUTING: 0,
  /** the event is canceled and the listeners are not informed about it */
  STOP_EXECUTING: 1,
};

/**
 * Defines a client event in SwG
 * Properties:
 * - eventType: Required. The AnalyticsEvent type that occurred.
 * - eventOriginator: Required.  The codebase that initiated the event.
 * - additionalParameters: Optional.  A JSON object to store generic data.
 * - isFromUserAction: Optional.  True if the user took an action to generate
 *   the event.
 *
 *  @typedef {{
 *    eventType: (!AnalyticsEvent),
 *    eventOriginator: (!EventOriginator),
 *    isFromUserAction: (?boolean),
 *    additionalParameters: (?Object),
 * }}
 */
export let SwgClientEvent;

/**
 * @interface
 */
export class SwgClientEventManagerApi {
  /**
   * Call this function to log an event. The registered listeners will be
   * invoked unless the event is filtered.
   * @param {!function(!SwgClientEvent)} callback
   */
  registerEventListener(callback) { }

  /**
   * Register a filterer for events if you need to potentially prevent the
   * listeners from hearing about it.  A filterer should return
   * FilterResult.STOP_EXECUTING to prevent listeners from hearing about the
   * event.
   * @param {!function(!SwgClientEvent):FilterResult} callback
   */
  registerEventFilterer(callback) { }

  /**
   * Call this function to log an event.  The registered listeners will be
   * invoked unless the event is filtered.  Returns false if the event was
   * filtered and throws an error if the event is invalid.
   * @param {!SwgClientEvent} event
   * @returns {!Promise}
   */
  logEvent(event) { }
}
