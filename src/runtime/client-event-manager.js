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

import {FilterResult} from '../api/client-event-manager-api';
import {AnalyticsEvent,EventOriginator} from '../proto/api_messages';
import {isObject, isFunction, isEnumValue, isBoolean} from '../utils/types';

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
 * @param {!../api/client-event-manager-api.ClientEvent} event
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


  if (event.isFromUserAction !== null && !isBoolean(event.isFromUserAction)) {
    throw new Error(createEventErrorMessage('isFromUserAction',
        event.isFromUserAction));
  }
}

/** @implements {../api/client-event-manager-api.ClientEventManagerApi} */
export class ClientEventManager {
  constructor() {
    /** @private {!Array<function(!../api/client-event-manager-api.ClientEvent)>} */
    this.listeners_ = [];

    /** @private {!Array<function(!../api/client-event-manager-api.ClientEvent):!FilterResult>} */
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
    validateEvent(event);
    //this will either resolve once the event is filtered out or once every
    //listener is called.  This only guarantees the listener returned, it
    //does not guarantee the listener finished anything it might have done
    //asynchronously.
    this.lastAction_ = new Promise(resolve => {
      for (let filterer = 0; filterer < this.filterers_.length; filterer++) {
        if (this.filterers_[filterer](event) === FilterResult.CANCEL_EVENT) {
          resolve();
          return;
        }
      }

      const promises = [];
      let listenerNum = 0;
      //builds an array of 1 promise per listener
      //each promise calls the next listener, increments the shared counter
      //and then resolves
      for (let builder = 0; builder < this.listeners_.length; builder++) {
        promises.push(new Promise(resolve => {
          try {
            this.listeners_[listenerNum++](event);
          } catch (e) { }
          resolve();
        }));
      }

      //the first promise is resolve once every listener is called
      Promise.all(promises).then(() => resolve());
    });
  }

  /**
   * This function exists for the sole purpose of allowing the code to be
   * presubmitted.  It can be removed once there is code generating a real
   * event object somewhere.
   */
  useValidateEventForCompilationPurposes() {
    validateEvent({
      eventType: AnalyticsEvent.UNKNOWN,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: {},
    });
  }
}
