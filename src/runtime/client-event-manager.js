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

import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {FilterResult} from '../api/client-event-manager-api';
import {isBoolean, isEnumValue, isFunction, isObject} from '../utils/types';
import {log} from '../utils/log';

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
    throw new Error(
      createEventErrorMessage('eventOriginator', event.eventOriginator)
    );
  }

  if (
    !isObject(event.additionalParameters) &&
    event.additionalParameters != null
  ) {
    throw new Error(
      createEventErrorMessage(
        'additionalParameters',
        event.additionalParameters
      )
    );
  }

  if (event.isFromUserAction != null && !isBoolean(event.isFromUserAction)) {
    throw new Error(
      createEventErrorMessage('isFromUserAction', event.isFromUserAction)
    );
  }
}

/** @implements {../api/client-event-manager-api.ClientEventManagerApi} */
export class ClientEventManager {
  /**
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @return {boolean}
   */
  static isPublisherEvent(event) {
    return (
      event.eventOriginator === EventOriginator.PROPENSITY_CLIENT ||
      event.eventOriginator === EventOriginator.PUBLISHER_CLIENT ||
      event.eventOriginator === EventOriginator.AMP_CLIENT
    );
  }

  /**
   *
   * @param {!Promise} configuredPromise
   */
  constructor(configuredPromise) {
    /** @private {!Array<function(!../api/client-event-manager-api.ClientEvent, Object)>} */
    this.listeners_ = [];

    /** @private {!Array<function(!../api/client-event-manager-api.ClientEvent):!FilterResult>} */
    this.filterers_ = [];

    /** @private {?Promise} */
    this.lastAction_ = null;

    /** @private @const {!Promise} */
    this.isReadyPromise_ = configuredPromise;
  }

  /**
   * @overrides
   */
  registerEventListener(listener) {
    if (!isFunction(listener)) {
      throw new Error('Event manager listeners must be a function');
    }
    this.listeners_.push(listener);
  }

  /**
   * @overrides
   */
  registerEventFilterer(filterer) {
    if (!isFunction(filterer)) {
      throw new Error('Event manager filterers must be a function');
    }
    this.filterers_.push(filterer);
  }

  /**
   * @overrides
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @param {Object} eventParams
   */
  logEvent(event, eventParams) {
    eventParams = eventParams || {};
    validateEvent(event);
    this.lastAction_ = this.isReadyPromise_.then(() => {
      for (let filterer = 0; filterer < this.filterers_.length; filterer++) {
        try {
          if (this.filterers_[filterer](event) === FilterResult.CANCEL_EVENT) {
            return Promise.resolve();
          }
        } catch (e) {
          log(e);
        }
      }
      for (let listener = 0; listener < this.listeners_.length; listener++) {
        try {
          this.listeners_[listener](event, eventParams);
        } catch (e) {
          log(e);
        }
      }
      return Promise.resolve();
    });
  }

  /**
   * Creates an event with the arguments provided and calls logEvent.
   * @param {!AnalyticsEvent} eventType
   * @param {?boolean=} isFromUserAction
   * @param {../proto/api_messages.EventParams=} eventParams
   */
  logSwgEvent(eventType, isFromUserAction = false, eventParams = null) {
    this.logEvent(
      {
        eventType,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction,
        additionalParameters: eventParams,
      },
      /* eventParams */ {}
    );
  }

  /** @return {!Promise<null>} */
  getReadyPromise() {
    return this.isReadyPromise_;
  }
}
