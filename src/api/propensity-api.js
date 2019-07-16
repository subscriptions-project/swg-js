/* eslint-disable no-unused-vars */

/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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
import * as LoggerApi from './logger-api';

/**
 * @enum {string}
 */
export const PropensityType = {
  // Propensity score for a user to subscribe to a publication.
  GENERAL: 'general',
  // Propensity score when blocked access to content by paywall.
  PAYWALL: 'paywall',
};

/**
 * The Body field of the Propensity Score.
 * Properties:
 * - result: Required. When available, provides the propensity score of the
 *       requested type with a number in the range [0-100], indicating the
 *       likelihood of a user to subscribe.
 *       If there are any errors which prevented the server from
 *       generating and providing a valid score, this field will have a
 *       string describing why score was not available.
 *
 *  @typedef {{
 *    result: (number|string)
 * }}
 */
export let Body;

/**
 * The Header of the Propensity Score.
 * Properties:
 * - ok: Required. true, if propensity score is available, false otherwise.
 *
 *  @typedef {{
 *    ok: boolean,
 * }}
 */
export let Header;

/**
 * The Propensity Score.
 * Properties:
 * - header: Required. Provides the header of the Score response.
 * - body: Required. Provides the body of the Score response.
 *
 *  @typedef {{
 *    header: Header,
 *    body: Body,
 * }}
 */
export let PropensityScore;

/**
 * Propensity Event
 * Properties:
 * - name: Required. Name should be valid string in Event.
 * - active: Required. A boolean that indicates whether the
 *         user took some action to participate in the flow
 *         that generated this event. For impression event,
 *         this is set to true if is_active field would be
 *         set to true, as described in documentation for
 *         enum Event. Otherwise, set this field to false.
 *         For action events, this field must always be set
 *         to true. The caller must always set this field.
 * - data: Optional. JSON block of depth '1' provides event
 *         parameters. The guideline to create this JSON block
 *         that describes the event is provided against each
 *         enum listed in the Event enum above.
 *
 *  @typedef {{
  *    name: !LoggerApi.Event,
  *    active: boolean,
  *    data: ?JsonObject,
  * }}
  */
export let PropensityEvent;

export const Event = LoggerApi.Event;
export const SubscriptionState = LoggerApi.SubscriptionState;

/**
 * @extends {LoggerApi.LoggerApi}
 * @interface
 */
export class PropensityApi {
  /**
   * Get the propensity of a user to subscribe based on the type.
   * The argument should be a valid string from PropensityType.
   * If no type is provided, GENERAL score is returned.
   * @param {PropensityType=} type
   * @return {?Promise<!PropensityScore>}
   */
  getPropensity(type) {}
}
