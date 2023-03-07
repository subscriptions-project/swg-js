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

interface AutoPromptConfigParams {
  displayDelaySeconds?: number;
  numImpressionsBetweenPrompts?: number;
  dismissalBackOffSeconds?: number;
  maxDismissalsPerWeek?: number;
  maxDismissalsResultingHideSeconds?: number;
  impressionBackOffSeconds?: number;
  maxImpressions?: number;
  maxImpressionsResultingHideSeconds?: number;
}

/**
 * Container for the auto prompt configuation details.
 */
export class AutoPromptConfig {
  clientDisplayTrigger: ClientDisplayTrigger;
  explicitDismissalConfig: ExplicitDismissalConfig;
  impressionConfig: ImpressionConfig;

  /**
   * @param {!AutoPromptConfigParams=} params
   */
  constructor({
    displayDelaySeconds,
    numImpressionsBetweenPrompts,
    dismissalBackOffSeconds,
    maxDismissalsPerWeek,
    maxDismissalsResultingHideSeconds,
    impressionBackOffSeconds,
    maxImpressions,
    maxImpressionsResultingHideSeconds,
  }: AutoPromptConfigParams) {
    this.clientDisplayTrigger = new ClientDisplayTrigger(
      displayDelaySeconds,
      numImpressionsBetweenPrompts
    );
    this.explicitDismissalConfig = new ExplicitDismissalConfig(
      dismissalBackOffSeconds,
      maxDismissalsPerWeek,
      maxDismissalsResultingHideSeconds
    );
    this.impressionConfig = new ImpressionConfig(
      impressionBackOffSeconds,
      maxImpressions,
      maxImpressionsResultingHideSeconds
    );
  }
}

/**
 * Client side conditions to trigger the display of the auto prompt.
 */
export class ClientDisplayTrigger {
  constructor(
    public readonly displayDelaySeconds?: number,
    public readonly numImpressionsBetweenPrompts?: number
  ) {}
}

/**
 * Configuration of explicit dismissal behavior and its effects.
 */
export class ExplicitDismissalConfig {
  constructor(
    public readonly backOffSeconds?: number,
    public readonly maxDismissalsPerWeek?: number,
    public readonly maxDismissalsResultingHideSeconds?: number
  ) {}
}

/**
 * Configuration of impression behavior and its effects.
 */
export class ImpressionConfig {
  constructor(
    public readonly backOffSeconds?: number,
    public readonly maxImpressions?: number,
    public readonly maxImpressionsResultingHideSeconds?: number
  ) {}
}
