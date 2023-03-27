/**
 * Copyright 2023 The Subscribe with Google Authors. All Rights Reserved.
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

import {PurchaseData, SubscribeResponse} from './subscribe-response';

const DUMMY_VALUE = '...';
const DUMMY_OBJECT = createObjectWithJsonMethod(DUMMY_VALUE);

function createObjectWithJsonMethod(jsonValue) {
  return {
    json: () => jsonValue,
  };
}

describes.realWin('SubscribeResponse', () => {
  describe('json', () => {
    it('calls the `json` method of the `purchaseData`, `userData`, and `entitlements` args', () => {
      const subscribeResponse = new SubscribeResponse(
        DUMMY_VALUE,
        createObjectWithJsonMethod('...purchaseData...'),
        createObjectWithJsonMethod('...userData...'),
        createObjectWithJsonMethod('...entitlements...')
      );

      expect(subscribeResponse.json().purchaseData).to.equal(
        '...purchaseData...'
      );
      expect(subscribeResponse.json().userData).to.equal('...userData...');
      expect(subscribeResponse.json().entitlements).to.equal(
        '...entitlements...'
      );
    });

    it('defaults `userData` and `entitlements` to `null`', () => {
      const subscribeResponse = new SubscribeResponse(
        DUMMY_VALUE,
        DUMMY_OBJECT
      );

      expect(subscribeResponse.json().userData).to.be.null;
      expect(subscribeResponse.json().entitlements).to.be.null;
    });
  });

  describe('clone', () => {
    it('clones response', () => {
      const subscribeResponse = new SubscribeResponse(
        DUMMY_VALUE,
        DUMMY_OBJECT
      );
      const clonedSubscribeResponse = subscribeResponse.clone();
      expect(clonedSubscribeResponse).to.deep.equal(subscribeResponse);
    });
  });

  describe('complete', () => {
    it('calls the complete handler passed into the constructor', () => {
      const mockCompleteHandler = sandbox.fake();
      const subscribeResponse = new SubscribeResponse(
        DUMMY_VALUE,
        DUMMY_OBJECT,
        DUMMY_OBJECT,
        DUMMY_OBJECT,
        DUMMY_VALUE,
        mockCompleteHandler
      );

      expect(mockCompleteHandler).not.to.be.called;
      subscribeResponse.complete();
      expect(mockCompleteHandler).to.be.called;
    });
  });
});

describes.realWin('PurchaseData', () => {
  describe('json', () => {
    it('returns JSON', () => {
      const purchaseData = new PurchaseData(DUMMY_VALUE, DUMMY_VALUE);

      expect(purchaseData.json()).to.deep.equal({
        data: DUMMY_VALUE,
        signature: DUMMY_VALUE,
      });
    });
  });

  describe('clone', () => {
    it('clones data', () => {
      const purchaseData = new PurchaseData(DUMMY_VALUE, DUMMY_VALUE);
      const clonedPurchaseData = purchaseData.clone();
      expect(clonedPurchaseData).to.deep.equal(purchaseData);
    });
  });
});
