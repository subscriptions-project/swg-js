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
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {
  ConfiguredRuntime,
  Runtime,
  installRuntime,
  getRuntime,
} from './runtime';
import {
  ContributionsFlow,
} from './contributions-flow';
import {DeferredAccountFlow} from './deferred-account-flow';
import {DialogManager} from '../components/dialog-manager';
import {Entitlement, Entitlements} from '../api/entitlements';
import {ExperimentFlags} from './experiment-flags';
import {Fetcher, XhrFetcher} from './fetcher';
import {JsError} from './jserror';
import {GlobalDoc} from '../model/doc';
import {
  LinkCompleteFlow,
  LinkbackFlow,
  LinkSaveFlow,
} from './link-accounts-flow';
import {LoginPromptApi} from './login-prompt-api';
import {LoginNotificationApi} from './login-notification-api';
import {WaitForSubscriptionLookupApi} from './wait-for-subscription-lookup-api';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {
  PayStartFlow,
} from './pay-flow';
import {SubscribeResponse} from '../api/subscribe-response';
import {
  AnalyticsMode,
  ReplaceSkuProrationMode,
  Subscriptions,
  ProductType,
} from '../api/subscriptions';
import {createElement} from '../utils/dom';
import {
  isExperimentOn,
  setExperiment,
  setExperimentsStringForTesting,
} from './experiments';
import {Propensity} from './propensity';
import {ClientEventManager} from './client-event-manager';

