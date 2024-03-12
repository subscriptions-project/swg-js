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

const Constants = {
  /**
   * Local storage key for swgUserToken.
   */
  USER_TOKEN: 'USER_TOKEN',

  /**
   * Local storage key for read time.
   */
  READ_TIME: 'READ_TIME',

  /**
   * IAB Audience taxonomy version for logging PPS values to localStorage.
   * Value mapped to googletag.enums.Taxonomy.IAB_AUDIENCE_1_1.
   */
  PPS_AUDIENCE_TAXONOMY_KEY: 1,
};

const StorageKeys = {
  /**
   * Local storage key for autoprompt dismissal timestamps.
   */
  DISMISSALS: 'autopromptdismiss',

  /**
   * Local storage key for dismissed prompts.
   */
  DISMISSED_PROMPTS: 'dismissedprompts',

  /**
   * Local storage key for cacheable entitlements.
   */
  ENTITLEMENTS: 'ents',

  /**
   * Local storage key for IAB Audience Taxonomy values. It must take on the
   * 'values' as defined by the PPS GPT API.
   */
  PPS_TAXONOMIES: 'ppstaxonomies',

  /**
   * Local storage key for autoprompt impression timestamps.
   */
  IMPRESSIONS: 'autopromptimp',

  /**
   * Local storage key for whether credential isReadyToPay.
   */
  IS_READY_TO_PAY: 'isreadytopay',

  /**
   * Local storage key for redirect.
   */
  REDIRECT: 'subscribe.google.com:rk',

  /**
   * Local storage key for survey completed timestamps.
   */
  SURVEY_COMPLETED: 'surveycompleted',

  /**
   * Local storage key for survey data transfer failure timestamps.
   */
  SURVEY_DATA_TRANSFER_FAILED: 'surveydatatransferfailed',

  /**
   * Local storage key for whether toast was shown.
   */
  TOAST: 'toast',

  // Prompt Frequency storage keys
  /**
   * Local storage key for prompt impression timestamps.
   */
  PF_IMPRESSIONS: 'imp',

  /**
   * Local storage key for prompt dismissal timestamps.
   */
  PF_DISMISSALS: 'dms',

  /**
   * Local storage key for prompt completion timestamps.
   */
  PF_COMPLETIONS: 'cpt',

  TIMESTAMPS: 'tsp',
};

/**
 * Local storage keys for intervention impressions.
 */
const ImpressionStorageKeys = {
  CONTRIBUTION: 'imp_contribution',

  NEWSLETTER_SIGNUP: 'imp_newsletter',

  REGISTRATION_WALL: 'imp_regwall',

  REWARDED_AD: 'imp_ad',

  REWARDED_SURVEY: 'imp_survey',

  SUBSCRIPTION: 'imp_subscription',
};

export {Constants, ImpressionStorageKeys, StorageKeys};
