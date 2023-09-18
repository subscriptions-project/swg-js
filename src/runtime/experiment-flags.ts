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
   * Experiment flag for logging audience activity.
   */
  LOGGING_AUDIENCE_ACTIVITY = 'logging-audience-activity',

  /**
   * Experiment flag for disabling the miniprompt icon on desktop screens wider
   * than 480px.
   */
  DISABLE_DESKTOP_MINIPROMPT = 'disable-desktop-miniprompt',

  /**
   * Experiment flag to enable populating the client config in the Classic runtime.
   */
  POPULATE_CLIENT_CONFIG_CLASSIC = 'populate-client-config-classic',

  /**
   * Experiment flag for enabling Frequency Capping local storage of impressions.
   */
  FREQUENCY_CAPPING_LOCAL_STORAGE = 'frequency_capping_local_storage_experiment',
}