const EDGE_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0)' +
    ' AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135' +
    ' Safari/537.36 Edge/12.10136';


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
    let eventManager;

    const event = {
      eventType: AnalyticsEvent.ACTION_OFFER_SELECTED,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    };

    beforeEach(() => {
      config = new PageConfig('pub1', true);
      configPromise = Promise.resolve(config);
      resolveStub = sandbox.stub(
          PageConfigResolver.prototype,
          'resolveConfig',
          () => configPromise);
      eventManager = runtime.eventManager();
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

    it('should propagate construction config', () => {
      sandbox.stub(ConfiguredRuntime.prototype, 'configure', () => {});
      runtime.configure({windowOpenMode: 'redirect'});
      runtime.init('pub2');
      return runtime.configured_(true).then(cr => {
        expect(cr.config().windowOpenMode).to.equal('redirect');
      });
    });

    it('should force redirect mode on Edge', () => {
      Object.defineProperty(win.navigator, 'userAgent', {
        value: EDGE_USER_AGENT,
      });
      sandbox.stub(ConfiguredRuntime.prototype, 'configure', () => {});
      runtime.init('pub2');
      return runtime.configured_(true).then(cr => {
        expect(cr.config().windowOpenMode).to.equal('redirect');
      });
    });

    it('should not return Propensity module when config not available', () => {
      configPromise = Promise.reject('config not available');
      return runtime.getPropensityModule().then(() => {
        throw new Error('must have failed');
      }, reason => {
        expect(() => {throw reason;}).to.throw(/config not available/);
      });
    });

    it('should not let event manager log until config available', function*() {
      let counter1 = 0;
      let counter2 = 0;

      eventManager.registerEventListener(() => counter1++);
      eventManager.logEvent(event);
      expect(counter1).to.equal(0);

      eventManager.registerEventListener(() => counter2++);
      eventManager.logEvent(event);
      expect(counter1).to.equal(0);
      expect(counter2).to.equal(0);

      runtime.configured_(true);

      yield eventManager.lastAction_;
      expect(counter1).to.equal(2);
      expect(counter2).to.equal(2);
    });

    it('should not log when config rejected', function*() {
      configPromise = Promise.reject('config not available');
      let counter1 = 0;

      eventManager.registerEventListener(() => counter1++);
      eventManager.logEvent(event);
      expect(counter1).to.equal(0);
      runtime.configured_(true);

      try {
        yield eventManager.lastAction_;
      } catch (e) {}
      expect(counter1).to.equal(0);
    });
  });

  describe('configured', () => {
    let config;
    let configureStub;
    let configuredRuntime;
    let configuredRuntimeMock;
    let analyticsMock;

    beforeEach(() => {
      config = new PageConfig('pub1');
      configuredRuntime = new ConfiguredRuntime(new GlobalDoc(win), config);
      configuredRuntimeMock = sandbox.mock(configuredRuntime);
      analyticsMock = sandbox.mock(configuredRuntime.analytics());
      configureStub = sandbox.stub(runtime, 'configured_',
          () => Promise.resolve(configuredRuntime));
    });

    afterEach(() => {
      configuredRuntimeMock.verify();
      analyticsMock.verify();
    });

    it('should delegate "configure"', () => {
      configuredRuntimeMock.expects('configure')
          .returns(Promise.resolve(11))
          .once();
      return runtime.configure().then(v => {
        expect(v).to.equal(11);  // Ensure that the result is propagated back.
      });
    });

    it('should delegate "start"', () => {
      configuredRuntimeMock.expects('start').once();
      return runtime.start().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "getEntitlements"', () => {
      const ents = {};
      configuredRuntimeMock.expects('getEntitlements')
          .returns(Promise.resolve(ents));
      return runtime.getEntitlements().then(value => {
        expect(value).to.equal(ents);
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "getEntitlements" with encryptedDocumentKey', () => {
      const ents = {};
      const encryptedDocumentKey = '{\"accessRequirements\": ' +
          '[\"norcal.com:premium\"], \"key\":\"aBcDef781-2-4/sjfdi\"}';
      configuredRuntimeMock.expects('getEntitlements')
          .returns(Promise.resolve(ents));
      return runtime.getEntitlements(encryptedDocumentKey).then(value => {
        expect(value).to.equal(ents);
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "reset"', () => {
      configuredRuntimeMock.expects('reset').once();
      return runtime.reset().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "clear"', () => {
      configuredRuntimeMock.expects('clear').once();
      return runtime.clear().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "getOffers"', () => {
      configuredRuntimeMock.expects('getOffers').withExactArgs(undefined)
          .once();
      return runtime.getOffers().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "getOffers" with options', () => {
      const opts = {productId: 'abc'};
      configuredRuntimeMock.expects('getOffers').withExactArgs(opts)
          .once();
      return runtime.getOffers(opts).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "showOffers"', () => {
      configuredRuntimeMock.expects('showOffers')
          .withExactArgs(undefined)
          .once();
      return runtime.showOffers().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "showOffers" with options', () => {
      const options = {list: 'other'};
      configuredRuntimeMock.expects('showOffers')
          .withExactArgs(options)
          .once();
      return runtime.showOffers(options).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "showSubscribeOption"', () => {
      configuredRuntimeMock.expects('showSubscribeOption')
          .withExactArgs(undefined)
          .once();
      return runtime.showSubscribeOption().then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "showSubscribeOption" with options', () => {
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

    it('should delegate "subscribe"', () => {
      configuredRuntimeMock.expects('subscribe')
          .withExactArgs('sku1')
          .once();
      return runtime.subscribe('sku1').then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(true);
      });
    });

    it('should delegate "completeDeferredAccountCreation"', () => {
      const request = {entitlements: 'ents'};
      const response = {};
      configuredRuntimeMock.expects('completeDeferredAccountCreation').once()
          .withExactArgs(request)
          .returns(Promise.resolve(response))
          .once();
      return runtime.completeDeferredAccountCreation(request)
          .then(result => {
            expect(configureStub).to.be.calledOnce.calledWith(true);
            expect(result).to.equal(response);
          });
    });

    it('should delegate "setOnEntitlementsResponse"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnEntitlementsResponse')
          .withExactArgs(callback)
          .once();
      return runtime.setOnEntitlementsResponse(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should delegate "setOnNativeSubscribeRequest"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnNativeSubscribeRequest')
          .withExactArgs(callback)
          .once();
      return runtime.setOnNativeSubscribeRequest(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should delegate "setOnSubscribeResponse"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnSubscribeResponse')
          .withExactArgs(callback)
          .once();
      return runtime.setOnSubscribeResponse(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should delegate "setOnLoginRequest"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnLoginRequest')
          .withExactArgs(callback)
          .once();
      return runtime.setOnLoginRequest(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should delegate "setOnLinkComplete"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnLinkComplete')
          .withExactArgs(callback)
          .once();
      return runtime.setOnLinkComplete(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should delegate "setOnFlowStarted"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnFlowStarted')
          .withExactArgs(callback)
          .once();
      return runtime.setOnFlowStarted(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should delegate "setOnFlowCanceled"', () => {
      const callback = function() {};
      configuredRuntimeMock.expects('setOnFlowCanceled')
          .withExactArgs(callback)
          .once();
      return runtime.setOnFlowCanceled(callback).then(() => {
        expect(configureStub).to.be.calledOnce.calledWith(false);
      });
    });

    it('should delegate "saveSubscription" with token', () => {
      const requestCallback = () => {
        return {token: 'test'};
      };
      configuredRuntimeMock.expects('saveSubscription').once()
          .withExactArgs(requestCallback).returns(Promise.resolve(true));
      return runtime.saveSubscription(requestCallback)
          .then(value => {
            expect(configureStub).to.be.calledOnce.calledWith(true);
            expect(value).to.be.true;
          });
    });

    it('should delegate "saveSubscription" with authCode', () => {
      const requestPromise = new Promise(resolve => {
        resolve({authCode: 'testCode'});
      });
      const requestCallback = () => requestPromise;
      configuredRuntimeMock.expects('saveSubscription').once()
          .withExactArgs(requestCallback).returns(Promise.resolve(true));
      return runtime.saveSubscription(requestCallback)
          .then(value => {
            expect(configureStub).to.be.calledOnce.calledWith(true);
            expect(value).to.be.true;
          });
    });

    it('should delegate "showLoginPrompt" and call the "start" method', () => {
      configuredRuntimeMock.expects('showLoginPrompt').once()
          .returns(Promise.resolve());

      return runtime.showLoginPrompt().then(() => {
        expect(configureStub).to.be.calledOnce;
      });
    });

    it('should directly call "createButton"', () => {
      const options = {};
      const callback = () => {};
      const button = win.document.createElement('button');
      const stub = sandbox.stub(runtime.buttonApi_, 'create', () => {
        return button;
      });
      const result = runtime.createButton(options, callback);
      expect(result).to.equal(button);
      expect(stub).to.be.calledOnce.calledWithExactly(options, callback);
    });

    it('should delegate "waitForSubscriptionLookup"', () => {
      configuredRuntimeMock.expects('waitForSubscriptionLookup').once()
          .returns(Promise.resolve());

      return runtime.waitForSubscriptionLookup().then(() => {
        expect(configureStub).to.be.calledOnce;
      });
    });

    it('should directly call "attachButton"', () => {
      const options = {};
      const callback = () => {};
      const button = win.document.createElement('button');
      const stub = sandbox.stub(runtime.buttonApi_, 'attach');
      runtime.attachButton(button, options, callback);
      expect(stub).to.be.calledOnce
          .calledWithExactly(button, options, callback);
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

    it('should return propensity module', () => {
      const propensity = new Propensity(win, config,
          configuredRuntime.eventManager());
      configuredRuntimeMock.expects('getPropensityModule')
          .once()
          .returns(propensity);
      return runtime.getPropensityModule()
          .then(propensityModule => {
            expect(configureStub).to.be.calledOnce.calledWith(true);
            expect(propensityModule).to.equal(propensity);
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
  let analyticsMock;
  let jserrorMock;
  let activityResultCallbacks;
  let offersApiMock;
  let redirectErrorHandler;

  beforeEach(() => {
    win = env.win;
    activityResultCallbacks = {};
    redirectErrorHandler = null;
    sandbox.stub(ActivityPorts.prototype, 'onResult',
        function(requestId, callback) {
          if (activityResultCallbacks[requestId]) {
            throw new Error('duplicate');
          }
          activityResultCallbacks[requestId] = callback;
        });
    sandbox.stub(ActivityPorts.prototype, 'onRedirectError',
        function(handler) {
          redirectErrorHandler = handler;
        });
    config = new PageConfig('pub1:label1', true);
    runtime = new ConfiguredRuntime(win, config);
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager_);
    dialogManagerMock = sandbox.mock(runtime.dialogManager_);
    analyticsMock = sandbox.mock(runtime.analytics());
    jserrorMock = sandbox.mock(runtime.jserror());
    offersApiMock = sandbox.mock(runtime.offersApi_);
  });

  afterEach(() => {
    dialogManagerMock.verify();
    analyticsMock.verify();
    jserrorMock.verify();
    entitlementsManagerMock.verify();
    offersApiMock.verify();
    setExperimentsStringForTesting('');
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
      runtime.callbacks().triggerFlowStarted('flow1', {a: 1});
      return promise.then(result => {
        expect(result).to.deep.equal({flow: 'flow1', data: {a: 1}});
      });
    });

    it('should trigger flow canceled callback', () => {
      const promise = new Promise(resolve => {
        runtime.setOnFlowCanceled(resolve);
      });
      runtime.callbacks().triggerFlowCanceled('flow1', {b: 2});
      return promise.then(result => {
        expect(result).to.deep.equal({flow: 'flow1', data: {b: 2}});
      });
    });
  });

  describe('config', () => {
    it('should disallow unknown properties', () => {
      expect(() => {
        runtime.configure({unknown: 1});
      }).to.throw(/Unknown config property/);
    });

    it('should configure windowOpenMode', () => {
      expect(runtime.config().windowOpenMode).to.equal('auto');
      runtime.configure({windowOpenMode: 'redirect'});
      expect(runtime.config().windowOpenMode).to.equal('redirect');
      runtime.configure({windowOpenMode: 'auto'});
      expect(runtime.config().windowOpenMode).to.equal('auto');
    });

    it('should configure analytics mode to track impressions', () => {
      expect(runtime.config().analyticsMode).to.equal(AnalyticsMode.DEFAULT);
      runtime.configure({analyticsMode: AnalyticsMode.IMPRESSIONS});
      expect(runtime.config().analyticsMode).to.equal(
          AnalyticsMode.IMPRESSIONS);
      runtime.configure({analyticsMode: AnalyticsMode.DEFAULT});
      expect(runtime.config().analyticsMode).to.equal(
          AnalyticsMode.DEFAULT);
    });

    it('should disallow unknown windowOpenMode values', () => {
      expect(() => {
        runtime.configure({windowOpenMode: 'unknown'});
      }).to.throw(/Unknown windowOpenMode/);
      // Value is unchanged.
      expect(runtime.config().windowOpenMode).to.equal('auto');
    });

    it('should set experiments', () => {
      runtime.configure({experiments: ['exp1', 'exp2']});
      expect(isExperimentOn(win, 'exp1')).to.be.true;
      expect(isExperimentOn(win, 'exp2')).to.be.true;
      expect(isExperimentOn(win, 'exp3')).to.be.false;
    });

    it('should set experiments after initialization', () => {
      expect(isExperimentOn(win, 'exp1')).to.be.false;
      expect(isExperimentOn(win, 'exp2')).to.be.false;
      expect(isExperimentOn(win, 'exp3')).to.be.false;

      runtime.configure({experiments: ['exp1', 'exp2']});
      expect(isExperimentOn(win, 'exp1')).to.be.true;
      expect(isExperimentOn(win, 'exp2')).to.be.true;
      expect(isExperimentOn(win, 'exp3')).to.be.false;
    });
  });

  it('should prefetch loading indicator', () => {
    const el = win.document.head.querySelector(
        'link[rel="preconnect prefetch"][href*="/loader.svg"]');
    expect(el).to.exist;
    expect(el.getAttribute('href')).to.equal('$assets$/loader.svg');
  });

  it('should prefetch payments', () => {
    const el = win.document.head.querySelector(
        'link[rel="preconnect prefetch"][href*="/pay?"]');
    expect(el).to.exist;
    expect(el.getAttribute('href')).to.equal('PAY_ORIGIN/gp/p/ui/pay?_=_');
  });

  it('should NOT inject button stylesheet', () => {
    const el = win.document.head.querySelector(
        'link[href*="swg-button.css"]');
    expect(el).to.not.exist;
  });

  it('should initialize deps', () => {
    expect(runtime.win()).to.equal(win);
    expect(runtime.doc().getWin()).to.equal(win);
    expect(runtime.doc().getRootNode()).to.equal(win.document);
    expect(runtime.pageConfig()).to.equal(config);
    expect(runtime.activities()).to.be.instanceof(ActivityPorts);
    expect(runtime.dialogManager()).to.be.instanceof(DialogManager);
    expect(runtime.dialogManager().doc_).to.equal(runtime.doc());
    expect(runtime.entitlementsManager().blockNextNotification_).to.be.false;
    expect(runtime.analytics()).to.be.instanceOf(AnalyticsService);
    expect(runtime.jserror()).to.be.instanceOf(JsError);
  });

  it('should report the redirect failure', () => {
    const error = new Error('intentional');
    analyticsMock.expects('addLabels')
        .withExactArgs(['redirect'])
        .once();
    analyticsMock.expects('logEvent')
        .withExactArgs(AnalyticsEvent.EVENT_PAYMENT_FAILED)
        .once();
    jserrorMock.expects('error')
        .withExactArgs('Redirect error', error)
        .once();
    redirectErrorHandler(error);
  });

  it('should reset entitlements', () => {
    dialogManagerMock.expects('completeAll').once();
    entitlementsManagerMock.expects('reset').once();
    runtime.reset();
  });

  it('should clear entitlements', () => {
    dialogManagerMock.expects('completeAll').once();
    entitlementsManagerMock.expects('clear').once();
    runtime.clear();
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
        .withExactArgs(undefined)
        .returns(Promise.resolve(entitlements))
        .once();
    return runtime.start();
  });

  it('should start entitlements flow with failure', () => {
    const error = new Error('broken');
    entitlementsManagerMock.expects('getEntitlements')
        .withExactArgs(undefined)
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

  it('should start "completeDeferredAccountCreation"', () => {
    const ents = {};
    const request = {entitlements: ents};
    const resp = {};
    let flow;
    const startStub = sandbox.stub(
        DeferredAccountFlow.prototype,
        'start',
        function() {
          flow = this;
          return Promise.resolve(resp);
        });
    return runtime.completeDeferredAccountCreation(request).then(result => {
      expect(startStub).to.be.calledOnce.calledWithExactly();
      expect(result).to.equal(resp);
      expect(flow.options_.entitlements).to.equal(ents);
    });
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
      expect(offersFlow.options_).to.deep.equal({});
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

  it('should call "showContributionOptions" with options', () => {
    setExperiment(win, ExperimentFlags.CONTRIBUTIONS, true);
    let contributionFlow;
    sandbox.stub(ContributionsFlow.prototype, 'start', function() {
      contributionFlow = this;
      return new Promise(() => {});
    });
    runtime.showContributionOptions({list: 'other', skus: ['sku1', 'sku2']});
    return runtime.documentParsed_.then(() => {
      expect(contributionFlow.options_).to.deep
          .equal({list: 'other', skus: ['sku1', 'sku2']});
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

  it('should start PayStartFlow for subscription', () => {
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
      expect(flowInstance.subscriptionRequest_.skuId).to.equal('sku1');
      expect(flowInstance.productType_).to.equal(ProductType.SUBSCRIPTION);
    });
  });

  it('should start PayStartFlow for replaceSubscription ' +
  '(no proration mode)', () => {
    setExperiment(win, ExperimentFlags.REPLACE_SUBSCRIPTION, true);
    let flowInstance;
    const startStub = sandbox.stub(
        PayStartFlow.prototype,
        'start',
        function() {
          flowInstance = this;
          return Promise.resolve();
        });
    return runtime.subscribe({skuId: 'newSku', oldSkuId: 'oldSku'}).then(() => {
      expect(startStub).to.be.calledOnce;
      expect(flowInstance.subscriptionRequest_.skuId).to.equal('newSku');
      expect(flowInstance.subscriptionRequest_.oldSkuId).to.equal('oldSku');
      expect(flowInstance.subscriptionRequest_.ReplaceSkuProrationMode)
          .to.be.undefined;
    });
  });

  it('should start PayStartFlow for replaceSubscription', () => {
    setExperiment(win, ExperimentFlags.REPLACE_SUBSCRIPTION, true);
    let flowInstance;
    const startStub = sandbox.stub(
        PayStartFlow.prototype,
        'start',
        function() {
          flowInstance = this;
          return Promise.resolve();
        });
    return runtime.subscribe({skuId: 'newSku', oldSkuId: 'oldSku',
      replaceSkuProrationMode: ReplaceSkuProrationMode
          .IMMEDIATE_WITH_TIME_PRORATION}).then(() => {
            expect(startStub).to.be.calledOnce;
            expect(flowInstance.subscriptionRequest_.skuId).to.equal(
                'newSku');
            expect(flowInstance.subscriptionRequest_.oldSkuId).to.equal(
                'oldSku');
            expect(flowInstance.subscriptionRequest_
                .replaceSkuProrationMode).to.equal(
                ReplaceSkuProrationMode.IMMEDIATE_WITH_TIME_PRORATION);
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

  it('should start PayStartFlow for contribution', () => {
    setExperiment(win, ExperimentFlags.CONTRIBUTIONS, true);
    let flowInstance;
    const startStub = sandbox.stub(
        PayStartFlow.prototype,
        'start',
        function() {
          flowInstance = this;
          return Promise.resolve();
        });
    return runtime.contribute('sku1').then(() => {
      expect(startStub).to.be.calledOnce;
      expect(flowInstance.subscriptionRequest_.skuId).to.equal('sku1');
      expect(flowInstance.productType_).to.equal(ProductType.UI_CONTRIBUTION);
    });
  });

  it('should start saveSubscriptionFlow with callback for token', () => {
    let linkSaveFlow;
    const newPromise = new Promise(() => {});
    sandbox.stub(LinkSaveFlow.prototype, 'start', function() {
      linkSaveFlow = this;
      return newPromise;
    });
    const requestPromise = new Promise(resolve => {
      resolve({token: 'test'});
    });
    const resultPromise = runtime.saveSubscription(() => requestPromise);
    return runtime.documentParsed_.then(() => {
      expect(linkSaveFlow.callback_()).to.equal.requestPromise;
      return linkSaveFlow.callback_().then(request => {
        expect(request).to.deep.equal({token: 'test'});
      });
    });
    expect(resultPromise).to.deep.equal(newPromise);
  });

  it('should start saveSubscriptionFlow with callback for authcode', () => {
    let linkSaveFlow;
    const newPromise = new Promise(() => {});
    sandbox.stub(LinkSaveFlow.prototype, 'start', function() {
      linkSaveFlow = this;
      return newPromise;
    });
    runtime.saveSubscription(() => {
      return {authCode: 'testCode'};
    });
    return runtime.documentParsed_.then(() => {
      expect(linkSaveFlow.callback_()).to.deep.equal({authCode: 'testCode'});
    });
  });

  it('should start LoginPromptApi', () => {
    const startStub = sandbox.stub(
        LoginPromptApi.prototype,
        'start',
        () => Promise.resolve());
    return runtime.showLoginPrompt().then(() => {
      expect(startStub).to.be.calledOnce;
    });
  });

  it('should start LoginNotificationApi', () => {
    const startStub = sandbox.stub(
        LoginNotificationApi.prototype,
        'start',
        () => Promise.resolve());
    return runtime.showLoginNotification().then(() => {
      expect(startStub).to.be.calledOnce;
    });
  });

  it('should directly call "createButton"', () => {
    const options = {};
    const callback = () => {};
    const button = win.document.createElement('button');
    const stub = sandbox.stub(runtime.buttonApi_, 'create', () => {
      return button;
    });
    const result = runtime.createButton(options, callback);
    expect(result).to.equal(button);
    expect(stub).to.be.calledOnce.calledWithExactly(options, callback);
  });

  it('should start WaitForSubscriptionLookupApi', () => {
    const accountResult = 'account result';
    const accountPromise = Promise.resolve(accountResult);
    const startSpy = sandbox.spy(
        WaitForSubscriptionLookupApi.prototype,
        'start');
    return runtime.waitForSubscriptionLookup(accountPromise).then(
        result => {
          expect(startSpy).to.be.calledOnce;
          expect(result).to.equal(accountResult);
        });
  });

  it('should directly call "attachButton"', () => {
    const options = {};
    const callback = () => {};
    const button = win.document.createElement('button');
    const stub = sandbox.stub(runtime.buttonApi_, 'attach');
    runtime.attachButton(button, options, callback);
    expect(stub).to.be.calledOnce
        .calledWithExactly(button, options, callback);
  });

  it('should invoke propensity APIs', () => {
    const propensityResponse = {
      header: {ok: true},
      body: {result: 42},
    };
    const sendSubscriptionStateStub = sandbox.stub(
        Propensity.prototype,
        'sendSubscriptionState');
    const eventStub = sandbox.stub(
        Propensity.prototype,
        'sendEvent');
    const getPropensityStub = sandbox.stub(
        Propensity.prototype,
        'getPropensity',
        () => Promise.resolve(propensityResponse));
    return runtime.getPropensityModule().then(propensity => {
      expect(propensity).to.not.be.null;
      propensity.sendSubscriptionState('unknown');
      const event = {
        name: 'ad_shown',
        active: false,
        data: {
          campaign: 'fall',
        },
      };
      propensity.sendEvent(event);
      expect(sendSubscriptionStateStub).to.be.calledWithExactly('unknown');
      expect(eventStub).to.be.calledWithExactly(event);
      return propensity.getPropensity().then(score => {
        expect(score).to.not.be.null;
        expect(score.header).to.not.be.null;
        expect(score.header.ok).to.be.true;
        expect(score.body).to.not.be.null;
        expect(score.body.result).to.equal(42);
        expect(getPropensityStub).to.be.calledOnce;
      });
    });
  });

  it('should return events manager', () => {
    expect(runtime.eventManager() instanceof ClientEventManager).to.be.true;
  });
});
