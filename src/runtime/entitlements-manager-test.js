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

import {Callbacks} from './callbacks';
import {DepsDef} from './deps';
import {
  EntitlementsManager,
} from './entitlements-manager';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';


describes.realWin('EntitlementsManager', {}, env => {
  let win;
  let config;
  let manager;
  let fetcher;
  let xhrMock;
  let jwtHelperMock;
  let callbacks;
  let storageMock;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig('pub1:label1');
    fetcher = new XhrFetcher(win);
    xhrMock = sandbox.mock(fetcher.xhr_);

    const deps = new DepsDef();
    callbacks = new Callbacks();
    sandbox.stub(deps, 'callbacks', () => callbacks);
    const storage = new Storage(win);
    storageMock = sandbox.mock(storage);
    sandbox.stub(deps, 'storage', () => storage);

    manager = new EntitlementsManager(win, config, fetcher, deps);
    jwtHelperMock = sandbox.mock(manager.jwtHelper_);
  });

  afterEach(() => {
    xhrMock.verify();
    jwtHelperMock.verify();
  });

  describe('fetching', () => {
    it('should fetch empty response', () => {
      xhrMock.expects('fetch').withExactArgs(
          '$entitlements$/v1/publication/' +
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
          '$entitlements$/v1/publication/' +
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

    it('should reset with positive expectation', () => {
      manager.reset();
      expect(manager.positiveRetries_).to.equal(0);
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);
      manager.reset();
      expect(manager.positiveRetries_).to.equal(3);
    });

    it('should fetch with positive expectation with one attempt', () => {
      xhrMock.expects('fetch')
          .returns(Promise.resolve({
            json: () => Promise.resolve({
              entitlements: {
                products: ['pub1:label1'],
                subscriptionToken: 's1',
              },
            }),
          }))
          .once();
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);
      const promise = manager.getEntitlements();
      expect(manager.positiveRetries_).to.equal(0);
      return promise.then(entitlements => {
        expect(entitlements.entitlements[0].subscriptionToken).to.equal('s1');
      });
    });

    it('should fetch with positive expectation with two attempts', () => {
      let totalTime = 0;
      sandbox.stub(win, 'setTimeout', (callback, timeout) => {
        totalTime += timeout;
        callback();
      });
      xhrMock.expects('fetch')
          .returns(Promise.resolve({
            json: () => Promise.resolve({
              entitlements: {
                products: ['pub1:label2'],
                subscriptionToken: 's2',
              },
            }),
          }))
          .once();
      xhrMock.expects('fetch')
          .returns(Promise.resolve({
            json: () => Promise.resolve({
              entitlements: {
                products: ['pub1:label1'],
                subscriptionToken: 's1',
              },
            }),
          }))
          .once();
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);
      const promise = manager.getEntitlements();
      expect(manager.positiveRetries_).to.equal(0);
      return promise.then(entitlements => {
        expect(entitlements.entitlements[0].subscriptionToken).to.equal('s1');
        expect(totalTime).to.be.greaterThan(499);
      });
    });

    it('should fetch with positive expectation with max attempts', () => {
      let totalTime = 0;
      sandbox.stub(win, 'setTimeout', (callback, timeout) => {
        totalTime += timeout;
        callback();
      });
      xhrMock.expects('fetch')
          .returns(Promise.resolve({
            json: () => Promise.resolve({
              entitlements: {
                products: ['pub1:label2'],
                subscriptionToken: 's2',
              },
            }),
          }))
          .thrice();
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);
      const promise = manager.getEntitlements();
      expect(manager.positiveRetries_).to.equal(0);
      return promise.then(entitlements => {
        expect(entitlements.entitlements).to.have.length(1);
        expect(entitlements.entitlements[0].subscriptionToken).to.equal('s2');
        expect(totalTime).to.be.greaterThan(999);
      });
    });
  });

  describe('flow', () => {
    let toastOpenStub;
    let toast;

    beforeEach(() => {
      toastOpenStub = sandbox.stub(Toast.prototype, 'open', function() {
        toast = this;
      });
    });

    function expectToastShown(value) {
      // Emulate promsie.
      storageMock.expects('get').withExactArgs('toast').returns({
        then: callback => {
          callback(value);
        },
      });
    }

    function expectNoResponse() {
      xhrMock.expects('fetch')
          .returns(Promise.resolve({
            json: () => Promise.resolve({}),
          }))
          .once();
    }

    function expectGoogleResponse() {
      xhrMock.expects('fetch')
          .returns(Promise.resolve({
            json: () => Promise.resolve({
              entitlements: {
                source: 'google',
                products: ['pub1:label1'],
                subscriptionToken: 's1',
              },
            }),
          }))
          .once();
    }

    function expectNonGoogleResponse() {
      xhrMock.expects('fetch')
          .returns(Promise.resolve({
            json: () => Promise.resolve({
              entitlements: {
                source: 'pub1',
                products: ['pub1:label1'],
                subscriptionToken: 's2',
              },
            }),
          }))
          .once();
    }

    it('should set toast flag', () => {
      manager.setToastShown(true);
    });

    it('should unset toast flag', () => {
      manager.setToastShown(false);
    });

    it('should trigger entitlements event for empty response', () => {
      expectToastShown('0');
      storageMock.expects('set').never();
      storageMock.expects('get')
          .withExactArgs('toast')
          .returns(Promise.resolve(false))
          .once();
      expectNoResponse();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesAny()).to.be.false;
        expect(callbacks.hasEntitlementsResponsePending()).to.be.true;
        return new Promise(resolve => {
          callbacks.setOnEntitlementsResponse(resolve);
        });
      }).then(entitlements => {
        expect(entitlements.enablesAny()).to.be.false;
        expect(toastOpenStub).to.not.be.called;
      });
    });

    it('should trigger entitlements event for Google response', () => {
      expectToastShown('0');
      storageMock.expects('set')
          .withExactArgs('toast', '1')
          .once();
      expectGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesAny()).to.be.true;
        expect(entitlements.enablesThis()).to.be.true;
        expect(entitlements.getEntitlementForThis().source).to.equal('google');
        expect(callbacks.hasEntitlementsResponsePending()).to.be.true;
        return new Promise(resolve => {
          callbacks.setOnEntitlementsResponse(resolve);
        });
      }).then(entitlements => {
        expect(entitlements.getEntitlementForThis().source).to.equal('google');
        expect(toastOpenStub).to.be.calledOnce;
        expect(toast.spec_.text).to.contain('Google');
      });
    });

    it('should trigger entitlements event for non-Google response', () => {
      expectToastShown('0');
      storageMock.expects('set')
          .withExactArgs('toast', '1')
          .once();
      expectNonGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesAny()).to.be.true;
        expect(entitlements.enablesThis()).to.be.true;
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
        expect(callbacks.hasEntitlementsResponsePending()).to.be.true;
        return new Promise(resolve => {
          callbacks.setOnEntitlementsResponse(resolve);
        });
      }).then(entitlements => {
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
        expect(toastOpenStub).to.be.calledOnce;
        expect(toast.spec_.text).to.contain('pub1');
      });
    });

    it('should NOT trigger entitlements when notification is blocked', () => {
      expectToastShown('0');
      storageMock.expects('set').never();
      expectGoogleResponse();
      manager.blockNextNotification();
      return manager.getEntitlements().then(entitlements => {
        expect(manager.blockNextNotification_).to.be.false;  // Reset.
        expect(entitlements.enablesThis()).to.be.true;
        expect(callbacks.hasEntitlementsResponsePending()).to.be.false;
        expect(toastOpenStub).to.not.be.called;
      });
    });

    it('should reset blocked state', () => {
      manager.blockNextNotification();
      expect(manager.blockNextNotification_).to.be.true;
      manager.unblockNextNotification();
      expect(manager.blockNextNotification_).to.be.false;  // Reset.
    });

    it('should NOT show toast if already shown', () => {
      expectToastShown('1');
      storageMock.expects('set').never();
      expectGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.getEntitlementForThis().source).to.equal('google');
      }).then(() => {
        expect(toastOpenStub).to.not.be.called;
      });
    });
  });
});
