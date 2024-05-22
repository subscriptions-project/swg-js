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

export enum FilterResult {
  /** The event is allowed to proceed to the listeners. */
  PROCESS_EVENT = 0,
  /** The event is canceled and the listeners are not informed about it. */
  CANCEL_EVENT = 1,
}

/** Defines a client event in SwG. */
export interface ClientEvent {
  /** Required. The AnalyticsEvent type that occurred. */
  eventType: AnalyticsEventDef | null;
  /** Required. The codebase that initiated the event. */
  eventOriginator: EventOriginatorDef;
  /** Optional. True if the user took an action to generate the event. */
  isFromUserAction?: boolean | null;
  /** Optional. A JSON object to store generic data. */
  additionalParameters?: {} | null;
  /** Optional. When the event happened. */
  timestamp?: number;
  /** Optional. ID of the associated action configuration. */
  configurationId?: string | null;
}

export interface ClientEventManagerApi {
  /**
   * Call this function to log an event. The registered listeners will be
   * invoked unless the event is filtered.
   */
  registerEventListener(
    listener: (
      clientEvent: ClientEvent,
      clientEventParams?: ClientEventParams
    ) => void
  ): void;

  /**
   * Register a filterer for events if you need to potentially prevent the
   * listeners from hearing about it.  A filterer should return
   * FilterResult.CANCEL_EVENT to prevent listeners from hearing about the
   * event.
   */
  registerEventFilterer(
    filterer: (clientEvent: ClientEvent) => FilterResult
  ): void;

  /**
   * Call this function to log an event.  It will immediately throw an error if
   * the event is invalid.  It will then asynchronously call the filterers and
   * stop the event if a filterer cancels it.  After that, it will call each
   * listener asynchronously.
   */
  logEvent(event: ClientEvent, eventParams?: ClientEventParams): void;
}

/**
 * Event Properties to handle for a specific event. For example, GA Event
 * properties to skip SwG logging but still be handled via callback.
 */
export interface ClientEventParams {
  googleAnalyticsParameters?: GoogleAnalyticsParameters;
}

export interface GoogleAnalyticsParameters {
  /* eslint-disable google-camelcase/google-camelcase */
  event_category?: string;
  survey_question?: string;
  survey_answer_category?: string;
  event_label?: string;
  /* eslint-enable google-camelcase/google-camelcase */
}
