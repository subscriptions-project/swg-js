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
import * as API from '../api/client-event-manager-api';

/**
 * Helper function to describe an issue with an event object
 * @param {!string} valueName
 * @param {?*} value
 * @returns {!string}
 */
function createEventErrorMessage(valueName, value) {
  return 'Event has an invalid ' + valueName + '(' + value + ')';
}

/**
 * Throws an error if the event is invalid.
 * @param {!API.ClientEvent} event
 * @returns {!Promise}
 */
function validateEvent(event) {
  if (!isObject(event)) {
    throw new Error('Event must be a valid object');
  }

  if (!isEnumValue(AnalyticsEvent, event.eventType)) {
    throw new Error(createEventErrorMessage('eventType', event.eventType));
  }

  if (!isEnumValue(EventOriginator, event.eventOriginator)) {
    throw new Error(createEventErrorMessage('eventOriginator',
        event.eventOriginator));
  }

  if (!isObject(event.additionalParameters)
      && event.additionalParameters !== null) {
    if (event.additionalParameters !== undefined) {
      throw new Error(createEventErrorMessage('additionalParameters',
          event.additionalParameters));
    }
    event.additionalParameters = null;
  }

  /*
  if (event.isFromUserAction !== null && !isBoolean(event.isFromUserAction)) {
    throw new Error(createEventErrorMessage('isFromUserAction',
        event.isFromUserAction));
  }*/
  return Promise.resolve();
}

/** @implements {../api/client-event-manager-api.ClientEventManagerApi} */
export class ClientEventManager {
  constructor() {
    /** @private {!Array<function(!API.ClientEvent)>} */
    this.listeners_ = [];

    /** @private {!Array<function(!API.ClientEvent):!API.FilterResult>} */
    this.filterers_ = [];

    /** @private {?Promise} */
    this.lastAction_ = null;
  }

  /**
   * @overrides
   */
  registerEventListener(callback) {
    if (!isFunction(callback)) {
      throw new Error('Event manager listeners must be a function');
    }
    this.listeners_.push(callback);
  }

  /**
   * @overrides
   */
  registerEventFilterer(callback) {
    if (!isFunction(callback)) {
      throw new Error('Event manager filterers must be a function');
    }
    this.filterers_.push(callback);
  }

  /**
   * @overrides
   */
  logEvent(event) {
    this.lastAction_ = validateEvent(event).then(() => {
      let callbackNum;
      for (callbackNum = 0; callbackNum < this.filterers_.length; callbackNum++)
      {
        if (this.filterers_[callbackNum](event)
            === API.FilterResult.CANCEL_EVENT) {
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
