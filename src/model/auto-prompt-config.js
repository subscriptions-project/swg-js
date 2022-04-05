/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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

/**
 * @typedef {{
 *   displayDelaySeconds: (number|undefined),
 *   dismissalBackoffSeconds: (number|undefined),
 *   maxDismissalsPerWeek: (number|undefined),
 *   maxDismissalsResultingHideSeconds: (number|undefined),
 *   impressionBackoffSeconds: (number|undefined),
 *   maxImpressions: (number|undefined),
 *   maxImpressionsResultingHideSeconds: (number|undefined),
 * }}
 */
export let AutoPromptConfigparams;

/**
 * Container for the auto prompt configuation details.
 */
export class AutoPromptConfig {
  /**
   * @param {!AutoPromptConfigparams=} params
   */
  constructor({
    displayDelaySeconds,
    dismissalBackoffSeconds,
    maxDismissalsPerWeek,
    maxDismissalsResultingHideSeconds,
    impressionBackoffSeconds,
    maxImpressions,
    maxImpressionsResultingHideSeconds,
  } = {}) {
    /** @const {!ClientDisplayTrigger} */
    this.clientDisplayTrigger = new ClientDisplayTrigger(displayDelaySeconds);

    /** @const {!ExplicitDismissalConfig} */
    this.explicitDismissalConfig = new ExplicitDismissalConfig(
      dismissalBackoffSeconds,
      maxDismissalsPerWeek,
      maxDismissalsResultingHideSeconds
    );

    /** @const {!ImpressionConfig} */
    this.impressionConfig = new ImpressionConfig(
      impressionBackoffSeconds,
      maxImpressions,
      maxImpressionsResultingHideSeconds
    );
  }
}

/**
 * Client side conditions to trigger the display of the auto prompt.
 */
export class ClientDisplayTrigger {
  /**
   * @param {number|undefined} displayDelaySeconds
   */
  constructor(displayDelaySeconds) {
    /** @const {number|undefined} */
    this.displayDelaySeconds = displayDelaySeconds;
  }
}

/**
 * Configuration of explicit dismissal behavior and its effects.
 */
export class ExplicitDismissalConfig {
  /**
   * @param {number|undefined} backoffSeconds
   * @param {number|undefined} maxDismissalsPerWeek
   * @param {number|undefined} maxDismissalsResultingHideSeconds
   */
  constructor(
    backoffSeconds,
    maxDismissalsPerWeek,
    maxDismissalsResultingHideSeconds
  ) {
    /** @const {number|undefined} */
    this.backoffSeconds = backoffSeconds;

    /** @const {number|undefined} */
    this.maxDismissalsPerWeek = maxDismissalsPerWeek;

    /** @const {number|undefined} */
    this.maxDismissalsResultingHideSeconds = maxDismissalsResultingHideSeconds;
  }
}

/**
 * Configuration of impression behavior and its effects.
 */
export class ImpressionConfig {
  /**
   * @param {number|undefined} backoffSeconds
   * @param {number|undefined} maxImpressions
   * @param {number|undefined} maxImpressionsResultingHideSeconds
   */
  constructor(
    backoffSeconds,
    maxImpressions,
    maxImpressionsResultingHideSeconds
  ) {
    /** @const {number|undefined} */
    this.backoffSeconds = backoffSeconds;

    /** @const {number|undefined} */
    this.maxImpressions = maxImpressions;

    /** @const {number|undefined} */
    this.maxImpressionsResultingHideSeconds =
      maxImpressionsResultingHideSeconds;
  }
}

/**
 * Predicates of whether or not to show button and prompt.
 */
export class UiPredicates {
  /**
   * @param {boolean|undefined} canDisplayAutoPrompt
   * @param {boolean|undefined} canDisplayButton
   */
  constructor(canDisplayAutoPrompt, canDisplayButton) {
    /** @const {boolean|undefined} */
    this.canDisplayAutoPrompt = canDisplayAutoPrompt;

    /** @const {boolean|undefined} */
    this.canDisplayButton = canDisplayButton;
  }
}
