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

/**
 * The callback used to notify registered listeners about new client events.
 * @callback SwgEventManagerListener
 * @param {SwgClientEvent} event
 */
export let SwgEventManagerListener;

/**
 * Return false to cancel the event.  You can also modify the event object
 * which is passed by reference.
 * @callback SwgEventManagerFilterer
 * @param {SwgClientEvent} event
 * @return {ShouldFilter}
 */
export let SwgEventManagerFilterer;

/** An array of callback functions
 * @typedef {SwgEventManagerListener|SwgEventManagerFilterer} CallBack
 */
export let CallBack;

export const ShouldFilter = {
  CONTINUE_EXECUTING: 0,
  STOP_EXECUTING: 1,
};

export class SwgClientEvent {
  /**
   * Ensures the passed enum value is a member of the passed type or '*'.
   * Throws an error if it isn't.
   * @param {!Object} enumType
   * @param {*} enumValue
   * @private
   */
  static isValidEnumValue_(enumType, enumValue) {
    return Object.values(enumType).includes(enumValue);
  }

  /**Returns true if the passed value is a JSON object
   * @param {?Object} object
   * @private
   */
  static isValidObject_(object) {
    return object && object.constructor === {}.constructor;
  }

  /**Helper function for checking whether the passed value is an event type.
   * @param {*} value
   * @private
   */
  static isValidType_(value) {
    return SwgClientEvent.isValidEnumValue_(AnalyticsEvent, value);
  }

  /**Helper function for checking whether the passed value is a client type.
   * @param {*} value
   * @private
   */
  static isValidOriginator_(value) {
    return SwgClientEvent.isValidEnumValue_(EventOriginator, value);
  }

  /**Helper function for ensuring the additional parameters value is valid.
   * @param {Object|null} value
   * @private
   */
  static isValidAdditionalParameters_(value) {
    return SwgClientEvent.isValidObject_(value);
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
    this.isValid(true);
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
    assert(SwgClientEvent.isValidOriginator_(value),
        'Invalid orginator in SwgClientEvent (' + value + ')');

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
    assert(SwgClientEvent.isValidType_(value),
        'Invalid event type in SwgClientEvent (' + value + ')');
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
    assert(SwgClientEvent.isValidIsFromUserAction_(value),
        'Invalid isFromUserAction in SwgClientEvent (' + value + ')');
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
    assert(SwgClientEvent.isValidAdditionalParameters_(value),
        'Invalid additionalParameters in SwgClientEvent (' + value + ')');
    this.additionalParameters_ = value;
  }

  /**Returns true if the object is valid.  Otherwise it throws an error if you
   * pass true and returns false if you don't.
   * @param {boolean} createError
   */
  isValid(createError) {
    if (!SwgClientEvent.isValidType_(this.eventType_)) {
      if (!createError) {
        return false;
      }
      throw new Error('Invalid event type in SwgClientEvent (' +
          this.eventType_ + ')');
    }
    if (!SwgClientEvent.isValidOriginator_(this.eventOriginator_)) {
      if (!createError) {
        return false;
      }
      throw new Error('Invalid event originator in SwgClientEvent (' +
          this.eventOriginator_ + ')');
    }
    if (!SwgClientEvent.isValidIsFromUserAction_(this.isFromUserAction_)) {
      if (!createError) {
        return false;
      }
      throw new Error('Invalid isFromUserAction in SwgClientEvent (' +
          this.isFromUserAction_ + ')');
    }
    if (!SwgClientEvent.isValidAdditionalParameters_(
        this.additionalParameters_)) {
      if (!createError) {
        return false;
      }
      throw new Error('Invalid additional parameters in SwgClientEvent (' +
          this.additionalParameters_ + ')');
    }
    return true;
  }
}

/** @private {Array<CallBack>}} */
const listeners = [];

/** @private {Array<CallBack>}} */
const filterers = [];

export class SwgClientEventManager {

  /**True if the value is a function
   * @param {*} value
   * @private
   */
  static isFunction_(value) {
    return typeof value === 'function';
  }

  /**Remove all existing filterers and listeners
   */
  static clear() {
    listeners.length = 0;
    filterers.length = 0;
  }

  /**
   * Ensures the callback function is notified anytime one of the passed
   * events occurs unless a filterer returns false.
   * @param {!SwgEventManagerListener} callback
   * @public
   */
  static addListener(callback) {
    assert(SwgClientEventManager.isFunction_(callback),
        'Invalid callback in SwgClientEventManager.addListener');
    listeners.push(callback);
  }

  /**
   * Filterers are called before listeners, if it returns
   * ShouldFilter.STOP_EXECUTING then the event is canceled.
   * @param {!SwgEventManagerFilterer} callback
   * @public
   */
  static addFilterer(callback) {
    assert(SwgClientEventManager.isFunction_(callback),
        'Invalid callback in SwgClientEventManager.addFilterer');
    filterers.push(callback);
  }

  /**Call this function to inform all listeners that a client event has
   * occurred.
   * @param {!SwgClientEvent} event
   * @public
   */
  static logEvent(event) {
    event.isValid(true);
    for (let callbackNum = 0; callbackNum < filterers.length; callbackNum++) {
      if (filterers[callbackNum](event) === ShouldFilter.STOP_EXECUTING) {
        return false;
      }
    }
    for (let callbackNum = 0; callbackNum < listeners.length; callbackNum++) {
      listeners[callbackNum](event);
    }
    return true;
  }
}
