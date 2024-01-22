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

import {AttributionParams} from './attribution-params';
import {AutoPromptConfig} from './auto-prompt-config';

/**
 * Client configuration options.
 */
interface ClientConfigOptions {
  attributionParams?: AttributionParams;
  autoPromptConfig?: AutoPromptConfig;
  paySwgVersion?: string;
  uiPredicates?: UiPredicates;
  useUpdatedOfferFlows?: boolean;
  skipAccountCreationScreen?: boolean;
}

/**
 * Container for the details relating to how the client should be configured.
 */
export class ClientConfig {
  public readonly attributionParams?: AttributionParams;
  public readonly autoPromptConfig?: AutoPromptConfig;
  public readonly paySwgVersion?: string;
  public readonly uiPredicates?: UiPredicates;
  public readonly useUpdatedOfferFlows?: boolean;
  public readonly skipAccountCreationScreen?: boolean;

  constructor({
    attributionParams,
    autoPromptConfig,
    paySwgVersion,
    uiPredicates,
    useUpdatedOfferFlows,
    skipAccountCreationScreen,
  }: ClientConfigOptions) {
    this.autoPromptConfig = autoPromptConfig;
    this.paySwgVersion = paySwgVersion;
    this.useUpdatedOfferFlows = useUpdatedOfferFlows || false;
    this.skipAccountCreationScreen = skipAccountCreationScreen || false;
    this.uiPredicates = uiPredicates;
    this.attributionParams = attributionParams;
  }
}

/**
 * Predicates to control UI elements.
 */
export class UiPredicates {
  constructor(
    public readonly canDisplayAutoPrompt?: boolean,
    public readonly canDisplayButton?: boolean,
    public readonly purchaseUnavailableRegion?: boolean
  ) {}
}

/**
 * The server sends this JSON representation of the client config.
 */
export interface ClientConfigJson {
  attributionParams?: {
    displayName: string;
    avatarUrl: string;
  };
  autoPromptConfig?: {
    clientDisplayTrigger?: {
      displayDelaySeconds?: number;
      numImpressionsBetweenPrompts?: number;
    };
    explicitDismissalConfig?: {
      backOffSeconds?: number;
      maxDismissalsPerWeek?: number;
      maxDismissalsResultingHideSeconds?: number;
    };
    impressionConfig?: {
      backOffSeconds?: number;
      maxImpressions?: number;
      maxImpressionsResultingHideSeconds?: number;
    };
    frequencyCapConfig?: {
      globalFrequencyCap?: {
        frequencyCapDuration?: {
          seconds?: number;
          nano?: number;
        };
      };
      promptFrequencyCaps?: Array<{
        audienceActionType?: string;
        frequencyCapDuration?: {
          seconds?: number;
          nano?: number;
        };
      }>;
      anyPromptFrequencyCap?: {
        frequencyCapDuration?: {
          seconds?: number;
          nano?: number;
        };
      };
    };
  };
  paySwgVersion?: string;
  uiPredicates?: {
    canDisplayAutoPrompt?: boolean;
    canDisplayButton?: boolean;
    purchaseUnavailableRegion?: boolean;
  };
  useUpdatedOfferFlows?: boolean;
  skipAccountCreationScreen?: boolean;
}
