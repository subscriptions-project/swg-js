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
import {LoggerApi} from './logger-api';

export enum PropensityType {
  /** Propensity score for a user to subscribe to a publication. */
  GENERAL = 'general',

  /** Propensity score when blocked access to content by paywall. */
  PAYWALL = 'paywall',
}

/**
 * The Propensity Score
 * - value: Required. A number that indicates the propensity to subscribe.
 * - bucketed: Required. Indicates if the score is a raw score [1-100] or bucketed[1-20].
 */
export interface Score {
  value: number;
  bucketed: boolean;
}

/**
 * Propensity Score Detail
 * Properties:
 * - product: Required. Indicates the publication_id:product_id for which the score is provided.
 * - score: Optional. When score is available, this field contains the propensity score for this product.
 * - error: Optional. When no score is avaialble, a string provides the error message.
 */
export interface ScoreDetail {
  product: string;
  score?: Score;
  error?: string;
}

/**
 * The Body field of the Propensity Score.
 * Properties:
 * - scores: Optional, an array of scores. When header indicates so, atleast one score is available.
 * - error: Optional, string describing why, if no scores were provided by the server.
 */
export interface Body {
  scores?: ScoreDetail[];
  error?: string;
}

/**
 * The Header of the Propensity Score.
 * Properties:
 * - ok: Required. true, if propensity score is available, false otherwise.
 */
export interface Header {
  ok: boolean;
}

/**
 * The Propensity Score.
 * Properties:
 * - header: Required. Provides the header of the Score response.
 * - body: Required. Provides the body of the Score response.
 */
export interface PropensityScore {
  header: Header;
  body: Body;
}

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
 */
export interface PropensityEvent {
  name: string;
  active: boolean;
  data?: unknown;
}

/*
 * Note: Propensity extends LoggerApi, and will continue functioning
 * as an event logger until we are certain no publishers actively
 * log events with it.
 */
export interface PropensityApi extends LoggerApi {
  /**
   * Get the propensity of a user to subscribe based on the type.
   * The argument should be a valid string from PropensityType.
   * If no type is provided, GENERAL score is returned.
   */
  getPropensity(type?: PropensityType): Promise<PropensityScore> | null;
}
