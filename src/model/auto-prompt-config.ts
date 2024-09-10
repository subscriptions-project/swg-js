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
  globalFrequencyCapDurationSeconds?: number;
  globalFrequencyCapDurationNano?: number;
  promptFrequencyCaps?: {
    audienceActionType?: string;
    frequencyCapDuration?: {
      seconds?: number;
      nano?: number;
    };
  }[];
  anyPromptFrequencyCapDurationSeconds?: number;
  anyPromptFrequencyCapDurationNano?: number;
}

/**
 * Container for the auto prompt configuation details.
 */
export class AutoPromptConfig {
  clientDisplayTrigger: ClientDisplayTrigger;
  explicitDismissalConfig: ExplicitDismissalConfig;
  impressionConfig: ImpressionConfig;
  frequencyCapConfig: FrequencyCapConfig;

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
    globalFrequencyCapDurationSeconds,
    globalFrequencyCapDurationNano,
    promptFrequencyCaps,
    anyPromptFrequencyCapDurationSeconds,
    anyPromptFrequencyCapDurationNano,
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
    this.frequencyCapConfig = new FrequencyCapConfig(
      new GlobalFrequencyCap(
        new Duration(
          globalFrequencyCapDurationSeconds,
          globalFrequencyCapDurationNano
        )
      ),
      promptFrequencyCaps?.map(
        (promptFrequencyCap) =>
          new PromptFrequencyCap(
            promptFrequencyCap.audienceActionType,
            new Duration(
              promptFrequencyCap.frequencyCapDuration?.seconds,
              promptFrequencyCap.frequencyCapDuration?.nano
            )
          )
      ),
      new AnyPromptFrequencyCap(
        new Duration(
          anyPromptFrequencyCapDurationSeconds,
          anyPromptFrequencyCapDurationNano
        )
      )
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

/**
 * Configuration of Prompt Frequency Capping.
 */
export class FrequencyCapConfig {
  constructor(
    public readonly globalFrequencyCap?: GlobalFrequencyCap,
    public readonly promptFrequencyCaps?: PromptFrequencyCap[],
    public readonly anyPromptFrequencyCap?: AnyPromptFrequencyCap
  ) {}
}

export class GlobalFrequencyCap {
  constructor(public readonly frequencyCapDuration?: Duration) {}
}

export class PromptFrequencyCap {
  constructor(
    public readonly audienceActionType?: string,
    public readonly frequencyCapDuration?: Duration
  ) {}
}

export class AnyPromptFrequencyCap {
  constructor(public readonly frequencyCapDuration?: Duration) {}
}

export class Duration {
  constructor(
    public readonly seconds?: number,
    public readonly nanos?: number
  ) {}
}
