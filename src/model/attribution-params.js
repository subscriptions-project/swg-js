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

/**
 * Container for attribution details for the publisher / creator.
 */
export class AttributionParams {
  /**
   * @param {string} displayName
   * @param {string} avatarUrl
   */
  constructor(displayName, avatarUrl) {
    /** @const {string} */
    this.displayName = displayName;

    /** @const {string} */
    this.avatarUrl = avatarUrl;
  }
}
