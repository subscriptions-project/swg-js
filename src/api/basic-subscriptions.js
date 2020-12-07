/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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
 * Interface for users of the basic tier of Subscribe with Google.
 * @interface
 */
export class BasicSubscriptions {

  /**
   * Initializes the basic subscriptions runtime. This includes setting of the
   * specified param values in the JSON-LD markup of the page, sets up any SwG
   * buttons with attribute 'swg-standard-button', and inserts a SwG prompt for
   * contributions/subscriptions. If the fields specified in the params are
   * already specified in the JSON-LD markup on the page, the existing values
   * will be preserved, and the values within init will be ignored.
   * @param {{
   *   type: string,
   *   isAccessibleForFree: boolean,
   *   isPartOfType: !Array<string>,
   *   isPartOfProductId: string,
   *   autoPromptType: string,
   * }} params
   */
  init({
    type,
    isAccessibleForFree,
    isPartOfType,
    isPartOfProductId,
    autoPromptType = AutoPromptType.NONE} = {}) {}
}

/** @enum {string} */
export const AutoPromptType = {
  NONE: 'none',
  CONTRIBUTION: 'contribution',
  SUBSCRIPTION: 'subscription',
};
