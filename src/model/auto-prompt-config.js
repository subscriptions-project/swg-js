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
 * Container for the auto prompt configuation details.
 */
export class AutoPromptConfig {
  /**
   * @param {number|undefined} maxImpressionsPerWeek
   */
  constructor(
    maxImpressionsPerWeek,
    displayDelaySeconds,
    backoffSeconds,
    maxDismissalsPerWeek,
    maxDismissalsResultingHideSeconds
  ) {
    /** @const {number|undefined} */
    this.maxImpressionsPerWeek = maxImpressionsPerWeek;

    /** @const {!ClientDisplayTrigger} */
    this.clientDisplayTrigger = new ClientDisplayTrigger(displayDelaySeconds);

    /** @const {!ExplicitDismissalConfig} */
    this.explicitDismissalConfig = new ExplicitDismissalConfig(
      backoffSeconds,
      maxDismissalsPerWeek,
      maxDismissalsResultingHideSeconds
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
 * Preicates of whether or not to show button and prompt.
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
