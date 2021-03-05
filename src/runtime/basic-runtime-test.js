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
import {Entitlements} from '../api/entitlements';
import {GlobalDoc} from '../model/doc';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
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
          theme: ClientTheme.DARK,
          lang: 'fr',
        },
      });
      expect(basicRuntime.clientOptions_).to.deep.equal({
        theme: ClientTheme.DARK,
        lang: 'fr',
      });
    });
  });

  describe('configured', () => {
    let pageConfig;
    let configuredBasicRuntime;
    let configuredBasicRuntimeMock;
    let configuredClassicRuntimeMock;

    beforeEach(() => {
      pageConfig = new PageConfig('pub1');
      configuredBasicRuntime = new ConfiguredBasicRuntime(doc, pageConfig);
      configuredBasicRuntimeMock = sandbox.mock(configuredBasicRuntime);
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

    it('should call attach on all buttons with the correct attribute', async () => {
      // Set up buttons on the doc.
      const subscriptionButton = createElement(doc.getRootNode(), 'button', {
        'swg-standard-button': 'subscription',
      });
      const contributionButton = createElement(doc.getRootNode(), 'button', {
        'swg-standard-button': 'contribution',
      });
      doc.getBody().appendChild(subscriptionButton);
      doc.getBody().appendChild(contributionButton);

      await basicRuntime.setupButtons();
      configuredClassicRuntimeMock.expects('showOffers').once();
      await subscriptionButton.click();

      configuredClassicRuntimeMock.expects('showContributionOptions').once();
      await contributionButton.click();
    });
  });
});

describes.realWin('BasicConfiguredRuntime', {}, (env) => {
  let win;
  let pageConfig;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1', true);
  });

  describe('configured', () => {
    let configuredBasicRuntime;
    let entitlementsManagerMock;
    let clientConfigManagerMock;
    let configuredClassicRuntimeMock;

    beforeEach(() => {
      configuredBasicRuntime = new ConfiguredBasicRuntime(win, pageConfig);
      entitlementsManagerMock = sandbox.mock(
        configuredBasicRuntime.configuredClassicRuntime_.entitlementsManager_
      );
      clientConfigManagerMock = sandbox.mock(
        configuredBasicRuntime.clientConfigManager_
      );
      configuredClassicRuntimeMock = sandbox.mock(
        configuredBasicRuntime.configuredClassicRuntime_
      );
    });

    afterEach(() => {
      entitlementsManagerMock.verify();
      clientConfigManagerMock.verify();
      configuredClassicRuntimeMock.verify();
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
        .expects('getAutoPromptConfig')
        .returns(Promise.resolve({}));
      configuredClassicRuntimeMock.expects('showOffers').once();

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
        .expects('getAutoPromptConfig')
        .returns(Promise.resolve({}));
      configuredClassicRuntimeMock.expects('showContributionOptions').once();

      await configuredBasicRuntime.setupAndShowAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
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
  });
});
