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

import {
  Entitlement,
  Entitlements,
} from '../api/entitlements';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {UserData} from '../api/user-data';


describes.sandboxed('Entitlements', {}, () => {

  it('should return properties', () => {
    const ents = new Entitlements('service1', 'RaW', [], null);
    expect(ents.service).to.equal('service1');
    expect(ents.raw).to.equal('RaW');
    expect(ents.entitlements).to.deep.equal([]);
    expect(ents.enablesAny()).to.be.false;
  });

  it('should test products', () => {
    const list = [
      new Entitlement('', ['product1', 'product2'], 'token1'),
      new Entitlement('', ['product2', 'product3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, 'product1');
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
  });

  it('should clone', () => {
    const list = [
      new Entitlement('source1', ['product1', 'product2'], 'token1'),
      new Entitlement('source2', ['product2', 'product3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, 'product1');
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
    });
  });

  it('should always test as false for a null product', () => {
    const list = [
      new Entitlement('', ['product1', 'product2'], 'token1'),
      new Entitlement('', ['product2', 'product3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, null);
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
    pd = new PurchaseData(
        'RAW',
        'SIG');
  });

  it('should correctly initialize', () => {
    expect(pd.raw).to.equal('RAW');
    expect(pd.signature).to.equal('SIG');
  });

  it('should clone correctly', () => {
    const clone = pd.clone();
    expect(clone).to.not.equal(pd);
    expect(clone).to.deep.equal(pd);
    expect(clone.raw).to.equal('RAW');
    expect(clone.signature).to.equal('SIG');
  });

  it('should export json', () => {
    expect(pd.json()).to.deep.equal({});
  });
});


describes.sandboxed('SubscribeResponse', {}, () => {
  let sr, pd, ud, complete, promise;

  beforeEach(() => {
    pd = new PurchaseData('PD_RAW', 'PD_SIG');
    ud = new UserData('ID_TOKEN', {sub: '1234'});
    promise = Promise.resolve();
    complete = () => promise;
    sr = new SubscribeResponse('SR_RAW', pd, ud, complete);
  });

  it('should initialize correctly', () => {
    expect(sr.raw).to.equal('SR_RAW');
    expect(sr.purchaseData).to.equal(pd);
    expect(sr.userData).to.equal(ud);
    expect(sr.complete()).to.equal(promise);
  });

  it('should clone', () => {
    const clone = sr.clone();
    expect(clone).to.not.equal(sr);
    expect(clone).to.deep.equal(sr);
    expect(clone.raw).to.equal('SR_RAW');
    expect(clone.purchaseData).to.equal(pd);
    expect(clone.userData).to.equal(ud);
    expect(clone.complete()).to.equal(promise);
  });

  it('should export json', () => {
    expect(sr.json()).to.deep.equal({
      'purchaseData': pd.json(),
      'userData': ud.json(),
    });
  });
});


describe('UserData', () => {
  let userData;

  beforeEach(() => {
    userData = new UserData(
        'ID_TOKEN',
        {
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
