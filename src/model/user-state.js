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
  */
 export class UserState {
   /**
    * @param {string} userId
    * @param {Array<string>} userAttributes
    * @param {Object} data
    */
  constructor(userId, userAttributes, data) {
    /** @private @const {string} */
    this.userId_ = userId;
    /** @private @const {Array<string>} */
    this.userAttributes_ = userAttributes;
    /** @private @const {Object} */
    this.data_ = data;
  }

  /**
   * @return {string}
   */
  getUserId() {
    return this.userId_;
  }

  /**
   * @return {Array<string>}
   */
  getUserAttributes() {
    return this.userAttributes_;
  }

  /**
   * @return {Object}
   */
  getData() {
    return this.data_;
  }
 }
