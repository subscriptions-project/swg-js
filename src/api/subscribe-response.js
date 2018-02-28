/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import {UserData} from './user-data';


/**
 */
export class SubscribeResponse {

  /**
   * @param {string} raw
   * @param {!PurchaseData} purchaseData
   * @param {?UserData} userData
   * @param {function():!Promise} completeHandler
   */
  constructor(raw, purchaseData, userData, completeHandler) {
    /** @const {string} */
    this.raw = raw;
    /** @const {!PurchaseData} */
    this.purchaseData = purchaseData;
    /** @const {?UserData} */
    this.userData = userData;
    /** @private @const {function():!Promise} */
    this.completeHandler_ = completeHandler;
  }

  /**
   * @return {!SubscribeResponse}
   */
  clone() {
    return new SubscribeResponse(
        this.raw,
        this.purchaseData,
        this.userData,
        this.completeHandler_);
  }

  /**
   * @return {!Object}
   */
  json() {
    return {
      'purchaseData': this.purchaseData.json(),
      'userData': this.userData ? this.userData.json() : null,
    };
  }

  /**
   * Allows the receiving site to complete/acknowledge that it registered
   * the subscription purchase. The typical action would be to create an
   * account (or match an existing one) and associated the purchase with
   * that account.
   *
   * SwG will display progress indicator until this method is called and
   * upon receiving this call will show the confirmation to the user.
   * The promise returned by this method will yield once the user closes
   * the confirmation.
   *
   * @return {!Promise}
   */
  complete() {
    return this.completeHandler_();
  }
}


/**
 */
export class PurchaseData {

  /**
   * @param {string} raw
   * @param {string} signature
   */
  constructor(raw, signature) {
    /** @const {string} */
    this.raw = raw;
    /** @const {string} */
    this.signature = signature;
  }

  /**
   * @return {!PurchaseData}
   */
  clone() {
    return new PurchaseData(this.raw, this.signature);
  }

  /**
   * @return {!Object}
   */
  json() {
    return {};
  }
}
