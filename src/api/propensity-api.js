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
 * The Propensity Score
 * - value: Required. A number that indicates the propensity to subscribe.
 * - bucketed: Required. Indicates if the score is a raw score [1-100] or bucketed[1-20].
 *
 * @typedef {{
 *   value: number,
 *   bucketed: boolean,
 * }}
 */
export let Score;

/**
 * Propensity Score Detail
 * Properties:
 * - product: Required. Indicates the publication_id:product_id for which the score is provided.
 * - score: Optional. When score is available, this field contains the propensity score for this product.
 * - error: Optional. When no score is avaialble, a string provides the error message.
 *
 * @typedef {{
 *   product: string,
 *   score: ?Score,
 *   error: ?string,
 * }}
 */
export let ScoreDetail;

/**
 * The Body field of the Propensity Score.
 * Properties:
 * - scores: Optional, an array of scores. When header indicates so, atleast one score is available.
 * - error: Optional, string describing why, if no scores were provided by the server.
 *
 *  @typedef {{
 *    scores: ?Array<ScoreDetail>,
 *    error: ?string,
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
 *   Please note that the primary defition of this object has changed to
 *   PublisherEvent and is defined in logger-api.js.  These two object
 *   definitions are identical.
 * Properties:
 * - name: Required. Name should be valid string in the Event
 *         enum within src/api/logger-api.js.
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
 *    name: string,
 *    active: boolean,
 *    data: ?JsonObject,
 * }}
 */
export let PropensityEvent;

/*
 * Please note that the definitions of Event and SubscriptionState have moved
 * to logger-api.js.  This is now the preferred interface to use for logging
 * publisher events and setting the user's current subscription state.
 * Propensity will continue to function as an event logger until we are certain
 * no publishers are actively using it to log events.
 */
export const Event = LoggerApi.Event;
export const SubscriptionState = LoggerApi.SubscriptionState;

/* eslint-disable no-unused-vars */
/**
 * @extends {LoggerApi.LoggerApi}
 * @interface
 */
export class PropensityApi extends LoggerApi.LoggerApi {
  /**
   * Get the propensity of a user to subscribe based on the type.
   * The argument should be a valid string from PropensityType.
   * If no type is provided, GENERAL score is returned.
   * @param {PropensityType=} type
   * @return {?Promise<!PropensityScore>}
   */
  getPropensity(type) {}
}
/* eslint-enable no-unused-vars */
