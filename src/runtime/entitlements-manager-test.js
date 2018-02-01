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

  it('should test labels', () => {
    const list = [
      new Entitlement('', ['label1', 'label2'], 'token1'),
      new Entitlement('', ['label2', 'label3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, 'label1');
    expect(ents.enablesAny()).to.be.true;
    expect(ents.enablesThis()).to.be.true;
    expect(ents.enables('label1')).to.be.true;
    expect(ents.enables('label2')).to.be.true;
    expect(ents.enables('label3')).to.be.true;
    expect(ents.enables('label4')).to.be.false;
    expect(ents.getEntitlementFor('label1')).to.equal(list[0]);
    expect(ents.getEntitlementFor('label2')).to.equal(list[0]);
    expect(ents.getEntitlementFor('label3')).to.equal(list[1]);
    expect(ents.getEntitlementFor('label4')).to.be.null;
    expect(ents.getEntitlementForThis()).to.equal(list[0]);
  });

  it('should clone', () => {
    const list = [
      new Entitlement('source1', ['label1', 'label2'], 'token1'),
      new Entitlement('source2', ['label2', 'label3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, 'label1');
    const cloned = ents.clone();
    expect(cloned.raw).to.equal('RaW');
    expect(cloned.json()).to.deep.equal({
      service: 'service1',
      entitlements: [
        {
          source: 'source1',
          labels: ['label1', 'label2'],
          subscriptionToken: 'token1',
        },
        {
          source: 'source2',
          labels: ['label2', 'label3'],
          subscriptionToken: 'token2',
        },
      ],
    });
  });

  it('should always test as false for a null label', () => {
    const list = [
      new Entitlement('', ['label1', 'label2'], 'token1'),
      new Entitlement('', ['label2', 'label3'], 'token2'),
    ];
    const ents = new Entitlements('service1', 'RaW', list, null);
    expect(ents.enablesAny()).to.be.true;
    expect(ents.enablesThis()).to.be.false;
  });

  describe('parseEntitlementsFromJson', () => {
    it('should parse a json object with a single label', () => {
      const list = parseEntitlementsFromJson({
        label: 'label1',
        subscriptionToken: 'token1',
      });
      expect(list).to.have.length(1);
      expect(list[0].json()).to.deep.equal({
        source: '',
        labels: ['label1'],
        subscriptionToken: 'token1',
      });
    });

    it('should parse a json object with multiple labels', () => {
      const list = parseEntitlementsFromJson({
        labels: ['label1', 'label2'],
        subscriptionToken: 'token1',
      });
      expect(list).to.have.length(1);
      expect(list[0].json()).to.deep.equal({
        source: '',
        labels: ['label1', 'label2'],
        subscriptionToken: 'token1',
      });
    });

    it('should parse a json array with multiple labels', () => {
      const list = parseEntitlementsFromJson([
        {
          labels: ['label1', 'label2'],
          subscriptionToken: 'token1',
        },
        {
          labels: ['label2', 'label3'],
          subscriptionToken: 'token2',
        },
      ]);
      expect(list).to.have.length(2);
      expect(list[0].json()).to.deep.equal({
        source: '',
        labels: ['label1', 'label2'],
        subscriptionToken: 'token1',
      });
      expect(list[1].json()).to.deep.equal({
        source: '',
        labels: ['label2', 'label3'],
        subscriptionToken: 'token2',
      });
    });

    it('should parse an empty source', () => {
      const list = parseEntitlementsFromJson({
        label: 'label1',
      });
      expect(list[0].source).to.equal('');
    });

    it('should parse a non-empty source', () => {
      const list = parseEntitlementsFromJson({
        source: 'pub1',
        label: 'label1',
      });
      expect(list[0].source).to.equal('pub1');
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
    config = new PageConfig({publicationId: 'pub1', label: 'label1'});
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
      expect(ents.label_).to.equal('label1');
      expect(ents.enablesThis()).to.be.false;
    });
  });

  it('should fetch non-empty response', () => {
    jwtHelperMock.expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            label: 'label1',
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
          labels: ['label1'],
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
