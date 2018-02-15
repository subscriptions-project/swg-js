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
  EntitlementsManager,
} from './entitlements-manager';
import {PageConfig} from '../model/page-config';


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
