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

import {
  AnalyticsEvent as AnalyticsEventDef,
  EventOriginator as EventOriginatorDef,
} from '../proto/api_messages';

/** @enum {number}  */
export const FilterResult = {
  /** The event is allowed to proceed to the listeners. */
  PROCESS_EVENT: 0,
  /** The event is canceled and the listeners are not informed about it. */
  CANCEL_EVENT: 1,
};

/**
 * Defines a client event in SwG
 * Properties:
 * - eventType: Required. The AnalyticsEvent type that occurred.
 * - eventOriginator: Required.  The codebase that initiated the event.
 * - isFromUserAction: Optional.  True if the user took an action to generate
 *   the event.
 * - additionalParameters: Optional.  A JSON object to store generic data.
 *
 *  @typedef {{
 *    eventType: ?AnalyticsEventDef,
 *    eventOriginator: !EventOriginatorDef,
 *    isFromUserAction: ?boolean,
 *    additionalParameters: ?Object,
 * }}
 */
export let ClientEvent;

/* eslint-disable no-unused-vars */
/**
 * @interface
 */
export class ClientEventManagerApi {
  /**
   * Call this function to log an event. The registered listeners will be
   * invoked unless the event is filtered.
   * @param {!function(!ClientEvent, Object)} listener
   */
  registerEventListener(listener) {}

  /**
   * Register a filterer for events if you need to potentially prevent the
   * listeners from hearing about it.  A filterer should return
   * FilterResult.CANCEL_EVENT to prevent listeners from hearing about the
   * event.
   * @param {!function(!ClientEvent):FilterResult} filterer
   */
  registerEventFilterer(filterer) {}

  /**
   * Call this function to log an event.  It will immediately throw an error if
   * the event is invalid.  It will then asynchronously call the filterers and
   * stop the event if a filterer cancels it.  After that, it will call each
   * listener asynchronously.
   * @param {!ClientEvent} event
   * @param {Object} eventParams
   */
  logEvent(event, eventParams) {}
}
/* eslint-enable no-unused-vars */
