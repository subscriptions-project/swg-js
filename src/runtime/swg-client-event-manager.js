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

import {AnalyticsEvent,EventOriginator} from '../proto/api_messages';
import {isObject, isFunction, isEnumValue} from '../utils/types';

const EVENT_ERROR = 'An SwgClientEvent has an invalid ';

/** @enum {number}  */
export const FilterResult = {
  CONTINUE_EXECUTING: 0,
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
 *    additionalParameters: (?Object),
 *    isFromUserAction: (?boolean),
 * }}
 */
export let SwgClientEvent;

/** @private {Array<function(!SwgClientEvent)>}} */
const listeners = [];

/** @private {Array<function(!SwgClientEvent):FilterResult>}} */
const filterers = [];

export class SwgClientEventManager {

  /**Remove all existing filterers and listeners
   * @package Used by testing code only
   */
  static clear() {
    listeners.length = 0;
    filterers.length = 0;
  }

  /**Throws an error if the event is invalid.
   * @param {SwgClientEvent} event
   */
  static validateEvent(event) {
    if (!isEnumValue(AnalyticsEvent, event.eventType)) {
      throw new Error(EVENT_ERROR + 'eventType');
    }
    if (!isEnumValue(EventOriginator, event.eventOriginator)) {
      throw new Error(EVENT_ERROR + 'eventOrginator');
    }
    if (!event.additionalParameters) {
      event.additionalParameters = {};
    }
    if (!isObject(event.additionalParameters)) {
      throw new Error(EVENT_ERROR + 'additionalParameters');
    }
    if (event.isFromUserAction !== null
        && event.isFromUserAction !== true
        && event.isFromUserAction !== false) {
      throw new Error(EVENT_ERROR + 'isFromUserAction');
    }
  }

  /**
   * Ensures the callback function is notified anytime one of the passed
   * events occurs unless a filterer returns false.
   * @param {!function(!SwgClientEvent)} callback
   */
  static addListener(callback) {
    if (!isFunction(callback)) {
      throw new Error('Event manager listeners must be a function');
    }
    listeners.push(callback);
  }

  /**
   * Register a filterer for events if you need to potentially cancel an event
   * before the listeners are called.  A filterer should return
   * FilterResult.STOP_EXECUTING to cancel an event.
   * @param {!function(!SwgClientEvent):FilterResult} callback
   */
  static addFilterer(callback) {
    if (!isFunction(callback)) {
      throw new Error('Event manager filterers must be a function');
    }
    filterers.push(callback);
  }

  /**Call this function to log an event.  The registered listeners will be
   * invoked unless the event is filtered.  Returns false if the event was
   * filtered.
   * @param {!SwgClientEvent} event
   * @return {boolean}
   */
  static logEvent(event) {
    SwgClientEventManager.validateEvent(event);
    for (let callbackNum = 0; callbackNum < filterers.length; callbackNum++) {
      if (filterers[callbackNum](event) === FilterResult.STOP_EXECUTING) {
        return false;
      }
    }
    for (let callbackNum = 0; callbackNum < listeners.length; callbackNum++) {
      listeners[callbackNum](event);
    }
    return true;
  }
}
