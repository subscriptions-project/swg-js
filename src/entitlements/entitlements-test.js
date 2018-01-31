/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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
  Entitlements,
  parseEntitlementsFromJson,
} from './entitlements';


describes.sandboxed('Entitlements', {}, () => {

  it('should return properties', () => {
    const ents = new Entitlements('service1', 'RaW', [], null);
    expect(ents.getServiceId()).to.equal('service1');
    expect(ents.raw()).to.equal('RaW');
    expect(ents.list()).to.deep.equal([]);
    expect(ents.enablesAny()).to.be.false;
  });

  it('should test labels', () => {
    const list = [
      {
        labels: ['label1', 'label2'],
        subscriptionToken: 'token1',
      },
      {
        labels: ['label2', 'label3'],
        subscriptionToken: 'token1',
      },
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

  it('should always test as false for a null label', () => {
    const list = [
      {
        labels: ['label1', 'label2'],
        subscriptionToken: 'token1',
      },
      {
        labels: ['label2', 'label3'],
        subscriptionToken: 'token1',
      },
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
      expect(list).to.deep.equal([
        {
          source: '',
          labels: ['label1'],
          subscriptionToken: 'token1',
        },
      ]);
    });

    it('should parse a json object with multiple labels', () => {
      const list = parseEntitlementsFromJson({
        labels: ['label1', 'label2'],
        subscriptionToken: 'token1',
      });
      expect(list).to.deep.equal([
        {
          source: '',
          labels: ['label1', 'label2'],
          subscriptionToken: 'token1',
        },
      ]);
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
      expect(list).to.deep.equal([
        {
          source: '',
          labels: ['label1', 'label2'],
          subscriptionToken: 'token1',
        },
        {
          source: '',
          labels: ['label2', 'label3'],
          subscriptionToken: 'token2',
        },
      ]);
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
