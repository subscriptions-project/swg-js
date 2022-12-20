/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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

import * as audienceActionFlow from './audience-action-flow';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {AutoPromptConfig} from '../model/auto-prompt-config';
import {AutoPromptManager} from './auto-prompt-manager';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfig, UiPredicates} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Constants, StorageKeys} from '../utils/constants';
import {DepsDef} from './deps';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {ExperimentFlags} from './experiment-flags';
import {Fetcher} from './fetcher';
import {GlobalDoc} from '../model/doc';
import {MiniPromptApi} from './mini-prompt-api';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {setExperiment} from './experiments';
import {tick} from '../../test/tick';

const CURRENT_TIME = 1615416442; // GMT: Wednesday, March 10, 2021 10:47:22 PM

describes.realWin('AutoPromptManager', (env) => {
  let autoPromptManager;
  let win;
  let deps;
  let doc;
  let pageConfig;
  let fetcher;
  let eventManager;
  let eventManagerCallback;
  let entitlementsManager;
  let logEventSpy;
  let entitlementsManagerMock;
  let clientConfigManager;
  let clientConfigManagerMock;
  let storageMock;
  let alternatePromptSpy;
  let miniPromptApiMock;
  let actionFlowSpy;
  let startSpy;
  const productId = 'pub1:label1';
  const pubId = 'pub1';

  beforeEach(() => {
    deps = new DepsDef();

    sandbox.useFakeTimers(CURRENT_TIME);
    win = Object.assign({}, env.win, {gtag: () => {}, ga: () => {}});
    win.setTimeout = (callback) => callback();
    sandbox.stub(deps, 'win').returns(win);

    doc = new GlobalDoc(win);
    sandbox.stub(deps, 'doc').returns(doc);

    pageConfig = new PageConfig(productId);
    sandbox.stub(deps, 'pageConfig').returns(pageConfig);

    eventManager = new ClientEventManager(new Promise(() => {}));
    sandbox.stub(deps, 'eventManager').returns(eventManager);
    sandbox
      .stub(eventManager, 'registerEventListener')
      .callsFake((callback) => (eventManagerCallback = callback));
    logEventSpy = sandbox.spy(eventManager, 'logEvent');

    const storage = new Storage(win);
    storageMock = sandbox.mock(storage);
    sandbox.stub(deps, 'storage').returns(storage);

    fetcher = new Fetcher(win);
    entitlementsManager = new EntitlementsManager(
      win,
      pageConfig,
      fetcher,
      deps
    );
    entitlementsManagerMock = sandbox.mock(entitlementsManager);
    sandbox.stub(deps, 'entitlementsManager').returns(entitlementsManager);

    clientConfigManager = new ClientConfigManager(deps, pubId, fetcher);
    clientConfigManagerMock = sandbox.mock(clientConfigManager);
    sandbox.stub(deps, 'clientConfigManager').returns(clientConfigManager);

    sandbox.stub(MiniPromptApi.prototype, 'init');
    autoPromptManager = new AutoPromptManager(deps);
    autoPromptManager.autoPromptDisplayed_ = true;

    miniPromptApiMock = sandbox.mock(autoPromptManager.miniPromptAPI_);
    alternatePromptSpy = sandbox.spy();

    actionFlowSpy = sandbox.spy(audienceActionFlow, 'AudienceActionFlow');
    startSpy = sandbox.spy(
      audienceActionFlow.AudienceActionFlow.prototype,
      'start'
    );
  });

  afterEach(() => {
    entitlementsManagerMock.verify();
    clientConfigManagerMock.verify();
    storageMock.verify();
    miniPromptApiMock.verify();
  });

  function setWinWithAnalytics(gtag, ga) {
    const winWithAnalytics = Object.assign({}, win);
    if (!gtag) {
      delete winWithAnalytics.gtag;
    }
    if (!ga) {
      delete winWithAnalytics.ga;
    }
    autoPromptManager.deps_.win.restore();
    sandbox.stub(autoPromptManager.deps_, 'win').returns(winWithAnalytics);
  }

  it('returns an instance of MiniPromptApi from getMiniPromptApi', () => {
    const miniPromptApi = autoPromptManager.getMiniPromptApi(deps);
    expect(miniPromptApi).to.be.instanceof(MiniPromptApi);
  });

  it('should be listening for events from the events manager', () => {
    expect(eventManagerCallback).to.not.be.null;
  });

  it('should locally store contribution impressions when contribution impression events are fired', async () => {
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.IMPRESSIONS, /* useLocalStorage */ true)
      .resolves(null)
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        StorageKeys.IMPRESSIONS,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();

    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should locally store subscription impressions when subscription impression events are fired', async () => {
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.IMPRESSIONS, /* useLocalStorage */ true)
      .resolves(null)
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        StorageKeys.IMPRESSIONS,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();

    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  [
    {
      miniPromptEventType:
        AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
      largePromptEventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      dismissableEventType: AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED,
      autoPromptType: AutoPromptType.CONTRIBUTION,
    },
    {
      miniPromptEventType:
        AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT,
      largePromptEventType: AnalyticsEvent.IMPRESSION_OFFERS,
      dismissableEventType: AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    },
  ].forEach((params) => {
    const {
      miniPromptEventType,
      largePromptEventType,
      dismissableEventType,
      autoPromptType,
    } = params;

    it(`should not store a ${autoPromptType} impression if a previous prompt impression has been stored`, async () => {
      storageMock
        .expects('get')
        .withExactArgs(StorageKeys.IMPRESSIONS, /* useLocalStorage */ true)
        .resolves(null)
        .once();
      storageMock
        .expects('set')
        .withExactArgs(
          StorageKeys.IMPRESSIONS,
          sandbox.match.any,
          /* useLocalStorage */ true
        )
        .resolves()
        .exactly(1);
      storageMock
        .expects('get')
        .withExactArgs(StorageKeys.DISMISSALS, /* useLocalStorage */ true)
        .resolves(null)
        .once();
      storageMock
        .expects('set')
        .withExactArgs(
          StorageKeys.DISMISSALS,
          sandbox.match.any,
          /* useLocalStorage */ true
        )
        .resolves()
        .once();

      await eventManagerCallback({
        eventType: miniPromptEventType,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });

      await eventManagerCallback({
        eventType: largePromptEventType,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });

      await eventManagerCallback({
        eventType: dismissableEventType,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });
  });

  it('should locally store contribution dismissals when contribution dismissal events are fired', async () => {
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.DISMISSALS, /* useLocalStorage */ true)
      .resolves(null)
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        StorageKeys.DISMISSALS,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();

    await eventManagerCallback({
      eventType: AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should locally store subscription dismissals when subscription dismissal events are fired', async () => {
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.DISMISSALS, /* useLocalStorage */ true)
      .resolves(null)
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        StorageKeys.DISMISSALS,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();

    await eventManagerCallback({
      eventType: AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should record the last dismissed flow if one was setup', async () => {
    autoPromptManager.promptDisplayed_ = AutoPromptType.CONTRIBUTION;
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.DISMISSALS, /* useLocalStorage */ true)
      .resolves(null)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.DISMISSED_PROMPTS, /* useLocalStorage */ true)
      .resolves(null)
      .once();

    storageMock
      .expects('set')
      .withExactArgs(
        StorageKeys.DISMISSALS,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        StorageKeys.DISMISSED_PROMPTS,
        AutoPromptType.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .resolves()
      .once();

    await eventManagerCallback({
      eventType: AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should record survey completed on survey submit action', async () => {
    autoPromptManager.promptDisplayed_ = AutoPromptType.CONTRIBUTION;
    storageMock
      .expects('set')
      .withExactArgs(
        StorageKeys.SURVEY_COMPLETED,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();
    await eventManagerCallback({
      eventType: AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should not store events when an impression or dismissal was fired for a paygated article', async () => {
    sandbox.stub(pageConfig, 'isLocked').returns(true);
    storageMock.expects('get').never();
    storageMock.expects('set').never();

    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });

    await eventManagerCallback({
      eventType: AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should ignore irrelevant events', async () => {
    storageMock.expects('get').never();
    storageMock.expects('set').never();

    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_AD,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should display the contribution mini prompt if the user has no entitlements', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const clientConfig = new ClientConfig();
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // alwaysShow is false
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the mini prompt, but not fetch entitlements and client config if alwaysShow is enabled', async () => {
    entitlementsManagerMock.expects('getEntitlements').never();
    clientConfigManagerMock.expects('getAutoPromptConfig').never();
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: true,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the large prompt, but not fetch entitlements and client config if alwaysShow is enabled', async () => {
    entitlementsManagerMock.expects('getEntitlements').never();
    clientConfigManagerMock.expects('getAutoPromptConfig').never();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
      alwaysShow: true,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.be.calledOnce;
  });

  it('should not display any prompt if the type is undefined', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const clientConfig = new ClientConfig();
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: undefined,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should not display any prompt if the type is NONE', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const clientConfig = new ClientConfig();
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.NONE,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should not display any prompt if the auto prompt config is not returned', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const clientConfig = new ClientConfig();
    clientConfigManagerMock
      .expects('getClientConfig')
      .returns(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config does not cap impressions', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const clientConfig = new ClientConfig();
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // alwaysShow is false
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should not display the mini prompt if the auto prompt config caps impressions, and the user is over the cap, and sufficient time has not yet passed since the specified hide duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // Two stored impressions.
    const storedImpressions =
      (CURRENT_TIME - 1).toString() + ',' + CURRENT_TIME.toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config caps impressions, and the user is over the cap, but sufficient time has passed since the specified hide duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // Two stored impressions.
    const storedImpressions =
      (CURRENT_TIME - 20000).toString() +
      ',' +
      (CURRENT_TIME - 11000).toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config caps impressions, and the user is under the cap', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression.
    const storedImpressions = CURRENT_TIME.toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should not display the mini prompt if the auto prompt config caps impressions, and the user is under the cap, but sufficient time has not yet passed since the specified backoff duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      impressionBackOffSeconds: 10,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 5,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression.
    const storedImpressions = (CURRENT_TIME - 6000).toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the large prompt if the auto prompt config caps impressions, and the user is under the cap', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    setupPreviousImpressionAndDismissals(storageMock, {
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });

    await tick(8);
    expect(alternatePromptSpy).to.be.calledOnce;
  });

  it('should display the mini prompt if the auto prompt config caps impressions, and the user is under the cap after discounting old impressions', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // Two stored impressions, the first from 2 weeks ago.
    const twoWeeksInMs = 1209600000;
    const storedImpressions =
      (CURRENT_TIME - twoWeeksInMs).toString() + ',' + CURRENT_TIME.toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should not display the mini prompt if the auto prompt config caps dismissals, and the user is over the cap', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      displayDelaySeconds: 0,
      dismissalBackOffSeconds: 0,
      maxDismissalsPerWeek: 1,
      maxDismissalsResultingHideSeconds: 10,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 10ms ago and one dismissal from 5ms ago.
    const storedImpressions = (CURRENT_TIME - 10).toString();
    const storedDismissals = (CURRENT_TIME - 5).toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      storedDismissals,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config caps dismissals, and the user is over the cap, but sufficient time has passed since the specified hide duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      displayDelaySeconds: 0,
      dismissalBackOffSeconds: 0,
      maxDismissalsPerWeek: 1,
      maxDismissalsResultingHideSeconds: 10,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 20s ago and one dismissal from 11s ago.
    const storedImpressions = (CURRENT_TIME - 20000).toString();
    const storedDismissals = (CURRENT_TIME - 11000).toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      storedDismissals,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should not display the mini prompt if the auto prompt config caps dismissals, and the user is under the cap, but sufficient time has not yet passed since the backoff duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      displayDelaySeconds: 0,
      dismissalBackOffSeconds: 10,
      maxDismissalsPerWeek: 2,
      maxDismissalsResultingHideSeconds: 5,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 20s ago and one dismissal from 6s ago.
    const storedImpressions = (CURRENT_TIME - 20000).toString();
    const storedDismissals = (CURRENT_TIME - 6000).toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      storedDismissals,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config caps dismissals, and the user is under the cap, and sufficient time has passed since the specified backoff duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      displayDelaySeconds: 0,
      dismissalBackOffSeconds: 5,
      maxDismissalsPerWeek: 2,
      maxDismissalsResultingHideSeconds: 10,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const clientConfig = new ClientConfig({autoPromptConfig});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 20s ago and one dismissal from 6s ago.
    const storedImpressions = (CURRENT_TIME - 20000).toString();
    const storedDismissals = (CURRENT_TIME - 6000).toString();
    setupPreviousImpressionAndDismissals(storageMock, {
      storedImpressions,
      storedDismissals,
      dismissedPromptGetCallCount: 1,
      getUserToken: false,
    });
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    await tick(8);
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the subscription mini prompt if the user has no entitlements', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const clientConfig = new ClientConfig();
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    await tick(8);
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should not display any prompt if the user has a valid entitlement', async () => {
    const entitlements = new Entitlements();
    sandbox.stub(entitlements, 'enablesThis').returns(true);
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const clientConfig = new ClientConfig();
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the alternate prompt if the user has no entitlements, but the content is paygated', async () => {
    sandbox.stub(pageConfig, 'isLocked').returns(true);
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    const clientConfig = new ClientConfig();
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });

    await tick(5);
    expect(alternatePromptSpy).to.be.calledOnce;
  });

  it('should not display any prompt if UI predicate is false', async () => {
    sandbox.stub(pageConfig, 'isLocked').returns(false);
    const entitlements = new Entitlements();
    sandbox.stub(entitlements, 'enablesThis').returns(true);
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();

    const autoPromptConfig = new AutoPromptConfig();
    const uiPredicates = new UiPredicates(
      /* canDisplayAutoPrompt */ false,
      /* canDisplayButton */ true
    );
    const clientConfig = new ClientConfig({
      autoPromptConfig,
      useUpdatedOfferFlows: true,
      uiPredicates,
    });
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should display the contribution mini prompt if the user has no entitlements and UI predicate is true', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();

    const autoPromptConfig = new AutoPromptConfig();
    const uiPredicates = new UiPredicates(
      /* canDisplayAutoPrompt */ true,
      /* canDisplayButton */ true
    );
    const clientConfig = new ClientConfig({
      autoPromptConfig,
      useUpdatedOfferFlows: true,
      uiPredicates,
    });
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.not.be.called;
  });

  it('should log events when a large prompt overrides the miniprompt', async () => {
    win./*OK*/ innerWidth = 500;
    setExperiment(win, ExperimentFlags.DISABLE_DESKTOP_MINIPROMPT, true);
    const expectedEvent = {
      eventType: AnalyticsEvent.EVENT_DISABLE_MINIPROMPT_DESKTOP,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: false,
      additionalParameters: {
        publicationid: pubId,
        promptType: AutoPromptType.CONTRIBUTION,
      },
    };

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: true,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(logEventSpy).to.be.calledOnceWith(expectedEvent);
    expect(alternatePromptSpy).to.be.calledOnce;
  });

  it('should replace the contribution miniprompt with a large prompt if DISABLE_DESKTOP_MINIPROMPT is enabled and viewport is wider than 480px', async () => {
    win./*OK*/ innerWidth = 500;
    setExperiment(win, ExperimentFlags.DISABLE_DESKTOP_MINIPROMPT, true);
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: true,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.be.calledOnce;
  });

  it('should replace the subscription miniprompt with a large prompt if DISABLE_DESKTOP_MINIPROMPT is enabled and viewport is wider than 480px', async () => {
    win./*OK*/ innerWidth = 500;
    setExperiment(win, ExperimentFlags.DISABLE_DESKTOP_MINIPROMPT, true);
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      alwaysShow: true,
      displayLargePromptFn: alternatePromptSpy,
    });
    expect(alternatePromptSpy).to.be.calledOnce;
  });

  it('should not replace the miniprompt with a large prompt when DISABLE_DESKTOP_MINIPROMPT is enabled but the viewport is narrower than 480px', async () => {
    win./*OK*/ innerWidth = 450;
    setExperiment(win, ExperimentFlags.DISABLE_DESKTOP_MINIPROMPT, true);
    const expectedEvent = {
      eventType: AnalyticsEvent.EVENT_DISABLE_MINIPROMPT_DESKTOP,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: false,
      additionalParameters: {
        publicationid: pubId,
        promptType: AutoPromptType.CONTRIBUTION,
      },
    };

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: true,
      displayLargePromptFn: alternatePromptSpy,
    });
    logEventSpy.should.not.have.been.calledWith(expectedEvent);
    expect(alternatePromptSpy).to.not.be.called;
  });

  describe('AudienceActionFlow', () => {
    let articleExpectation;

    beforeEach(() => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      const entitlements = new Entitlements();
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      const clientConfig = new ClientConfig();
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();
      articleExpectation = entitlementsManagerMock.expects('getArticle');
      articleExpectation
        .resolves({
          audienceActions: {
            actions: [{type: 'TYPE_REGISTRATION_WALL'}],
            engineId: '123',
          },
        })
        .once();
    });

    it('should display an AudienceActionFlow if there are any actions provided in the article response', async () => {
      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(5);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
      });
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
    });

    it('should call the original prompt for no article actions', async () => {
      articleExpectation
        .resolves({
          audienceActions: {},
        })
        .once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(5);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(alternatePromptSpy).to.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.equal(null);
    });

    it('should return the last AudienceActionFlow', async () => {
      const lastAudienceActionFlow = new audienceActionFlow.AudienceActionFlow(
        deps,
        {
          action: 'TYPE_REGISTRATION_WALL',
          onCancel: undefined,
          autoPromptType: AutoPromptType.CONTRIBUTION,
        }
      );
      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      autoPromptManager.setLastAudienceActionFlow(lastAudienceActionFlow);

      expect(autoPromptManager.getLastAudienceActionFlow()).to.equal(
        lastAudienceActionFlow
      );
    });
  });

  describe('Contribution Flows with Audience Actions', () => {
    let articleExpectation;

    beforeEach(() => {
      const autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
      });
      const uiPredicates = new UiPredicates(
        /* canDisplayAutoPrompt */ true,
        /* canDisplayButton */ true
      );
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        useUpdatedOfferFlows: true,
        uiPredicates,
      });
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();
      sandbox.stub(pageConfig, 'isLocked').returns(false);
      const entitlements = new Entitlements();
      sandbox.stub(entitlements, 'enablesThis').returns(false);
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      articleExpectation = entitlementsManagerMock.expects('getArticle');
      articleExpectation
        .resolves({
          audienceActions: {
            actions: [
              {type: 'TYPE_REWARDED_SURVEY'},
              {type: 'TYPE_REGISTRATION_WALL'},
              {type: 'TYPE_NEWSLETTER_SIGNUP'},
            ],
            engineId: '123',
          },
        })
        .once();
    });

    it('should show the Contribution prompt before any actions', async () => {
      setupPreviousImpressionAndDismissals(storageMock, {
        dismissedPromptGetCallCount: 1,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(
        AutoPromptType.CONTRIBUTION
      );
    });

    it('should show the first Audience Action flow if a Contribution was previously dismissed and is not the next Contribution prompt time', async () => {
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts: AutoPromptType.CONTRIBUTION,
        dismissedPromptGetCallCount: 2,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(
        'TYPE_REWARDED_SURVEY'
      );
      await verifyOnCancelStores('contribution,TYPE_REWARDED_SURVEY');
    });

    it('should show the second Audience Action flow if the first was previously dismissed and is not the next Contribution prompt time', async () => {
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts: 'contribution,TYPE_REWARDED_SURVEY',
        dismissedPromptGetCallCount: 2,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        'contribution,TYPE_REWARDED_SURVEY,TYPE_REGISTRATION_WALL'
      );
    });

    it('should skip survey and show second Audience Action flow if survey was completed', async () => {
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      const storedSurveyCompleted = (CURRENT_TIME - 5).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts: AutoPromptType.CONTRIBUTION,
        dismissedPromptGetCallCount: 2,
        storedSurveyCompleted,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores('contribution,TYPE_REGISTRATION_WALL');
    });

    it('should skip survey and show second Audience Action flow if survey data transfer failed', async () => {
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      const storedSurveyFailed = (CURRENT_TIME - 5).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts: AutoPromptType.CONTRIBUTION,
        dismissedPromptGetCallCount: 2,
        storedSurveyFailed,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores('contribution,TYPE_REGISTRATION_WALL');
    });

    it('should show nothing if the the last Audience Action was previously dismissed and is not in the next Contribution prompt time', async () => {
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts:
          'contribution,TYPE_REWARDED_SURVEY,TYPE_REGISTRATION_WALL,TYPE_NEWSLETTER_SIGNUP',
        dismissedPromptGetCallCount: 1,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(null);
    });

    it('should show the Contribution Flow even if there is an available Audience Action that was previously dismissed and is in the next Contribution prompt time', async () => {
      // One stored impression from 20s ago and one dismissal from 6s ago.
      const storedImpressions = (CURRENT_TIME - 20000).toString();
      const storedDismissals = (CURRENT_TIME - 6000).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts: 'contribution,TYPE_REWARDED_SURVEY',
        dismissedPromptGetCallCount: 1,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(null);
    });

    it('should show survey if TYPE_REWARDED_SURVEY is next and is ga eligible but not gtag eligible', async () => {
      setWinWithAnalytics(/* gtag */ false, /* ga */ true);
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts: AutoPromptType.CONTRIBUTION,
        dismissedPromptGetCallCount: 2,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(
        'TYPE_REWARDED_SURVEY'
      );
      await verifyOnCancelStores('contribution,TYPE_REWARDED_SURVEY');
    });

    it('should show survey if TYPE_REWARDED_SURVEY is next and is gtag eligible but not ga eligible', async () => {
      setWinWithAnalytics(/* gtag */ true, /* ga */ false);
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts: AutoPromptType.CONTRIBUTION,
        dismissedPromptGetCallCount: 2,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(
        'TYPE_REWARDED_SURVEY'
      );
      await verifyOnCancelStores('contribution,TYPE_REWARDED_SURVEY');
    });

    it('should skip action and continue the Contribution Flow if TYPE_REWARDED_SURVEY is next but publisher is not eligible for ga nor gTag', async () => {
      setWinWithAnalytics(/* gtag */ false, /* ga */ false);
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      setupPreviousImpressionAndDismissals(storageMock, {
        storedImpressions,
        storedDismissals,
        dismissedPrompts: AutoPromptType.CONTRIBUTION,
        dismissedPromptGetCallCount: 2,
        getUserToken: true,
      });
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
        displayLargePromptFn: alternatePromptSpy,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      expect(alternatePromptSpy).to.not.have.been.called;
      expect(autoPromptManager.promptDisplayed_).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores('contribution,TYPE_REGISTRATION_WALL');
    });

    async function verifyOnCancelStores(setValue) {
      storageMock
        .expects('set')
        .withExactArgs(
          StorageKeys.DISMISSED_PROMPTS,
          setValue,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();
      const {onCancel} = actionFlowSpy.firstCall.args[1];
      onCancel();
      await tick(2);
    }
  });
  function setupPreviousImpressionAndDismissals(storageMock, setupArgs) {
    const {
      storedImpressions,
      storedDismissals,
      dismissedPrompts,
      dismissedPromptGetCallCount,
      storedSurveyCompleted,
      storedSurveyFailed,
      getUserToken,
    } = {
      storedImpressions: null,
      storedDismissals: null,
      dismissedPrompts: null,
      storedSurveyCompleted: null,
      storedSurveyFailed: null,
      ...setupArgs,
    };
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.IMPRESSIONS, /* useLocalStorage */ true)
      .resolves(storedImpressions)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.DISMISSALS, /* useLocalStorage */ true)
      .resolves(storedDismissals)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.DISMISSED_PROMPTS, /* useLocalStorage */ true)
      .resolves(dismissedPrompts)
      .exactly(dismissedPromptGetCallCount);
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.SURVEY_COMPLETED, /* useLocalStorage */ true)
      .resolves(storedSurveyCompleted)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(
        StorageKeys.SURVEY_DATA_TRANSFER_FAILED,
        /* useLocalStorage */ true
      )
      .resolves(storedSurveyFailed)
      .once();
    if (getUserToken) {
      storageMock
        .expects('get')
        .withExactArgs(Constants.USER_TOKEN, /* useLocalStorage */ true)
        .resolves('token')
        .atMost(1);
    }
  }
});
