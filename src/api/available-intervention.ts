/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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

import {AudienceActionIframeFlow} from '../runtime/audience-action-flow';
import {AudienceActionLocalFlow} from '../runtime/audience-action-local-flow';
import {Deps} from '../runtime/deps';
import {Intervention} from '../runtime/intervention';
import {InterventionType} from './intervention-type';
import {SurveyDataTransferRequest} from '../proto/api_messages';

/**
 * Opt-in data passed to the AvailableIntervention.show callback for an opt-in
 * intervention.
 */
export interface OptInResult {
  // Email of the opted-in user, ex. john.johnson@gmail.com
  email: string | null;
  // Display name of the opted-in user, ex. John Johnson
  displayName: string | null;
  // Given name of the opted-in user, ex. John
  givenName: string | null;
  // Family name of the opted-in user, ex. Johnson
  familyName: string | null;
  // Whether the user has consented to the terms and conditions. Null is returned if the CTA does not have terms.
  termsAndConditionsConsent: boolean | null;
}

/**
 * Completion data passed to the AvailableIntervention.show callback for a the
 * rewarded ad intervention.
 */
export interface RewardedAdResult {
  // Did the prompt successfully render?
  rendered: boolean;
  // Was a reward granted?
  rewardGranted: boolean;
  // The publisher defined reward amount granted to the reader
  reward?: number;
  // The publisher defined reward type granted to the reader
  type?: string;
}

/**
 * Result of an intervention passed to the AvailableIntervention.show callback.
 */
export interface InterventionResult {
  // Configuration id of the intervention
  configurationId?: string;
  // Data returned from the intervention
  data: OptInResult | SurveyDataTransferRequest | RewardedAdResult;
}

/**
 * Params passed to the AvailableIntervention.show method.
 */
export interface ShowInterventionParams {
  // Determine whether the view is closable.
  isClosable?: boolean;

  // Callback to get the result data from the intervention. Return a boolean
  // indicating if the data was recorded successfully.
  onResult?: (result: InterventionResult) => Promise<boolean> | boolean;

  // Suppresses the completion toasts of the intervention.
  suppressToast?: boolean;

  // Callback for clicking clicking on an alternate action. Closes the prompt when called.
  onAlternateAction?: () => void;

  // Callback for signing in. Closes the prompt when called.
  onSignIn?: () => void;
}

export class AvailableIntervention {
  readonly type: InterventionType;

  readonly configurationId?: string;

  constructor(
    private readonly intervention: Intervention,
    private readonly deps_: Deps
  ) {
    this.type = intervention.type;
    this.configurationId = intervention.configurationId;
  }

  /**
   * Starts the intervention flow.
   */
  async show(params: ShowInterventionParams): Promise<void> {
    if (
      this.intervention.type == InterventionType.TYPE_NEWSLETTER_SIGNUP ||
      this.intervention.type == InterventionType.TYPE_REWARDED_SURVEY ||
      this.intervention.type == InterventionType.TYPE_BYO_CTA
    ) {
      return new AudienceActionIframeFlow(this.deps_, {
        action: this.intervention.type,
        configurationId: this.intervention.configurationId,
        onResult: params.onResult,
        isClosable: params.isClosable,
        calledManually: true,
        suppressToast: params.suppressToast,
      }).start();
    } else if (this.intervention.type == InterventionType.TYPE_REWARDED_AD) {
      return new AudienceActionLocalFlow(this.deps_, {
        action: this.intervention.type,
        configurationId: this.intervention.configurationId,
        onResult: params.onResult,
        isClosable: params.isClosable,
        calledManually: true,
        onAlternateAction: params.onAlternateAction,
        onSignIn: params.onSignIn,
      }).start();
    }
    throw Error(`Can't show ${this.type}`);
  }
}
