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

import {Entitlements} from './entitlements';
import {PurchaseData} from './subscribe-response';
import {UserData} from './user-data';

/**
 * Properties:
 * - entitlements - the current entitlements.
 * - consent - whether to ask the user for account creation consent.
 *   Default is `true`.
 */
export interface DeferredAccountCreationRequest {
  entitlements?: Entitlements | null;
  consent?: boolean;
}

export class DeferredAccountCreationResponse {
  // TODO(dvoytenko): deprecate.
  purchaseData: PurchaseData;

  constructor(
    readonly entitlements: Entitlements,
    readonly userData: UserData,
    readonly purchaseDataList: Array<PurchaseData>,
    private readonly completeHandler_: () => Promise<void>
  ) {
    // TODO(dvoytenko): deprecate.
    this.purchaseData = purchaseDataList[0];
  }

  clone(): DeferredAccountCreationResponse {
    return new DeferredAccountCreationResponse(
      this.entitlements,
      this.userData,
      this.purchaseDataList,
      this.completeHandler_
    );
  }

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
   */
  complete(): Promise<void> {
    return this.completeHandler_();
  }
}
