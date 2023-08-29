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

import * as entitlementsManager from './entitlements-manager';
import {AbbrvOfferFlow, OffersFlow, SubscribeOptionFlow} from './offers-flow';
import {ActivityPorts} from '../components/activities';
import {
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {
  AnalyticsMode,
  ProductType,
  ReplaceSkuProrationMode,
  ShowcaseEvent,
} from '../api/subscriptions';
import {AnalyticsService} from './analytics-service';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {
  ConfiguredRuntime,
  Runtime,
  getRuntime,
  installRuntime,
} from './runtime';
import {ContributionsFlow} from './contributions-flow';
import {DeferredAccountFlow} from './deferred-account-flow';
import {DialogManager} from '../components/dialog-manager';
import {Entitlement, Entitlements} from '../api/entitlements';
import {Event} from '../api/logger-api';
import {GlobalDoc} from '../model/doc';
import {JsError} from './jserror';
import {
  LinkCompleteFlow,
  LinkSaveFlow,
  LinkbackFlow,
} from './link-accounts-flow';
import {Logger} from './logger';
import {LoginNotificationApi} from './login-notification-api';
import {LoginPromptApi} from './login-prompt-api';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {PayClient} from './pay-client';
import {PayStartFlow} from './pay-flow';
import {Propensity} from './propensity';
import {SubscribeResponse} from '../api/subscribe-response';
import {SubscriptionLinkingFlow} from './subscription-linking-flow';
import {WaitForSubscriptionLookupApi} from './wait-for-subscription-lookup-api';
import {XhrFetcher} from './fetcher';
import {analyticsEventToGoogleAnalyticsEvent} from './event-type-mapping';
import {createElement} from '../utils/dom';
import {isExperimentOn, setExperimentsStringForTesting} from './experiments';
import {parseUrl} from '../utils/url';
import {tick} from '../../test/tick';

describes.realWin('installRuntime', (env) => {
  let win;

  beforeEach(() => {
    // Mock console.warn method.
    sandbox.stub(self.console, 'warn');

    win = env.win;
  });

  afterEach(() => {
    self.console.warn.restore();
  });

  function dep(callback) {
    (win.SWG = win.SWG || []).push(callback);
  }

  it('chains and executes dependencies in order', async () => {
    // Before runtime is installed.
    let progress = '';
    dep(() => {
      progress += '1';
    });
    dep(() => {
      progress += '2';
    });
    expect(progress).to.equal('');

    // Install runtime and schedule few more dependencies.
    installRuntime(win);
    dep(() => {
      progress += '3';
    });
    dep(() => {
      progress += '4';
    });
    await tick();
    expect(progress).to.equal('1234');

    // Few more.
    dep(() => {
      progress += '5';
    });
    dep(() => {
      progress += '6';
    });
    await tick();
    expect(progress).to.equal('123456');
  });

  it('reuses the same runtime on multiple runs', () => {
    installRuntime(win);
    const runtime1 = getRuntime();
    installRuntime(win);
    expect(getRuntime()).to.equal(runtime1);
  });

  it('handles recursive calls after installation', async () => {
    installRuntime(win);

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

    await tick(2);
    expect(progress).to.equal('123');
  });

  it('handles recursive calls before installation', async () => {
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

    installRuntime(win);

    await tick(2);
    expect(progress).to.equal('123');
  });

  it('RuntimeReadyEvent logged from callWhenRuntimeIsReady', async () => {
    // Sending RuntimeReadyEvent is blocked until runtime has been configured.
    const config = new PageConfig('pub1', true);
    const configPromise = Promise.resolve(config);
    const resolveStub = sandbox
      .stub(PageConfigResolver.prototype, 'resolveConfig')
      .callsFake(() => configPromise);
    let progress = '';
    dep(() => {
      progress += '1';
    });

    installRuntime(win);

    await tick();
    expect(resolveStub).to.be.calledOnce;
    expect(progress).to.equal('1');
  });
});

describes.realWin('Runtime', (env) => {
  let win;
  let runtime;
  let loggedEvents = [];

  beforeEach(() => {
    win = env.win;
    runtime = new Runtime(win);
    loggedEvents = [];
    sandbox
      .stub(ClientEventManager.prototype, 'logEvent')
      .callsFake((event) => loggedEvents.push(event));
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
      doc.head.appendChild(
        createElement(doc, 'meta', {
          name: 'subscriptions-control',
          content: 'manual',
        })
      );
      runtime.startSubscriptionsFlowIfNeeded();
      expect(startStub).to.not.be.called;
    });

    it('should start when auto', () => {
      const doc = win.document;
      doc.head.appendChild(
        createElement(doc, 'meta', {
          name: 'subscriptions-control',
          content: 'auto',
        })
      );
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
      resolveStub = sandbox
        .stub(PageConfigResolver.prototype, 'resolveConfig')
        .callsFake(() => configPromise);
    });

    it('should initialize correctly with config lookup', async () => {
      const p = runtime.configured_(true);
      expect(resolveStub).to.be.calledOnce;

      const cr = await p;
      expect(resolveStub).to.be.calledOnce;
      expect(cr.pageConfig()).to.equal(config);
    });

    it('should initialize correctly with direct config, unlocked', async () => {
      runtime.init('pub2');

      const cr = await runtime.configured_(true);
      expect(resolveStub).to.not.be.called;
      expect(cr.pageConfig()).to.not.equal(config);
      expect(cr.pageConfig().getPublicationId()).to.equal('pub2');
      expect(cr.pageConfig().isLocked()).to.be.false;
    });

    it('should allow `configured_(false)` calls to resolve', async () => {
      runtime.init('pub3');

      // This should resolve.
      await runtime.configured_(false);
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

    it('should log init error to server', async () => {
      const configuredRuntime = await runtime.configured_(true);
      const jserror = sandbox.mock(configuredRuntime.jserror());
      jserror.expects('error').once();
      expect(() => {
        runtime.init('pub2');
      }).to.throw(/already configured/);
      await runtime.configured_(false);
      jserror.verify();
    });

    it('should fail when config lookup fails', async () => {
      configPromise = Promise.reject('config broken');

      await expect(runtime.configured_(true)).to.be.rejectedWith(
        /config broken/
      );
    });

    it('should propagate construction config', async () => {
      sandbox
        .stub(ConfiguredRuntime.prototype, 'configure')
        .callsFake(() => {});
      runtime.configure({windowOpenMode: 'redirect'});
      runtime.init('pub2');

      const cr = await runtime.configured_(true);
      expect(cr.config().windowOpenMode).to.equal('redirect');
    });

    it('should not return Propensity module when config not available', async () => {
      configPromise = Promise.reject('config not available');

      await expect(runtime.getPropensityModule()).to.be.rejectedWith(
        'config not available'
      );
    });

    it('should return a working logger', async () => {
      const logger = await runtime.getLogger();
      logger.sendEvent({
        name: Event.IMPRESSION_PAYWALL,
        active: null,
        data: null,
      });
      expect(loggedEvents.length).to.equal(2);
      const payEvent =
        loggedEvents[0].eventType === AnalyticsEvent.IMPRESSION_PAYWALL
          ? loggedEvents[0]
          : loggedEvents[1];
      const startEvent =
        loggedEvents[0].eventType === AnalyticsEvent.IMPRESSION_PAGE_LOAD
          ? loggedEvents[0]
          : loggedEvents[1];
      expect(payEvent).to.deep.equal({
        eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
        eventOriginator: EventOriginator.PUBLISHER_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
      expect(startEvent).to.deep.equal({
        eventType: AnalyticsEvent.IMPRESSION_PAGE_LOAD,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
      });
      expect(logger).to.be.instanceOf(Logger);
    });

    it('sets up analytics', async () => {
      runtime.init('pub2');
      const configuredRuntime = await runtime.configured_(true);
      const analytics = configuredRuntime.analytics();
      expect(analytics.readyForLogging_).to.be.true;
    });

    it('sets article endpoint on by default', async () => {
      runtime = new Runtime(win);
      const configuredRuntime = await runtime.configured_(true);
      const entitlementsManager = configuredRuntime.entitlementsManager();
      expect(entitlementsManager.useArticleEndpoint_).to.be.true;
    });

    it('sets useArticleEndpoint from config', async () => {
      runtime.configure({useArticleEndpoint: false});
      runtime.init('pub2');
      const configuredRuntime = await runtime.configured_(true);
      const entitlementsManager = configuredRuntime.entitlementsManager();
      expect(entitlementsManager.useArticleEndpoint_).to.be.false;
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
      configureStub = sandbox
        .stub(runtime, 'configured_')
        .callsFake(() => Promise.resolve(configuredRuntime));
    });

    afterEach(() => {
      configuredRuntimeMock.verify();
      analyticsMock.verify();
    });

    it('should delegate "configure"', async () => {
      configuredRuntimeMock.expects('configure').resolves(11).once();

      const v = await runtime.configure();
      expect(v).to.equal(11); // Ensure that the result is propagated back.
    });

    it('should delegate "start"', async () => {
      configuredRuntimeMock.expects('start').once();

      await runtime.start();
      expect(configureStub).to.be.calledWith(true);
    });

    it('should delegate "getEntitlements"', async () => {
      const ents = {};
      configuredRuntimeMock.expects('getEntitlements').resolves(ents);

      const value = await runtime.getEntitlements();
      expect(value).to.equal(ents);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "getEntitlements" with encryptedDocumentKey', async () => {
      const ents = {};
      const encryptedDocumentKey =
        '{"accessRequirements": ' +
        '["norcal.com:premium"], "key":"aBcDef781-2-4/sjfdi"}';
      configuredRuntimeMock.expects('getEntitlements').resolves(ents);

      const value = await runtime.getEntitlements({
        encryption: {encryptedDocumentKey},
      });
      expect(value).to.equal(ents);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "reset"', async () => {
      configuredRuntimeMock.expects('reset').once();

      await runtime.reset();
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "clear"', async () => {
      configuredRuntimeMock.expects('clear').once();

      await runtime.clear();
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "getOffers"', async () => {
      configuredRuntimeMock
        .expects('getOffers')
        .withExactArgs(undefined)
        .once();

      await runtime.getOffers();
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "getOffers" with options', async () => {
      const opts = {productId: 'abc'};
      configuredRuntimeMock.expects('getOffers').withExactArgs(opts).once();

      await runtime.getOffers(opts);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "showOffers"', async () => {
      configuredRuntimeMock
        .expects('showOffers')
        .withExactArgs(undefined)
        .once();

      await runtime.showOffers();
      expect(configureStub).to.be.calledWith(true);
    });

    it('should delegate "showOffers" with options', async () => {
      const options = {list: 'other'};
      configuredRuntimeMock.expects('showOffers').withExactArgs(options).once();

      await runtime.showOffers(options);
      expect(configureStub).to.be.calledWith(true);
    });

    it('should delegate "showUpdateOffers"', async () => {
      configuredRuntimeMock
        .expects('showUpdateOffers')
        .withExactArgs(undefined)
        .once();

      await runtime.showUpdateOffers();
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "showUpdateOffers" with options', async () => {
      const options = {list: 'other'};
      configuredRuntimeMock
        .expects('showUpdateOffers')
        .withExactArgs(options)
        .once();

      await runtime.showUpdateOffers(options);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "showSubscribeOption"', async () => {
      configuredRuntimeMock
        .expects('showSubscribeOption')
        .withExactArgs(undefined)
        .once();

      await runtime.showSubscribeOption();
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "showSubscribeOption" with options', async () => {
      const options = {list: 'other'};
      configuredRuntimeMock
        .expects('showSubscribeOption')
        .withExactArgs(options)
        .once();

      await runtime.showSubscribeOption(options);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "showAbbrvOffer"', async () => {
      configuredRuntimeMock
        .expects('showAbbrvOffer')
        .withExactArgs(undefined)
        .once();

      await runtime.showAbbrvOffer();
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "showAbbrvOffer" with options', async () => {
      const options = {list: 'other'};
      configuredRuntimeMock
        .expects('showAbbrvOffer')
        .withExactArgs(options)
        .once();

      await runtime.showAbbrvOffer(options);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "showContributionOptions"', async () => {
      configuredRuntimeMock
        .expects('showContributionOptions')
        .withExactArgs(undefined)
        .once();

      await runtime.showContributionOptions();
      expect(configureStub).to.be.calledWith(true);
    });

    it('should delegate "subscribe"', async () => {
      configuredRuntimeMock.expects('subscribe').withExactArgs('sku1').once();

      await runtime.subscribe('sku1');
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "updateSubscription"', async () => {
      configuredRuntimeMock
        .expects('updateSubscription')
        .withExactArgs({skuId: 'sku1', oldSku: 'sku2'})
        .once();

      await runtime.updateSubscription({skuId: 'sku1', oldSku: 'sku2'});
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "setOnContributionResponse"', async () => {
      const callback = sandbox.fake();
      configuredRuntimeMock
        .expects('setOnContributionResponse')
        .withExactArgs(callback)
        .once();

      await runtime.setOnContributionResponse(callback);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "setOnPaymentResponse"', async () => {
      const request = {};
      configuredRuntimeMock
        .expects('setOnPaymentResponse')
        .withExactArgs(request)
        .once();

      await runtime.setOnPaymentResponse(request);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "contribute"', async () => {
      const request = {};
      configuredRuntimeMock.expects('contribute').withExactArgs(request).once();

      await runtime.contribute(request);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "linkAccount"', async () => {
      const params = {};
      configuredRuntimeMock.expects('linkAccount').withExactArgs(params).once();

      await runtime.linkAccount(params);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "showLoginNotification"', async () => {
      configuredRuntimeMock
        .expects('showLoginNotification')
        .withExactArgs()
        .once();

      await runtime.showLoginNotification();
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "attachSmartButton"', async () => {
      const args = [{}, {}, () => {}];
      configuredRuntimeMock
        .expects('attachSmartButton')
        .withExactArgs(...args)
        .once();

      await runtime.attachSmartButton(...args);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "getEventManager"', async () => {
      configuredRuntimeMock.expects('getEventManager').withExactArgs().once();

      await runtime.getEventManager();
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "completeDeferredAccountCreation"', async () => {
      const request = {entitlements: 'ents'};
      const response = {};
      configuredRuntimeMock
        .expects('completeDeferredAccountCreation')
        .once()
        .withExactArgs(request)
        .resolves(response)
        .once();

      const result = await runtime.completeDeferredAccountCreation(request);
      expect(configureStub).to.be.calledOnce.calledWith(true);
      expect(result).to.equal(response);
    });

    it('should delegate "setOnEntitlementsResponse"', async () => {
      const callback = () => {};
      configuredRuntimeMock
        .expects('setOnEntitlementsResponse')
        .withExactArgs(callback)
        .once();

      await runtime.setOnEntitlementsResponse(callback);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "setOnNativeSubscribeRequest"', async () => {
      const callback = () => {};
      configuredRuntimeMock
        .expects('setOnNativeSubscribeRequest')
        .withExactArgs(callback)
        .once();

      await runtime.setOnNativeSubscribeRequest(callback);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "setOnSubscribeResponse"', async () => {
      const callback = () => {};
      configuredRuntimeMock
        .expects('setOnSubscribeResponse')
        .withExactArgs(callback)
        .once();

      await runtime.setOnSubscribeResponse(callback);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "setOnLoginRequest"', async () => {
      const callback = () => {};
      configuredRuntimeMock
        .expects('setOnLoginRequest')
        .withExactArgs(callback)
        .once();

      await runtime.setOnLoginRequest(callback);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should trigger "triggerLoginRequest"', async () => {
      const request = {linkRequested: false};
      configuredRuntimeMock
        .expects('triggerLoginRequest')
        .withExactArgs(request)
        .once();

      await runtime.triggerLoginRequest(request);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "setOnLinkComplete"', async () => {
      const callback = () => {};
      configuredRuntimeMock
        .expects('setOnLinkComplete')
        .withExactArgs(callback)
        .once();

      await runtime.setOnLinkComplete(callback);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "setOnFlowStarted"', async () => {
      const callback = () => {};
      configuredRuntimeMock
        .expects('setOnFlowStarted')
        .withExactArgs(callback)
        .once();

      await runtime.setOnFlowStarted(callback);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "setOnFlowCanceled"', async () => {
      const callback = () => {};
      configuredRuntimeMock
        .expects('setOnFlowCanceled')
        .withExactArgs(callback)
        .once();

      await runtime.setOnFlowCanceled(callback);
      expect(configureStub).to.be.calledOnce.calledWith(false);
    });

    it('should delegate "saveSubscription" with token', async () => {
      const requestCallback = () => ({token: 'test'});
      configuredRuntimeMock
        .expects('saveSubscription')
        .once()
        .withExactArgs(requestCallback)
        .resolves(true);

      const value = await runtime.saveSubscription(requestCallback);
      expect(configureStub).to.be.calledOnce.calledWith(true);
      expect(value).to.be.true;
    });

    it('should delegate "saveSubscription" with authCode', async () => {
      const requestPromise = new Promise((resolve) => {
        resolve({authCode: 'testCode'});
      });
      const requestCallback = () => requestPromise;
      configuredRuntimeMock
        .expects('saveSubscription')
        .once()
        .withExactArgs(requestCallback)
        .resolves(true);

      const value = await runtime.saveSubscription(requestCallback);
      expect(configureStub).to.be.calledOnce.calledWith(true);
      expect(value).to.be.true;
    });

    it('should delegate "showLoginPrompt" and call the "start" method', async () => {
      configuredRuntimeMock.expects('showLoginPrompt').once().resolves();

      await runtime.showLoginPrompt();
      expect(configureStub).to.be.calledOnce;
    });

    it('should directly call "createButton"', async () => {
      const options = {};
      const callback = () => {};
      const button = win.document.createElement('button');
      const stub = sandbox
        .stub(runtime.buttonApi_, 'create')
        .callsFake(() => button);
      const result = runtime.createButton(options, callback);
      expect(result).to.equal(button);
      expect(stub).to.be.calledOnce.calledWithExactly(options, callback);
    });

    it('should delegate "waitForSubscriptionLookup"', async () => {
      configuredRuntimeMock
        .expects('waitForSubscriptionLookup')
        .once()
        .resolves();

      await runtime.waitForSubscriptionLookup();
      expect(configureStub).to.be.calledOnce;
    });

    it('delegates linkSubscription', async () => {
      const mockResult = {success: true};
      configuredRuntimeMock
        .expects('linkSubscription')
        .once()
        .resolves(mockResult);

      const result = await runtime.linkSubscription({});

      expect(result).to.deep.equal(mockResult);
    });

    it('should directly call "attachButton"', () => {
      const options = {};
      const callback = () => {};
      const button = win.document.createElement('button');
      const stub = sandbox.stub(runtime.buttonApi_, 'attach');
      runtime.attachButton(button, options, callback);
      expect(stub).to.be.calledOnce.calledWithExactly(
        button,
        options,
        callback
      );
    });

    it('should use default fetcher', async () => {
      const ents = {};
      const xhrFetchStub = sandbox
        .stub(XhrFetcher.prototype, 'fetchCredentialedJson')
        .callsFake(() => Promise.resolve(ents));

      await runtime.getEntitlements();
      expect(xhrFetchStub).to.be.called;
    });

    it('should override fetcher', async () => {
      const ents = {};
      const otherFetcher = new XhrFetcher(env.win);
      const fetchStub = sandbox
        .stub(otherFetcher, 'fetchCredentialedJson')
        .callsFake(() => Promise.resolve(ents));
      const xhrFetchStub = sandbox.stub(
        XhrFetcher.prototype,
        'fetchCredentialedJson'
      );
      runtime = new ConfiguredRuntime(new GlobalDoc(win), config, {
        fetcher: otherFetcher,
      });

      await runtime.getEntitlements();
      expect(fetchStub).to.be.called;
      expect(xhrFetchStub).to.not.be.called;
    });

    it('should return propensity module', async () => {
      const propensity = new Propensity(
        win,
        configuredRuntime,
        new XhrFetcher(env.win)
      );
      configuredRuntimeMock
        .expects('getPropensityModule')
        .once()
        .returns(propensity);

      const propensityModule = await runtime.getPropensityModule();
      expect(configureStub).to.be.calledOnce.calledWith(true);
      expect(propensityModule).to.equal(propensity);
    });

    it('should delegate "setShowcaseEntitlement"', async () => {
      const entitlement = {
        entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION,
        isUserRegistered: true,
        subscriptionTimestamp: 1602763094,
      };
      configuredRuntimeMock
        .expects('setShowcaseEntitlement')
        .withExactArgs(entitlement)
        .once();

      await runtime.setShowcaseEntitlement(entitlement);
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should delegate "consumeShowcaseEntitlementJwt"', async () => {
      const showcaseEntitlementJwt = 'jw7';
      const callbackSpy = sandbox.spy();
      configuredRuntimeMock
        .expects('consumeShowcaseEntitlementJwt')
        .withExactArgs(showcaseEntitlementJwt, callbackSpy)
        .once();

      await runtime.consumeShowcaseEntitlementJwt(
        showcaseEntitlementJwt,
        callbackSpy
      );
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });

    it('should not call showBestAudienceAction', () => {
      expect(() => runtime.showBestAudienceAction()).to.not.throw();
    });

    it('should delegate "setPublisherProvidedId"', async () => {
      configuredRuntimeMock
        .expects('setPublisherProvidedId')
        .withExactArgs('publisherProvidedId')
        .once();

      await runtime.setPublisherProvidedId('publisherProvidedId');
      expect(configureStub).to.be.calledOnce.calledWith(true);
    });
  });
});

describes.realWin('ConfiguredRuntime', (env) => {
  let win;
  let config;
  let runtime;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig('pub1:label1', true);
  });

  it('should allow experiments to be set in config', () => {
    expect(
      () =>
        new ConfiguredRuntime(win, config, null, {
          experiments: ['a'],
        })
    ).to.not.throw();
  });

  it('should allow skipAccountCreationScreen to be set in config', () => {
    expect(
      () =>
        new ConfiguredRuntime(win, config, null, {
          skipAccountCreationScreen: true,
        })
    ).to.not.throw();
  });

  it('should throw if skipAccountCreationScreen set but not boolean', () => {
    expect(
      () =>
        new ConfiguredRuntime(win, config, null, {
          skipAccountCreationScreen: 1,
        })
    ).to.throw();
  });

  it('should allow enablePropensity to be set in config', () => {
    expect(
      () =>
        new ConfiguredRuntime(win, config, null, {
          enablePropensity: true,
        })
    ).to.not.throw();
  });

  it('should throw if enablePropensity set but not boolean', () => {
    expect(
      () =>
        new ConfiguredRuntime(win, config, null, {
          enablePropensity: 1,
        })
    ).to.throw();
  });

  it('should allow enableSwgAnalytics to be set in config', () => {
    expect(
      () =>
        new ConfiguredRuntime(win, config, null, {
          enableSwgAnalytics: true,
        })
    ).to.not.throw();
  });

  it('should throw if enableSwgAnalytics set but not boolean', () => {
    expect(
      () =>
        new ConfiguredRuntime(win, config, null, {
          enableSwgAnalytics: 1,
        })
    ).to.throw();
  });

  it('should pass enableDefaultMeteringHandler into EntitlementsManager during constuction and default to false', () => {
    const entitlementsManagerSpy = sandbox.spy(
      entitlementsManager,
      'EntitlementsManager'
    );
    runtime = new ConfiguredRuntime(win, config);

    expect(entitlementsManagerSpy.getCall(0).args[5]).to.be.false;

    runtime = new ConfiguredRuntime(win, config, {
      enableDefaultMeteringHandler: true,
    });

    expect(entitlementsManagerSpy.getCall(1).args[5]).to.be.true;
  });

  describe('while configuring', () => {
    let resolveConfig;
    let rejectConfig;
    let eventManager;
    let configPromise;
    let winMock;

    const event = {
      eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: true,
      additionalParameters: null,
    };

    beforeEach(() => {
      win = Object.assign({}, env.win, {
        ga: () => {},
      });
      winMock = sandbox.mock(win);
      configPromise = new Promise((resolve, reject) => {
        resolveConfig = resolve;
        rejectConfig = reject;
      });
      runtime = new ConfiguredRuntime(win, config, {configPromise});
      eventManager = runtime.eventManager();
    });

    afterEach(() => {
      winMock.verify();
    });

    it('holds events until config resolved', async () => {
      eventManager.logEvent(event);

      //register after declaring the event, then resolve the promise
      //ensure you got the event even though you sent it before registering
      let eventCount = 0;
      eventManager.registerEventListener(() => eventCount++);
      resolveConfig();

      await configPromise;
      await tick(1);

      expect(eventCount).to.equal(2);
    });

    it('should not log when config rejected', async () => {
      let eventCount = 0;

      eventManager.registerEventListener(() => eventCount++);
      eventManager.logEvent(event);
      expect(eventCount).to.equal(0);
      rejectConfig();

      await expect(configPromise).to.be.rejected;

      expect(eventCount).to.equal(0);
    });

    it('should not set up Google Analytics event listener when not enabled', async () => {
      expect(runtime.googleAnalyticsEventListener_).to.be.undefined;
      winMock.expects('ga').never();
      runtime.eventManager().logEvent({
        eventType: AnalyticsEvent.IMPRESSION_OFFERS,
        eventOriginator: EventOriginator.SWG_CLIENT,
      });
      resolveConfig();
      await configPromise;
      await runtime.eventManager().lastAction_;
    });

    it('should set up Google Analytics event listener and listen to events on startup when told to', async () => {
      runtime = new ConfiguredRuntime(win, config, {
        configPromise,
        enableGoogleAnalytics: true,
      });
      expect(runtime.googleAnalyticsEventListener_.constructor.name).equals(
        'GoogleAnalyticsEventListener'
      );
      winMock
        .expects('ga')
        .withExactArgs(
          'send',
          'event',
          analyticsEventToGoogleAnalyticsEvent(AnalyticsEvent.IMPRESSION_OFFERS)
        )
        .once();
      resolveConfig();
      await configPromise;
      runtime.eventManager().logEvent({
        eventType: AnalyticsEvent.IMPRESSION_OFFERS,
        eventOriginator: EventOriginator.SWG_CLIENT,
      });
      await runtime.eventManager().lastAction_;
    });
  });

  describe('configured', () => {
    let runtime;
    let entitlementsManagerMock;
    let dialogManagerMock;
    let analyticsMock;
    let jserrorMock;
    let activityResultCallbacks;
    let offersApiMock;
    let redirectErrorHandler;
    let eventManagerMock;
    let clientConfigManagerMock;

    beforeEach(() => {
      activityResultCallbacks = {};
      redirectErrorHandler = null;
      sandbox
        .stub(ActivityPorts.prototype, 'onResult')
        .callsFake((requestId, callback) => {
          if (!activityResultCallbacks[requestId]) {
            activityResultCallbacks[requestId] = callback;
          }
        });
      sandbox
        .stub(ActivityPorts.prototype, 'onRedirectError')
        .callsFake((handler) => {
          redirectErrorHandler = handler;
        });
      runtime = new ConfiguredRuntime(win, config);
      entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager_);
      dialogManagerMock = sandbox.mock(runtime.dialogManager_);
      analyticsMock = sandbox.mock(runtime.analytics());
      jserrorMock = sandbox.mock(runtime.jserror());
      offersApiMock = sandbox.mock(runtime.offersApi_);
      eventManagerMock = sandbox.mock(runtime.eventManager());
      clientConfigManagerMock = sandbox.mock(runtime.clientConfigManager());
    });

    afterEach(() => {
      dialogManagerMock.verify();
      analyticsMock.verify();
      jserrorMock.verify();
      entitlementsManagerMock.verify();
      offersApiMock.verify();
      eventManagerMock.verify();
      clientConfigManagerMock.verify();
      setExperimentsStringForTesting('');
    });

    async function returnActivity(requestId, code, dataOrError, origin) {
      const activityResult = new ActivityResult(
        code,
        dataOrError,
        'POPUP',
        origin || 'https://example.com',
        false,
        false
      );
      const activityResultPromise = Promise.resolve(activityResult);
      const promise = activityResultCallbacks[requestId]({
        acceptResult() {
          return activityResultPromise;
        },
      });
      await activityResultPromise;
      // Skip microtask.
      return promise;
    }

    describe('callbacks', () => {
      it('should trigger entitlements callback', async () => {
        const promise = new Promise((resolve) => {
          runtime.setOnEntitlementsResponse(resolve);
        });
        runtime
          .callbacks()
          .triggerEntitlementsResponse(
            Promise.resolve(new Entitlements('', 'RaW', [], null, () => {}))
          );

        const result = await promise;
        expect(result.raw).to.equal('RaW');
      });

      it('should trigger native subscribe request', async () => {
        const promise = new Promise((resolve) => {
          runtime.setOnNativeSubscribeRequest(resolve);
        });
        runtime.callbacks().triggerSubscribeRequest();
        await promise;
      });

      it('should trigger subscribe response', async () => {
        const promise = new Promise((resolve) => {
          runtime.setOnSubscribeResponse(resolve);
        });
        runtime
          .callbacks()
          .triggerPaymentResponse(
            Promise.resolve(new SubscribeResponse('RaW'))
          );

        const result = await promise;
        expect(result.raw).to.equal('RaW');
      });

      it('should trigger login request', async () => {
        const promise = new Promise((resolve) => {
          runtime.setOnLoginRequest(resolve);
        });
        runtime.callbacks().triggerLoginRequest({linkRequested: true});

        const result = await promise;
        expect(result.linkRequested).to.be.true;
      });

      it('should trigger link complete', async () => {
        const promise = new Promise((resolve) => {
          runtime.setOnLinkComplete(resolve);
        });
        runtime.callbacks().triggerLinkComplete();
        await promise;
      });

      it('should trigger flow started callback', async () => {
        const promise = new Promise((resolve) => {
          runtime.setOnFlowStarted(resolve);
        });
        runtime.callbacks().triggerFlowStarted('flow1', {a: 1});

        const result = await promise;
        expect(result).to.deep.equal({flow: 'flow1', data: {a: 1}});
      });

      it('should trigger flow canceled callback', async () => {
        const promise = new Promise((resolve) => {
          runtime.setOnFlowCanceled(resolve);
        });
        runtime.callbacks().triggerFlowCanceled('flow1', {b: 2});

        const result = await promise;
        expect(result).to.deep.equal({flow: 'flow1', data: {b: 2}});
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
          AnalyticsMode.IMPRESSIONS
        );
        runtime.configure({analyticsMode: AnalyticsMode.DEFAULT});
        expect(runtime.config().analyticsMode).to.equal(AnalyticsMode.DEFAULT);
      });

      it('throws on unknown analytics modes', () => {
        const mistake = () => runtime.configure({analyticsMode: -1});
        expect(mistake).to.throw('Unknown analytics mode');
      });

      it('should disallow unknown windowOpenMode values', () => {
        expect(() => {
          runtime.configure({windowOpenMode: 'unknown'});
        }).to.throw(/Unknown windowOpenMode/);
        // Value is unchanged.
        expect(runtime.config().windowOpenMode).to.equal('auto');
      });

      it('should set experiments', () => {
        const arr = ['exp1', 'exp2'];
        analyticsMock.expects('addLabels').withExactArgs(arr).once();
        runtime.configure({experiments: arr});
        expect(isExperimentOn(win, 'exp1')).to.be.true;
        expect(isExperimentOn(win, 'exp2')).to.be.true;
        expect(isExperimentOn(win, 'exp3')).to.be.false;
      });

      it('should set experiments after initialization', () => {
        const arr = ['exp1', 'exp2'];
        expect(isExperimentOn(win, 'exp1')).to.be.false;
        expect(isExperimentOn(win, 'exp2')).to.be.false;
        expect(isExperimentOn(win, 'exp3')).to.be.false;

        analyticsMock.expects('addLabels').withExactArgs(arr).once();
        runtime.configure({experiments: arr});
        expect(isExperimentOn(win, 'exp1')).to.be.true;
        expect(isExperimentOn(win, 'exp2')).to.be.true;
        expect(isExperimentOn(win, 'exp3')).to.be.false;
      });

      it('throws when the publisherProvidedId value is not a string', () => {
        expect(() => {
          runtime.configure({publisherProvidedId: 1});
        }).to.throw(/publisherProvidedId must be a string, value: 1/);
        expect(() => {
          runtime.configure({publisherProvidedId: ''});
        }).to.throw(/publisherProvidedId must be a string, value: /);
      });

      it('throws on unknown enableSwgAnalytics value', () => {
        const mistake = () => runtime.configure({enableSwgAnalytics: 'true'});
        expect(mistake).to.throw(
          'enableSwgAnalytics must be a boolean, type: string'
        );
      });

      it('throws on unknown enablePropensity value', () => {
        const mistake = () => runtime.configure({enablePropensity: 'true'});
        expect(mistake).to.throw(
          'enablePropensity must be a boolean, type: string'
        );
      });

      it('throws on unknown skipAccountCreationScreen value', () => {
        const mistake = () =>
          runtime.configure({skipAccountCreationScreen: 'true'});
        expect(mistake).to.throw(
          'skipAccountCreationScreen must be a boolean, type: string'
        );
      });

      it('throws on unknown useArticleEndpoint value', () => {
        const mistake = () => runtime.configure({useArticleEndpoint: 'true'});
        expect(mistake).to.throw(
          'useArticleEndpoint must be a boolean, type: string'
        );
      });
    });

    it('should prefetch loading indicator', () => {
      const el = win.document.head.querySelector(
        'link[rel="preconnect prefetch"][href*="/loader.svg"]'
      );
      expect(el).to.exist;
      expect(el.getAttribute('href')).to.equal('/assets/loader.svg');
    });

    it('should preconnect to google domains', () => {
      const gstatic = win.document.head.querySelector(
        'link[rel="preconnect"][href*="gstatic"]'
      );
      const goog = win.document.head.querySelector(
        'link[rel="preconnect"][href*="google.com"]'
      );
      expect(gstatic).to.exist;
      expect(goog).to.exist;
      expect(gstatic.getAttribute('href')).to.equal('https://www.gstatic.com/');
      expect(goog.getAttribute('href')).to.equal('https://www.google.com/');
    });

    it('should NOT inject button stylesheet', () => {
      const el = win.document.head.querySelector(
        'link[href*="swg-button.css"]'
      );
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
      expect(runtime.payClient()).to.be.instanceOf(PayClient);
      expect(runtime.clientConfigManager()).to.be.instanceOf(
        ClientConfigManager
      );
    });

    it('should report the redirect failure', () => {
      const error = new Error('intentional');
      analyticsMock.expects('addLabels').withExactArgs(['redirect']).once();
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(AnalyticsEvent.EVENT_PAYMENT_FAILED, false)
        .once();
      jserrorMock
        .expects('error')
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

    it('should close all dialogs', () => {
      dialogManagerMock.expects('completeAll').once();
      runtime.closeDialog();
    });

    describe('start', () => {
      it('does not start entitlements flow without product', async () => {
        sandbox.stub(config, 'getProductId').callsFake(() => null);
        entitlementsManagerMock.expects('getEntitlements').never();
        const triggerStub = sandbox.stub(
          runtime.callbacks(),
          'triggerEntitlementsResponse'
        );

        await runtime.start();
        expect(triggerStub).to.not.be.called;
      });

      it('does not start entitlements flow for unlocked', async () => {
        sandbox.stub(config, 'isLocked').callsFake(() => false);
        entitlementsManagerMock.expects('getEntitlements').never();
        const triggerStub = sandbox.stub(
          runtime.callbacks(),
          'triggerEntitlementsResponse'
        );

        await runtime.start();
        expect(triggerStub).to.not.be.called;
      });

      it('(optionally) sends publisher provided ID', async () => {
        entitlementsManagerMock
          .expects('getEntitlements')
          .withExactArgs({publisherProvidedId: 'publisherProvidedId'})
          .resolves({clone: () => null})
          .once();

        await runtime.setPublisherProvidedId('publisherProvidedId');
        await runtime.getEntitlements({publisherProvidedId: true});
      });

      describe('getEntitlements', () => {
        it('starts entitlements flow and fetches client config', async () => {
          const entitlements = new Entitlements(
            'service',
            'raw',
            [],
            'product1',
            () => {}
          );

          entitlementsManagerMock
            .expects('getEntitlements')
            .withExactArgs(undefined)
            .resolves(entitlements)
            .once();

          clientConfigManagerMock
            .expects('fetchClientConfig')
            .callsFake(async (readyPromise) => {
              const promiseValue = await readyPromise;
              expect(promiseValue).to.equal(entitlements);
            })
            .once();

          await runtime.getEntitlements();
        });
      });
    });

    describe('Entitlements Success', () => {
      let entitlements;

      afterEach(async () => {
        entitlementsManagerMock
          .expects('getEntitlements')
          .withExactArgs(undefined)
          .resolves(
            new Entitlements(
              'service',
              'raw',
              entitlements,
              'product1',
              () => {}
            )
          )
          .once();
        await runtime.start();
      });

      it('works for 1 entitlement', async () => {
        entitlements = [
          new Entitlement('google', ['product1'], '{"productId":"token1"}'),
        ];
        analyticsMock.expects('setSku').withExactArgs('token1').once();
      });

      it('works for multiple entitlement', async () => {
        entitlements = [
          new Entitlement('google', ['product1'], '{"productId":"token1"}'),
          new Entitlement('google', ['product2'], '{"productId":"token2"}'),
          new Entitlement('google', ['product3'], '{"productId":"token3"}'),
        ];
        analyticsMock
          .expects('setSku')
          .withExactArgs('token1,token2,token3')
          .once();
      });

      it('works for no entitlements', async () => {
        entitlements = [];
        analyticsMock.expects('setSku').never();
      });

      it('kind of works for non-JSON entitlement', async () => {
        entitlements = [new Entitlement('', ['product1'], 'token1')];
        analyticsMock
          .expects('setSku')
          .withExactArgs('unknown subscriptionToken')
          .once();
      });

      it('missing product ID in SwG entitlement', async () => {
        entitlements = [new Entitlement('google', ['product1'], 'token1')];
        analyticsMock
          .expects('setSku')
          .withExactArgs('unknown subscriptionToken')
          .once();
      });
    });

    it('should start entitlements flow with failure', async () => {
      const error = new Error('broken');
      entitlementsManagerMock
        .expects('getEntitlements')
        .withExactArgs(undefined)
        .rejects(error)
        .once();
      await runtime.start();
    });

    it('should call offers API w/o productId', () => {
      const p = Promise.resolve();
      offersApiMock
        .expects('getOffers')
        .withExactArgs(undefined)
        .returns(p)
        .twice();
      expect(runtime.getOffers()).to.equal(p);
      expect(runtime.getOffers({})).to.equal(p);
    });

    it('should call offers API with productId', () => {
      const p = Promise.resolve();
      offersApiMock.expects('getOffers').withExactArgs('p1').returns(p).once();
      expect(runtime.getOffers({productId: 'p1'})).to.equal(p);
    });

    it('should start "completeDeferredAccountCreation"', async () => {
      const ents = {};
      const request = {entitlements: ents};
      const resp = {};
      let flow;
      const startStub = sandbox
        .stub(DeferredAccountFlow.prototype, 'start')
        .callsFake(function () {
          flow = this;
          return Promise.resolve(resp);
        });

      const result = await runtime.completeDeferredAccountCreation(request);
      expect(startStub).to.be.calledOnce.calledWithExactly();
      expect(result).to.equal(resp);
      expect(flow.options_.entitlements).to.equal(ents);
    });

    it('should start "completeDeferredAccountCreation" with missing param', async () => {
      const ents = null;
      const resp = {};
      let flow;
      const startStub = sandbox
        .stub(DeferredAccountFlow.prototype, 'start')
        .callsFake(function () {
          flow = this;
          return Promise.resolve(resp);
        });

      const result = await runtime.completeDeferredAccountCreation();
      expect(startStub).to.be.calledOnce.calledWithExactly();
      expect(result).to.equal(resp);
      expect(flow.options_.entitlements).to.equal(ents);
    });

    it('should call "showOffers"', async () => {
      let offersFlow;
      sandbox.stub(OffersFlow.prototype, 'start').callsFake(function () {
        offersFlow = this;
        return new Promise(() => {});
      });
      runtime.showOffers();

      await runtime.documentParsed_;
      const activityIframeView = await offersFlow.activityIframeViewPromise_;
      expect(activityIframeView.args_['list']).to.equal('default');
    });

    it('should call "showOffers" with options', async () => {
      let offersFlow;
      sandbox.stub(OffersFlow.prototype, 'start').callsFake(function () {
        offersFlow = this;
        return new Promise(() => {});
      });
      runtime.showOffers({list: 'other'});

      await runtime.documentParsed_;
      const activityIframeView = await offersFlow.activityIframeViewPromise_;
      expect(activityIframeView.args_['list']).to.equal('other');
    });

    it('should throw an error if showOffers is used with an oldSku', async () => {
      await expect(
        runtime.showOffers({skuId: 'newSku', oldSku: 'oldSku'})
      ).to.be.rejectedWith(
        'The showOffers() method cannot be used to update \
a subscription. Use the showUpdateOffers() method instead.'
      );
    });

    it('should call "showUpdateOffers"', async () => {
      await expect(runtime.showUpdateOffers()).to.be.rejectedWith(
        'The showUpdateOffers() method cannot be used for \
new subscribers. Use the showOffers() method instead.'
      );
    });

    it('should call "showUpdateOffers" with options', async () => {
      let offersFlow;
      sandbox.stub(OffersFlow.prototype, 'start').callsFake(function () {
        offersFlow = this;
        return new Promise(() => {});
      });
      runtime.showUpdateOffers({oldSku: 'other', skus: ['sku1', 'sku2']});

      await runtime.documentParsed_;
      const activityIframeView = await offersFlow.activityIframeViewPromise_;
      expect(activityIframeView.args_['list']).to.equal('default');
    });

    it('should throw an error if showUpdateOffers is used without an oldSku', async () => {
      await expect(
        runtime.showUpdateOffers({skuId: 'newSku'})
      ).to.be.rejectedWith(
        'The showUpdateOffers() method cannot be used for \
new subscribers. Use the showOffers() method instead.'
      );
    });

    it('should call "showAbbrvOffer"', async () => {
      let offersFlow;
      sandbox.stub(AbbrvOfferFlow.prototype, 'start').callsFake(function () {
        offersFlow = this;
        return new Promise(() => {});
      });
      runtime.showAbbrvOffer();

      await runtime.documentParsed_;
      expect(offersFlow.options_).to.deep.equal({});
    });

    it('should call "showAbbrvOffer" with options', async () => {
      let offersFlow;
      sandbox.stub(AbbrvOfferFlow.prototype, 'start').callsFake(function () {
        offersFlow = this;
        return new Promise(() => {});
      });
      runtime.showAbbrvOffer({list: 'other'});

      await runtime.documentParsed_;
      expect(offersFlow.options_).to.deep.equal({list: 'other'});
    });

    it('should call "showSubscribeOption"', async () => {
      let offersFlow;
      sandbox
        .stub(SubscribeOptionFlow.prototype, 'start')
        .callsFake(function () {
          offersFlow = this;
          return new Promise(() => {});
        });
      runtime.showSubscribeOption();

      await runtime.documentParsed_;
      expect(offersFlow.options_).to.be.undefined;
    });

    it('should call "showSubscribeOption" with options', async () => {
      let offersFlow;
      sandbox
        .stub(SubscribeOptionFlow.prototype, 'start')
        .callsFake(function () {
          offersFlow = this;
          return new Promise(() => {});
        });
      runtime.showSubscribeOption({list: 'other'});

      await runtime.documentParsed_;
      expect(offersFlow.options_).to.deep.equal({list: 'other'});
    });

    it('should call "showContributionOptions" with options', async () => {
      let contributionFlow;
      sandbox.stub(ContributionsFlow.prototype, 'start').callsFake(function () {
        contributionFlow = this;
        return new Promise(() => {});
      });
      runtime.showContributionOptions({list: 'other', skus: ['sku1', 'sku2']});

      await runtime.documentParsed_;
      expect(contributionFlow.options_).to.deep.equal({
        list: 'other',
        skus: ['sku1', 'sku2'],
      });
    });

    it('should start LinkbackFlow', async () => {
      const startStub = sandbox
        .stub(LinkbackFlow.prototype, 'start')
        .callsFake(() => Promise.resolve());

      await runtime.linkAccount();
      expect(startStub).to.be.calledOnce;
    });

    it('should start LinkbackFlow with ampReaderId', async () => {
      const startStub = sandbox
        .stub(LinkbackFlow.prototype, 'start')
        .callsFake((params) => {
          expect(params.ampReaderId).to.equal('ari1');
          return Promise.resolve();
        });

      await runtime.linkAccount({ampReaderId: 'ari1'});
      expect(startStub).to.be.calledOnce;
    });

    it('should configure and start LinkCompleteFlow for swg-link', async () => {
      expect(activityResultCallbacks['swg-link']).to.exist;
      const startStub = sandbox
        .stub(LinkCompleteFlow.prototype, 'start')
        .callsFake(() => Promise.resolve());
      await returnActivity(
        'swg-link',
        ActivityResultCode.OK,
        {},
        'https://news.google.com'
      );
      expect(startStub).to.be.calledOnce;
    });

    it('should start PayStartFlow for subscription', async () => {
      let flowInstance;
      const startStub = sandbox
        .stub(PayStartFlow.prototype, 'start')
        .callsFake(function () {
          flowInstance = this;
          return Promise.resolve();
        });

      await runtime.subscribe('sku1');
      expect(startStub).to.be.calledOnce;
      expect(flowInstance.subscriptionRequest_.skuId).to.equal('sku1');
      expect(flowInstance.productType_).to.equal(ProductType.SUBSCRIPTION);
    });

    it('throws if subscribe() is used to replace a subscription', async () => {
      await expect(
        runtime.subscribe({skuId: 'newSku', oldSku: 'oldSku'})
      ).to.eventually.be.rejectedWith(
        'The subscribe() method can only take a \
sku as its parameter; for subscription updates please use the \
updateSubscription() method'
      );
    });

    it('throws if updateSubscription is used to initiate a new subscription', async () => {
      await expect(
        runtime.updateSubscription({skuId: 'newSku'})
      ).to.eventually.be.rejectedWith(
        'The updateSubscription() method should \
be used for subscription updates; for new subscriptions please use the \
subscribe() method'
      );
    });

    it(
      'should start PayStartFlow for replaceSubscription ' +
        '(no proration mode)',
      async () => {
        let flowInstance;
        const startStub = sandbox
          .stub(PayStartFlow.prototype, 'start')
          .callsFake(function () {
            flowInstance = this;
            return Promise.resolve();
          });

        await runtime.updateSubscription({skuId: 'newSku', oldSku: 'oldSku'});
        expect(startStub).to.be.calledOnce;
        expect(flowInstance.subscriptionRequest_.skuId).to.equal('newSku');
        expect(flowInstance.subscriptionRequest_.oldSku).to.equal('oldSku');
        expect(flowInstance.subscriptionRequest_.ReplaceSkuProrationMode).to.be
          .undefined;
      }
    );

    it('should start PayStartFlow for replaceSubscription', async () => {
      let flowInstance;
      const startStub = sandbox
        .stub(PayStartFlow.prototype, 'start')
        .callsFake(function () {
          flowInstance = this;
          return Promise.resolve();
        });

      await runtime.updateSubscription({
        skuId: 'newSku',
        oldSku: 'oldSku',
        replaceSkuProrationMode:
          ReplaceSkuProrationMode.IMMEDIATE_WITH_TIME_PRORATION,
      });
      expect(startStub).to.be.calledOnce;
      expect(flowInstance.subscriptionRequest_.skuId).to.equal('newSku');
      expect(flowInstance.subscriptionRequest_.oldSku).to.equal('oldSku');
      expect(
        flowInstance.subscriptionRequest_.replaceSkuProrationMode
      ).to.equal(ReplaceSkuProrationMode.IMMEDIATE_WITH_TIME_PRORATION);
    });

    it('should register PayClient response callback', async () => {
      expect(runtime.payClient().responseCallback_).to.not.be.null;
    });

    it('should start PayStartFlow for contribution', async () => {
      let flowInstance;
      const startStub = sandbox
        .stub(PayStartFlow.prototype, 'start')
        .callsFake(function () {
          flowInstance = this;
          return Promise.resolve();
        });

      await runtime.contribute('sku1');
      expect(startStub).to.be.calledOnce;
      expect(flowInstance.subscriptionRequest_.skuId).to.equal('sku1');
      expect(flowInstance.productType_).to.equal(ProductType.UI_CONTRIBUTION);
    });

    it('should start PayStartFlow for contribution with object param', async () => {
      let flowInstance;
      const startStub = sandbox
        .stub(PayStartFlow.prototype, 'start')
        .callsFake(function () {
          flowInstance = this;
          return Promise.resolve();
        });

      await runtime.contribute({skuId: 'sku1'});
      expect(startStub).to.be.calledOnce;
      expect(flowInstance.subscriptionRequest_.skuId).to.equal('sku1');
      expect(flowInstance.productType_).to.equal(ProductType.UI_CONTRIBUTION);
    });

    describe('saveSubscription', () => {
      it('starts LinkSaveFlow with callback for token', async () => {
        let linkSaveFlow;
        const newPromise = new Promise(() => {});
        sandbox.stub(LinkSaveFlow.prototype, 'start').callsFake(function () {
          linkSaveFlow = this;
          return newPromise;
        });
        const requestPromise = new Promise((resolve) => {
          resolve({token: 'test'});
        });
        runtime.saveSubscription(() => requestPromise);

        await runtime.documentParsed_;
        expect(linkSaveFlow.callback_()).to.equal(requestPromise);

        const request = await linkSaveFlow.callback_();
        expect(request).to.deep.equal({token: 'test'});
      });

      it('starts LinkSaveFlow with callback for authcode', async () => {
        let linkSaveFlow;
        const newPromise = new Promise(() => {});
        sandbox.stub(LinkSaveFlow.prototype, 'start').callsFake(function () {
          linkSaveFlow = this;
          return newPromise;
        });
        runtime.saveSubscription(() => ({authCode: 'testCode'}));

        await runtime.documentParsed_;
        expect(linkSaveFlow.callback_()).to.deep.equal({authCode: 'testCode'});
      });

      it('returns promise with result of LinkSaveFlow start()', async () => {
        sandbox.stub(LinkSaveFlow.prototype, 'start').resolves(true);
        const requestPromise = new Promise((resolve) => {
          resolve({token: 'test'});
        });
        const result = await runtime.saveSubscription(() => requestPromise);
        expect(result).to.equal(true);
      });
    });

    it('should start LoginPromptApi', async () => {
      const startStub = sandbox
        .stub(LoginPromptApi.prototype, 'start')
        .callsFake(() => Promise.resolve());

      await runtime.showLoginPrompt();
      expect(startStub).to.be.calledOnce;
    });

    it('should start LoginNotificationApi', async () => {
      const startStub = sandbox
        .stub(LoginNotificationApi.prototype, 'start')
        .callsFake(() => Promise.resolve());

      await runtime.showLoginNotification();
      expect(startStub).to.be.calledOnce;
    });

    it('should directly call "createButton"', async () => {
      const options = {};
      const callback = () => {};
      const button = win.document.createElement('button');
      const stub = sandbox
        .stub(runtime.buttonApi_, 'create')
        .callsFake(() => button);
      const result = runtime.createButton(options, callback);
      expect(result).to.equal(button);
      expect(stub).to.be.calledOnce.calledWithExactly(options, callback);
    });

    it('should start WaitForSubscriptionLookupApi', async () => {
      const accountResult = 'account result';
      const accountPromise = Promise.resolve(accountResult);
      const startSpy = sandbox.spy(
        WaitForSubscriptionLookupApi.prototype,
        'start'
      );

      const result = await runtime.waitForSubscriptionLookup(accountPromise);
      expect(startSpy).to.be.calledOnce;
      expect(result).to.equal(accountResult);
    });

    it('should directly call "attachButton"', () => {
      const options = {};
      const callback = () => {};
      const button = win.document.createElement('button');
      const stub = sandbox.stub(runtime.buttonApi_, 'attach');
      runtime.attachButton(button, options, callback);
      expect(stub).to.be.calledOnce.calledWithExactly(
        button,
        options,
        callback
      );
    });

    it('should invoke propensity APIs', async () => {
      const propensityResponse = {
        header: {ok: true},
        body: {result: 42},
      };
      const sendSubscriptionStateStub = sandbox.stub(
        Propensity.prototype,
        'sendSubscriptionState'
      );
      const eventStub = sandbox.stub(Propensity.prototype, 'sendEvent');
      const getPropensityStub = sandbox
        .stub(Propensity.prototype, 'getPropensity')
        .callsFake(() => Promise.resolve(propensityResponse));

      const propensity = await runtime.getPropensityModule();
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

      const score = await propensity.getPropensity();
      expect(score).to.not.be.null;
      expect(score.header).to.not.be.null;
      expect(score.header.ok).to.be.true;
      expect(score.body).to.not.be.null;
      expect(score.body.result).to.equal(42);
      expect(getPropensityStub).to.be.calledOnce;
    });

    it('should return events manager', () => {
      expect(runtime.eventManager() instanceof ClientEventManager).to.be.true;
    });

    it('should return events manager promise', async () => {
      const eventManager = await runtime.getEventManager();
      expect(eventManager instanceof ClientEventManager).to.be.true;
    });

    it('should let event manager send events without a promise', () => {
      const event = {
        eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: true,
        additionalParameters: null,
      };

      let count = 0;
      sandbox
        .stub(ClientEventManager.prototype, 'logEvent')
        .callsFake(() => count++);
      runtime.eventManager().logEvent(event);
      expect(count).to.equal(1);
    });

    it('should create a working logger', async () => {
      let receivedEvent = null;
      sandbox
        .stub(ClientEventManager.prototype, 'logEvent')
        .callsFake((event) => (receivedEvent = event));

      const logger = await runtime.getLogger();
      logger.sendEvent({
        name: Event.IMPRESSION_PAYWALL,
        active: null,
        data: null,
      });

      expect(receivedEvent).to.deep.equal({
        eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
        eventOriginator: EventOriginator.PUBLISHER_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
      expect(logger).to.be.instanceOf(Logger);
    });

    it('should log to EventManager on createButton click.', async () => {
      let count = 0;
      sandbox
        .stub(ClientEventManager.prototype, 'logSwgEvent')
        .withArgs(AnalyticsEvent.ACTION_SWG_BUTTON_CLICK, true)
        .callsFake(() => count++);

      const button = runtime.createButton();
      await button.click();
      expect(count).to.equal(1);
    });

    it('should return the last OffersFlow', async () => {
      // Show subscription offers first in order to get an OffersFlow
      runtime.showOffers();

      expect(runtime.getLastOffersFlow()).to.equal(runtime.lastOffersFlow_);
    });

    it('should return the last OffersFlow', async () => {
      // Show contribution offers first in order to get a ContributionsFlow
      runtime.showContributionOptions();

      expect(runtime.getLastContributionsFlow()).to.equal(
        runtime.lastContributionsFlow_
      );
    });

    it('attaches smart button', async () => {
      const stub = sandbox.stub(runtime.buttonApi_, 'attachSmartButton');

      const args = [1, 2, 3];
      runtime.attachSmartButton(...args);
      expect(stub).to.be.calledWithExactly(runtime, ...args);
    });

    it('sets response for contribution', async () => {
      const stub = sandbox.stub(
        runtime.callbacks_,
        'setOnContributionResponse'
      );

      const callback = sandbox.fake();
      runtime.setOnContributionResponse(callback);
      expect(stub).to.be.calledWithExactly(callback);
    });

    it('sets response for payment', async () => {
      const stub = sandbox.stub(runtime.callbacks_, 'setOnPaymentResponse');

      const callback = sandbox.fake();
      runtime.setOnPaymentResponse(callback);
      expect(stub).to.be.calledWithExactly(callback);
    });

    it('triggers login request', async () => {
      const stub = sandbox.stub(runtime.callbacks_, 'triggerLoginRequest');

      const request = {};
      runtime.triggerLoginRequest(request);
      expect(stub).to.be.calledWithExactly(request);
    });

    it('should set the publisherProvidedId', async () => {
      runtime.setPublisherProvidedId('publisherProvidedId');

      expect(runtime.publisherProvidedId_).to.equal('publisherProvidedId');
    });

    describe('setShowcaseEntitlement', () => {
      const SECURE_PUB_URL = 'https://www.publisher.com';
      const UNSECURE_PUB_URL = 'http://www.publisher.com';
      const GAA_QUERY_STRING = '?gaa_at=gaa&gaa_n=n&gaa_sig=sig&gaa_ts=99999';
      const GAA_NA_QUERY_STRING = '?gaa_at=na&gaa_n=n&gaa_sig=sig&gaa_ts=99999';
      let logEventStub;
      let win;

      beforeEach(() => {
        // Detects when events are logged.
        logEventStub = sandbox.stub(ClientEventManager.prototype, 'logEvent');

        // Returns custom window objects.
        win = {
          location: parseUrl(SECURE_PUB_URL + GAA_QUERY_STRING),
        };
        sandbox.stub(runtime, 'win').callsFake(() => win);

        // Allows GAA query param checks to pass.
        sandbox.useFakeTimers();
      });

      it('should log unlock by meter events', () => {
        runtime.setShowcaseEntitlement({
          entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_METER,
          isUserRegistered: true,
          subscriptionTimestamp: null,
        });

        expect(logEventStub).callCount(2);
      });

      it('should log unlock by subscription events', () => {
        runtime.setShowcaseEntitlement({
          entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION,
          isUserRegistered: true,
          subscriptionTimestamp: 1602763094,
        });

        expect(logEventStub).callCount(1);
      });

      it('should require entitlement', () => {
        runtime.setShowcaseEntitlement({
          entitlement: undefined,
          isUserRegistered: true,
          subscriptionTimestamp: null,
        });

        expect(logEventStub).callCount(0);
      });

      it('should require GAA params', () => {
        // This location has no GAA params.
        win.location = parseUrl(SECURE_PUB_URL);

        runtime.setShowcaseEntitlement({
          entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_METER,
          isUserRegistered: true,
          subscriptionTimestamp: null,
        });

        expect(logEventStub).callCount(0);
      });

      it('allows URLs with `gaa_at=na`', () => {
        // This URL has `gaa_at=na`.
        // This means Showcase entitlements are disabled for this URL.
        // The publisher might still want to track outcomes though,
        // which helps them measure the relative effectiveness of
        // Showcase in creating positive outcomes.
        win.location = parseUrl(SECURE_PUB_URL + GAA_NA_QUERY_STRING);

        runtime.setShowcaseEntitlement({
          entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_FREE_PAGE,
          isUserRegistered: true,
          subscriptionTimestamp: null,
        });

        expect(logEventStub).callCount(1);
      });

      it('should require https page', () => {
        // This page is http.
        win.location = parseUrl(UNSECURE_PUB_URL + GAA_QUERY_STRING);

        runtime.setShowcaseEntitlement({
          entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_METER,
          isUserRegistered: true,
          subscriptionTimestamp: null,
        });

        expect(logEventStub).callCount(0);
      });
    });

    describe('consumeShowcaseEntitlementJwt', () => {
      it('consumes entitlement and calls callback', () => {
        const SHOWCASE_ENTITLEMENT_JWT = 'jw7';

        const consumeStub = sandbox
          .stub(Entitlements.prototype, 'consume')
          .callsFake((callback) => callback() && Promise.resolve());
        const callbackSpy = sandbox.spy();

        runtime.consumeShowcaseEntitlementJwt(
          SHOWCASE_ENTITLEMENT_JWT,
          callbackSpy
        );
        expect(consumeStub).to.be.calledOnce;
        expect(callbackSpy).to.be.calledOnce;
      });
    });

    describe('showBestAudienceAction', () => {
      it('not implemented', () => {
        expect(() => runtime.showBestAudienceAction()).to.not.throw();
      });
    });

    describe('linkSubscription', () => {
      it('starts SubscriptionLinkingFlow', async () => {
        const request = {publisherPovidedId: 'foo'};
        const mockResult = {success: true};
        const start = sandbox
          .stub(SubscriptionLinkingFlow.prototype, 'start')
          .returns(mockResult);

        const result = await runtime.linkSubscription(request);

        expect(start).to.be.calledOnceWith(request);
        expect(result).to.deep.equal(mockResult);
      });
    });
  });
});
