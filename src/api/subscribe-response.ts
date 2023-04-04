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
import {UserData} from './user-data';

export class SubscribeResponse {
  constructor(
    readonly raw: string,
    readonly purchaseData: PurchaseData,
    readonly userData: UserData | null,
    readonly entitlements: Entitlements | null,
    readonly productType: string,
    private readonly completeHandler_: () => Promise<void>,
    readonly oldSku: string | null = null,
    readonly swgUserToken: string | null = null,
    readonly paymentRecurrence: number | null = null,
    readonly requestMetadata: unknown = null
  ) {}

  clone(): SubscribeResponse {
    return new SubscribeResponse(
      this.raw,
      this.purchaseData,
      this.userData,
      this.entitlements,
      this.productType,
      this.completeHandler_,
      this.oldSku,
      this.swgUserToken
    );
  }

  json() {
    return {
      'purchaseData': this.purchaseData.json(),
      'userData': this.userData ? this.userData.json() : null,
      'entitlements': this.entitlements ? this.entitlements.json() : null,
      'oldSku': this.oldSku,
      'productType': this.productType,
      'swgUserToken': this.swgUserToken,
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
   */
  complete(): Promise<void> {
    return this.completeHandler_();
  }
}

export class PurchaseData {
  readonly data: string;

  constructor(readonly raw: string, readonly signature: string) {
    this.data = raw;
  }

  clone(): PurchaseData {
    return new PurchaseData(this.raw, this.signature);
  }

  json() {
    return {
      'data': this.raw,
      'signature': this.signature,
    };
  }
}
