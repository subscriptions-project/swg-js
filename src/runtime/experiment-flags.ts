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

/**
 * Experiment flags.
 *
 * IMPORTANT: All flags should also be added to the e2e test configuration in
 * nightwatch.conf.js.
 */
export enum ExperimentFlags {}

/**
 * Experiment flags within article experiment config.
 */
export enum ArticleExperimentFlags {
  /**
   * Experiment flag to enable paywall background click behavior so that links
   * cannot be clicked through the darkened background and so that it closes
   * closable popups.
   */
  BACKGROUND_CLICK_BEHAVIOR_EXPERIMENT = 'background_click_behavior_experiment',

  /**
   * Experiment flag to enable onsite preview.
   */
  ONSITE_PREVIEW_ENABLED = 'onsite_preview_enabled',

  /**
   * [FPA M0.5] Experiment flag to enable the new autoPromptManager flow to use
   * actionOrchestration from the article response as the source of the
   * targeted intervention funnel.
   */
  ACTION_ORCHESTRATION_EXPERIMENT = 'action_orchestration_experiment',
}
