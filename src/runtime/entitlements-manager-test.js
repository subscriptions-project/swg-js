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
import {GlobalDoc} from '../model/doc';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';
import {
  base64UrlEncodeFromBytes,
  utf8EncodeSync,
} from '../utils/bytes';
import {AnalyticsService} from './analytics-service';
import {defaultConfig} from '../api/subscriptions';
import {ClientEventManager} from './client-event-manager';

describes.realWin('EntitlementsManager', {}, env => {
  let win;
  let pageConfig;
  let manager;
  let fetcher;
  let xhrMock;
  let jwtHelperMock;
  let callbacks;
  let storageMock;
  let config;
  let analyticsMock;
  let deps;
  let encryptedDocumentKey;
  let eventManager;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    fetcher = new XhrFetcher(win);
    eventManager = new ClientEventManager();
    xhrMock = sandbox.mock(fetcher.xhr_);
    config = defaultConfig();
    deps = new DepsDef();
    sandbox.stub(deps, 'win', () => win);
    const globalDoc = new GlobalDoc(win);
    sandbox.stub(deps, 'doc', () => globalDoc);
    callbacks = new Callbacks();
    sandbox.stub(deps, 'callbacks', () => callbacks);
    const storage = new Storage(win);
    storageMock = sandbox.mock(storage);
    sandbox.stub(deps, 'storage', () => storage);
    sandbox.stub(deps, 'pageConfig', () => pageConfig);
    sandbox.stub(deps, 'config', () => config);
    sandbox.stub(deps, 'eventManager', () => eventManager);
    const analyticsService = new AnalyticsService(deps);
    analyticsMock = sandbox.mock(analyticsService);
    sandbox.stub(deps, 'analytics', () => analyticsService);

    manager = new EntitlementsManager(win, pageConfig, fetcher, deps);
    jwtHelperMock = sandbox.mock(manager.jwtHelper_);
    encryptedDocumentKey = '{\"accessRequirements\": ' +
        '[\"norcal.com:premium\"], \"key\":\"aBcDef781-2-4/sjfdi\"}';
  });

  afterEach(() => {
    storageMock.verify();
    xhrMock.verify();
    jwtHelperMock.verify();
    analyticsMock.verify();
  });

  function expectNoResponse() {
    xhrMock.expects('fetch')
        .returns(Promise.resolve({
          json: () => Promise.resolve({}),
        }))
        .once();
  }

  function entitlementsResponse(entitlements, opt_options, opt_isReadyToPay) {
    function enc(obj) {
      return base64UrlEncodeFromBytes(utf8EncodeSync(JSON.stringify(obj)));
    }
    const options = Object.assign({
      exp: Math.floor(Date.now() / 1000) + 10,  // 10 seconds in the future.
    }, opt_options || {});
    const header = {};
    const payload = {
      'iss': 'google.com',
      'exp': options.exp,
      'entitlements': entitlements,
    };
    return {
      'signedEntitlements': enc(header) + '.' + enc(payload) + '.SIG',
      'isReadyToPay': opt_isReadyToPay,
    };
  }

  function expectGoogleResponse(opt_options, opt_isReadyToPay) {
    const resp = entitlementsResponse({
      source: 'google',
      products: ['pub1:label1'],
      subscriptionToken: 's1',
    }, opt_options, opt_isReadyToPay);
    xhrMock.expects('fetch')
        .returns(Promise.resolve({
          json: () => Promise.resolve(resp),
        }))
        .once();
    return resp;
  }

  function expectNonGoogleResponse(opt_options, opt_isReadyToPay) {
    const resp = entitlementsResponse({
      source: 'pub1',
      products: ['pub1:label1'],
      subscriptionToken: 's2',
    }, opt_options, opt_isReadyToPay);
    xhrMock.expects('fetch')
        .returns(Promise.resolve({
          json: () => Promise.resolve(resp),
        }))
        .once();
    return resp;
  }

  describe('fetching', () => {
    beforeEach(() => {
      // Expect empty cache.
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(null))
          .atLeast(0);
      storageMock.expects('get')
          .withExactArgs('toast')
          .returns(Promise.resolve(null))
          .atLeast(0);
      storageMock.expects('get')
          .withExactArgs('isreadytopay')
          .returns(Promise.resolve(null))
          .atLeast(0);
    });

    it('should fetch empty response', () => {
      xhrMock.expects('fetch').withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements',
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

    it('should accept encrypted document key', () => {
      xhrMock.expects('fetch').withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements?crypt=' +
          encodeURIComponent(encryptedDocumentKey),
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }).returns(Promise.resolve({
            json: () => Promise.resolve({}),
          }));
      return manager.getEntitlements(encryptedDocumentKey).then(ents => {
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
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements',
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
      return manager.getEntitlements().then(entitlements => {
        expect(manager.positiveRetries_).to.equal(0);
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
      return promise.then(entitlements => {
        expect(manager.positiveRetries_).to.equal(0);
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
      return promise.then(entitlements => {
        expect(manager.positiveRetries_).to.equal(0);
        expect(entitlements.entitlements).to.have.length(1);
        expect(entitlements.entitlements[0].subscriptionToken).to.equal('s2');
        expect(totalTime).to.be.greaterThan(999);
      });
    });

    it('should re-fetch after clear', () => {
      xhrMock.expects('fetch')
          .returns(Promise.resolve({
            json: () => Promise.resolve({}),
          }))
          .twice();
      return manager.getEntitlements().then(() => {
        manager.clear();
        return manager.getEntitlements();
      });
    });

    it('should clear all state and cache', () => {
      manager.reset(true);
      manager.blockNextNotification();
      manager.responsePromise_ = Promise.reject();
      expect(manager.positiveRetries_).to.equal(3);
      expect(manager.blockNextNotification_).to.be.true;

      storageMock.expects('remove').withExactArgs('ents').once();
      storageMock.expects('remove').withExactArgs('toast').once();
      storageMock.expects('remove').withExactArgs('isreadytopay').once();

      manager.clear();
      expect(manager.positiveRetries_).to.equal(0);
      expect(manager.blockNextNotification_).to.be.false;
      expect(manager.responsePromise_).to.be.null;
    });
  });

  describe('flow', () => {
    let toastOpenStub;
    let toast;

    beforeEach(() => {
      toastOpenStub = sandbox.stub(Toast.prototype, 'open', function() {
        toast = this;
      });
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(null))
          .atLeast(0);
      storageMock.expects('set')
          .withArgs('ents')
          .returns(Promise.resolve())
          .atLeast(0);
    });

    function expectToastShown(value) {
      // Emulate promsie.
      storageMock.expects('get').withExactArgs('toast').returns({
        then: callback => {
          callback(value);
        },
      });
    }

    function expectGetIsReadyToPayToBeCalled(value) {
      storageMock.expects('get')
          .withExactArgs('isreadytopay')
          .returns(Promise.resolve(value))
          .once();
    }

    it('should set toast flag', () => {
      storageMock.expects('set')
          .withExactArgs('toast', '1')
          .once();
      manager.setToastShown(true);
    });

    it('should unset toast flag', () => {
      storageMock.expects('set')
          .withExactArgs('toast', '0')
          .once();
      manager.setToastShown(false);
    });

    it('should trigger entitlements event for empty response', () => {
      storageMock.expects('get').withExactArgs('toast').never();
      storageMock.expects('set').withArgs('toast').never();
      expectGetIsReadyToPayToBeCalled(null);
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
      storageMock.expects('set').withArgs('toast').never();
      expectGetIsReadyToPayToBeCalled(null);
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
        expect(toast.args_.source).to.equal('google');
      });
    });

    it('should trigger entitlements event with readyToPay true', () => {
      expectToastShown('0');
      storageMock.expects('set').withArgs('isreadytopay', 'true').once();
      expectGetIsReadyToPayToBeCalled('true');
      expectGoogleResponse(/* options */ undefined, /* isReadyToPay */ true);
      analyticsMock.expects('setReadyToPay')
          .withExactArgs(true).once();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.isReadyToPay).to.be.true;
      });
    });

    it('should trigger entitlements event with readyToPay false', () => {
      expectToastShown('0');
      storageMock.expects('set').withArgs('isreadytopay', 'false').once();
      expectGetIsReadyToPayToBeCalled('false');
      expectGoogleResponse(/* options */ undefined, /* isReadyToPay */ false);
      analyticsMock.expects('setReadyToPay')
          .withExactArgs(false).once();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.isReadyToPay).to.be.false;
      });
    });

    it('should trigger entitlements with default readyToPay', () => {
      expectToastShown('0');
      expectGetIsReadyToPayToBeCalled(null);
      expectGoogleResponse();
      analyticsMock.expects('setReadyToPay')
          .withExactArgs(false).once();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.isReadyToPay).to.be.false;
      });
    });

    it('should tolerate expired response from server', () => {
      expectToastShown('0');
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('set').withArgs('toast').never();
      expectGoogleResponse({
        exp: Date.now() / 1000 - 10000,  // Far back.
      });
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesAny()).to.be.true;
        expect(entitlements.enablesThis()).to.be.true;
        expect(entitlements.getEntitlementForThis().source).to.equal('google');
      });
    });

    it('should acknowledge and update the toast bit', () => {
      expectToastShown('0');
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('set')
          .withExactArgs('toast', '1')
          .once();
      expectGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesThis()).to.be.true;
        entitlements.ack();
      });
    });

    it('should acknowledge and NOT update the toast bit', () => {
      storageMock.expects('set').withArgs('toast').never();
      expectGetIsReadyToPayToBeCalled(null);
      expectNoResponse();
      analyticsMock.expects('setReadyToPay')
          .withExactArgs(false);
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesThis()).to.be.false;
        entitlements.ack();
      });
    });

    it('should trigger entitlements event for non-Google response', () => {
      expectToastShown('0');
      expectGetIsReadyToPayToBeCalled(null);
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
        entitlements.ack();
        return entitlements;
      }).then(entitlements => {
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
        expect(toastOpenStub).to.be.calledOnce;
        expect(toast.args_.source).to.equal('pub1');
      });
    });

    it('should NOT trigger entitlements when notification is blocked', () => {
      expectGoogleResponse();
      expectGetIsReadyToPayToBeCalled(null);
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
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('set').withArgs('toast').never();
      expectGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.getEntitlementForThis().source).to.equal('google');
      }).then(() => {
        expect(toastOpenStub).to.not.be.called;
      });
    });
  });

  describe('flow with cache', () => {
    beforeEach(() => {
      sandbox.stub(Toast.prototype, 'open');
      storageMock.expects('get')
          .withArgs('toast')
          .returns(Promise.resolve(null))
          .atLeast(0);
      storageMock.expects('set')
          .withArgs('toast')
          .returns(Promise.resolve(null))
          .atLeast(0);
    });

    function expectGetIsReadyToPayToBeCalled(value) {
      storageMock.expects('get')
          .withExactArgs('isreadytopay')
          .returns(Promise.resolve(value))
          .atLeast(0);
    }

    it('should not store empty response', () => {
      expectNoResponse();
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(null))
          .once();
      storageMock.expects('set')
          .withExactArgs('ents')
          .never();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesAny()).to.be.false;
      });
    });

    it('should store non-empty Google response', () => {
      const raw = expectGoogleResponse()['signedEntitlements'];
      expect(raw).to.match(/e30\=\.eyJpc3MiOiJnb/);
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(null))
          .once();
      storageMock.expects('set')
          .withExactArgs('ents', raw)
          .returns(Promise.resolve())
          .once();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesAny()).to.be.true;
        expect(entitlements.enablesThis()).to.be.true;
        expect(entitlements.getEntitlementForThis().source).to.equal('google');
      });
    });

    it('should store non-empty non-Google response', () => {
      const raw = expectNonGoogleResponse()['signedEntitlements'];
      expect(raw).to.match(/e30\=\.eyJpc3MiOiJnb/);
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(null))
          .once();
      storageMock.expects('set')
          .withExactArgs('ents', raw)
          .returns(Promise.resolve())
          .once();
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.enablesAny()).to.be.true;
        expect(entitlements.enablesThis()).to.be.true;
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
      });
    });

    it('should retrieve a Google response from cache, rtp default', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(raw))
          .once();
      storageMock.expects('set')
          .withArgs('ents')
          .never();
      xhrMock.expects('fetch')
          .never();
      manager.reset(true);
      return manager.getEntitlements().then(entitlements => {
        expect(manager.positiveRetries_).to.equal(0);  // Retries are reset.
        expect(entitlements.enablesAny()).to.be.true;
        expect(entitlements.enablesThis()).to.be.true;
        expect(entitlements.getEntitlementForThis().source).to.equal('google');
        expect(entitlements.isReadyToPay).to.be.false;
      });
    });

    it('should retrieve a Google response from cache, rtp true', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled('true');
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(raw))
          .once();
      storageMock.expects('set')
          .withArgs('ents')
          .never();
      xhrMock.expects('fetch')
          .never();
      manager.reset(true);
      analyticsMock.expects('setReadyToPay')
          .withExactArgs(true);
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.isReadyToPay).to.be.true;
      });
    });

    it('should retrieve a Google response from cache, rtp false', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled('false');
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(raw))
          .once();
      storageMock.expects('set')
          .withArgs('ents')
          .never();
      xhrMock.expects('fetch')
          .never();
      manager.reset(true);
      analyticsMock.expects('setReadyToPay')
          .withExactArgs(false);
      return manager.getEntitlements().then(entitlements => {
        expect(entitlements.isReadyToPay).to.be.false;
      });
    });

    it('should retrieve a non-Google response from cache', () => {
      const raw = entitlementsResponse({
        source: 'pub1',
        products: ['pub1:label1'],
        subscriptionToken: 's2',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(raw))
          .once();
      storageMock.expects('set')
          .withArgs('ents')
          .never();
      xhrMock.expects('fetch')
          .never();
      manager.reset(true);
      return manager.getEntitlements().then(entitlements => {
        expect(manager.positiveRetries_).to.equal(0);  // Retries are reset.
        expect(entitlements.enablesAny()).to.be.true;
        expect(entitlements.enablesThis()).to.be.true;
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
        expect(entitlements.isReadyToPay).to.be.false;
      });
    });

    it('should not accept expired response in cache', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      }, {
        exp: Date.now() / 1000 - 100000,  // Far back.
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(raw))
          .once();
      storageMock.expects('set')
          .withArgs('ents')
          .once();
      expectNonGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        // Cached response is from Google, but refresh response is from "pub1".
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
      });
    });

    it('should not accept response in cache for a different product', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:other'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(raw))
          .once();
      storageMock.expects('set')
          .withArgs('ents')
          .once();
      expectNonGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        // Cached response is from Google, but refresh response is from "pub1".
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
      });
    });

    it('should not accept empty response in cache', () => {
      const raw = entitlementsResponse({})['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve(raw))
          .once();
      storageMock.expects('set')
          .withArgs('ents')
          .once();
      expectNonGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        // Cached response is from Google, but refresh response is from "pub1".
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
      });
    });

    it('should tolerate malformed cache', () => {
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('get')
          .withExactArgs('ents')
          .returns(Promise.resolve('VeRy BroKen'))
          .once();
      storageMock.expects('set')
          .withArgs('ents')
          .once();
      expectNonGoogleResponse();
      return manager.getEntitlements().then(entitlements => {
        // Cached response is from Google, but refresh response is from "pub1".
        expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
      });
    });

    it('should push entitlements', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      storageMock.expects('set')
          .withExactArgs('ents', raw)
          .returns(Promise.resolve())
          .once();
      const res = manager.pushNextEntitlements(raw);
      expect(res).to.be.true;
      manager.reset(true);
    });

    it('should ignore expired pushed entitlements', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      }, {
        exp: Date.now() / 1000 - 10000,  // Far back.
      })['signedEntitlements'];
      storageMock.expects('set')
          .withArgs('ents')
          .never();
      const res = manager.pushNextEntitlements(raw);
      expect(res).to.be.false;
    });

    it('should ignore unrelated pushed entitlements', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:other'],
        subscriptionToken: 's1',
      }, {
      })['signedEntitlements'];
      storageMock.expects('set')
          .withArgs('ents')
          .never();
      const res = manager.pushNextEntitlements(raw);
      expect(res).to.be.false;
    });

    it('should ignore malformed pushed entitlements', () => {
      storageMock.expects('set')
          .withArgs('ents')
          .never();
      const res = manager.pushNextEntitlements('VeRy BroKen');
      expect(res).to.be.false;
    });

    it('should reset w/o clearing cache', () => {
      storageMock.expects('remove').never();
      manager.reset();
    });

    it('should reset and clearing cache', () => {
      storageMock.expects('remove')
          .withExactArgs('ents')
          .once();
      storageMock.expects('remove')
          .withExactArgs('isreadytopay')
          .once();
      manager.reset(true);
    });
  });
});
