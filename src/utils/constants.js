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

const Constants = {};

/**
 * Local storage key for swgUserToken.
 *
 * @const {string}
 */
Constants.USER_TOKEN = 'USER_TOKEN';

/**
 * Local storage key for read time.
 *
 * @const {string}
 */
Constants.READ_TIME = 'READ_TIME';

const StorageKeys = {};

/**
 * Local storage key for autoprompt dismissal timestamps.
 * @const {string}
 */

StorageKeys.DISMISSALS = 'autopromptdismiss';

/**
 * Local storage key for dismissed prompts.
 * @const {string}
 */
StorageKeys.DISMISSED_PROMPTS = 'dismissedprompts';

/**
 * Local storage key for cacheable entitlements.
 * @const {string}
 */
StorageKeys.ENTITLEMENTS = 'ents';

/**
 * Local storage key for autoprompt impression timestamps.
 * @const {string}
 */
StorageKeys.IMPRESSIONS = 'autopromptimp';

/**
 * Local storage key for whether credential isReadyToPay.
 * @const {string}
 */
StorageKeys.IS_READY_TO_PAY = 'isreadytopay';

/**
 * Local storage key for redirect.
 * @const {string}
 */
StorageKeys.REDIRECT = 'subscribe.google.com:rk';

/**
 * Local storage key for survey completed timestamps.
 * @const {string}
 */
StorageKeys.SURVEY_COMPLETED = 'surveycompleted';

/**
 * Local storage key for survey data transfer failure timestamps.
 * @const {string}
 */
StorageKeys.SURVEY_DATA_TRANSFER_FAILED = 'surveydatatransferfailed';

/**
 * Local storage key for whether toast was shown.
 * @const {string}
 */
StorageKeys.TOAST = 'toast';

export {Constants, StorageKeys};
