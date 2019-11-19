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

import {DeferredAccountCreationResponse} from '../api/deferred-account-creation';
import {Entitlement, Entitlements} from '../api/entitlements';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {UserData} from '../api/user-data';

describes.sandboxed('Entitlements', {}, () => {
  let ackSpy;

  beforeEach(() => {
    ackSpy = sandbox.spy();
  });

  it('should return properties', () => {
    const ents = new Entitlements('service1', 'RaW', [], null, ackSpy);
    expect(ents.service).to.equal('service1');
    expect(ents.raw).to.equal('RaW');
    expect(ents.entitlements).to.deep.equal([]);
    expect(ents.enablesAny()).to.be.false;
  });

  it('should ack receipt', () => {
    const ents = new Entitlements('service1', 'RaW', [], null, ackSpy);
    expect(ackSpy).to.not.be.called;
    ents.ack();
    expect(ackSpy).to.be.calledOnce.calledWithExactly(ents);

    const clone = ents.clone();
    expect(ackSpy).to.be.calledOnce;
    clone.ack();
    expect(ackSpy).to.be.calledTwice;
    expect(ackSpy.args[1][0]).to.equal(clone);
  });

  it('should test products', () => {
    const list = [
      new Entitlement('source1', ['product1', 'product2'], 'token1'),
      new Entitlement('source2', ['product2', 'product3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, 'product1', ackSpy);
    expect(ents.enablesAny()).to.be.true;
    expect(ents.enablesThis()).to.be.true;
    expect(ents.enables('product1')).to.be.true;
    expect(ents.enables('product2')).to.be.true;
    expect(ents.enables('product3')).to.be.true;
    expect(ents.enables('product4')).to.be.false;
    expect(ents.getEntitlementFor('product1')).to.equal(list[0]);
    expect(ents.getEntitlementFor('product2')).to.equal(list[0]);
    expect(ents.getEntitlementFor('product3')).to.equal(list[1]);
    expect(ents.getEntitlementFor('product4')).to.be.null;
    expect(ents.getEntitlementForThis()).to.equal(list[0]);

    expect(ents.enablesAny('source1')).to.be.true;
    expect(ents.enablesAny('source2')).to.be.true;
    expect(ents.enablesAny('source3')).to.be.false; // Unknown source.
    expect(ents.enablesThis('source1')).to.be.true;
    expect(ents.enablesThis('source2')).to.be.false; // No "product1".
    expect(ents.enablesThis('source3')).to.be.false; // Unknown source.
    expect(ents.enables('product1', 'source1')).to.be.true;
    expect(ents.enables('product1', 'source2')).to.be.false; // No "product1"
    expect(ents.enables('product2', 'source1')).to.be.true;
    expect(ents.enables('product2', 'source2')).to.be.true;
    expect(ents.enables('product3', 'source1')).to.be.false; // No "product3"
    expect(ents.enables('product3', 'source2')).to.be.true;
    expect(ents.enables('product4', 'source1')).to.be.false; // No "product4".
    expect(ents.enables('product4', 'source2')).to.be.false; // No "product4".
    expect(ents.getEntitlementFor('product1', 'source1')).to.equal(list[0]);
    expect(ents.getEntitlementFor('product1', 'source2')).to.be.null;
    expect(ents.getEntitlementFor('product2', 'source1')).to.equal(list[0]);
    expect(ents.getEntitlementFor('product2', 'source2')).to.equal(list[1]);
    expect(ents.getEntitlementFor('product3', 'source1')).to.be.null;
    expect(ents.getEntitlementFor('product3', 'source2')).to.equal(list[1]);
    expect(ents.getEntitlementFor('product4', 'source1')).to.be.null;
    expect(ents.getEntitlementFor('product4', 'source2')).to.be.null;
    expect(ents.getEntitlementForThis('source1')).to.equal(list[0]);
    expect(ents.getEntitlementForThis('source2')).to.be.null; // No "product1".
    expect(ents.getEntitlementForThis('source3')).to.be.null; // No source.

    // Change current product.
    ents.product_ = 'product2';
    expect(ents.getEntitlementForThis('source1')).to.equal(list[0]);
    expect(ents.getEntitlementForThis('source2')).to.equal(list[1]);

    // Just source.
    expect(ents.getEntitlementForSource('source1')).to.equal(list[0]);
    expect(ents.getEntitlementForSource('source2')).to.equal(list[1]);
    expect(ents.getEntitlementForSource('source3')).to.be.null; // No source.
  });

  it('should match products by wildcard', () => {
    const list = [new Entitlement('source1', ['pub:*'], 'token1')];
    const ents = new Entitlements(
      'service1',
      'RaW',
      list,
      'pub:product1',
      ackSpy
    );
    expect(ents.enablesAny()).to.be.true;
    expect(ents.enablesThis()).to.be.true;
    expect(ents.enables('pub:product1')).to.be.true;
    expect(ents.enables('pub:product2')).to.be.true;
    expect(ents.enables('product3')).to.be.false; // Empty publication.
    expect(ents.enables('otr:product4')).to.be.false; // Different publication.
    expect(ents.getEntitlementFor('pub:product1')).to.equal(list[0]);
    expect(ents.getEntitlementFor('pub:product2')).to.equal(list[0]);
    expect(ents.getEntitlementFor('product3')).to.be.null;
    expect(ents.getEntitlementFor('otr:product4')).to.be.null;
    expect(ents.getEntitlementForThis()).to.equal(list[0]);

    expect(ents.enablesAny('source1')).to.be.true;
    expect(ents.enablesAny('source2')).to.be.false; // Unknown source.
    expect(ents.enablesThis('source1')).to.be.true;
    expect(ents.enablesThis('source2')).to.be.false; // Unknown source.
  });

  it('should clone', () => {
    const list = [
      new Entitlement('source1', ['product1', 'product2'], 'token1'),
      new Entitlement('source2', ['product2', 'product3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, 'product1', ackSpy);
    const cloned = ents.clone();
    expect(cloned.raw).to.equal('RaW');
    expect(cloned.json()).to.deep.equal({
      service: 'service1',
      entitlements: [
        {
          source: 'source1',
          products: ['product1', 'product2'],
          subscriptionToken: 'token1',
        },
        {
          source: 'source2',
          products: ['product2', 'product3'],
          subscriptionToken: 'token2',
        },
      ],
      isReadyToPay: false,
    });
  });

  it('should always test as false for a null product', () => {
    const list = [
      new Entitlement('', ['product1', 'product2'], 'token1'),
      new Entitlement('', ['product2', 'product3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, null, ackSpy);
    expect(ents.enablesAny()).to.be.true;
    expect(ents.enablesThis()).to.be.false;
  });

  describe('parseListFromJson', () => {
    it('should parse a json object with a single product', () => {
      const list = Entitlement.parseListFromJson({
        products: ['product1'],
        subscriptionToken: 'token1',
      });
      expect(list).to.have.length(1);
      expect(list[0].json()).to.deep.equal({
        source: '',
        products: ['product1'],
        subscriptionToken: 'token1',
      });
    });

    it('should parse a json object with multiple products', () => {
      const list = Entitlement.parseListFromJson({
        products: ['product1', 'product2'],
        subscriptionToken: 'token1',
      });
      expect(list).to.have.length(1);
      expect(list[0].json()).to.deep.equal({
        source: '',
        products: ['product1', 'product2'],
        subscriptionToken: 'token1',
      });
    });

    it('should parse a json array with multiple products', () => {
      const list = Entitlement.parseListFromJson([
        {
          products: ['product1', 'product2'],
          subscriptionToken: 'token1',
        },
        {
          products: ['product2', 'product3'],
          subscriptionToken: 'token2',
        },
      ]);
      expect(list).to.have.length(2);
      expect(list[0].json()).to.deep.equal({
        source: '',
        products: ['product1', 'product2'],
        subscriptionToken: 'token1',
      });
      expect(list[1].json()).to.deep.equal({
        source: '',
        products: ['product2', 'product3'],
        subscriptionToken: 'token2',
      });
    });

    it('should parse an empty source', () => {
      const list = Entitlement.parseListFromJson({
        product: 'product1',
      });
      expect(list[0].source).to.equal('');
    });

    it('should parse a non-empty source', () => {
      const list = Entitlement.parseListFromJson({
        source: 'pub1',
        product: 'product1',
      });
      expect(list[0].source).to.equal('pub1');
    });
  });
});

describe('PurchaseData', () => {
  let pd;

  beforeEach(() => {
    pd = new PurchaseData('RAW', 'SIG');
  });

  it('should correctly initialize', () => {
    expect(pd.raw).to.equal('RAW');
    expect(pd.data).to.equal('RAW');
    expect(pd.signature).to.equal('SIG');
  });

  it('should clone correctly', () => {
    const clone = pd.clone();
    expect(clone).to.not.equal(pd);
    expect(clone).to.deep.equal(pd);
    expect(clone.raw).to.equal('RAW');
    expect(clone.data).to.equal('RAW');
    expect(clone.signature).to.equal('SIG');
  });

  it('should export json', () => {
    expect(pd.json()).to.deep.equal({
      'data': 'RAW',
      'signature': 'SIG',
    });
  });
});

describes.sandboxed('SubscribeResponse', {}, () => {
  let sr, pd, ud, entitlements, complete, promise;

  beforeEach(() => {
    pd = new PurchaseData('PD_RAW', 'PD_SIG');
    ud = new UserData('ID_TOKEN', {sub: '1234'});
    entitlements = new Entitlements('service1', 'RaW', [], null, function() {});
    promise = Promise.resolve();
    complete = () => promise;
    sr = new SubscribeResponse('SR_RAW', pd, ud, entitlements, null, complete);
  });

  it('should still support absent entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    sr = new SubscribeResponse('SR_RAW', pd, ud, null, null, complete);
    expect(sr.entitlements).to.be.null;
    expect(sr.clone().entitlements).to.be.null;
    expect(sr.json()).to.deep.equal({
      'purchaseData': pd.json(),
      'userData': ud.json(),
      'entitlements': null,
      'productType': null,
      'oldSku': null,
    });
    expect(sr.complete()).to.equal(promise);
  });

  it('should initialize correctly', () => {
    expect(sr.raw).to.equal('SR_RAW');
    expect(sr.purchaseData).to.equal(pd);
    expect(sr.userData).to.equal(ud);
    expect(sr.entitlements).to.equal(entitlements);
    expect(sr.complete()).to.equal(promise);
  });

  it('should clone', () => {
    const clone = sr.clone();
    expect(clone).to.not.equal(sr);
    expect(clone).to.deep.equal(sr);
    expect(clone.raw).to.equal('SR_RAW');
    expect(clone.purchaseData).to.equal(pd);
    expect(clone.userData).to.equal(ud);
    expect(clone.entitlements).to.equal(entitlements);
    expect(clone.complete()).to.equal(promise);
  });

  it('should export json', () => {
    expect(sr.json()).to.deep.equal({
      'purchaseData': pd.json(),
      'userData': ud.json(),
      'entitlements': entitlements.json(),
      'productType': null,
      'oldSku': null,
    });
  });
});

describe('UserData', () => {
  let userData;

  beforeEach(() => {
    userData = new UserData('ID_TOKEN', {
      'sub': 'id1',
      'email': 'id1@email.org',
      'email_verified': true,
      'name': 'Id One',
      'picture': 'https://example.org/avatar/test',
      'given_name': 'Id',
      'family_name': 'One',
    });
  });

  it('should correctly initialize', () => {
    expect(userData.idToken).to.equal('ID_TOKEN');
    expect(userData.id).to.equal('id1');
    expect(userData.email).to.equal('id1@email.org');
    expect(userData.emailVerified).to.equal(true);
    expect(userData.name).to.equal('Id One');
    expect(userData.givenName).to.equal('Id');
    expect(userData.familyName).to.equal('One');
    expect(userData.pictureUrl).to.equal('https://example.org/avatar/test');
  });

  it('should clone correctly', () => {
    const clone = userData.clone();
    expect(clone).to.not.equal(userData);
    expect(clone).to.deep.equal(userData);
    expect(clone.idToken).to.equal('ID_TOKEN');
    expect(clone.id).to.equal('id1');
    expect(clone.email).to.equal('id1@email.org');
    expect(userData.emailVerified).to.equal(true);
    expect(clone.name).to.equal('Id One');
    expect(clone.givenName).to.equal('Id');
    expect(clone.familyName).to.equal('One');
    expect(clone.pictureUrl).to.equal('https://example.org/avatar/test');
  });

  it('should export json', () => {
    expect(userData.json()).to.deep.equal({
      'id': 'id1',
      'email': 'id1@email.org',
      'emailVerified': true,
      'name': 'Id One',
      'givenName': 'Id',
      'familyName': 'One',
      'pictureUrl': 'https://example.org/avatar/test',
    });
  });
});

describes.sandboxed('DeferredAccountCreationResponse', {}, () => {
  let ents, dacr, pd, pd2, ud, complete, promise;

  beforeEach(() => {
    ents = new Entitlements(
      'service1',
      'RaW',
      [new Entitlement('source1', ['product1', 'product2'], 'token1')],
      'product1',
      () => {}
    );
    pd = new PurchaseData('PD_RAW', 'PD_SIG');
    pd2 = new PurchaseData('PD_RAW2', 'PD_SIG2');
    ud = new UserData('ID_TOKEN', {sub: '1234'});
    promise = Promise.resolve();
    complete = () => promise;
    dacr = new DeferredAccountCreationResponse(ents, ud, [pd, pd2], complete);
  });

  it('should initialize correctly', () => {
    expect(dacr.entitlements).to.equal(ents);
    expect(dacr.userData).to.equal(ud);
    expect(dacr.purchaseDataList).to.deep.equal([pd, pd2]);
    expect(dacr.purchaseData).to.equal(pd);
    expect(dacr.complete()).to.equal(promise);
  });

  it('should clone', () => {
    const clone = dacr.clone();
    expect(clone).to.not.equal(dacr);
    expect(clone).to.deep.equal(dacr);
    expect(clone.entitlements).to.equal(ents);
    expect(clone.purchaseDataList).to.deep.equal([pd, pd2]);
    expect(clone.purchaseData).to.equal(pd);
    expect(clone.userData).to.equal(ud);
    expect(clone.complete()).to.equal(promise);
  });

  it('should export json', () => {
    expect(dacr.json()).to.deep.equal({
      'entitlements': ents.json(),
      'userData': ud.json(),
      'purchaseDataList': [pd.json(), pd2.json()],
      'purchaseData': pd.json(),
    });
  });
});
