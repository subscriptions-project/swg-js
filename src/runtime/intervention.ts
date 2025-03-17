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

import {InterventionType} from '../api/intervention-type';

/**
 * Intervention returned from the article endpoint. Interventions are configured
 * in the Publisher Center, and are used to display a prompt.
 */
export interface Intervention {
  // Indicates what type of intervention this is.
  readonly type: InterventionType;
  // ID used to fetch the configuration for the intervention. IDs are found in
  // the Publisher Center.
  readonly configurationId?: string;
  // Indicates if the intervention should be Google provided, or publisher
  // provided.
  readonly preference?: string;
  // Flexible Prompt Architecture - number of completions used only for
  // repeatable actions (Rewarded Ads, BYO-CTA) to determine action eligibility
  // based on funnel-level configured repeatability.
  readonly numberOfCompletions?: number;
  // Publisher provided name for the action configured in the Publisher Center.
  readonly name?: string;
}
