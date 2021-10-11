/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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
import {ActivityPort} from '../components/activities';
import {
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {
  AutoPromptType,
  BasicSubscriptions,
  ClientTheme,
} from '../api/basic-subscriptions';
import {
  BasicRuntime,
  ConfiguredBasicRuntime,
  getBasicRuntime,
  installBasicRuntime,
} from './basic-runtime';
import {ContributionsFlow} from './contributions-flow';
import {Entitlements} from '../api/entitlements';
import {GlobalDoc} from '../model/doc';
import {OffersFlow} from './offers-flow';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {Toast} from '../ui/toast';
import {acceptPortResultData} from './../utils/activity-utils';
import {analyticsEventToGoogleAnalyticsEvent} from './event-type-mapping';
import {createElement} from '../utils/dom';

describes.realWin('installBasicRuntime', {}, (env) => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  function dep(callback) {
    (win.SWG_BASIC = win.SWG_BASIC || []).push(callback);
  }

  it('should chain and execute dependencies in order', async () => {
    // Before runtime is installed.
    let progress = '';
    dep(function () {
      progress += '1';
    });
    dep(function () {
      progress += '2';
    });
    expect(progress).to.equal('');

    // Install runtime and schedule few more dependencies.
    try {
      installBasicRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    dep(function () {
      progress += '3';
    });
    dep(function () {
      progress += '4';
    });

    // Wait for ready signal.
    await getBasicRuntime().whenReady();
    expect(progress).to.equal('1234');

    // Few more.
    dep(function () {
      progress += '5';
    });
    dep(function () {
      progress += '6';
    });
    await getBasicRuntime().whenReady();
    expect(progress).to.equal('123456');
  });

  it('should reuse the same runtime on multiple runs', () => {
    try {
      installBasicRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    const runtime1 = getBasicRuntime();
    installBasicRuntime(win);
    expect(getBasicRuntime()).to.equal(runtime1);
  });

  it('should implement BasicSubscriptions interface', async () => {
    const promise = new Promise((resolve) => {
      dep(resolve);
    });
    installBasicRuntime(win);

    const basicSubscriptions = await promise;
    const keys = Object.getOwnPropertyNames(BasicSubscriptions.prototype);
    for (const key of keys) {
      expect(basicSubscriptions[key]).to.exist;
    }
  });

  it('handles recursive calls after installation', async () => {
    try {
      installBasicRuntime(win);
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

    await getBasicRuntime().whenReady();
    await getBasicRuntime().whenReady();
    await getBasicRuntime().whenReady();
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
    try {
      installBasicRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }

    await getBasicRuntime().whenReady();
    await getBasicRuntime().whenReady();
    await getBasicRuntime().whenReady();
    expect(progress).to.equal('123');
  });

  it('should implement all APIs', async () => {
    installBasicRuntime(win);

    const basicSubscriptions = await new Promise((resolve) => {
      dep(resolve);
    });

    const names = Object.getOwnPropertyNames(BasicSubscriptions.prototype);
    for (const name of names) {
      if (name == 'constructor') {
        continue;
      }
      expect(basicSubscriptions).to.have.property(name);
    }
  });
});

describes.realWin('BasicRuntime', {}, (env) => {
  let win;
  let doc;
  let basicRuntime;

  beforeEach(() => {
    win = env.win;
    doc = new GlobalDoc(win);
    basicRuntime = new BasicRuntime(win);
  });

  describe('initialization', () => {
    let pageConfig;
    let pageConfigPromise;
    let resolveStub;

    beforeEach(() => {
      pageConfig = new PageConfig('pub1', true);
      pageConfigPromise = Promise.resolve(pageConfig);
      resolveStub = sandbox
        .stub(PageConfigResolver.prototype, 'resolveConfig')
        .callsFake(() => pageConfigPromise);
    });

    it('should initialize and generate markup as specified', async () => {
      basicRuntime.init({
        type: 'NewsArticle',
        isAccessibleForFree: true,
        isPartOfType: ['Product'],
        isPartOfProductId: 'herald-foo-times.com:basic',
      });

      await basicRuntime.configured_(true);

      // init should have written the LD+JSON markup.
      const elements = doc
        .getRootNode()
        .querySelectorAll('script[type="application/ld+json"]');
      expect(elements).to.have.length(1);

      // PageConfigResolver should have been created and attempted to resolve
      // the PageConfig.
      expect(resolveStub).to.be.calledOnce;
    });

    it('should try to check the page config resolver after initial configuration', async () => {
      const checkStub = sandbox.stub(PageConfigResolver.prototype, 'check');
      // Simulate the resolver still resolving the page config.
      pageConfigPromise = new Promise(() => {});
      basicRuntime.configured_(true);
      basicRuntime.configured_(true);
      expect(resolveStub).to.be.calledOnce;
      expect(checkStub).to.be.calledOnce;
    });

    it('should fail when config lookup fails', async () => {
      pageConfigPromise = Promise.reject('config broken');

      await expect(basicRuntime.configured_(true)).to.be.rejectedWith(
        /config broken/
      );
    });

    it('should initialize and save client options', async () => {
      basicRuntime.init({
        type: 'NewsArticle',
        isAccessibleForFree: true,
        isPartOfType: ['Product'],
        isPartOfProductId: 'herald-foo-times.com:basic',
        clientOptions: {
          disableButton: false,
          forceLangInIframes: true,
          lang: 'fr',
          theme: ClientTheme.DARK,
        },
      });
      expect(basicRuntime.clientOptions_).to.deep.equal({
        disableButton: false,
        forceLangInIframes: true,
        lang: 'fr',
        theme: ClientTheme.DARK,
      });
    });
  });

  describe('configured', () => {
    let pageConfig;
    let configuredBasicRuntime;
    let configuredBasicRuntimeMock;
    let clientConfigManagerMock;
    let configuredClassicRuntimeMock;

    beforeEach(() => {
      pageConfig = new PageConfig('pub1');
      configuredBasicRuntime = new ConfiguredBasicRuntime(doc, pageConfig);
      configuredBasicRuntimeMock = sandbox.mock(configuredBasicRuntime);
      clientConfigManagerMock = sandbox.mock(
        configuredBasicRuntime.clientConfigManager()
      );
      configuredClassicRuntimeMock = sandbox.mock(
        configuredBasicRuntime.configuredClassicRuntime()
      );

      sandbox
        .stub(basicRuntime, 'configured_')
        .callsFake(() => Promise.resolve(configuredBasicRuntime));
    });

    afterEach(() => {
      configuredBasicRuntimeMock.verify();
      configuredClassicRuntimeMock.verify();
      clientConfigManagerMock.verify();
    });

    it('should create a SwG classic ConfiguredRuntime', async () => {
      expect(configuredBasicRuntime.configuredClassicRuntime()).to.exist;
    });

    it('should delegate "setOnEntitlementsResponse" to ConfiguredBasicRuntime', async () => {
      const callback = function () {};
      configuredBasicRuntimeMock
        .expects('setOnEntitlementsResponse')
        .withExactArgs(callback)
        .once();

      await basicRuntime.setOnEntitlementsResponse(callback);
    });

    it('should delegate "setOnEntitlementsResponse" to the shared ConfiguredRuntime', async () => {
      const callback = function () {};
      configuredClassicRuntimeMock
        .expects('setOnEntitlementsResponse')
        .withExactArgs(callback)
        .once();

      await basicRuntime.setOnEntitlementsResponse(callback);
    });

    it('should delegate "setOnPaymentResponse" to ConfiguredBasicRuntime', async () => {
      const callback = function () {};
      configuredBasicRuntimeMock
        .expects('setOnPaymentResponse')
        .withExactArgs(callback)
        .once();

      await basicRuntime.setOnPaymentResponse(callback);
    });

    it('should delegate "setOnPaymentResponse" to ConfiguredRuntime', async () => {
      const callback = function () {};
      configuredClassicRuntimeMock
        .expects('setOnPaymentResponse')
        .withExactArgs(callback)
        .once();

      await basicRuntime.setOnPaymentResponse(callback);
    });

    it('should delegate "setOnLoginRequest" to ConfiguredBasicRuntime', async () => {
      configuredBasicRuntimeMock
        .expects('setOnLoginRequest')
        .withExactArgs()
        .once();

      await basicRuntime.setOnLoginRequest();
    });

    it('should delegate "setOnLoginRequest" to ConfiguredClassicRuntime', async () => {
      configuredClassicRuntimeMock.expects('setOnLoginRequest').once();

      await basicRuntime.setOnLoginRequest();
    });

    it('should trigger login request', async () => {
      configuredBasicRuntime.setOnLoginRequest();

      const openStub = sandbox.stub(
        configuredBasicRuntime.activities(),
        'open'
      );
      await configuredBasicRuntime
        .callbacks()
        .triggerLoginRequest({linkRequested: true});

      expect(openStub).to.be.calledOnceWithExactly(
        'CHECK_ENTITLEMENTS',
        'https://news.google.com/swg/_/ui/v1/checkentitlements?_=_&publicationId=pub1',
        '_blank',
        {publicationId: 'pub1', _client: 'SwG $internalRuntimeVersion$'},
        {'width': 600, 'height': 600}
      );
    });

    it('should delegate "processEntitlements"', async () => {
      const activitiesMock = sandbox.mock(configuredBasicRuntime.activities());
      let handler;
      activitiesMock
        .expects('onResult')
        .withExactArgs(
          'CHECK_ENTITLEMENTS',
          sandbox.match((arg) => {
            handler = arg;
            return typeof arg == 'function';
          })
        )
        .once();
      await basicRuntime.processEntitlements();
      expect(handler).to.exist;

      const port = new ActivityPort();
      port.onResizeRequest = () => {};
      port.whenReady = () => Promise.resolve();
      const result = new ActivityResult(
        ActivityResultCode.OK,
        {'jwt': 'abc', 'usertoken': 'xyz'},
        sandbox.match.any,
        sandbox.match.any,
        true,
        true
      );
      port.acceptResult = () => Promise.resolve(result);

      handler(port);

      const data = await acceptPortResultData(
        port,
        sandbox.match.any,
        true,
        true
      );
      expect(data['jwt']).to.equal('abc');
      expect(data['usertoken']).to.equal('xyz');
      activitiesMock.verify();
    });

    it('should delegate "setupAndShowAutoPrompt"', async () => {
      const options = {alwaysShow: true};
      configuredBasicRuntimeMock
        .expects('setupAndShowAutoPrompt')
        .withExactArgs(options)
        .once();

      await basicRuntime.setupAndShowAutoPrompt(options);
    });

    it('should delegate "dismissSwgUI"', async () => {
      configuredBasicRuntimeMock.expects('dismissSwgUI').once();

      await basicRuntime.dismissSwgUI();
    });

    it('should call attach on all buttons with the correct attribute if buttons should be enable', async () => {
      // Set up buttons on the doc.
      const subscriptionButton = createElement(doc.getRootNode(), 'button', {
        'swg-standard-button': 'subscription',
      });
      const contributionButton = createElement(doc.getRootNode(), 'button', {
        'swg-standard-button': 'contribution',
      });
      doc.getBody().appendChild(subscriptionButton);
      doc.getBody().appendChild(contributionButton);

      clientConfigManagerMock
        .expects('shouldEnableButton')
        .returns(Promise.resolve(true))
        .once();

      await basicRuntime.setupButtons();
      configuredClassicRuntimeMock
        .expects('showOffers')
        .withExactArgs({
          isClosable: true,
        })
        .once();
      await subscriptionButton.click();

      configuredClassicRuntimeMock
        .expects('showContributionOptions')
        .withExactArgs({
          isClosable: true,
        })
        .once();
      await contributionButton.click();
    });

    it('should not call attach on all buttons if buttons should be disabled', async () => {
      // Set up buttons on the doc.
      const subscriptionButton = createElement(doc.getRootNode(), 'button', {
        'swg-standard-button': 'subscription',
      });
      const contributionButton = createElement(doc.getRootNode(), 'button', {
        'swg-standard-button': 'contribution',
      });
      doc.getBody().appendChild(subscriptionButton);
      doc.getBody().appendChild(contributionButton);

      clientConfigManagerMock
        .expects('shouldEnableButton')
        .returns(Promise.resolve(false))
        .once();

      await basicRuntime.setupButtons();
      configuredClassicRuntimeMock
        .expects('showOffers')
        .withExactArgs({
          isClosable: true,
        })
        .never();
      await subscriptionButton.click();

      configuredClassicRuntimeMock
        .expects('showContributionOptions')
        .withExactArgs({
          isClosable: true,
        })
        .never();
      await contributionButton.click();
    });

    it('should set up buttons with non-closable iframes if content is paygated', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);

      // Set up buttons on the doc.
      const subscriptionButton = createElement(doc.getRootNode(), 'button', {
        'swg-standard-button': 'subscription',
      });
      const contributionButton = createElement(doc.getRootNode(), 'button', {
        'swg-standard-button': 'contribution',
      });
      doc.getBody().appendChild(subscriptionButton);
      doc.getBody().appendChild(contributionButton);

      clientConfigManagerMock
        .expects('shouldEnableButton')
        .returns(Promise.resolve(true))
        .once();

      await basicRuntime.setupButtons();
      configuredClassicRuntimeMock
        .expects('showOffers')
        .withExactArgs({
          isClosable: false,
        })
        .once();
      await subscriptionButton.click();

      configuredClassicRuntimeMock
        .expects('showContributionOptions')
        .withExactArgs({
          isClosable: false,
        })
        .once();
      await contributionButton.click();
    });

    it('should delegate "processEntitlements"', async () => {
      configuredBasicRuntimeMock.expects('processEntitlements').once();

      await basicRuntime.processEntitlements();
    });
  });
});

describes.realWin('BasicConfiguredRuntime', {}, (env) => {
  let win;
  let pageConfig;

  beforeEach(() => {
    win = Object.assign({}, env.win, {
      ga: () => {},
    });
    pageConfig = new PageConfig('pub1:label1', true);
  });

  describe('configured', () => {
    let configuredBasicRuntime;
    let entitlementsManagerMock;
    let clientConfigManagerMock;
    let configuredClassicRuntimeMock;
    let winMock;

    beforeEach(() => {
      configuredBasicRuntime = new ConfiguredBasicRuntime(win, pageConfig);
      entitlementsManagerMock = sandbox.mock(
        configuredBasicRuntime.configuredClassicRuntime_.entitlementsManager_
      );
      clientConfigManagerMock = sandbox.mock(
        configuredBasicRuntime.configuredClassicRuntime_.clientConfigManager_
      );
      configuredClassicRuntimeMock = sandbox.mock(
        configuredBasicRuntime.configuredClassicRuntime_
      );
      winMock = sandbox.mock(win);
    });

    afterEach(() => {
      entitlementsManagerMock.verify();
      clientConfigManagerMock.verify();
      configuredClassicRuntimeMock.verify();
      winMock.verify();
    });

    it('should store and doc and win', () => {
      expect(configuredBasicRuntime.win()).to.equal(win);
      expect(configuredBasicRuntime.doc().getWin()).to.equal(win);
    });

    it('should delegate config to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('config').once();
      configuredBasicRuntime.config();
    });

    it('should delegate pageConfig to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('pageConfig').once();
      configuredBasicRuntime.pageConfig();
    });

    it('should delegate activities to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('activities').once();
      configuredBasicRuntime.activities();
    });

    it('should delegate payClient to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('payClient').once();
      configuredBasicRuntime.payClient();
    });

    it('should delegate dialogManager to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('dialogManager').once();
      configuredBasicRuntime.dialogManager();
    });

    it('should delegate entitlementsManager to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('entitlementsManager').once();
      configuredBasicRuntime.entitlementsManager();
    });

    it('should delegate clientConfigManager to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('clientConfigManager').once();
      configuredBasicRuntime.clientConfigManager();
    });

    it('should delegate callbacks to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('callbacks').once();
      configuredBasicRuntime.callbacks();
    });

    it('should delegate storage to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('storage').once();
      configuredBasicRuntime.storage();
    });

    it('should delegate analytics to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('analytics').once();
      configuredBasicRuntime.analytics();
    });

    it('should delegate jserror to ConfiguredRuntime', () => {
      configuredClassicRuntimeMock.expects('jserror').once();
      configuredBasicRuntime.jserror();
    });

    it('should configure subscription auto prompts to show offers for paygated content', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      const entitlements = new Entitlements();
      entitlementsManagerMock
        .expects('getEntitlements')
        .returns(Promise.resolve(entitlements));
      clientConfigManagerMock
        .expects('getClientConfig')
        .returns(Promise.resolve({}));
      configuredClassicRuntimeMock
        .expects('showOffers')
        .withExactArgs({
          isClosable: false,
        })
        .once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      });
    });

    it('should configure contribution auto prompts to show contribution options for paygated content', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      const entitlements = new Entitlements();
      entitlementsManagerMock
        .expects('getEntitlements')
        .returns(Promise.resolve(entitlements));
      clientConfigManagerMock
        .expects('getClientConfig')
        .returns(Promise.resolve({}));
      configuredClassicRuntimeMock
        .expects('showContributionOptions')
        .withExactArgs({
          isClosable: false,
        })
        .once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
    });

    it('should dimiss SwG UI', () => {
      const dialogManagerMock = sandbox.mock(
        configuredBasicRuntime.dialogManager()
      );
      dialogManagerMock.expects('completeAll').once();
      configuredBasicRuntime.dismissSwgUI();
      dialogManagerMock.verify();
    });

    it('should set clientOptions in ClientConfigManager', () => {
      configuredBasicRuntime = new ConfiguredBasicRuntime(
        win,
        pageConfig,
        undefined,
        undefined,
        {theme: ClientTheme.DARK, lang: 'fr'}
      );
      expect(configuredBasicRuntime.clientConfigManager().getLanguage()).equals(
        'fr'
      );
      expect(configuredBasicRuntime.clientConfigManager().getTheme()).equals(
        ClientTheme.DARK
      );
    });

    it('should pass ClientOptions to button setup', () => {
      const clientOptions = {theme: ClientTheme.DARK, lang: 'fr'};
      configuredBasicRuntime = new ConfiguredBasicRuntime(
        win,
        pageConfig,
        /* integr */ undefined,
        /* config */ undefined,
        clientOptions
      );
      const buttonApiMock = sandbox.mock(configuredBasicRuntime.buttonApi_);
      buttonApiMock
        .expects('attachButtonsWithAttribute')
        .withExactArgs(
          /* attribute */ sandbox.match.any,
          /* attributeValues */ sandbox.match.any,
          clientOptions,
          /* attributeValueToCallback */ sandbox.match.any
        );
    });

    it('should set up Google Analytics event listener and listen to events on startup', async () => {
      expect(
        configuredBasicRuntime.configuredClassicRuntime()
          .googleAnalyticsEventListener_.constructor.name
      ).equals('GoogleAnalyticsEventListener');
      winMock
        .expects('ga')
        .withExactArgs(
          'send',
          'event',
          analyticsEventToGoogleAnalyticsEvent(AnalyticsEvent.IMPRESSION_OFFERS)
        )
        .once();
      configuredBasicRuntime.eventManager().logEvent({
        eventType: AnalyticsEvent.IMPRESSION_OFFERS,
        eventOriginator: EventOriginator.SWG_CLIENT,
      });
      await configuredBasicRuntime.eventManager().lastAction_;
    });

    it('should handle an EntitlementsResponse with jwt and usertoken', async () => {
      const port = new ActivityPort();
      port.acceptResult = () => {
        const result = new ActivityResult();
        result.data = {'jwt': 'abc', 'usertoken': 'xyz'};
        result.origin = 'https://news.google.com';
        result.originVerified = true;
        result.secureChannel = true;
        return Promise.resolve(result);
      };

      configuredClassicRuntimeMock.expects('closeDialog').once();
      entitlementsManagerMock
        .expects('pushNextEntitlements')
        .withExactArgs('abc')
        .once();

      const storageMock = sandbox.mock(configuredBasicRuntime.storage());
      storageMock
        .expects('set')
        .withExactArgs('USER_TOKEN', 'xyz', true)
        .once();

      let toast;
      const toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });
      await configuredBasicRuntime.entitlementsResponseHandler(port);

      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=basic');
      storageMock.verify();
    });

    it('should handle an empty EntitlementsResponse from subscription offers flow', async () => {
      const port = new ActivityPort();
      port.acceptResult = () => {
        const result = new ActivityResult();
        result.data = {}; // no data
        result.origin = 'https://news.google.com';
        result.originVerified = true;
        result.secureChannel = true;
        return Promise.resolve(result);
      };

      const offersFlow = new OffersFlow(configuredBasicRuntime, {
        skus: ['sku1', 'sku2'],
      });
      configuredClassicRuntimeMock
        .expects('getLastOffersFlow')
        .withExactArgs()
        .returns(offersFlow)
        .once();

      const offersFlowMock = sandbox.mock(offersFlow);
      offersFlowMock
        .expects('showNoEntitlementFoundToast')
        .withExactArgs()
        .once();
      await configuredBasicRuntime.entitlementsResponseHandler(port);
      offersFlowMock.verify();
    });

    it('should handle an empty EntitlementsResponse from contributions flow', async () => {
      const port = new ActivityPort();
      port.acceptResult = () => {
        const result = new ActivityResult();
        result.data = {}; // no data
        result.origin = 'https://news.google.com';
        result.originVerified = true;
        result.secureChannel = true;
        return Promise.resolve(result);
      };

      const contributionsFlow = new ContributionsFlow(configuredBasicRuntime, {
        skus: ['sku1', 'sku2'],
      });
      configuredClassicRuntimeMock
        .expects('getLastContributionsFlow')
        .withExactArgs()
        .returns(contributionsFlow)
        .once();

      const contributionsFlowMock = sandbox.mock(contributionsFlow);
      contributionsFlowMock
        .expects('showNoEntitlementFoundToast')
        .withExactArgs()
        .once();
      await configuredBasicRuntime.entitlementsResponseHandler(port);
      contributionsFlowMock.verify();
    });
  });
});
