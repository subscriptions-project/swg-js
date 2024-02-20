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
import * as audienceActionLocalFlow from './audience-action-local-flow';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {AutoPromptConfig} from '../model/auto-prompt-config';
import {AutoPromptManager} from './auto-prompt-manager';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfig, UiPredicates} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {
  Constants,
  ImpressionStorageKeys,
  StorageKeys,
} from '../utils/constants';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {ExperimentFlags} from './experiment-flags';
import {GlobalDoc} from '../model/doc';
import {MiniPromptApi} from './mini-prompt-api';
import {MockDeps} from '../../test/mock-deps';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {XhrFetcher} from './fetcher';
import {setExperiment} from './experiments';
import {tick} from '../../test/tick';

const CURRENT_TIME = 1615416442; // GMT: Wednesday, March 10, 2021 10:47:22 PM
const SECOND_IN_MS = Math.pow(10, 3);
const SECOND_IN_NANO = Math.pow(10, 9);
const CONTRIBUTION_INTERVENTION = {
  type: 'TYPE_CONTRIBUTION',
  configurationId: 'contribution_config_id',
};
const SURVEY_INTERVENTION = {
  type: 'TYPE_REWARDED_SURVEY',
  configurationId: 'survey_config_id',
};
const NEWSLETTER_INTERVENTION = {
  type: 'TYPE_NEWSLETTER_SIGNUP',
  configurationId: 'newsletter_config_id',
};
const NEWSLETTER_INTERVENTION_PUBLISHER_PROMPT = {
  type: 'TYPE_NEWSLETTER_SIGNUP',
  configurationId: 'newsletter_config_id',
  preference: 'PREFERENCE_PUBLISHER_PROVIDED_PROMPT',
};
const REGWALL_INTERVENTION = {
  type: 'TYPE_REGISTRATION_WALL',
  configurationId: 'regwall_config_id',
};
const SUBSCRIPTION_INTERVENTION = {
  type: 'TYPE_SUBSCRIPTION',
  configurationId: 'subscription_config_id',
};
const REWARDED_AD_INTERVENTION = {
  type: 'TYPE_REWARDED_AD',
  configurationId: 'rewarded_ad_config_id',
};

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
  let miniPromptApiMock;
  let actionFlowSpy;
  let startSpy;
  let runtime;
  let contributionPromptFnSpy;
  let subscriptionPromptFnSpy;
  const productId = 'pub1:label1';
  const pubId = 'pub1';

  beforeEach(() => {
    deps = new MockDeps();

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

    fetcher = new XhrFetcher(win);
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

    runtime = new ConfiguredRuntime(win, pageConfig);
    contributionPromptFnSpy = sandbox.spy(runtime, 'showContributionOptions');
    subscriptionPromptFnSpy = sandbox.spy(runtime, 'showOffers');

    sandbox.stub(MiniPromptApi.prototype, 'init');
    autoPromptManager = new AutoPromptManager(deps, runtime);
    autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = true;

    miniPromptApiMock = sandbox.mock(autoPromptManager.miniPromptAPI_);

    actionFlowSpy = sandbox.spy(audienceActionFlow, 'AudienceActionIframeFlow');
    startSpy = sandbox.spy(
      audienceActionFlow.AudienceActionIframeFlow.prototype,
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
    autoPromptManager.interventionDisplayed_ = {
      type: AutoPromptType.CONTRIBUTION,
    };
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
    autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = false;
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

  it('should ignore undefined events', async () => {
    storageMock.expects('get').never();
    storageMock.expects('set').never();

    await eventManagerCallback({
      eventType: undefined,
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

  it('should not set frequency cap local storage if experiment is disabled', async () => {
    autoPromptManager.frequencyCappingLocalStorageEnabled_ = false;
    autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = true;
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .never();
    storageMock
      .expects('set')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .never();
    // Legacy storage operations
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
      eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should not set frequency cap local storage if experiment is enabled and content is locked', async () => {
    autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
    autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = true;
    sandbox.stub(pageConfig, 'isLocked').returns(true);
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .never();
    storageMock
      .expects('set')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .never();

    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should not set frequency cap local storage if experiment is enabled and prompt was nondismissible', async () => {
    autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
    autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = true;
    autoPromptManager.isClosable_ = false;
    sandbox.stub(pageConfig, 'isLocked').returns(true);
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .never();
    storageMock
      .expects('set')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .never();

    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  it('should set frequency cap local storage if experiment is enabled and a dismissible contribution prompt was triggered on a locked page', async () => {
    autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
    autoPromptManager.autoPromptType_ = AutoPromptType.CONTRIBUTION_LARGE;
    autoPromptManager.isClosable_ = true;
    sandbox.stub(pageConfig, 'isLocked').returns(true);
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .resolves(null)
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();

    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });

    expect(autoPromptManager.hasStoredMiniPromptImpression_).to.equal(true);
  });

  it('should set frequency cap local storage if experiment is enabled and a monetization prompt was triggered', async () => {
    autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
    autoPromptManager.isClosable_ = true;
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .resolves(null)
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();
    // Legacy storage operations
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
      eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });

    expect(autoPromptManager.hasStoredMiniPromptImpression_).to.equal(true);
  });

  it('should set frequency cap local storage if experiment is enabled and a mini monetization prompt was triggered', async () => {
    autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
    autoPromptManager.isClosable_ = true;
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .resolves(null)
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();
    // Legacy storage operations
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

    expect(autoPromptManager.hasStoredMiniPromptImpression_).to.equal(true);
  });

  it('should set frequency cap local storage only once if experiment is enabled and both mini and normal monetization prompts were triggered', async () => {
    autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
    autoPromptManager.isClosable_ = true;
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .resolves(null)
      .once();
    storageMock
      .expects('set')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .resolves()
      .once();
    // Legacy storage operations
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
    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });

    expect(autoPromptManager.hasStoredMiniPromptImpression_).to.equal(true);
  });

  it('should not set frequency cap local storage if experiment is enabled and hasStoredImpression is true and a monetization prompt was triggered', async () => {
    autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
    autoPromptManager.isClosable_ = true;
    autoPromptManager.hasStoredMiniPromptImpression_ = true;
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .never();
    storageMock
      .expects('set')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        CURRENT_TIME.toString(),
        /* useLocalStorage */ true
      )
      .never();
    // Legacy storage operations
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
      eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
  });

  [
    {
      eventType: AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN,
      storageKey: ImpressionStorageKeys.NEWSLETTER_SIGNUP,
    },
    {
      eventType: AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN,
      storageKey: ImpressionStorageKeys.NEWSLETTER_SIGNUP,
    },
    {
      eventType: AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN,
      storageKey: ImpressionStorageKeys.REGISTRATION_WALL,
    },
    {
      eventType: AnalyticsEvent.IMPRESSION_SURVEY,
      storageKey: ImpressionStorageKeys.REWARDED_SURVEY,
    },
    {
      eventType: AnalyticsEvent.IMPRESSION_REWARDED_AD,
      storageKey: ImpressionStorageKeys.REWARDED_AD,
    },
  ].forEach(({eventType, storageKey}) => {
    it(`for eventType=${eventType} and storageKey=${storageKey}, should set frequency cap timestamps via local storage if experiment is enabled`, async () => {
      autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
      autoPromptManager.isClosable_ = true;
      storageMock
        .expects('get')
        .withExactArgs(storageKey, /* useLocalStorage */ true)
        .resolves(null)
        .once();
      storageMock
        .expects('set')
        .withExactArgs(
          storageKey,
          CURRENT_TIME.toString(),
          /* useLocalStorage */ true
        )
        .resolves()
        .once();

      await eventManagerCallback({
        eventType,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });
  });

  it('should display the mini prompt, but not fetch entitlements and client config if alwaysShow is enabled', async () => {
    entitlementsManagerMock.expects('getEntitlements').never();
    clientConfigManagerMock.expects('getAutoPromptConfig').never();
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: true,
    });
  });

  it('should display the large prompt, but not fetch entitlements and client config if alwaysShow is enabled', async () => {
    entitlementsManagerMock.expects('getEntitlements').never();
    clientConfigManagerMock.expects('getAutoPromptConfig').never();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
      alwaysShow: true,
    });
  });

  it('should not display a prompt if the autoprompttype is unknown and alwaysShow is enabled', async () => {
    entitlementsManagerMock.expects('getEntitlements').never();
    clientConfigManagerMock.expects('getAutoPromptConfig').never();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: 'UNKNOWN',
      alwaysShow: true,
    });
  });

  it('should not show monetization prompt as soft paywall if the type is undefined', async () => {
    const shouldShow =
      await autoPromptManager.shouldShowMonetizationPromptAsSoftPaywall(
        undefined,
        false
      );
    expect(shouldShow).to.be.false;
  });

  it('should not show monetization prompt as soft paywall if the type is NONE', async () => {
    const shouldShow =
      await autoPromptManager.shouldShowMonetizationPromptAsSoftPaywall(
        AutoPromptType.NONE,
        false
      );
    expect(shouldShow).to.be.false;
  });

  it('should not display a prompt if the type is undefined', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const clientConfig = new ClientConfig({});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: undefined,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
    expect(subscriptionPromptFnSpy).to.not.be.called;
  });

  it('should not display a prompt if the type is NONE', async () => {
    entitlementsManagerMock.expects('getEntitlements').never();
    entitlementsManagerMock.expects('getArticle').never();
    clientConfigManagerMock.expects('getClientConfig').never();
    storageMock.expects('get').never();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.NONE,
      alwaysShow: false,
    });
    await tick(10);

    expect(startSpy).to.not.have.been.called;
    expect(actionFlowSpy).to.not.have.been.called;
    expect(autoPromptManager.getLastAudienceActionFlow()).to.equal(null);
    expect(contributionPromptFnSpy).to.not.be.called;
    expect(subscriptionPromptFnSpy).to.not.be.called;
  });

  it('should not display any prompt if the auto prompt config is not returned', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .returns(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should not display any prompt if canDisplayAutoPrompt is false', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ false);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .returns(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      // autoPromptType value not provided
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
    expect(subscriptionPromptFnSpy).to.not.be.called;
  });

  it('should display the mini prompt if the user has no entitlements and auto prompt config does not cap impressions', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should not display the mini contribution prompt if the article is null', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock.expects('getArticle').resolves(null).once();
    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should not display the mini contribution prompt if the article returns no actions', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock.expects('getArticle').resolves({}).once();
    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should not display the mini prompt if the auto prompt config caps impressions, and the user is over the cap, and sufficient time has not yet passed since the specified hide duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // Two stored impressions.
    const storedImpressions =
      (CURRENT_TIME - 1).toString() + ',' + CURRENT_TIME.toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config caps impressions, and the user is over the cap, but sufficient time has passed since the specified hide duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // Two stored impressions.
    const storedImpressions =
      (CURRENT_TIME - 20000).toString() +
      ',' +
      (CURRENT_TIME - 11000).toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config caps impressions, and the user is under the cap', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression.
    const storedImpressions = CURRENT_TIME.toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should not display the mini prompt if the auto prompt config caps impressions, and the user is under the cap, but sufficient time has not yet passed since the specified backoff duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      impressionBackOffSeconds: 10,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 5,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression.
    const storedImpressions = (CURRENT_TIME - 6000).toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should display the large prompt if the auto prompt config caps impressions, and the user is under the cap', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.be.calledOnce;
  });

  it('should display the mini prompt if the auto prompt config caps impressions, and the user is under the cap after discounting old impressions', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // Two stored impressions, the first from 2 weeks ago.
    const twoWeeksInMs = 1209600000;
    const storedImpressions =
      (CURRENT_TIME - twoWeeksInMs).toString() + ',' + CURRENT_TIME.toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should not display the mini prompt if the auto prompt config caps dismissals, and the user is over the cap', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      displayDelaySeconds: 0,
      numImpressionsBetweenPrompts: 2,
      dismissalBackOffSeconds: 0,
      maxDismissalsPerWeek: 1,
      maxDismissalsResultingHideSeconds: 10,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 10ms ago and one dismissal from 5ms ago.
    const storedImpressions = (CURRENT_TIME - 10).toString();
    const storedDismissals = (CURRENT_TIME - 5).toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        storedDismissals,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config caps dismissals, and the user is over the cap, but sufficient time has passed since the specified hide duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      displayDelaySeconds: 0,
      numImpressionsBetweenPrompts: 2,
      dismissalBackOffSeconds: 0,
      maxDismissalsPerWeek: 1,
      maxDismissalsResultingHideSeconds: 10,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 20s ago and one dismissal from 11s ago.
    const storedImpressions = (CURRENT_TIME - 20000).toString();
    const storedDismissals = (CURRENT_TIME - 11000).toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        storedDismissals,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('handles null values for maxDismissalsResultingHideSeconds and maxImpressionsResultingHideSeconds', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      maxDismissalsResultingHideSeconds: null,
      maxImpressionsResultingHideSeconds: null,
      displayDelaySeconds: 0,
      numImpressionsBetweenPrompts: 2,
      dismissalBackOffSeconds: 0,
      maxDismissalsPerWeek: 1,
      maxImpressions: 2,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 20s ago and one dismissal from 11s ago.
    const storedImpressions = (CURRENT_TIME - 20000).toString();
    const storedDismissals = (CURRENT_TIME - 11000).toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        storedDismissals,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should not display the mini prompt if the auto prompt config caps dismissals, and the user is under the cap, but sufficient time has not yet passed since the backoff duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      displayDelaySeconds: 0,
      numImpressionsBetweenPrompts: 2,
      dismissalBackOffSeconds: 10,
      maxDismissalsPerWeek: 2,
      maxDismissalsResultingHideSeconds: 5,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 20s ago and one dismissal from 6s ago.
    const storedImpressions = (CURRENT_TIME - 20000).toString();
    const storedDismissals = (CURRENT_TIME - 6000).toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        storedDismissals,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should display the mini prompt if the auto prompt config caps dismissals, and the user is under the cap, and sufficient time has passed since the specified backoff duration', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({
      displayDelaySeconds: 0,
      numImpressionsBetweenPrompts: 2,
      dismissalBackOffSeconds: 5,
      maxDismissalsPerWeek: 2,
      maxDismissalsResultingHideSeconds: 10,
      maxImpressions: 2,
      maxImpressionsResultingHideSeconds: 10,
    });
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    // One stored impression from 20s ago and one dismissal from 6s ago.
    const storedImpressions = (CURRENT_TIME - 20000).toString();
    const storedDismissals = (CURRENT_TIME - 6000).toString();
    setupPreviousImpressionAndDismissals(
      storageMock,
      {
        storedImpressions,
        storedDismissals,
        dismissedPromptGetCallCount: 1,
        getUserToken: false,
      },
      /* setAutopromptExpectations */ true,
      /* setSurveyExpectations */ false
    );
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should display the subscription mini prompt if the user has no entitlements', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [SUBSCRIPTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(subscriptionPromptFnSpy).to.not.be.called;
  });

  it('should not display the mini subscription prompt if the article returns no actions', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock.expects('getArticle').resolves({}).once();
    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(subscriptionPromptFnSpy).to.not.be.called;
  });

  [
    {
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      interventionDisplayed: 'TYPE_SUBSCRIPTION',
    },
    {
      autoPromptType: AutoPromptType.CONTRIBUTION,
      interventionDisplayed: 'TYPE_CONTRIBUTION',
    },
    {autoPromptType: 'UNKNOWN', interventionDisplayed: undefined},
  ].forEach(({autoPromptType, interventionDisplayed}) => {
    it(`should set autoPromptManager internal state for autoPromptType: (${autoPromptType})`, async () => {
      const entitlements = new Entitlements();
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      entitlementsManagerMock
        .expects('getArticle')
        .resolves({
          audienceActions: {
            actions: [
              {
                type: interventionDisplayed,
                configurationId: 'config_id',
              },
            ],
            engineId: '123',
          },
        })
        .once();
      const autoPromptConfig = new AutoPromptConfig({
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType,
        alwaysShow: false,
      });
      await tick(10);

      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(true);
      expect(autoPromptManager.interventionDisplayed_?.type).to.equal(
        interventionDisplayed
      );
    });
  });

  it('should not display any prompt if the user has a valid entitlement', async () => {
    const entitlements = new Entitlements();
    sandbox.stub(entitlements, 'enablesThis').returns(true);
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
  });

  it('should display a blocking prompt for locked content in the contribution flow if the user has no entitlements', async () => {
    sandbox.stub(pageConfig, 'isLocked').returns(true);
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();
    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
    const clientConfig = new ClientConfig({autoPromptConfig, uiPredicates});
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(clientConfig)
      .once();
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
      alwaysShow: false,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.be.calledOnce;
  });

  [
    {
      autoPromptType: AutoPromptType.CONTRIBUTION,
    },
    {
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    },
  ].forEach(({autoPromptType}) => {
    it(`should not display any monetization prompt if the article returns no actions for autoPromptType: ${autoPromptType}`, async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      const entitlements = new Entitlements();
      sandbox.stub(entitlements, 'enablesThis').returns(false);
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      entitlementsManagerMock
        .expects('getArticle')
        .resolves({
          audienceActions: {
            actions: [
              // No action is eligible
            ],
            engineId: '123',
          },
        })
        .once();

      const autoPromptConfig = new AutoPromptConfig({});
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
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
        autoPromptType,
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(contributionPromptFnSpy).to.not.be.called;
      expect(subscriptionPromptFnSpy).to.not.be.called;
    });
  });

  it('should display the contribution mini prompt if the user has no entitlements and UI predicate is true', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .resolves(entitlements)
      .once();
    entitlementsManagerMock
      .expects('getArticle')
      .resolves({
        audienceActions: {
          actions: [CONTRIBUTION_INTERVENTION],
          engineId: '123',
        },
      })
      .once();

    const autoPromptConfig = new AutoPromptConfig({});
    const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
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
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.not.be.called;
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
      timestamp: sandbox.match.number,
    };

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: true,
    });
    await tick(10);

    expect(logEventSpy).to.be.calledOnceWith(expectedEvent);
  });

  it('should replace the contribution miniprompt with a large prompt if DISABLE_DESKTOP_MINIPROMPT is enabled and viewport is wider than 480px', async () => {
    win./*OK*/ innerWidth = 500;
    setExperiment(win, ExperimentFlags.DISABLE_DESKTOP_MINIPROMPT, true);
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: true,
    });
    await tick(10);

    expect(contributionPromptFnSpy).to.be.calledOnce;
  });

  it('should replace the subscription miniprompt with a large prompt if DISABLE_DESKTOP_MINIPROMPT is enabled and viewport is wider than 480px', async () => {
    win./*OK*/ innerWidth = 500;
    setExperiment(win, ExperimentFlags.DISABLE_DESKTOP_MINIPROMPT, true);
    miniPromptApiMock.expects('create').never();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      alwaysShow: true,
    });
    await tick(10);

    expect(subscriptionPromptFnSpy).to.be.calledOnce;
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
    miniPromptApiMock.expects('create').once();

    await autoPromptManager.showAutoPrompt({
      autoPromptType: AutoPromptType.CONTRIBUTION,
      alwaysShow: true,
    });
    await tick(10);

    logEventSpy.should.not.have.been.calledWith(expectedEvent);
    expect(contributionPromptFnSpy).to.not.be.called;
  });

  describe('AudienceActionFlow', () => {
    let getArticleExpectation;

    beforeEach(() => {
      autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = false;
      const entitlements = new Entitlements();
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      const autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        useUpdatedOfferFlows: true,
        uiPredicates,
      });
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();
      getArticleExpectation = entitlementsManagerMock.expects('getArticle');
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [REGWALL_INTERVENTION, SUBSCRIPTION_INTERVENTION],
            engineId: '123',
          },
        })
        .once();
    });

    it('should set article experiment flag from experiment config', async () => {
      getArticleExpectation.resolves({
        experimentConfig: {
          experimentFlags: [
            'frequency_capping_local_storage_experiment',
            'prompt_frequency_capping_experiment',
          ],
        },
      });
      await autoPromptManager.showAutoPrompt({alwaysShow: false});

      expect(autoPromptManager.frequencyCappingLocalStorageEnabled_).to.equal(
        true
      );
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
    });

    it('should display an AudienceActionFlow if the page is locked and there are any actions provided in the article response', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        alwaysShow: false,
      });
      await tick(7);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: false,
      });
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
    });

    it('should override isClosable if page is locked and isClosable is defined', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        alwaysShow: false,
        isClosable: true,
      });
      await tick(7);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: true,
      });
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
    });

    it('should show the first Contribution prompt for the contribution flow', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [CONTRIBUTION_INTERVENTION, NEWSLETTER_INTERVENTION],
            engineId: '123',
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(contributionPromptFnSpy).to.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(true);
      expect(autoPromptManager.getLastAudienceActionFlow()).to.equal(null);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_CONTRIBUTION'
      );
    });

    it('should show a soft paywall for unlocked content in the subscription flow', async () => {
      await autoPromptManager.showAutoPrompt({
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(subscriptionPromptFnSpy).to.have.been.calledOnce;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(true);
      expect(autoPromptManager.getLastAudienceActionFlow()).to.equal(null);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_SUBSCRIPTION'
      );
    });

    // Note: Locked content on contribution is not an officially supported flow
    it('should show an uncapped contribution prompt for locked content in the contribution flow', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [CONTRIBUTION_INTERVENTION, SURVEY_INTERVENTION],
            engineId: '123',
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(contributionPromptFnSpy).to.have.been.calledOnce;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.getLastAudienceActionFlow()).to.equal(null);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_CONTRIBUTION'
      );
    });

    it('should show an uncapped prompt for paywalled content in the subscription flow', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);

      await autoPromptManager.showAutoPrompt({
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: false,
      });
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
    });

    [
      {
        autoPromptType: AutoPromptType.CONTRIBUTION,
      },
      {
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
      },
      {
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      },
      {
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
      },
    ].forEach(({autoPromptType}) => {
      it(`should not show any prompt if the article returns no actions for autoPromptType: ${autoPromptType}`, async () => {
        getArticleExpectation
          .resolves({
            audienceActions: {},
          })
          .once();
        miniPromptApiMock.expects('create').never();

        await autoPromptManager.showAutoPrompt({
          autoPromptType,
          alwaysShow: false,
        });
        await tick(8);

        expect(startSpy).to.not.have.been.called;
        expect(actionFlowSpy).to.not.have.been.called;
        expect(contributionPromptFnSpy).to.not.have.been.called;
        expect(subscriptionPromptFnSpy).to.not.have.been.called;
      });
    });

    it('should return the last AudienceActionFlow', async () => {
      const lastAudienceActionFlow =
        new audienceActionFlow.AudienceActionIframeFlow(deps, {
          action: 'TYPE_REGISTRATION_WALL',
          onCancel: undefined,
          autoPromptType: AutoPromptType.CONTRIBUTION,
        });
      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
      });
      autoPromptManager.setLastAudienceActionFlow(lastAudienceActionFlow);

      expect(autoPromptManager.getLastAudienceActionFlow()).to.equal(
        lastAudienceActionFlow
      );
    });
  });

  describe('Contribution Flows with Audience Actions', () => {
    let getArticleExpectation;

    beforeEach(() => {
      autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = false;
      const autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
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
      getArticleExpectation = entitlementsManagerMock.expects('getArticle');
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              {
                type: 'TYPE_CONTRIBUTION',
                configurationId: 'contribution_config_id',
              },
              SURVEY_INTERVENTION,
              REGWALL_INTERVENTION,
              NEWSLETTER_INTERVENTION,
            ],
            engineId: '123',
          },
        })
        .once();
    });

    it('should show the Contribution prompt before any actions', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutoPromptExpectations */ true,
        /* setSurveyExpectations */ false
      );
      miniPromptApiMock.expects('create').once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(true);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_CONTRIBUTION'
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
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
        isClosable: true,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REWARDED_SURVEY'
      );
      expect(autoPromptManager.interventionDisplayed_.configurationId).to.equal(
        'survey_config_id'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'contribution,TYPE_REWARDED_SURVEY'
      );
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
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
        isClosable: true,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'contribution,TYPE_REWARDED_SURVEY,TYPE_REGISTRATION_WALL'
      );
    });

    it('should show the third Audience Action flow if the first two were previously dismissed and is not the next Contribution prompt time', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              CONTRIBUTION_INTERVENTION,
              SURVEY_INTERVENTION,
              REGWALL_INTERVENTION,
              NEWSLETTER_INTERVENTION,
            ],
            engineId: '123',
          },
        })
        .once();
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
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
        isClosable: true,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
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
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
        isClosable: true,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'contribution,TYPE_REGISTRATION_WALL'
      );
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
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
        isClosable: true,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'contribution,TYPE_REGISTRATION_WALL'
      );
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
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_).to.equal(null);
    });

    it('should show the Contribution Flow even if there is an available Audience Action that was previously dismissed and is in the next Contribution prompt time', async () => {
      // One stored impression from 20s ago and one dismissal from 6s ago.
      const storedImpressions = (CURRENT_TIME - 20000).toString();
      const storedDismissals = (CURRENT_TIME - 6000).toString();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          storedImpressions,
          storedDismissals,
          dismissedPrompts: 'contribution,TYPE_REWARDED_SURVEY',
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutoPromptExpectations */ true,
        /* setSurveyExpectations */ false
      );
      miniPromptApiMock.expects('create').once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(true);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_CONTRIBUTION'
      );
    });

    [
      {
        gaEligible: false,
        gtagEligible: true,
      },
      {
        gaEligible: true,
        gtagEligible: false,
      },
    ].forEach(({gaEligible, gtagEligible}) => {
      it(`should show survey if TYPE_REWARDED_SURVEY is next and is ga eligible: ${gaEligible}, is gTag eligible: ${gtagEligible}`, async () => {
        setWinWithAnalytics(/* gtag */ gtagEligible, /* ga */ gaEligible);
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
        });
        await tick(10);

        expect(startSpy).to.have.been.calledOnce;
        expect(actionFlowSpy).to.have.been.calledWith(deps, {
          action: 'TYPE_REWARDED_SURVEY',
          configurationId: 'survey_config_id',
          onCancel: sandbox.match.any,
          autoPromptType: AutoPromptType.CONTRIBUTION,
          isClosable: true,
        });
        expect(contributionPromptFnSpy).to.not.have.been.called;
        expect(
          autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
        ).to.equal(false);
        expect(autoPromptManager.interventionDisplayed_.type).to.equal(
          'TYPE_REWARDED_SURVEY'
        );
        expect(
          autoPromptManager.interventionDisplayed_.configurationId
        ).to.equal('survey_config_id');
        await verifyOnCancelStores(
          storageMock,
          actionFlowSpy,
          'contribution,TYPE_REWARDED_SURVEY'
        );
      });
    });

    it('should skip action and continue the Contribution Flow if TYPE_REWARDED_SURVEY is next but publisher is not eligible for ga nor gTag', async () => {
      setWinWithAnalytics(/* gtag */ false, /* ga */ false);
      const storedImpressions = (CURRENT_TIME - 5).toString();
      const storedDismissals = (CURRENT_TIME - 10).toString();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          storedImpressions,
          storedDismissals,
          dismissedPrompts: AutoPromptType.CONTRIBUTION,
          dismissedPromptGetCallCount: 2,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ true,
        /* setSurveyExpectations */ false
      );
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION,
        isClosable: true,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'contribution,TYPE_REGISTRATION_WALL'
      );
    });
  });

  describe('Non-Monetary Revenue Model with Audience Actions', () => {
    let getArticleExpectation;

    beforeEach(() => {
      autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = false;
      const autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
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
      getArticleExpectation = entitlementsManagerMock.expects('getArticle');
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              SURVEY_INTERVENTION,
              REGWALL_INTERVENTION,
              NEWSLETTER_INTERVENTION,
            ],
            engineId: '123',
          },
        })
        .once();
    });

    it('should show the first Audience Action flow', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 2,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        // autoPromptType value not provided
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: undefined,
        isClosable: true,
      });
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REWARDED_SURVEY'
      );
      expect(autoPromptManager.interventionDisplayed_.configurationId).to.equal(
        'survey_config_id'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'TYPE_REWARDED_SURVEY'
      );
    });

    it('should show the second Audience Action flow if the first was previously dismissed', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPrompts: 'TYPE_REWARDED_SURVEY',
          dismissedPromptGetCallCount: 2,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        // autoPromptType value not provided
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: undefined,
        isClosable: true,
      });
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'TYPE_REWARDED_SURVEY,TYPE_REGISTRATION_WALL'
      );
    });

    it('should show the third Audience Action flow if the first two were previously dismissed', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPrompts: 'TYPE_REWARDED_SURVEY,TYPE_REGISTRATION_WALL',
          dismissedPromptGetCallCount: 2,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        // autoPromptType value not provided
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: undefined,
        isClosable: true,
      });
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_NEWSLETTER_SIGNUP'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'TYPE_REWARDED_SURVEY,TYPE_REGISTRATION_WALL,TYPE_NEWSLETTER_SIGNUP'
      );
    });

    it('should skip survey and show second Audience Action flow if survey was completed', async () => {
      const storedSurveyCompleted = (CURRENT_TIME - 5).toString();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 2,
          storedSurveyCompleted,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        // autoPromptType value not provided
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: undefined,
        isClosable: true,
      });
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'TYPE_REGISTRATION_WALL'
      );
    });

    it('should skip survey and show second Audience Action flow if survey data transfer failed', async () => {
      const storedSurveyFailed = (CURRENT_TIME - 5).toString();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 2,
          storedSurveyFailed,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        // autoPromptType value not provided
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: undefined,
        isClosable: true,
      });
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'TYPE_REGISTRATION_WALL'
      );
    });

    it('should show nothing if the the last Audience Action was previously dismissed', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPrompts:
            'TYPE_REWARDED_SURVEY,TYPE_REGISTRATION_WALL,TYPE_NEWSLETTER_SIGNUP',
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        // autoPromptType value not provided
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_).to.equal(null);
    });

    [
      {
        gaEligible: false,
        gtagEligible: true,
      },
      {
        gaEligible: true,
        gtagEligible: false,
      },
    ].forEach(({gaEligible, gtagEligible}) => {
      it(`should show survey if TYPE_REWARDED_SURVEY is next and is ga eligible ${gaEligible}, and is gTag eligible: ${gtagEligible}`, async () => {
        setWinWithAnalytics(/* gtag */ gtagEligible, /* ga */ gaEligible);
        setupPreviousImpressionAndDismissals(
          storageMock,
          {
            dismissedPromptGetCallCount: 2,
            getUserToken: true,
          },
          /* setAutopromptExpectations */ false
        );
        miniPromptApiMock.expects('create').never();

        await autoPromptManager.showAutoPrompt({
          // autoPromptType value not provided
          alwaysShow: false,
        });
        await tick(10);

        expect(startSpy).to.have.been.calledOnce;
        expect(actionFlowSpy).to.have.been.calledWith(deps, {
          action: 'TYPE_REWARDED_SURVEY',
          configurationId: 'survey_config_id',
          onCancel: sandbox.match.any,
          autoPromptType: undefined,
          isClosable: true,
        });
        expect(
          autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
        ).to.equal(false);
        expect(autoPromptManager.interventionDisplayed_.type).to.equal(
          'TYPE_REWARDED_SURVEY'
        );
        expect(
          autoPromptManager.interventionDisplayed_.configurationId
        ).to.equal('survey_config_id');
        await verifyOnCancelStores(
          storageMock,
          actionFlowSpy,
          'TYPE_REWARDED_SURVEY'
        );
      });
    });

    it('should skip action and continue the Contribution Flow if TYPE_REWARDED_SURVEY is next but publisher is not eligible for ga nor gTag', async () => {
      setWinWithAnalytics(/* gtag */ false, /* ga */ false);
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 2,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false,
        /* setSurveyExpectations */ false
      );
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        // autoPromptType value not provided
        alwaysShow: false,
      });
      await tick(10);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: undefined,
        isClosable: true,
      });
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REGISTRATION_WALL'
      );
      await verifyOnCancelStores(
        storageMock,
        actionFlowSpy,
        'TYPE_REGISTRATION_WALL'
      );
    });
  });

  describe('Prompt Frequency Capping Flow', () => {
    let autoPromptConfig;
    let getArticleExpectation;
    let getClientConfigExpectation;
    const globalFrequencyCapDurationSeconds = 100;
    const contributionFrequencyCapDurationSeconds = 10800;
    const surveyFrequencyCapDurationSeconds = 7200;
    const newsletterFrequencyCapDurationSeconds = 3600;
    const promptFrequencyCaps = [
      {
        audienceActionType: CONTRIBUTION_INTERVENTION.type,
        frequencyCapDuration: {
          seconds: contributionFrequencyCapDurationSeconds,
        },
      },
      {
        audienceActionType: SURVEY_INTERVENTION.type,
        frequencyCapDuration: {seconds: surveyFrequencyCapDurationSeconds},
      },
      {
        audienceActionType: NEWSLETTER_INTERVENTION.type,
        frequencyCapDuration: {seconds: newsletterFrequencyCapDurationSeconds},
      },
    ];
    const anyPromptFrequencyCapDurationSeconds = 600;

    beforeEach(() => {
      autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
        globalFrequencyCapDurationSeconds,
        promptFrequencyCaps,
        anyPromptFrequencyCapDurationSeconds,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation =
        clientConfigManagerMock.expects('getClientConfig');
      getClientConfigExpectation.resolves(clientConfig).once();
      const entitlements = new Entitlements();
      sandbox.stub(entitlements, 'enablesThis').returns(false);
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      getArticleExpectation = entitlementsManagerMock.expects('getArticle');
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              CONTRIBUTION_INTERVENTION,
              SURVEY_INTERVENTION,
              NEWSLETTER_INTERVENTION,
            ],
            engineId: '123',
          },
          experimentConfig: {
            experimentFlags: [
              'frequency_capping_local_storage_experiment',
              'prompt_frequency_capping_experiment',
            ],
          },
        })
        .once();
      autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = false;
    });

    it('should execute the legacy triggering flow if there is no frequency cap config', async () => {
      autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();

      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ true,
        /* setSurveyExpectations */ false
      );

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(10);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(true);
      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should not show any prompt if there are no audience actions', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [],
            engineId: '123',
          },
          experimentConfig: {
            experimentFlags: [
              'frequency_capping_local_storage_experiment',
              'prompt_frequency_capping_experiment',
            ],
          },
        })
        .once();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false,
        /* setSurveyExpectations */ false
      );

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should not show any prompt if there are no eligible audience actions', async () => {
      setWinWithAnalytics(/* gtag */ false, /* ga */ false);
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          experimentConfig: {
            experimentFlags: [
              'frequency_capping_local_storage_experiment',
              'prompt_frequency_capping_experiment',
            ],
          },
        })
        .once();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false,
        /* setSurveyExpectations */ false
      );

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should show the first prompt if there are no stored impressions', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      expectFrequencyCappingGlobalImpressions(storageMock);
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show the first prompt if the frequency cap is not met', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const contributionTimestamps = (
        CURRENT_TIME -
        10 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: contributionTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(contributionTimestamps)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show the first contribution prompt if it is not dismissible', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );

      await autoPromptManager.showAutoPrompt({
        alwaysShow: false,
        isClosable: false,
      });
      await tick(20);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should not show any prompt if the global frequency cap is met', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: (
          CURRENT_TIME -
          0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
        ).toString(),
      });

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should not show any prompt if the global frequency cap is met via nanos', async () => {
      autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
        globalFrequencyCapDurationNano:
          globalFrequencyCapDurationSeconds * SECOND_IN_NANO,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: (
          CURRENT_TIME -
          0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
        ).toString(),
      });

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should show the second prompt if the frequency cap for contributions is met', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const contributionTimestamps = (
        CURRENT_TIME -
        (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: contributionTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(contributionTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(25);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
      });
    });

    it('should show the second prompt if the global frequency cap is undefined and prompt frequency cap for contributions is met', async () => {
      autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
        promptFrequencyCaps,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const contributionTimestamps = (
        CURRENT_TIME -
        (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS
      ).toString();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(contributionTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
      });
    });

    it('should show the second prompt if the frequency cap for contributions is undefined and the default anyPromptFrequencyCap is met', async () => {
      autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
        globalFrequencyCapDurationSeconds,
        anyPromptFrequencyCapDurationSeconds,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const contributionTimestamps = (
        CURRENT_TIME -
        2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: contributionTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(contributionTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(25);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
      });
    });

    it('should show the third prompt if the frequency cap for contributions is met and survey analytics is not configured', async () => {
      setWinWithAnalytics(/* gtag */ false, /* ga */ false);
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false,
        /* setSurveyExpectations */ false
      );
      const contributionTimestamps = (
        CURRENT_TIME -
        2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: contributionTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(contributionTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.NEWSLETTER_SIGNUP,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
      });
    });

    it('should show the third prompt if the frequency caps for contributions and surveys are met', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const promptTimestamps = (
        CURRENT_TIME -
        (surveyFrequencyCapDurationSeconds - 1) * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: promptTimestamps,
        survey: promptTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.NEWSLETTER_SIGNUP,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(30);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
      });
    });

    it('should show the third prompt if the frequency caps for contributions and surveys are undefined and the default anyPromptFrequencyCap is met', async () => {
      autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
        globalFrequencyCapDurationSeconds,
        anyPromptFrequencyCapDurationSeconds,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const promptTimestamps = (
        CURRENT_TIME -
        (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: promptTimestamps,
        survey: promptTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.NEWSLETTER_SIGNUP,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(30);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
      });
    });

    it('should not show any prompt if the frequency cap is met for all prompts (but global cap is not)', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const promptTimestamps = (
        CURRENT_TIME -
        2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: promptTimestamps,
        survey: promptTimestamps,
        newsletter: promptTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.NEWSLETTER_SIGNUP,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should not show any prompt if the frequency cap undefined for all prompts and the default anyPromptFrequencyCap is met (but global cap is not)', async () => {
      autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
        dismissalBackOffSeconds: 5,
        maxDismissalsPerWeek: 2,
        maxDismissalsResultingHideSeconds: 10,
        maxImpressions: 2,
        maxImpressionsResultingHideSeconds: 10,
        globalFrequencyCapDurationSeconds,
        anyPromptFrequencyCapDurationSeconds,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const promptTimestamps = (
        CURRENT_TIME -
        (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: promptTimestamps,
        survey: promptTimestamps,
        newsletter: promptTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.NEWSLETTER_SIGNUP,
          /* useLocalStorage */ true
        )
        .resolves(promptTimestamps)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should not show any dismissible prompt if the global frequency cap is met on locked content', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: (
          CURRENT_TIME -
          0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
        ).toString(),
      });

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(autoPromptManager.isClosable_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should show the second dismissible prompt if the frequency cap for contributions is met on locked content', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const contributionTimestamps = (
        CURRENT_TIME -
        2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: contributionTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(contributionTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(25);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(autoPromptManager.isClosable_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
      });
    });

    it('should show the contribution as a mini prompt', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      expectFrequencyCappingGlobalImpressions(storageMock);
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();
      miniPromptApiMock.expects('create').once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: false,
      });
      await tick(20);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should show the first nondismissible subscription prompt for metered flow', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              SURVEY_INTERVENTION,
              REGWALL_INTERVENTION,
              SUBSCRIPTION_INTERVENTION,
            ],
            engineId: '123',
          },
          experimentConfig: {
            experimentFlags: [
              'frequency_capping_local_storage_experiment',
              'prompt_frequency_capping_experiment',
            ],
          },
        })
        .once();

      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        alwaysShow: false,
      });
      await tick(20);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: false,
      });
    });

    it('should not show any prompt if the global frequency cap is met for subscription openaccess content', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              SURVEY_INTERVENTION,
              REGWALL_INTERVENTION,
              SUBSCRIPTION_INTERVENTION,
            ],
            engineId: '123',
          },
          experimentConfig: {
            experimentFlags: [
              'frequency_capping_local_storage_experiment',
              'prompt_frequency_capping_experiment',
            ],
          },
        })
        .once();

      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );

      expectFrequencyCappingGlobalImpressions(storageMock, {
        subscription: (
          CURRENT_TIME -
          0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
        ).toString(),
      });

      await autoPromptManager.showAutoPrompt({
        alwaysShow: false,
        isClosable: true,
      });
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(autoPromptManager.isClosable_).to.equal(true);
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should show the second dismissible prompt if the frequency cap is met for subscription openaccess content', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              SURVEY_INTERVENTION,
              REGWALL_INTERVENTION,
              SUBSCRIPTION_INTERVENTION,
            ],
            engineId: '123',
          },
          experimentConfig: {
            experimentFlags: [
              'frequency_capping_local_storage_experiment',
              'prompt_frequency_capping_experiment',
            ],
          },
        })
        .once();

      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );

      const surveyTimestamps = (
        CURRENT_TIME -
        2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        survey: surveyTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(surveyTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REGISTRATION_WALL,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({
        alwaysShow: false,
        isClosable: true,
      });
      await tick(25);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(autoPromptManager.isClosable_).to.equal(true);
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: true,
      });
    });

    it('should execute the legacy frequency cap flow if the experiment is disabled', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              CONTRIBUTION_INTERVENTION,
              SURVEY_INTERVENTION,
              NEWSLETTER_INTERVENTION,
            ],
            engineId: '123',
          },
        })
        .once();

      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ true,
        /* setSurveyExpectations */ false
      );

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(10);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(false);
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(true);
      expect(autoPromptManager.interventionDisplayed_?.type).to.equal(
        'TYPE_CONTRIBUTION'
      );
      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should execute the legacy subscription flow if the experiment is disabled', async () => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              SURVEY_INTERVENTION,
              REGWALL_INTERVENTION,
              SUBSCRIPTION_INTERVENTION,
            ],
            engineId: '123',
          },
        })
        .once();

      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );

      await autoPromptManager.showAutoPrompt({
        alwaysShow: false,
      });
      await tick(10);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(false);
      expect(
        autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_
      ).to.equal(false);
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: false,
      });
    });

    it('should display a monetization prompt for an unknown autoprompt type if the next action is a monetization prompt', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      expectFrequencyCappingGlobalImpressions(storageMock);
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: 'unknown',
        alwaysShow: false,
      });
      await tick(25);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(contributionPromptFnSpy).to.be.calledOnce;
      expect(startSpy).to.not.have.been.called;
    });

    it('should display a dismissible prompt for an unknown autoprompt type if the next action is a nonmonetization prompt', async () => {
      setupPreviousImpressionAndDismissals(
        storageMock,
        {
          dismissedPromptGetCallCount: 1,
          getUserToken: true,
        },
        /* setAutopromptExpectations */ false
      );
      const contributionTimestamps = (
        CURRENT_TIME -
        2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS
      ).toString();
      expectFrequencyCappingGlobalImpressions(storageMock, {
        contribution: contributionTimestamps,
      });
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.CONTRIBUTION,
          /* useLocalStorage */ true
        )
        .resolves(contributionTimestamps)
        .once();
      storageMock
        .expects('get')
        .withExactArgs(
          ImpressionStorageKeys.REWARDED_SURVEY,
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: 'unknown',
        alwaysShow: false,
      });
      await tick(25);

      expect(autoPromptManager.promptFrequencyCappingEnabled_).to.equal(true);
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        onCancel: sandbox.match.any,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
      });
    });
  });

  describe('Helper Functions', () => {
    it('isFrequencyCapped_ should return false for empty impressions', async () => {
      const duration = {seconds: 60, nano: 0};
      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        []
      );
      expect(isFrequencyCapped).to.equal(false);
    });

    it('isFrequencyCapped_ should return false for impressions that occurred outside of the cap duration', async () => {
      const duration = {seconds: 60, nano: 0};
      const impressions = [CURRENT_TIME - 120 * SECOND_IN_MS];
      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );
      expect(isFrequencyCapped).to.equal(false);
    });

    it('isFrequencyCapped_ should return true if the max impression occurred within of the cap duration', async () => {
      const duration = {seconds: 60, nano: 0};
      const impressions = [
        CURRENT_TIME - 10 * SECOND_IN_MS,
        CURRENT_TIME - 120 * SECOND_IN_MS,
      ];
      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );
      expect(isFrequencyCapped).to.equal(true);
    });

    it('isFrequencyCapped_ should return true for impressions that occurred within the cap duration', async () => {
      const duration = {seconds: 60, nano: 0};
      const impressions = [CURRENT_TIME - 10 * SECOND_IN_MS];
      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );
      expect(isFrequencyCapped).to.equal(true);
    });

    it('isFrequencyCapped_ should return true if the max impression occurred within the cap duration, including nanos', async () => {
      const duration = {seconds: 60, nano: 60 * SECOND_IN_NANO};
      const impressions = [CURRENT_TIME - 90 * SECOND_IN_MS];
      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );
      expect(isFrequencyCapped).to.equal(true);
    });

    it('isFrequencyCapped_ should return false if the max impression occurred within the cap duration, including negative nanos', async () => {
      const duration = {seconds: 120, nano: -60 * SECOND_IN_NANO};
      const impressions = [CURRENT_TIME - 90 * SECOND_IN_MS];
      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );
      expect(isFrequencyCapped).to.equal(false);
    });

    it('getActionImpressions_ should return empty timestamps and log error event if an action type does not map to the storage key', async () => {
      const impressions = await autoPromptManager.getActionImpressions_(
        'undefined'
      );
      expect(logEventSpy).to.be.calledOnceWith({
        eventType:
          AnalyticsEvent.EVENT_ACTION_IMPRESSIONS_STORAGE_KEY_NOT_FOUND_ERROR,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(impressions.length).to.equal(0);
    });

    it('isSurveyEligible_ returns false when survey is not a potential audience action', async () => {
      const isSurveyEligible = await autoPromptManager.isSurveyEligible_([
        CONTRIBUTION_INTERVENTION,
      ]);
      expect(isSurveyEligible).to.equal(false);
    });

    it('getMonetizationPromptFun_ returns function that does not open a mini or large prompt with an undefined input', async () => {
      miniPromptApiMock.expects('create').never();
      const fn = autoPromptManager.getMonetizationPromptFn_(
        AutoPromptType.CONTRIBUTION,
        undefined
      );

      await fn();
      await tick(10);

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('getPotentialAction_ returns the first action and logs error event for contribution flow with no frequencyCapConfig', async () => {
      autoPromptManager.isClosable_ = true;
      const action = await autoPromptManager.getPotentialAction_({
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        article: {audienceActions: {actions: [CONTRIBUTION_INTERVENTION]}},
        frequencyCapConfig: {},
      });
      await tick(10);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_FREQUENCY_CAP_CONFIG_NOT_FOUND_ERROR,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
      });
      expect(action).to.equal(CONTRIBUTION_INTERVENTION);
    });
  });

  function expectFrequencyCappingGlobalImpressions(
    storageMock,
    impressions = {}
  ) {
    const {contribution, newsletter, regwall, survey, ad, subscription} = {
      contribution: null,
      newsletter: null,
      regwall: null,
      survey: null,
      ad: null,
      subscription: null,
      ...impressions,
    };
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.CONTRIBUTION,
        /* useLocalStorage */ true
      )
      .resolves(contribution)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.NEWSLETTER_SIGNUP,
        /* useLocalStorage */ true
      )
      .resolves(newsletter)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.REGISTRATION_WALL,
        /* useLocalStorage */ true
      )
      .resolves(regwall)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.REWARDED_SURVEY,
        /* useLocalStorage */ true
      )
      .resolves(survey)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.REWARDED_AD,
        /* useLocalStorage */ true
      )
      .resolves(ad)
      .once();
    storageMock
      .expects('get')
      .withExactArgs(
        ImpressionStorageKeys.SUBSCRIPTION,
        /* useLocalStorage */ true
      )
      .resolves(subscription)
      .once();
  }

  describe('AudienceActionLocalFlow', () => {
    let getArticleExpectation;
    let actionLocalFlowStub;
    let startLocalSpy;

    beforeEach(() => {
      sandbox.stub(pageConfig, 'isLocked').returns(true);
      autoPromptManager.monetizationPromptWasDisplayedAsSoftPaywall_ = false;
      const entitlements = new Entitlements();
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      const autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds: 0,
        numImpressionsBetweenPrompts: 2,
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
      getArticleExpectation = entitlementsManagerMock.expects('getArticle');
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [REWARDED_AD_INTERVENTION, SUBSCRIPTION_INTERVENTION],
            engineId: '123',
          },
        })
        .once();

      startLocalSpy = sandbox.spy(
        audienceActionLocalFlow.AudienceActionLocalFlow.prototype,
        'start'
      );
      actionLocalFlowStub = sandbox
        .stub(audienceActionLocalFlow, 'AudienceActionLocalFlow')
        .returns({
          start: startLocalSpy,
        });
    });

    it('is rendered for TYPE_REWARDED_ADS', async () => {
      win.googletag = {
        apiReady: true,
        getVersion: () => 'gpt_version_foo',
      };

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
      });

      await tick(7);

      expect(actionLocalFlowStub).to.have.been.calledOnce.calledWith(deps, {
        action: 'TYPE_REWARDED_AD',
        configurationId: 'rewarded_ad_config_id',
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        onCancel: sandbox.match.any,
        isClosable: false,
        monetizationFunction: sandbox.match.any,
      });
      expect(startLocalSpy).to.have.been.calledOnce;
      expect(startSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_REWARDED_AD'
      );
    });

    it('is rendered for TYPE_NEWSLETTER_SIGNUP', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              NEWSLETTER_INTERVENTION_PUBLISHER_PROMPT,
              CONTRIBUTION_INTERVENTION,
            ],
            engineId: '123',
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        alwaysShow: false,
      });

      await tick(7);

      expect(actionLocalFlowStub).to.have.been.calledOnce.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        onCancel: sandbox.match.any,
        isClosable: true,
      });
      expect(startLocalSpy).to.have.been.calledOnce;
      expect(startSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
      expect(autoPromptManager.interventionDisplayed_.type).to.equal(
        'TYPE_NEWSLETTER_SIGNUP'
      );
    });
  });

  async function verifyOnCancelStores(storageMock, actionFlowSpy, setValue) {
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

  function setupPreviousImpressionAndDismissals(
    storageMock,
    setupArgs,
    setAutopromptExpectations = true,
    setSurveyExpectations = true
  ) {
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
      setsNewShouldShowAutoPromptTimestamp: false,
      ...setupArgs,
    };
    if (setAutopromptExpectations) {
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
    }
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.DISMISSED_PROMPTS, /* useLocalStorage */ true)
      .resolves(dismissedPrompts)
      .exactly(dismissedPromptGetCallCount);
    if (setSurveyExpectations) {
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
    }
    if (getUserToken) {
      storageMock
        .expects('get')
        .withExactArgs(Constants.USER_TOKEN, /* useLocalStorage */ true)
        .resolves('token')
        .atMost(1);
    }
  }
});
