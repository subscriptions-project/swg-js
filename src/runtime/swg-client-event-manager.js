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

/** @enum {number}  */
export const FilterResult = {
  CONTINUE_EXECUTING: 0,
  STOP_EXECUTING: 1,
};

export class SwgClientEvent {

  /**Helper function for checking whether the passed value is an event type.
   * @param {*} value
   * @private
   */
  static isValidType_(value) {
    return isEnumValue(AnalyticsEvent, value);
  }

  /**Helper function for checking whether the passed value is a client type.
   * @param {*} value
   * @private
   */
  static isValidOriginator_(value) {
    return isEnumValue(EventOriginator, value);
  }

  /**Helper function for ensuring the additional parameters value is valid.
   * @param {Object|null} value
   * @private
   */
  static isValidAdditionalParameters_(value) {
    return isObject(value);
  }

  /**Helper function for ensuring the isFromUserAction field is valid.
   * @param {*} value
   * @private
   */
  static isValidIsFromUserAction_(value) {
    return value === null || value === true || value === false;
  }

  /**
   * @returns {!SwgClientEvent}
   */
  copy() {
    const event = new SwgClientEvent(this.eventType_, this.eventOriginator_,
        this.getAdditionalParameters());
    event.setIsFromUserAction(this.getIsFromUserAction());
    return event;
  }

  /**
   * @param {!AnalyticsEvent} eventType
   * @param {!EventOriginator} eventOriginator
   * @param {?Object} additionalParameters
   */
  constructor(eventType, eventOriginator, additionalParameters) {
    /**@private {AnalyticsEvent} */
    this.eventType_ = eventType;

    /** @private {EventOriginator} */
    this.eventOriginator_ = eventOriginator;

    /** @private {?boolean} */
    this.isFromUserAction_ = null;

    if (!SwgClientEvent.isValidAdditionalParameters_(additionalParameters)) {
      additionalParameters = {};
    }
    /** @private {?Object} */
    this.additionalParameters_ = additionalParameters;
    if (!this.isEventValid()) {
      throw new Error('An invalid parameter was passed to SwgClientEvent');
    }
  }

  /**
   * @returns {!EventOriginator}
   */
  getEventOriginator() {
    return this.eventOriginator_;
  }

  /**
   * @param {!EventOriginator} value
   */
  setEventOriginator(value) {
    if (!SwgClientEvent.isValidOriginator_(value)) {
      throw new Error('Invalid orginator in SwgClientEvent (' + value + ')');
    }
    this.eventOriginator_ = value;
  }

  /**
   * @returns {?AnalyticsEvent}
   */
  getEventType() {
    return this.eventType_;
  }

  /**
   * @param {AnalyticsEvent} value
   */
  setEventType(value) {
    if (!SwgClientEvent.isValidType_(value)) {
      throw new Error('Invalid event type in SwgClientEvent (' + value + ')');
    }
    this.eventType_ = value;
  }

  /** True if the user took direct action to initiate this event.  False if the
   *  event was generated passively in the background.
   * @return {boolean|null}
   */
  getIsFromUserAction() {
    return this.isFromUserAction_;
  }

  /**True if the user took direct action to initiate this event.  False if the
   * event was generated passively in the background.  Leave this value null
   * if you don't know the correct answer.
   * @param {boolean|null} value
   */
  setIsFromUserAction(value) {
    if (!SwgClientEvent.isValidIsFromUserAction_(value)) {
      throw new Error('Invalid isFromUserAction in SwgClientEvent (' + value
          + ')');
    }
    this.isFromUserAction_ = value;
  }

  /**An optional parameter bag that can be included to provide additional
   * details about some events.
   * @return {Object}
   */
  getAdditionalParameters() {
    return this.additionalParameters_;
  }

  /**An optional parameter bag that can be included to provide additional
   * details about some events.  If you want to add or override a property,
   * use the get method to get a reference to the existing object.
   * @param {Object} value
   */
  setAdditionalParameters(value) {
    if (!SwgClientEvent.isValidAdditionalParameters_(value)) {
      throw new Error('Invalid additionalParameters in SwgClientEvent (' +
          value + ')');
    }
    this.additionalParameters_ = value;
  }

  /**Returns true if the object is valid.
   */
  isEventValid() {
    return SwgClientEvent.isValidType_(this.eventType_)
        && SwgClientEvent.isValidOriginator_(this.eventOriginator_)
        && SwgClientEvent.isValidIsFromUserAction_(this.isFromUserAction_)
        && SwgClientEvent.isValidAdditionalParameters_(
            this.additionalParameters_);
  }
}

/** @private {Array<function(!SwgClientEvent)>}} */
const listeners = [];

/** @private {Array<function(!SwgClientEvent):FilterResult>}} */
const filterers = [];

export class SwgClientEventManager {

  /**Remove all existing filterers and listeners
   */
  static clear() {
    listeners.length = 0;
    filterers.length = 0;
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
    event.isEventValid(true);
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
