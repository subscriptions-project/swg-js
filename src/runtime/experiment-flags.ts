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
   * Experiment flag for recording Frequency Capping by dismissals instead of
   * impressions. String is abbreviated.
   */
  FREQUENCY_CAPPING_BY_DISMISSALS = 'fcbd_exp',

  /**
   * Experiment flag for enabling Frequency Capping local storage of impressions.
   */
  FREQUENCY_CAPPING_LOCAL_STORAGE = 'frequency_capping_local_storage_experiment',

  /**
   * Experiment flag for enabling Prompt Frequency Capping experiment for
   * triggering.
   */
  PROMPT_FREQUENCY_CAPPING_EXPERIMENT = 'prompt_frequency_capping_experiment',

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
}
