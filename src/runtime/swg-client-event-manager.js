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

import {AnalyticsEvent,Client} from '../proto/api_messages';

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

/** An array of callback functions
 * @typedef {Array<CallBack>} CallBackArray
 */
export let CallBackArray;

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
   * @param {Object|null} object
   * @private
   */
  static isValidObject_(object) {
    return object && object.constructor === {}.constructor;
  }

  /**A helper function for handling invalid argument errors.  If isValid is
   * true, this function will return true.  Otherwise an error will be
   * generated if throwError is true.  Name and value are used to describe the
   * cause of the error.
   * @param {boolean} isValid
   * @param {boolean} throwError
   * @param {string} name
   * @param {*} value
   * @private
   */
  static maybeAssert_(isValid, throwError, name, value) {
    if (isValid) {
      return true;
    }
    if (!throwError) {
      return false;
    }
    throw new Error('Invalid argument provided to SwgClientEventManager: ' +
        name + '=' + value);
  }

  /**Helper function for checking whether the passed value is an event type.
   * @param {*} value
   * @param {boolean} throwError
   * @private
   */
  static isValidType_(value, throwError) {
    return SwgClientEvent.maybeAssert_(
        SwgClientEvent.isValidEnumValue_(AnalyticsEvent, value), throwError,
        'eventType', value);
  }

  /**Helper function for checking whether the passed value is a client type.
   * @param {*} value
   * @param {boolean} throwError
   * @private
   */
  static isValidClient_(value, throwError) {
    return SwgClientEvent.maybeAssert_(
        SwgClientEvent.isValidEnumValue_(Client, value), throwError,
        'eventOrigin', value);
  }

  /**Helper function for ensuring the additional parameters value is valid.
   * @param {Object|null} value
   * @param {boolean} throwError
   * @private
   */
  static isValidAdditionalParameters_(value, throwError) {
    return SwgClientEvent.maybeAssert_(SwgClientEvent.isValidObject_(value),
        throwError, 'additionalParameters', value);
  }

  /**Helper function for ensuring the isFromUserAction field is valid.
   * @param {*} value
   * @param {boolean} throwError
   * @private
   */
  static isValidIsFromUserAction_(value, throwError) {
    return SwgClientEvent.maybeAssert_(
        value === null || value === true || value === false, throwError,
        'isFromUserAction', value);
  }

  /**
   * @returns {!SwgClientEvent}
   */
  copy() {
    const event = new SwgClientEvent(this.eventType_, this.eventOrigin_,
        this.getAdditionalParameters());
    event.setIsFromUserAction(this.getIsFromUserAction());
    return event;
  }

  /**
   * @param {!AnalyticsEvent} eventType
   * @param {!Client} eventOrigin
   * @param {?Object} additionalParameters
   */
  constructor(eventType, eventOrigin, additionalParameters) {
    /**@private {AnalyticsEvent} */
    this.eventType_ = eventType;

    /** @private {Client} */
    this.eventOrigin_ = eventOrigin;

    /** @private {?boolean} */
    this.isFromUserAction_ = null;

    /** @private {?Object} */
    this.additionalParameters_ = additionalParameters;
    this.setEventType(eventType);
    this.setEventOrigin(eventOrigin);
    this.setIsFromUserAction(null);
    if (!SwgClientEvent.isValidAdditionalParameters_(
        additionalParameters, false)) {
      additionalParameters = {};
    }
    this.setAdditionalParameters(additionalParameters);
  }

  /**
   * @returns {?Client}
   */
  getEventOrigin() {
    return this.eventOrigin_;
  }

  /**
   * @param {Client} value
   */
  setEventOrigin(value) {
    SwgClientEvent.isValidClient_(value, true);
    /** @private */
    this.eventOrigin_ = value;
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
    SwgClientEvent.isValidType_(value, true);
    /** @private */
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
    SwgClientEvent.isValidIsFromUserAction_(value, true);
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
    SwgClientEvent.isValidAdditionalParameters_(value, true);
    this.additionalParameters_ = value;
  }

  isValid(createError) {
    if (!SwgClientEvent.isValidType_(this.eventType_, createError)
        || !SwgClientEvent.isValidClient_(this.eventOrigin_, createError)
        || !SwgClientEvent.isValidIsFromUserAction_(
            this.isFromUserAction_, createError)
        || !SwgClientEvent.isValidAdditionalParameters_(
            this.additionalParameters_, createError)) {
      return false;
    }
    return true;
  }
}

export class SwgClientEventManager {

  constructor() {
    /** @type {!CallBackArray} @private */
    this.listeners_ = [];

    /** @type {!CallBackArray} @private */
    this.filterers_ = [];
  }

  /**Remove all existing filterers and listeners
   */
  clear() {
    this.listeners_ = [];
    this.filterers_ = [];
  }

  /**
   * Ensures the callback function is notified anytime one of the passed
   * events occurs unless a filterer returns false.
   * @param {!SwgEventManagerListener} callback
   * @public
   */
  addListener(callback) {
    this.listeners_.push(callback);
  }

  /**
   * Filterers are called before listeners, if it returns
   * ShouldFilter.STOP_EXECUTING then the event is canceled.
   * @param {!SwgEventManagerFilterer} callback
   * @public
   */
  addFilterer(callback) {
    this.filterers_.push(callback);
  }

  /**Call this function to inform all listeners that a client event has
   * occurred.
   * @param {!SwgClientEvent} event
   * @public
   */
  logEvent(event) {
    event.isValid(true);
    let callbacks = this.filterers_;
    for (let callbackNum = 0; callbackNum < callbacks.length; callbackNum++) {
      if (callbacks[callbackNum](event) === ShouldFilter.STOP_EXECUTING) {
        return false;
      }
    }
    callbacks = this.listeners_;
    for (let callbackNum = 0; callbackNum < callbacks.length; callbackNum++) {
      callbacks[callbackNum](event);
    }
    return true;
  }
}
