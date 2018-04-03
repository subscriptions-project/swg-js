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

import {
  AbbrvOfferFlow,
  OffersFlow,
  SubscribeOptionFlow,
} from './offers-flow';
import {
  ActivityPorts,
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {
  ConfiguredRuntime,
  Runtime,
  installRuntime,
  getRuntime,
} from './runtime';
import {DialogManager} from '../components/dialog-manager';
import {Entitlement, Entitlements} from '../api/entitlements';
import {Fetcher, XhrFetcher} from './fetcher';
import {GlobalDoc} from '../model/doc';
import {
  LinkCompleteFlow,
  LinkbackFlow,
} from './link-accounts-flow';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {
  PayStartFlow,
} from './pay-flow';
import {SubscribeResponse} from '../api/subscribe-response';
import {Subscriptions} from '../api/subscriptions';
import {createElement} from '../utils/dom';


describes.realWin('installRuntime', {}, env => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  function dep(callback) {
    (win.SWG = win.SWG || []).push(callback);
  }

  it('should chain and execute dependencies in order', function* () {
    // Before runtime is installed.
    let progress = '';
    dep(function() {
      progress += '1';
    });
    dep(function() {
      progress += '2';
    });
    expect(progress).to.equal('');

    // Install runtime and schedule few more dependencies.
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    dep(function() {
      progress += '3';
    });
    dep(function() {
      progress += '4';
    });

    // Wait for ready signal.
    yield getRuntime().whenReady();
    expect(progress).to.equal('1234');

    // Few more.
    dep(function() {
      progress += '5';
    });
    dep(function() {
      progress += '6';
    });
    yield getRuntime().whenReady();
    expect(progress).to.equal('123456');
  });

  it('should reuse the same runtime on multiple runs', () => {
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    const runtime1 = getRuntime();
    installRuntime(win);
    expect(getRuntime()).to.equal(runtime1);
  });

  it('should implement Subscriptions interface', () => {
    const promise = new Promise(resolve => {
      dep(resolve);
    });
    installRuntime(win);
    return promise.then(subscriptions => {
      for (const k in Subscriptions.prototype) {
        expect(subscriptions).to.contain(k);
      }
    });
  });

  it('handles recursive calls after installation', function* () {
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    let progress = '';
    dep(() => {
      progress += '1';
      dep(() => {
        progress += '2';
        dep(() => {
          progress += '3';
        });
      });
    });
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    expect(progress).to.equal('123');
  });

  it('handles recursive calls before installation', function* () {
    let progress = '';
    dep(() => {
      progress += '1';
      dep(() => {
        progress += '2';
        dep(() => {
          progress += '3';
        });
      });
    });
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    expect(progress).to.equal('123');
  });

  it('should implement all APIs', () => {
    installRuntime(win);
    return new Promise(resolve => {
      dep(resolve);
    }).then(subscriptions => {
      const names = Object.getOwnPropertyNames(Subscriptions.prototype);
      names.forEach(name => {
        if (name == 'constructor') {
          return;
        }
        expect(subscriptions).to.have.property(name);
      });
    });
  });
});


