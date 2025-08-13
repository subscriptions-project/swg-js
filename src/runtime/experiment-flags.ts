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
export enum ExperimentFlags {
  /**
   * Experiment flag for enabling publication_id suffix to browser storage key.
   */
  ENABLE_PUBLICATION_ID_SUFFIX_FOR_STORAGE_KEY = 'enable-pub-id-suffix-for-storage-key',
}

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
   * Experiment flag to enable the rendering of the CTAs inline.
   */
  INLINE_CTA_EXPERIMENT = 'inline_cta_experiment',

  /**
   * Experiment flag to enable the standardized rewarded ads.
   */
  STANDARD_REWARDED_AD_EXPERIMENT = 'standard_rewarded_ad_experiment',

  /**
   * Experiment flag to enable multiple instances of CTAs (FCA Phase 1).
   */
  MULTI_INSTANCE_CTA_EXPERIMENT = 'multi_instance_cta_experiment',

  /**
   * Experiment flag that shows non-dismissible contribution CTA regardless of
   * reader's region. (If reader is in RRM-unsupported region, expect
   * contribution CTA to render "purchase not available").
   */
  ALWAYS_SHOW_BLOCKING_CONTRIBUTION_EXPERIMENT = 'bcontrib_experiment',
}
