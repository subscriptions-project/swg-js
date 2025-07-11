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
  AnalyticsEvent,
  EventOriginator,
  EventParams,
} from '../proto/api_messages';
import {
  ClientEvent,
  ClientEventManagerApi,
  ClientEventParams,
  FilterResult,
} from '../api/client-event-manager-api';
import {isBoolean, isEnumValue, isFunction, isObject} from '../utils/types';
import {log} from '../utils/log';

/**
 * Helper function to describe an issue with an event object
 * @param {!string} valueName
 * @param {unknown} value
 * @returns {!string}
 */
function createEventErrorMessage(valueName: string, value: unknown): string {
  return 'Event has an invalid ' + valueName + '(' + value + ')';
}

/**
 * Throws an error if the event is invalid.
 */
function validateEvent(event: ClientEvent) {
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

export class ClientEventManager implements ClientEventManagerApi {
  static isPublisherEvent(event: ClientEvent): boolean {
    return (
      event.eventOriginator === EventOriginator.PROPENSITY_CLIENT ||
      event.eventOriginator === EventOriginator.PUBLISHER_CLIENT
    );
  }

  private listeners_: ((
    clientEvent: ClientEvent,
    params?: ClientEventParams
  ) => void)[] = [];
  private filterers_: ((clientEvent: ClientEvent) => FilterResult)[] = [];

  /** Visible for testing. */
  lastAction: Promise<void> | null = null;

  constructor(private readonly isReadyPromise_: Promise<void>) {}

  registerEventListener(
    listener: (
      clientEvent: ClientEvent,
      clientEventParams?: ClientEventParams
    ) => void
  ) {
    if (!isFunction(listener)) {
      throw new Error('Event manager listeners must be a function');
    }
    this.listeners_.push(listener);
  }

  registerEventFilterer(filterer: (clientEvent: ClientEvent) => FilterResult) {
    if (!isFunction(filterer)) {
      throw new Error('Event manager filterers must be a function');
    }
    this.filterers_.push(filterer);
  }

  logEvent(
    event: ClientEvent,
    eventParams?: ClientEventParams,
    eventTime?: number
  ) {
    validateEvent(event);

    // Use provided timestamp or current if not provided.
    event.timestamp = eventTime ?? Date.now();

    this.lastAction = this.handleEvent_(event, eventParams);
  }

  /**
   * Triggers event listeners, unless filterers cancel the event.
   */
  private async handleEvent_(
    event: ClientEvent,
    eventParams?: ClientEventParams
  ) {
    await this.isReadyPromise_;

    // Bail if a filterer cancels the event.
    for (const filterer of this.filterers_) {
      try {
        if (filterer(event) === FilterResult.CANCEL_EVENT) {
          return;
        }
      } catch (e) {
        log(e);
      }
    }

    // Trigger listeners.
    for (const listener of this.listeners_) {
      try {
        listener(event, eventParams);
      } catch (e) {
        log(e);
      }
    }
  }

  /**
   * Creates an event with the arguments provided and calls logEvent.
   */
  logSwgEvent(
    eventType: AnalyticsEvent,
    isFromUserAction: boolean | null = false,
    eventParams: EventParams | null = null,
    eventTime?: number,
    configurationId: string | null = null
  ) {
    this.logEvent(
      {
        eventType,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction,
        additionalParameters: eventParams,
        configurationId,
      },
      undefined,
      eventTime
    );
  }

  getReadyPromise(): Promise<void> {
    return this.isReadyPromise_;
  }
}