describes.realWin('installRuntime legacy', {}, env => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  function dep(callback) {
    (win.SUBSCRIPTIONS = win.SUBSCRIPTIONS || []).push(callback);
  }

  it('should chain and execute dependencies in order', function* () {
    // Before runtime is installed.
    let progress = '';
    dep(function() {
      progress += '1';
    });
    dep(function() {
      progress += '2';
    });
    expect(progress).to.equal('');

    // Install runtime and schedule few more dependencies.
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    dep(function() {
      progress += '3';
    });
    dep(function() {
      progress += '4';
    });

    // Wait for ready signal.
    yield getRuntime().whenReady();
    expect(progress).to.equal('1234');

    // Few more.
    dep(function() {
      progress += '5';
    });
    dep(function() {
      progress += '6';
    });
    yield getRuntime().whenReady();
    expect(progress).to.equal('123456');
  });

  it('should reuse the same runtime on multiple runs', () => {
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    const runtime1 = getRuntime();
    installRuntime(win);
    expect(getRuntime()).to.equal(runtime1);
  });

  it('handles recursive calls after installation', function* () {
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    let progress = '';
    dep(() => {
      progress += '1';
      dep(() => {
        progress += '2';
        dep(() => {
          progress += '3';
        });
      });
    });
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    expect(progress).to.equal('123');
  });

  it('handles recursive calls before installation', function* () {
    let progress = '';
    dep(() => {
      progress += '1';
      dep(() => {
        progress += '2';
        dep(() => {
          progress += '3';
        });
      });
    });
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    expect(progress).to.equal('123');
  });

  it('should implement all APIs', () => {
    installRuntime(win);
    return new Promise(resolve => {
      dep(resolve);
    }).then(subscriptions => {
      const names = Object.getOwnPropertyNames(Subscriptions.prototype);
      names.forEach(name => {
        if (name == 'constructor') {
          return;
        }
        expect(subscriptions).to.have.property(name);
      });
    });
  });
});


