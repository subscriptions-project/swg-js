/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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
export class UserData {

  /**
   * @param {string} idToken
   * @param {string} id
   * @param {string} email
   * @param {string} name
   */
  constructor(idToken, id, email, name) {
    /** @const {string} */
    this.idToken = idToken;
    /** @const {string} */
    this.id = id;
    /** @const {string} */
    this.email = email;
    /** @const {string} */
    this.name = name;
  }

  /**
   * @return {!UserData}
   */
  clone() {
    return new UserData(
        this.idToken,
        this.id,
        this.email,
        this.name);
  }

  /**
   * @return {!Object}
   */
  json() {
    return {
      'id': this.id,
      'email': this.email,
      'name': this.name,
    };
  }
}
