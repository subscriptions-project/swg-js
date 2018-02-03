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
import {
  EntitlementsManager,
  parseEntitlementsFromJson,
} from './entitlements-manager';
import {PageConfig} from '../model/page-config';


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

  describe('parseEntitlementsFromJson', () => {
    it('should parse a json object with a single product', () => {
      const list = parseEntitlementsFromJson('pub1', {
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
      const list = parseEntitlementsFromJson('pub1', {
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
      const list = parseEntitlementsFromJson('pub1', [
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
      const list = parseEntitlementsFromJson('pub1', {
        product: 'product1',
      });
      expect(list[0].source).to.equal('');
    });

    it('should parse a non-empty source', () => {
      const list = parseEntitlementsFromJson('pub1', {
        source: 'pub1',
        product: 'product1',
      });
      expect(list[0].source).to.equal('pub1');
    });

    it('should parse a json object with a single label', () => {  // MIGRATE
      const list = parseEntitlementsFromJson('pub1', {
        labels: ['label1'],
        subscriptionToken: 'token1',
      });
      expect(list).to.have.length(1);
      expect(list[0].json()).to.deep.equal({
        source: '',
        products: ['pub1:label1'],
        subscriptionToken: 'token1',
      });
    });

    it('should parse a json object with multiple labels', () => {  // MIGRATE
      const list = parseEntitlementsFromJson('pub1', {
        labels: ['label1', 'label2'],
        subscriptionToken: 'token1',
      });
      expect(list).to.have.length(1);
      expect(list[0].json()).to.deep.equal({
        source: '',
        products: ['pub1:label1', 'pub1:label2'],
        subscriptionToken: 'token1',
      });
    });
  });
});


describes.realWin('EntitlementsManager', {}, env => {
  let win;
  let config;
  let manager;
  let xhrMock;
  let jwtHelperMock;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig('pub1:label1');
    manager = new EntitlementsManager(win, config);
    xhrMock = sandbox.mock(manager.xhr_);
    jwtHelperMock = sandbox.mock(manager.jwtHelper_);
  });

  afterEach(() => {
    xhrMock.verify();
    jwtHelperMock.verify();
  });

  it('should fetch empty response', () => {
    xhrMock.expects('fetch').withExactArgs(
        '$entitlements$/_/v1/publication/' +
        'pub1' +
        '/entitlements',
        {
          method: 'GET',
          headers: {'Accept': 'text/plain, application/json'},
          credentials: 'include',
        }).returns(Promise.resolve({
          json: () => Promise.resolve({}),
        }));
    return manager.getEntitlements().then(ents => {
      expect(ents.service).to.equal('subscribe.google.com');
      expect(ents.raw).to.equal('');
      expect(ents.entitlements).to.deep.equal([]);
      expect(ents.product_).to.equal('pub1:label1');
      expect(ents.enablesThis()).to.be.false;
    });
  });

  it('should fetch non-empty response', () => {
    jwtHelperMock.expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            products: ['pub1:label1'],
            subscriptionToken: 'token1',
          },
        });
    xhrMock.expects('fetch').withExactArgs(
        '$entitlements$/_/v1/publication/' +
        'pub1' +
        '/entitlements',
        {
          method: 'GET',
          headers: {'Accept': 'text/plain, application/json'},
          credentials: 'include',
        })
        .returns(Promise.resolve({
          json: () => Promise.resolve({
            signedEntitlements: 'SIGNED_DATA',
          }),
        }));
    return manager.getEntitlements().then(ents => {
      expect(ents.service).to.equal('subscribe.google.com');
      expect(ents.raw).to.equal('SIGNED_DATA');
      expect(ents.entitlements).to.deep.equal([
        {
          source: '',
          products: ['pub1:label1'],
          subscriptionToken: 'token1',
        },
      ]);
      expect(ents.enablesThis()).to.be.true;
    });
  });

  it('should only fetch once', () => {
    xhrMock.expects('fetch')
        .returns(Promise.resolve({
          json: () => Promise.resolve({}),
        }))
        .once();
    return manager.getEntitlements().then(() => {
      return manager.getEntitlements();
    });
  });

  it('should re-fetch after reset', () => {
    xhrMock.expects('fetch')
        .returns(Promise.resolve({
          json: () => Promise.resolve({}),
        }))
        .twice();
    return manager.getEntitlements().then(() => {
      manager.reset();
      return manager.getEntitlements();
    });
  });
});
