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
import * as EventManagerApi from '../api/swg-client-event-manager-api';

/**
 * Helper function to describe an issue with an event object
 * @param {!string} valueName
 * @param {?*} value
 * @returns {!string}
 */
function createEventErrorMessage(valueName, value) {
  return 'An SwgClientEvent has an invalid ' + valueName + '(' + value + ')';
}

/**
 * Throws an error if the event is invalid.
 * @param {!EventManagerApi.SwgClientEvent} event
 * @returns {!Promise}
 */
function validateEvent(event) {
  if (!event) {
    throw new Error('SwgClientEventManager cannot log a null event');
  }

  if (!isEnumValue(AnalyticsEvent, event.eventType)) {
    throw new Error(createEventErrorMessage('eventType', event.eventType));
  }
  if (!isEnumValue(EventOriginator, event.eventOriginator)) {
    throw new Error(createEventErrorMessage('eventOriginator',
        event.eventOriginator));
  }
  if (!event.additionalParameters) {
    event.additionalParameters = {};
  }
  if (!isObject(event.additionalParameters)) {
    throw new Error(createEventErrorMessage('additionalParameters',
        event.additionalParameters));
  }
  if (event.isFromUserAction !== null
      && event.isFromUserAction !== true
      && event.isFromUserAction !== false) {
    throw new Error(createEventErrorMessage('isFromUserAction',
        event.isFromUserAction));
  }
  return Promise.resolve();
}

/** @implements {EventManagerApi.SwgClientEventManagerApi} */
export class SwgClientEventManager {
  constructor() {
    /** @private {!Array<function(!EventManagerApi.SwgClientEvent)>} */
    this.listeners_ = [];

    /** @private {!Array<function(!EventManagerApi.SwgClientEvent):!EventManagerApi.FilterResult>} */
    this.filterers_ = [];
  }

  /**
   * Ensures the callback function is notified anytime one of the passed
   * events occurs unless a filterer returns false.
   * @param {!function(!EventManagerApi.SwgClientEvent)} callback
   * @overrides
   */
  registerEventListener(callback) {
    if (!isFunction(callback)) {
      throw new Error('Event manager listeners must be a function');
    }
    this.listeners_.push(callback);
  }

  /**
   * Register a filterer for events if you need to potentially cancel an event
   * before the listeners are called.  A filterer should return
   * FilterResult.STOP_EXECUTING to cancel an event.
   * @param {!function(!EventManagerApi.SwgClientEvent):!EventManagerApi.FilterResult} callback
   * @overrides
   */
  registerEventFilterer(callback) {
    if (!isFunction(callback)) {
      throw new Error('Event manager filterers must be a function');
    }
    this.filterers_.push(callback);
  }

  /**
   * Call this function to log an event.  The registered listeners will be
   * invoked unless the event is filtered.  Returns false if the event was
   * filtered and throws an error if the event is invalid.
   * @param {!EventManagerApi.SwgClientEvent} event
   * @returns {!Promise}
   * @overrides
   */
  logEvent(event) {
    return validateEvent(event).then(() => {
      let callbackNum;
      for (callbackNum = 0; callbackNum < this.filterers_.length; callbackNum++)
      {
        if (this.filterers_[callbackNum](event)
            === EventManagerApi.FilterResult.STOP_EXECUTING) {
          return;
        }
      }
      for (callbackNum = 0; callbackNum < this.listeners_.length; callbackNum++)
      {
        this.listeners_[callbackNum](event);
      }
    });
  }
}