describes.realWin('Runtime', {}, env => {
  let win;
  let runtime;

  beforeEach(() => {
    win = env.win;
    runtime = new Runtime(win);
  });

  describe('startSubscriptionsFlowIfNeeded', () => {
    let startStub;

    beforeEach(() => {
      startStub = sandbox.stub(runtime, 'start');
    });

    it('should default to auto and start', () => {
      runtime.startSubscriptionsFlowIfNeeded();
      expect(startStub).to.be.calledOnce;
    });

    it('should not start when manual', () => {
      const doc = win.document;
      doc.head.appendChild(createElement(doc, 'meta', {
        name: 'subscriptions-control',
        content: 'manual',
      }));
      runtime.startSubscriptionsFlowIfNeeded();
      expect(startStub).to.not.be.called;
    });

    it('should start when auto', () => {
      const doc = win.document;
      doc.head.appendChild(createElement(doc, 'meta', {
        name: 'subscriptions-control',
        content: 'auto',
      }));
      runtime.startSubscriptionsFlowIfNeeded();
      expect(startStub).to.be.calledOnce;
    });
  });

  describe('initialization', () => {
    let config;
    let configPromise;
    let resolveStub;

    beforeEach(() => {
      config = new PageConfig('pub1', true);
      configPromise = Promise.resolve(config);
      resolveStub = sandbox.stub(
          PageConfigResolver.prototype,
          'resolveConfig',
          () => configPromise);
    });

    it('should initialize correctly with config lookup', () => {
      const p = runtime.configured_(true);
      expect(resolveStub).to.be.calledOnce;
      return p.then(cr => {
        expect(resolveStub).to.be.calledOnce;
        expect(cr.pageConfig()).to.equal(config);
      });
    });

    it('should initialize correctly with direct config, unlocked', () => {
      runtime.init('pub2');
      return runtime.configured_(true).then(cr => {
        expect(resolveStub).to.not.be.called;
        expect(cr.pageConfig()).to.not.equal(config);
        expect(cr.pageConfig().getPublicationId()).to.equal('pub2');
        expect(cr.pageConfig().isLocked()).to.be.false;
      });
    });

    it('should not force initialization without commit', () => {
      runtime.configured_(false);
      expect(resolveStub).to.not.be.called;
    });

    it('should initialize only once', () => {
      runtime.configured_(true);
      runtime.configured_(true);
      expect(resolveStub).to.be.calledOnce;
      expect(() => {
        runtime.init('pub2');
      }).to.throw(/already configured/);
    });

    it('should fail when config lookup fails', () => {
      configPromise = Promise.reject('config broken');
      return runtime.configured_(true).then(() => {
        throw new Error('must have failed');
      }, reason => {
        expect(() => {throw reason;}).to.throw(/config broken/);
      });
    });
  });

  describe('configured', () => {
    let config;
    let configureStub;
    let configuredRuntime;
    let configuredRuntimeMock;

    beforeEach(() => {
      config = new PageConfig('pub1');
      configuredRuntime = new ConfiguredRuntime(new GlobalDoc(win), config);
      configuredRuntimeMock = sandbox.mock(configuredRuntime);
      configureStub = sandbox.stub(runtime, 'configured_',
          () => Promise.resolve(configuredRuntime));
    });

    afterEach(() => {
      configuredRuntimeMock.verify();
    });

    it('should should delegate "start"', () => {
      configuredRuntimeMock.expects('start').once();
      return runtime.start().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "getEntitlements"', () => {
      const ents = {};
      configuredRuntimeMock.expects('getEntitlements')
          .returns(Promise.resolve(ents));
      return runtime.getEntitlements().then(value => {
        expect(value).to.equal(ents);
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "reset"', () => {
      configuredRuntimeMock.expects('reset').once();
      return runtime.reset().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "getOffers"', () => {
      configuredRuntimeMock.expects('getOffers').withExactArgs(undefined)
          .once();
      return runtime.getOffers().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "getOffers" with options', () => {
      const opts = {productId: 'abc'};
      configuredRuntimeMock.expects('getOffers').withExactArgs(opts)
          .once();
      return runtime.getOffers(opts).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "showOffers"', () => {
      configuredRuntimeMock.expects('showOffers')
          .withExactArgs(undefined)
          .once();
      return runtime.showOffers().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "showOffers" with options', () => {
      const options = {list: 'other'};
      configuredRuntimeMock.expects('showOffers')
          .withExactArgs(options)
          .once();
      return runtime.showOffers(options).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "showSubscribeOption"', () => {
      configuredRuntimeMock.expects('showSubscribeOption')
          .withExactArgs(undefined)
          .once();
      return runtime.showSubscribeOption().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "showSubscribeOption" with options', () => {
      const options = {list: 'other'};
      configuredRuntimeMock.expects('showSubscribeOption')
          .withExactArgs(options)
          .once();
      return runtime.showSubscribeOption(options).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "showAbbrvOffer"', () => {
      configuredRuntimeMock.expects('showAbbrvOffer')
          .withExactArgs(undefined)
          .once();
      return runtime.showAbbrvOffer().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "showAbbrvOffer" with options', () => {
      const options = {list: 'other'};
      configuredRuntimeMock.expects('showAbbrvOffer')
          .withExactArgs(options)
          .once();
      return runtime.showAbbrvOffer(options).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "subscribe"', () => {
      configuredRuntimeMock.expects('subscribe')
          .withExactArgs('sku1')
          .once();
      return runtime.subscribe('sku1').then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should should delegate "setOnEntitlementsResponse"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnEntitlementsResponse')
          .withExactArgs(callback)
          .once();
      return runtime.setOnEntitlementsResponse(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should should delegate "setOnNativeSubscribeRequest"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnNativeSubscribeRequest')
          .withExactArgs(callback)
          .once();
      return runtime.setOnNativeSubscribeRequest(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should should delegate "setOnSubscribeResponse"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnSubscribeResponse')
          .withExactArgs(callback)
          .once();
      return runtime.setOnSubscribeResponse(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should should delegate "setOnLoginRequest"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnLoginRequest')
          .withExactArgs(callback)
          .once();
      return runtime.setOnLoginRequest(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should should delegate "setOnLinkComplete"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnLinkComplete')
          .withExactArgs(callback)
          .once();
      return runtime.setOnLinkComplete(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should should delegate "setOnFlowStarted"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnFlowStarted')
          .withExactArgs(callback)
          .once();
      return runtime.setOnFlowStarted(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should should delegate "setOnFlowCanceled"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnFlowCanceled')
          .withExactArgs(callback)
          .once();
      return runtime.setOnFlowCanceled(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should use default fetcher', () => {
      const ents = {};
      const xhrFetchStub = sandbox.stub(
          XhrFetcher.prototype,
          'fetchCredentialedJson',
          () => Promise.resolve(ents));
      return runtime.getEntitlements().then(() => {
        expect(xhrFetchStub).to.be.calledOnce;
      });
    });

    it('should override fetcher', () => {
      const ents = {};
      const otherFetcher = new Fetcher();
      const fetchStub = sandbox.stub(
          otherFetcher,
          'fetchCredentialedJson',
          () => Promise.resolve(ents));
      const xhrFetchStub = sandbox.stub(
          XhrFetcher.prototype,
          'fetchCredentialedJson',
          () => Promise.resolve(ents));
      runtime = new ConfiguredRuntime(new GlobalDoc(win), config, {
        fetcher: otherFetcher,
      });
      return runtime.getEntitlements().then(() => {
        expect(fetchStub).to.be.calledOnce;
        expect(xhrFetchStub).to.not.be.called;
      });
    });
  });
});


describes.realWin('ConfiguredRuntime', {}, env => {
  let win;
  let config;
  let runtime;
  let entitlementsManagerMock;
  let dialogManagerMock;
  let activityResultCallbacks;
  let offersApiMock;

  beforeEach(() => {
    win = env.win;
    activityResultCallbacks = {};
    sandbox.stub(ActivityPorts.prototype, 'onResult',
        function(requestId, callback) {
          if (activityResultCallbacks[requestId]) {
            throw new Error('duplicate');
          }
          activityResultCallbacks[requestId] = callback;
        });
    config = new PageConfig('pub1:label1', true);
    runtime = new ConfiguredRuntime(win, config);
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager_);
    dialogManagerMock = sandbox.mock(runtime.dialogManager_);
    offersApiMock = sandbox.mock(runtime.offersApi_);
  });

  afterEach(() => {
    dialogManagerMock.verify();
    entitlementsManagerMock.verify();
    offersApiMock.verify();
  });

  function returnActivity(requestId, code, opt_dataOrError, opt_origin) {
    const activityResult = new ActivityResult(code, opt_dataOrError,
        'POPUP', opt_origin || 'https://example.com', false, false);
    const activityResultPromise = Promise.resolve(activityResult);
    const promise = activityResultCallbacks[requestId]({
      acceptResult() {
        return activityResultPromise;
      },
    });
    return activityResultPromise.then(() => {
      // Skip microtask.
      return promise;
    });
  }

  it('should prefetch payments', () => {
    const el = win.document.head.querySelector(
        'link[rel="preconnect prefetch"][href*="/pay?"]');
    expect(el).to.exist;
    expect(el.getAttribute('href')).to.equal('PAY_ORIGIN/gp/p/ui/pay?_=_');
  });

  it('should should initialize deps', () => {
    expect(runtime.win()).to.equal(win);
    expect(runtime.doc().getWin()).to.equal(win);
    expect(runtime.doc().getRootNode()).to.equal(win.document);
    expect(runtime.pageConfig()).to.equal(config);
    expect(runtime.activities()).to.be.instanceof(ActivityPorts);
    expect(runtime.dialogManager()).to.be.instanceof(DialogManager);
    expect(runtime.dialogManager().doc_).to.equal(runtime.doc());
    expect(runtime.entitlementsManager().blockNextNotification_).to.be.false;
  });

  it('should reset entitlements', () => {
    dialogManagerMock.expects('completeAll').once();
    entitlementsManagerMock.expects('reset').once();
    runtime.reset();
  });

  it('should not start entitlements flow without product', () => {
    sandbox.stub(config, 'getProductId', () => null);
    entitlementsManagerMock.expects('getEntitlements').never();
    const triggerStub = sandbox.stub(runtime.callbacks(),
        'triggerEntitlementsResponse');
    return runtime.start().then(() => {
      expect(triggerStub).to.not.be.called;
    });
  });

  it('should not start entitlements flow for unlocked', () => {
    sandbox.stub(config, 'isLocked', () => false);
    entitlementsManagerMock.expects('getEntitlements').never();
    const triggerStub = sandbox.stub(runtime.callbacks(),
        'triggerEntitlementsResponse');
    return runtime.start().then(() => {
      expect(triggerStub).to.not.be.called;
    });
  });

  it('should start entitlements flow with success', () => {
    const entitlements = new Entitlements(
        'service', 'raw',
        [new Entitlement('', ['product1'], 'token1')],
        'product1',
        () => {});
    entitlementsManagerMock.expects('getEntitlements')
        .withExactArgs()
        .returns(Promise.resolve(entitlements))
        .once();
    return runtime.start();
  });

  it('should start entitlements flow with failure', () => {
    const error = new Error('broken');
    entitlementsManagerMock.expects('getEntitlements')
        .withExactArgs()
        .returns(Promise.reject(error))
        .once();
    return runtime.start();
  });

  it('should call offers API w/o productId', () => {
    const p = Promise.resolve();
    offersApiMock.expects('getOffers')
        .withExactArgs(undefined)
        .returns(p)
        .twice();
    expect(runtime.getOffers()).to.equal(p);
    expect(runtime.getOffers({})).to.equal(p);
  });

  it('should call offers API with productId', () => {
    const p = Promise.resolve();
    offersApiMock.expects('getOffers')
        .withExactArgs('p1')
        .returns(p)
        .once();
    expect(runtime.getOffers({productId: 'p1'})).to.equal(p);
  });

  it('should call "showOffers"', () => {
    let offersFlow;
    sandbox.stub(OffersFlow.prototype, 'start', function() {
      offersFlow = this;
      return new Promise(() => {});
    });
    runtime.showOffers();
    return runtime.documentParsed_.then(() => {
      expect(offersFlow.activityIframeView_.args_['list']).to.equal('default');
    });
  });

  it('should call "showOffers" with options', () => {
    let offersFlow;
    sandbox.stub(OffersFlow.prototype, 'start', function() {
      offersFlow = this;
      return new Promise(() => {});
    });
    runtime.showOffers({list: 'other'});
    return runtime.documentParsed_.then(() => {
      expect(offersFlow.activityIframeView_.args_['list']).to.equal('other');
    });
  });

  it('should call "showAbbrvOffer"', () => {
    let offersFlow;
    sandbox.stub(AbbrvOfferFlow.prototype, 'start', function() {
      offersFlow = this;
      return new Promise(() => {});
    });
    runtime.showAbbrvOffer();
    return runtime.documentParsed_.then(() => {
      expect(offersFlow.options_).to.be.undefined;
    });
  });

  it('should call "showAbbrvOffer" with options', () => {
    let offersFlow;
    sandbox.stub(AbbrvOfferFlow.prototype, 'start', function() {
      offersFlow = this;
      return new Promise(() => {});
    });
    runtime.showAbbrvOffer({list: 'other'});
    return runtime.documentParsed_.then(() => {
      expect(offersFlow.options_).to.deep.equal({list: 'other'});
    });
  });

  it('should call "showSubscribeOption"', () => {
    let offersFlow;
    sandbox.stub(SubscribeOptionFlow.prototype, 'start', function() {
      offersFlow = this;
      return new Promise(() => {});
    });
    runtime.showSubscribeOption();
    return runtime.documentParsed_.then(() => {
      expect(offersFlow.options_).to.be.undefined;
    });
  });

  it('should call "showSubscribeOption" with options', () => {
    let offersFlow;
    sandbox.stub(SubscribeOptionFlow.prototype, 'start', function() {
      offersFlow = this;
      return new Promise(() => {});
    });
    runtime.showSubscribeOption({list: 'other'});
    return runtime.documentParsed_.then(() => {
      expect(offersFlow.options_).to.deep.equal({list: 'other'});
    });
  });

  it('should start LinkbackFlow', () => {
    const startStub = sandbox.stub(
        LinkbackFlow.prototype,
        'start',
        () => Promise.resolve());
    return runtime.linkAccount().then(() => {
      expect(startStub).to.be.calledOnce;
    });
  });

  it('should configure and start LinkCompleteFlow for swg-link', () => {
    expect(activityResultCallbacks['swg-link']).to.exist;
    const startStub = sandbox.stub(
        LinkCompleteFlow.prototype,
        'start',
        () => Promise.resolve());
    return returnActivity('swg-link', ActivityResultCode.OK, {},
        location.origin)
        // Succeeds or fails is not important for this test.
        .catch(() => {})
        .then(() => {
          expect(startStub).to.be.calledOnce;
        });
  });

  it('should start PayStartFlow', () => {
    let flowInstance;
    const startStub = sandbox.stub(
        PayStartFlow.prototype,
        'start',
        function() {
          flowInstance = this;
          return Promise.resolve();
        });
    return runtime.subscribe('sku1').then(() => {
      expect(startStub).to.be.calledOnce;
      expect(flowInstance.sku_).to.equal('sku1');
    });
  });

  it('should configure and start PayCompleteFlow', () => {
    expect(activityResultCallbacks['swg-pay']).to.exist;
    const stub = sandbox.stub(
        runtime.callbacks(),
        'triggerSubscribeResponse');
    return returnActivity('swg-pay', ActivityResultCode.OK)
        // Succeeds or fails is not important for this test.
        .catch(() => {})
        .then(() => {
          expect(stub).to.be.calledOnce;
        });
  });

  describe('callbacks', () => {
    it('should trigger entitlements callback', () => {
      const promise = new Promise(resolve => {
        runtime.setOnEntitlementsResponse(resolve);
      });
      runtime.callbacks().triggerEntitlementsResponse(
          Promise.resolve(new Entitlements('', 'RaW', [], null, () => {})));
      return promise.then(result => {
        expect(result.raw).to.equal('RaW');
      });
    });

    it('should trigger native subscribe request', () => {
      const promise = new Promise(resolve => {
        runtime.setOnNativeSubscribeRequest(resolve);
      });
      runtime.callbacks().triggerSubscribeRequest();
      return promise;
    });

    it('should trigger subscribe response', () => {
      const promise = new Promise(resolve => {
        runtime.setOnSubscribeResponse(resolve);
      });
      runtime.callbacks().triggerSubscribeResponse(Promise.resolve(
          new SubscribeResponse('RaW')));
      return promise.then(result => {
        expect(result.raw).to.equal('RaW');
      });
    });

    it('should trigger login request', () => {
      const promise = new Promise(resolve => {
        runtime.setOnLoginRequest(resolve);
      });
      runtime.callbacks().triggerLoginRequest({linkRequested: true});
      return promise.then(result => {
        expect(result.linkRequested).to.be.true;
      });
    });

    it('should trigger link complete', () => {
      const promise = new Promise(resolve => {
        runtime.setOnLinkComplete(resolve);
      });
      runtime.callbacks().triggerLinkComplete();
      return promise;
    });

    it('should trigger flow started callback', () => {
      const promise = new Promise(resolve => {
        runtime.setOnFlowStarted(resolve);
      });
      runtime.callbacks().triggerFlowStarted('flow1');
      return promise.then(result => {
        expect(result).to.deep.equal({flow: 'flow1'});
      });
    });

    it('should trigger flow canceled callback', () => {
      const promise = new Promise(resolve => {
        runtime.setOnFlowCanceled(resolve);
      });
      runtime.callbacks().triggerFlowCanceled('flow1');
      return promise.then(result => {
        expect(result).to.deep.equal({flow: 'flow1'});
      });
    });
  });
});
