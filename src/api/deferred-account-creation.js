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

import {Entitlements as EntitlementsDef} from './entitlements';
import {PurchaseData as PurchaseDataDef} from './subscribe-response';
import {UserData as UserDataDef} from './user-data';

/**
 * Properties:
 * - entitlements - the current entitlements.
 * - consent - whether to ask the user for account creation consent.
 *   Default is `true`.
 *
 * @typedef {{
 *   entitlements: (?EntitlementsDef|undefined),
 *   consent: (boolean|undefined),
 * }}
 */
export let DeferredAccountCreationRequest;

/**
 */
export class DeferredAccountCreationResponse {
  /**
   * @param {!EntitlementsDef} entitlements
   * @param {!UserDataDef} userData
   * @param {!Array<!PurchaseDataDef>} purchaseDataList
   * @param {function():!Promise} completeHandler
   */
  constructor(entitlements, userData, purchaseDataList, completeHandler) {
    /** @const {!Entitlements} */
    this.entitlements = entitlements;
    /** @const {!UserData} */
    this.userData = userData;
    /** @const {!Array<!PurchaseData>} */
    this.purchaseDataList = purchaseDataList;
    // TODO(dvoytenko): deprecate.
    /** @const {!PurchaseData} */
    this.purchaseData = purchaseDataList[0];
    /** @private @const {function():!Promise} */
    this.completeHandler_ = completeHandler;
  }

  /**
   * @return {!DeferredAccountCreationResponse}
   */
  clone() {
    return new DeferredAccountCreationResponse(
      this.entitlements,
      this.userData,
      this.purchaseDataList,
      this.completeHandler_
    );
  }

  /**
   * @return {!Object}
   */
  json() {
    return {
      'entitlements': this.entitlements.json(),
      'userData': this.userData.json(),
      'purchaseDataList': this.purchaseDataList.map((pd) => pd.json()),
      // TODO(dvoytenko): deprecate.
      'purchaseData': this.purchaseData.json(),
    };
  }

  /**
   * Allows the receiving site to complete/acknowledge that it registered
   * the subscription info. The typical action would be to create an
   * account (or match an existing one) and associated the subscription with
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
