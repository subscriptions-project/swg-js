/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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

import {Entitlement, Entitlements} from './entitlements';

describes.realWin('Entitlements', {}, () => {
  let entitlement;
  let entitlements;

  beforeEach(() => {
    entitlement = Entitlement.parseFromJson(null);
    entitlements = new Entitlements('service1', 'RaW', [], null, null);
    sandbox.stub(self.console, 'warn');
  });

  afterEach(() => {
    self.console.warn.restore();
  });

  describe('enables', () => {
    it('handles falsy `product` param', () => {
      expect(entitlement.enables(null)).to.be.false;
    });
  });

  describe('enablesThisWithCacheableEntitlements', () => {
    const CURRENT_PRODUCT = 'testpub:product_id';

    function createEntitlements(entitlements) {
      return new Entitlements(
        'service1',
        'RaW',
        entitlements,
        CURRENT_PRODUCT,
        null
      );
    }

    it('returns false when no entitlement is found for current product', () => {
      entitlements = createEntitlements([]);
      expect(entitlements.enablesThisWithCacheableEntitlements()).to.be.false;
    });

    it('returns false for entitlement with a metering source', () => {
      entitlements = createEntitlements([
        new Entitlement('google:metering', [CURRENT_PRODUCT], 'token'),
      ]);
      expect(entitlements.enablesThisWithCacheableEntitlements()).to.be.false;
    });

    it('returns true for entitlement with a non-metering source', () => {
      entitlements = createEntitlements([
        new Entitlement('google', [CURRENT_PRODUCT], 'token'),
      ]);
      expect(entitlements.enablesThisWithCacheableEntitlements()).to.be.true;
    });

    it('returns false for entitlement with a dev mode token', () => {
      entitlements = createEntitlements([
        new Entitlement('google', [CURRENT_PRODUCT], 'GOOGLE_DEV_MODE_TOKEN'),
      ]);
      expect(entitlements.enablesThisWithCacheableEntitlements()).to.be.false;
    });
  });

  describe('getEntitlementFor', () => {
    it('warns users if their article needs to define a product ID', () => {
      entitlements.getEntitlementFor(null, null);
      expect(self.console.warn).to.have.been.calledWithExactly(
        'SwG needs this article to define a product ID (e.g. example.com:premium). Articles can define a product ID using JSON+LD. SwG can check entitlements after this article defines a product ID.'
      );
    });
  });
});
