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
 * @enum {string}
 */
export const ExperimentFlags = {
  /**
   * Enables the feature that allows you to replace one subscription
   * for another in the subscribe() API.
   */
  REPLACE_SUBSCRIPTION: 'replace-subscription',

  /**
   * Enables the contributions feature.
   * DEPRECATED. This flag can be removed once not used by anyone.
   */
  CONTRIBUTIONS: 'contributions',

  /**
   * Enables the Propensity feature
   */
  PROPENSITY: 'propensity',

  /**
   * Enables the Smartbox feature.
   */
  SMARTBOX: 'smartbox',

  /**
   * Enables using new Activities APIs
   */
  HEJIRA: 'hejira',

  /** Enables logging to both the new SwG Clearcut service and the pre-existing
   *  Clearcut iframe while we verify the new logging system works.
   *  Publishers should not activate this experiment.
   */
  LOGGING_BEACON: 'logging-beacon',

  /** Enables googleTransactionID change. With the experiment on the ID is
   *  changed from '<uuid>' to '<uuid>.swg'.
   */
  UPDATE_GOOGLE_TRANSACTION_ID: 'update-google-transaction-id',

  /**
   * Experiment flag for guarding changes to fix PayClient redirect flow.
   */
  PAY_CLIENT_REDIRECT: 'pay-client-redirect',

  /**
   * Experiment flag for logging audience activity.
   */
  LOGGING_AUDIENCE_ACTIVITY: 'logging-audience-activity',
};
