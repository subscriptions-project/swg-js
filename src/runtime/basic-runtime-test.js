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
import * as runtime from './runtime';
import {
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {ArticleExperimentFlags} from './experiment-flags';
import {AudienceActionIframeFlow} from './audience-action-flow';
import {AudienceActionLocalFlow} from './audience-action-local-flow';
import {AudienceActivityEventListener} from './audience-activity-listener';
import {AutoPromptType} from '../api/basic-subscriptions';
import {
  BasicRuntime,
  ConfiguredBasicRuntime,
  getBasicRuntime,
  installBasicRuntime,
} from './basic-runtime';
import {ClientConfigManager} from './client-config-manager';
import {ClientTheme} from '../api/subscriptions';
import {ContributionsFlow} from './contributions-flow';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {GlobalDoc} from '../model/doc';
import {MeterClientTypes} from '../api/metering';
import {MeterToastApi} from './meter-toast-api';
import {MiniPromptApi} from './mini-prompt-api';
import {MockActivityPort} from '../../test/mock-activity-port';
import {OffersFlow} from './offers-flow';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {Toast} from '../ui/toast';
import {UiPredicates} from '../model/client-config';
import {acceptPortResultData} from './../utils/activity-utils';
import {analyticsEventToGoogleAnalyticsEvent} from './event-type-mapping';
import {createElement} from '../utils/dom';
import {tick} from '../../test/tick';

describes.realWin('installBasicRuntime', (env) => {
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
    dep(() => {
      progress += '1';
    });
    dep(() => {
      progress += '2';
    });
    expect(progress).to.equal('');

    // Install runtime and schedule few more dependencies.
    installBasicRuntime(win);
    dep(() => {
      progress += '3';
    });
    dep(() => {
      progress += '4';
    });

    // Wait for ready signal.
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

  it('should reuse the same runtime on multiple runs', () => {
    installBasicRuntime(win);
    const runtime1 = getBasicRuntime();
    installBasicRuntime(win);
    expect(getBasicRuntime()).to.equal(runtime1);
  });

  it('handles recursive calls after installation', async () => {
    installBasicRuntime(win);
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
    installBasicRuntime(win);

    await tick(2);
    expect(progress).to.equal('123');
  });
});

describes.realWin('BasicRuntime', (env) => {
  let win;
  let doc;
  let basicRuntime;
  let configuredRuntimeSpy;

  beforeEach(() => {
    win = env.win;
    doc = new GlobalDoc(win);
    configuredRuntimeSpy = sandbox.spy(runtime, 'ConfiguredRuntime');
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

      // Default metering handler in entitlements-manager should be enabled
      // for BasicRuntime.
      expect(
        configuredRuntimeSpy.getCall(0).args[2].enableDefaultMeteringHandler
      ).to.be.true;
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

    it('should not force lang if html attribute and clientOptions not set', async () => {
      win.document.documentElement.lang = '';

      basicRuntime.init({
        type: 'NewsArticle',
        isAccessibleForFree: true,
        isPartOfType: ['Product'],
        isPartOfProductId: 'herald-foo-times.com:basic',
        clientOptions: {
          disableButton: false,
          theme: ClientTheme.DARK,
        },
      });

      expect(basicRuntime.clientOptions_).to.deep.equal({
        disableButton: false,
        forceLangInIframes: false,
        lang: '',
        theme: ClientTheme.DARK,
      });
    });

    it('should force lang if html attribute set', async () => {
      win.document.documentElement.lang = 'pt-br';

      basicRuntime.init({
        type: 'NewsArticle',
        isAccessibleForFree: true,
        isPartOfType: ['Product'],
        isPartOfProductId: 'herald-foo-times.com:basic',
        clientOptions: {
          disableButton: false,
          theme: ClientTheme.DARK,
        },
      });

      expect(basicRuntime.clientOptions_).to.deep.equal({
        disableButton: false,
        forceLangInIframes: true,
        lang: 'pt-br',
        theme: ClientTheme.DARK,
      });
    });

    it('should force lang if clientOptions set', async () => {
      win.document.documentElement.lang = '';

      basicRuntime.init({
        type: 'NewsArticle',
        isAccessibleForFree: true,
        isPartOfType: ['Product'],
        isPartOfProductId: 'herald-foo-times.com:basic',
        clientOptions: {
          lang: 'pt-br',
          disableButton: false,
          theme: ClientTheme.DARK,
        },
      });

      expect(basicRuntime.clientOptions_).to.deep.equal({
        disableButton: false,
        forceLangInIframes: true,
        lang: 'pt-br',
        theme: ClientTheme.DARK,
      });
    });

    it('preferr clientOptions over lang if both are set ', async () => {
      win.document.documentElement.lang = 'pt-br';

      basicRuntime.init({
        type: 'NewsArticle',
        isAccessibleForFree: true,
        isPartOfType: ['Product'],
        isPartOfProductId: 'herald-foo-times.com:basic',
        clientOptions: {
          lang: 'fr',
          disableButton: false,
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

    it('should allow caller to disable default metering handler', async () => {
      basicRuntime.init({
        type: 'NewsArticle',
        isAccessibleForFree: true,
        isPartOfType: ['Product'],
        isPartOfProductId: 'herald-foo-times.com:basic',
        disableDefaultMeteringHandler: true,
      });

      await basicRuntime.configured_(true);

      expect(
        configuredRuntimeSpy.getCall(0).args[2].enableDefaultMeteringHandler
      ).to.be.false;
    });

    it('should set publisherProvidedId after initialization', async () => {
      basicRuntime.init({
        isPartOfType: ['Product'],
        isPartOfProductId: 'herald-foo-times.com:basic',
        publisherProvidedId: 'publisherProvidedId',
      });

      await basicRuntime.configured_(true);

      expect(basicRuntime.config_.publisherProvidedId).to.equal(
        'publisherProvidedId'
      );
    });

    [
      {
        isAccessibleForFree: true,
        isPartOfProductId: 'publication:openaccess',
        isAccessibleFromProductId: true,
      },
      {
        isAccessibleForFree: true,
        isPartOfProductId: 'publication:notopen',
        isAccessibleFromProductId: true,
      },
      {
        isAccessibleForFree: false,
        isPartOfProductId: 'publication:openaccess',
        isAccessibleFromProductId: false,
      },
      {
        isAccessibleForFree: false,
        isPartOfProductId: 'publication:notopen',
        isAccessibleFromProductId: false,
      },
      {
        isAccessibleForFree: undefined,
        isPartOfProductId: 'publication:openaccess',
        isAccessibleFromProductId: true,
      },
      {
        isAccessibleForFree: undefined,
        isPartOfProductId: 'publication:notopen',
        isAccessibleFromProductId: false,
      },
    ].forEach(
      ({isAccessibleForFree, isPartOfProductId, isAccessibleFromProductId}) => {
        it(`writes page config with isAccessibleForFree=${isAccessibleFromProductId} when isAccessibleForFree=${isAccessibleForFree} and isPartOfProductId=${isPartOfProductId}`, async () => {
          const writePageConfigStub = sandbox.stub(
            basicRuntime,
            'writePageConfig_'
          );

          basicRuntime.init({
            type: 'NewsArticle',
            isAccessibleForFree,
            isPartOfType: ['Product'],
            isPartOfProductId,
          });

          expect(writePageConfigStub).to.have.been.calledWith({
            type: 'NewsArticle',
            isAccessibleForFree: isAccessibleFromProductId,
            isPartOfType: ['Product'],
            isPartOfProductId,
          });
        });
      }
    );

    [
      {
        isAccessibleForFree: true,
        isPartOfProductId: 'publication:openaccess',
        isClosable: true,
        contentType: 'OPEN',
      },
      {
        isAccessibleForFree: true,
        isPartOfProductId: 'publication:notopen',
        isClosable: true,
        contentType: 'OPEN',
      },
      {
        isAccessibleForFree: false,
        isPartOfProductId: 'publication:openaccess',
        isClosable: false,
        contentType: 'CLOSED',
      },
      {
        isAccessibleForFree: false,
        isPartOfProductId: 'publication:notopen',
        isClosable: false,
        contentType: 'CLOSED',
      },
      {
        isAccessibleForFree: undefined,
        isPartOfProductId: 'publication:openaccess',
        isClosable: true,
        contentType: 'OPEN',
      },
      {
        isAccessibleForFree: undefined,
        isPartOfProductId: 'publication:notopen',
        isClosable: undefined,
        contentType: 'CLOSED',
      },
    ].forEach(
      ({isAccessibleForFree, isPartOfProductId, isClosable, contentType}) => {
        it(`shows autoPrompt with isClosable=${isClosable} when isAccessibleForFree=${isAccessibleForFree} and isPartOfProductId=${isPartOfProductId}`, async () => {
          const setupAndShowAutoPromptStub = sandbox.stub(
            basicRuntime,
            'setupAndShowAutoPrompt'
          );

          basicRuntime.init({
            type: 'NewsArticle',
            isAccessibleForFree,
            isPartOfType: ['Product'],
            isPartOfProductId,
            autoPromptType: 'none',
          });

          expect(setupAndShowAutoPromptStub).to.have.been.calledWith({
            autoPromptType: 'none',
            alwaysShow: false,
            isClosable,
            contentType,
          });
        });
      }
    );
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
      const callback = () => {};
      configuredBasicRuntimeMock
        .expects('setOnEntitlementsResponse')
        .withExactArgs(callback)
        .once();

      await basicRuntime.setOnEntitlementsResponse(callback);
    });

    it('should delegate "setOnEntitlementsResponse" to the shared ConfiguredRuntime', async () => {
      const callback = () => {};
      configuredClassicRuntimeMock
        .expects('setOnEntitlementsResponse')
        .withExactArgs(callback)
        .once();

      await basicRuntime.setOnEntitlementsResponse(callback);
    });

    it('should delegate "setOnPaymentResponse" to ConfiguredBasicRuntime', async () => {
      const callback = () => {};
      configuredBasicRuntimeMock
        .expects('setOnPaymentResponse')
        .withExactArgs(callback)
        .once();

      await basicRuntime.setOnPaymentResponse(callback);
    });

    it('should delegate "setOnPaymentResponse" to ConfiguredRuntime', async () => {
      const callback = () => {};
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
        'https://news.google.com/swg/ui/v1/checkentitlements?_=_&publicationId=pub1',
        '_blank',
        {publicationId: 'pub1', _client: 'SwG 0.0.0'},
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

      const port = new MockActivityPort();
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
        false
      );
      expect(data['jwt']).to.equal('abc');
      expect(data['usertoken']).to.equal('xyz');
      activitiesMock.verify();
    });

    it('should delegate "setupAndShowAutoPrompt"', async () => {
      const options = {alwaysShow: true, isAccessibleForFree: true};
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
        .resolves(true)
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
        .resolves(false)
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
        .resolves(true)
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

    it('should delegate "processEntitlements"', async () => {
      configuredBasicRuntimeMock.expects('processEntitlements').once();

      await basicRuntime.processEntitlements();
    });

    it('should delegate "setupInlineCta"', async () => {
      configuredBasicRuntimeMock.expects('setupInlineCta').once();

      await basicRuntime.setupInlineCta();
    });
  });
});

describes.realWin('BasicConfiguredRuntime', (env) => {
  let win;
  let pageConfig;

  beforeEach(() => {
    win = Object.assign({}, env.win, {
      ga: () => {},
      setTimeout: (callback) => callback(),
    });
    pageConfig = new PageConfig('pub1:label1', true);
  });

  describe('configured', () => {
    let configuredBasicRuntime;
    let entitlementsManagerMock;
    let clientConfigManagerMock;
    let configuredClassicRuntimeMock;
    let winMock;
    let audienceActivityEventListener;
    let audienceActivityEventListenerMock;
    let entitlementsStub;
    let miniPromptApiMock;
    let autoPromptManagerMock;
    let inlineCtaMock;

    beforeEach(() => {
      entitlementsStub = sandbox.stub(
        EntitlementsManager.prototype,
        'getEntitlements'
      );
      entitlementsStub.resolves(new Entitlements());
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
      audienceActivityEventListener = new AudienceActivityEventListener(
        configuredBasicRuntime,
        configuredBasicRuntime.fetcher_
      );
      audienceActivityEventListenerMock = sandbox.mock(
        audienceActivityEventListener
      );
      sandbox.stub(MiniPromptApi.prototype, 'init');
      miniPromptApiMock = sandbox.mock(
        configuredBasicRuntime.autoPromptManager_.miniPromptAPI_
      );
      autoPromptManagerMock = sandbox.mock(
        configuredBasicRuntime.autoPromptManager_
      );
      inlineCtaMock = sandbox.mock(configuredBasicRuntime.inlineCtaApi_);
    });

    afterEach(() => {
      entitlementsManagerMock.verify();
      clientConfigManagerMock.verify();
      configuredClassicRuntimeMock.verify();
      miniPromptApiMock.verify();
      winMock.verify();
      inlineCtaMock.verify();
    });

    it('should store creationTimestamp', () => {
      expect(configuredBasicRuntime.creationTimestamp()).to.equal(0);
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

    it('should configure blocking subscription miniprompts to show offers', async () => {
      entitlementsManagerMock
        .expects('getArticle')
        .resolves({
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'config_id',
                  type: 'TYPE_SUBSCRIPTION',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
          audienceActions: {
            actions: [
              {type: 'TYPE_SUBSCRIPTION', configurationId: 'config_id'},
            ],
            engineId: '123',
          },
        })
        .atLeast(1);
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves({uiPredicates});
      miniPromptApiMock.expects('create').once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      });
    });

    it('should configure blocking subscription auto prompts to show offers when the desktop viewport is large', async () => {
      autoPromptManagerMock.expects('getInnerWidth_').returns(500).once();
      entitlementsManagerMock
        .expects('getArticle')
        .resolves({
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'config_id',
                  type: 'TYPE_SUBSCRIPTION',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
          audienceActions: {
            actions: [
              {type: 'TYPE_SUBSCRIPTION', configurationId: 'config_id'},
            ],
            engineId: '123',
          },
        })
        .atLeast(1);
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves({uiPredicates});
      configuredClassicRuntimeMock
        .expects('showOffers')
        .withExactArgs({
          isClosable: false,
          shouldAnimateFade: true,
        })
        .once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      });
    });

    it('should configure blocking subscription auto prompts to show offers', async () => {
      entitlementsManagerMock
        .expects('getArticle')
        .resolves({
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'config_id',
                  type: 'TYPE_SUBSCRIPTION',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
          audienceActions: {
            actions: [
              {type: 'TYPE_SUBSCRIPTION', configurationId: 'config_id'},
            ],
            engineId: '123',
          },
        })
        .atLeast(1);
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves({uiPredicates});
      configuredClassicRuntimeMock
        .expects('showOffers')
        .withExactArgs({
          isClosable: false,
          shouldAnimateFade: true,
        })
        .once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
      });
    });

    it('should configure blocking contribution miniprompts to show contribution options', async () => {
      entitlementsManagerMock
        .expects('getArticle')
        .resolves({
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'config_id',
                  type: 'TYPE_CONTRIBUTION',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
          audienceActions: {
            actions: [
              {type: 'TYPE_CONTRIBUTION', configurationId: 'config_id'},
            ],
            engineId: '123',
          },
        })
        .atLeast(1);
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves({uiPredicates});
      miniPromptApiMock.expects('create').once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
    });

    it('should configure contribution auto prompts to show contribution options when the desktop viewport is large', async () => {
      autoPromptManagerMock.expects('getInnerWidth_').returns(500).once();
      entitlementsManagerMock
        .expects('getArticle')
        .resolves({
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'config_id',
                  type: 'TYPE_CONTRIBUTION',
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
          audienceActions: {
            actions: [
              {type: 'TYPE_CONTRIBUTION', configurationId: 'config_id'},
            ],
            engineId: '123',
          },
        })
        .atLeast(1);
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves({uiPredicates});
      configuredClassicRuntimeMock
        .expects('showContributionOptions')
        .withExactArgs({
          isClosable: true,
          shouldAnimateFade: true,
        })
        .once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
    });

    it('should configure contribution auto prompts to show contribution options', async () => {
      entitlementsManagerMock
        .expects('getArticle')
        .resolves({
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'config_id',
                  type: 'TYPE_CONTRIBUTION',
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
          audienceActions: {
            actions: [
              {type: 'TYPE_CONTRIBUTION', configurationId: 'config_id'},
            ],
            engineId: '123',
          },
        })
        .atLeast(1);
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves({uiPredicates});
      configuredClassicRuntimeMock
        .expects('showContributionOptions')
        .withExactArgs({
          isClosable: true,
          shouldAnimateFade: true,
        })
        .once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
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
      const port = new MockActivityPort();
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

    it('should handle an EntitlementsResponse with jwt and usertoken for AudienceActionLocalFlow', async () => {
      const port = new MockActivityPort();
      port.acceptResult = () => {
        const result = new ActivityResult();
        result.data = {'jwt': 'abc', 'usertoken': 'xyz'};
        result.origin = 'https://news.google.com';
        result.originVerified = true;
        result.secureChannel = true;
        return Promise.resolve(result);
      };

      const audienceActionFlow = new AudienceActionLocalFlow(
        configuredBasicRuntime,
        {action: 'foo', configurationId: 'configId'}
      );
      const audienceActionFlowMock = sandbox.mock(audienceActionFlow);
      audienceActionFlowMock.expects('close').withExactArgs().once();
      const autoPromptManagerMock = sandbox.mock(
        configuredBasicRuntime.autoPromptManager_
      );
      autoPromptManagerMock
        .expects('getLastAudienceActionFlow')
        .withExactArgs()
        .returns(audienceActionFlow)
        .once();

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

      audienceActionFlowMock.verify();
    });

    it('should handle an empty EntitlementsResponse from subscription offers flow', async () => {
      const port = new MockActivityPort();
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
      const port = new MockActivityPort();
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

    it('should handle an empty EntitlementsResponse from audience action flow', async () => {
      const port = new MockActivityPort();
      port.acceptResult = () => {
        const result = new ActivityResult();
        result.data = {}; // no data
        result.origin = 'https://news.google.com';
        result.originVerified = true;
        result.secureChannel = true;
        return Promise.resolve(result);
      };

      const audienceActionFlow = new AudienceActionIframeFlow(
        configuredBasicRuntime,
        {
          action: 'TYPE_REGISTRATION_WALL',
          configurationId: 'configId',
          fallback: undefined,
          autoPromptType: AutoPromptType.CONTRIBUTION,
          calledManually: false,
        }
      );
      const autoPromptManagerMock = sandbox.mock(
        configuredBasicRuntime.autoPromptManager_
      );
      autoPromptManagerMock
        .expects('getLastAudienceActionFlow')
        .withExactArgs()
        .returns(audienceActionFlow)
        .once();

      const audienceActionFlowMock = sandbox.mock(audienceActionFlow);
      audienceActionFlowMock
        .expects('showNoEntitlementFoundToast')
        .withExactArgs()
        .once();
      await configuredBasicRuntime.entitlementsResponseHandler(port);
      audienceActionFlowMock.verify();
    });

    it('should handle an empty EntitlementsResponse from meter flow', async () => {
      const port = new MockActivityPort();
      port.acceptResult = () => {
        const result = new ActivityResult();
        result.data = {}; // no data
        result.origin = 'https://news.google.com';
        result.originVerified = true;
        result.secureChannel = true;
        return Promise.resolve(result);
      };

      const meterToastApi = new MeterToastApi(configuredBasicRuntime, {
        meterClientType: MeterClientTypes.METERED_BY_GOOGLE.valueOf(),
        meterClientUserAttribute: 'standard_registered_user',
      });
      const entitlementsManagerMock = sandbox.mock(
        configuredBasicRuntime.entitlementsManager()
      );
      entitlementsManagerMock
        .expects('getLastMeterToast')
        .withExactArgs()
        .returns(meterToastApi)
        .once();

      const meterToastApiMock = sandbox.mock(meterToastApi);
      meterToastApiMock
        .expects('showNoEntitlementFoundToast')
        .withExactArgs()
        .once();
      await configuredBasicRuntime.entitlementsResponseHandler(port);
      meterToastApiMock.verify();
    });

    it('should handle an empty EntitlementsResponse with no active flow', async () => {
      const port = new MockActivityPort();
      port.acceptResult = () => {
        const result = new ActivityResult();
        result.data = {}; // no data
        result.origin = 'https://news.google.com';
        result.originVerified = true;
        result.secureChannel = true;
        return Promise.resolve(result);
      };

      let toast;
      const toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });

      await configuredBasicRuntime.entitlementsResponseHandler(port);

      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=custom');
      expect(toast.src_).to.contain(
        `customText=${encodeURIComponent('No membership found')}`
      );
    });

    it('passes getEntitlements to fetchClientConfig', async () => {
      const entitlements = new Entitlements(
        'foo.service',
        'RaW',
        [],
        null,
        null
      );
      entitlementsStub.resolves(entitlements);
      const clientConfigManagerStub = sandbox.stub(
        ClientConfigManager.prototype,
        'fetchClientConfig'
      );

      configuredBasicRuntime = new ConfiguredBasicRuntime(win, pageConfig);

      expect(clientConfigManagerStub).to.be.called;
      expect(await clientConfigManagerStub.args[0][0]).to.deep.equal(
        entitlements
      );
    });

    it('should set up Audience Activity event listener and listen to events on startup', async () => {
      audienceActivityEventListenerMock.expects('start').once();
    });

    it('should enable METERED_BY_GOOGLE on the entitlements manager if the page is locked', () => {
      const entitlementsStub = sandbox.stub(
        EntitlementsManager.prototype,
        'enableMeteredByGoogle'
      );
      sandbox.stub(pageConfig, 'isLocked').returns(true);

      configuredBasicRuntime = new ConfiguredBasicRuntime(win, pageConfig);

      expect(entitlementsStub).to.be.calledOnce;
    });

    it('should not enable METERED_BY_GOOGLE on the entitlements manager if the page is unlocked', () => {
      const entitlementsStub = sandbox.stub(
        EntitlementsManager.prototype,
        'enableMeteredByGoogle'
      );
      sandbox.stub(pageConfig, 'isLocked').returns(false);

      configuredBasicRuntime = new ConfiguredBasicRuntime(win, pageConfig);

      expect(entitlementsStub).to.not.be.called;
    });

    it('should set onOffersFlowRequest to handle clicks on the Metering Toast "Subscribe" button', async () => {
      expect(configuredBasicRuntime.configuredClassicRuntime()).to.exist;
      expect(
        configuredBasicRuntime
          .configuredClassicRuntime()
          .callbacks()
          .hasOffersFlowRequestCallback()
      ).to.be.true;
    });

    it('should dismiss the active dialog and call showOffers when offers flow request is triggered', async () => {
      let offersOptions = null;
      const showOffersStub = sandbox
        .stub(configuredBasicRuntime.configuredClassicRuntime(), 'showOffers')
        .callsFake((options) => {
          offersOptions = options;
        });
      const completeAllStub = sandbox.stub(
        configuredBasicRuntime.dialogManager(),
        'completeAll'
      );
      await configuredBasicRuntime.callbacks().triggerOffersFlowRequest();
      expect(showOffersStub).to.be.calledOnce;
      expect(completeAllStub).to.be.calledOnce;
      expect(offersOptions.isClosable).to.equal(true);
    });

    it('should configure inline CTA when experiment enabled', async () => {
      entitlementsManagerMock
        .expects('getExperimentConfigFlags')
        .resolves([ArticleExperimentFlags.INLINE_CTA_EXPERIMENT])
        .atLeast(1);

      inlineCtaMock.expects('attachInlineCtasWithAttribute').once();

      await configuredBasicRuntime.setupInlineCta();
    });

    it('should not configure inline CTA when experiment disabled', async () => {
      entitlementsManagerMock
        .expects('getExperimentConfigFlags')
        .resolves([])
        .atLeast(1);

      inlineCtaMock.expects('attachInlineCtasWithAttribute').never();

      await configuredBasicRuntime.setupInlineCta();
    });
  });
});
