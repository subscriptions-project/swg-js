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
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {GlobalDoc} from '../model/doc';
import {MiniPromptApi} from './mini-prompt-api';
import {MockDeps} from '../../test/mock-deps';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {XhrFetcher} from './fetcher';
import {tick} from '../../test/tick';

const CURRENT_TIME = 1615416442; // GMT: Wednesday, March 10, 2021 10:47:22 PM
const TWO_WEEKS_IN_MILLIS = 2 * 604800000;
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
  let winMock;
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
    winMock = sandbox.mock(win);
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

  it('should be listening for events from the events manager', () => {
    expect(eventManagerCallback).to.not.be.null;
  });

  describe('LocalStorage timestamps via Client Event handler', () => {
    it('should ignore undefined events', async () => {
      autoPromptManager.isClosable_ = true;
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await eventManagerCallback({
        eventType: undefined,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it('should not store event timestamps for a non frequency capping event', async () => {
      autoPromptManager.isClosable_ = true;
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await eventManagerCallback({
        eventType: AnalyticsEvent.ACTION_TWG_CREATOR_BENEFIT_CLICK,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it('should ignore irrelevant events', async () => {
      autoPromptManager.isClosable_ = true;
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await eventManagerCallback({
        eventType: AnalyticsEvent.IMPRESSION_AD,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it(`should properly prune and fill all local storage Timestamps`, async () => {
      autoPromptManager.isClosable_ = true;

      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {impressions: [CURRENT_TIME]},
        'TYPE_NEWSLETTER_SIGNUP': {
          impressions: [CURRENT_TIME - TWO_WEEKS_IN_MILLIS - 1],
          dismissals: [CURRENT_TIME - TWO_WEEKS_IN_MILLIS - 1],
        },
        // Unsupported case where action is in local storage with no timestamps
        'TYPE_REWARDED_SURVEY': {},
        'TYPE_REWARDED_AD': {
          impressions: [
            CURRENT_TIME - TWO_WEEKS_IN_MILLIS - 1,
            CURRENT_TIME - TWO_WEEKS_IN_MILLIS,
          ],
          completions: [CURRENT_TIME],
        },
      });
      const timestamps = await autoPromptManager.getTimestamps();
      expect(JSON.stringify(timestamps)).to.equal(
        JSON.stringify({
          'TYPE_CONTRIBUTION': {
            impressions: [CURRENT_TIME],
            dismissals: [],
            completions: [],
          },
          'TYPE_NEWSLETTER_SIGNUP': {
            impressions: [],
            dismissals: [],
            completions: [],
          },
          'TYPE_REWARDED_SURVEY': {
            impressions: [],
            dismissals: [],
            completions: [],
          },
          'TYPE_REWARDED_AD': {
            impressions: [CURRENT_TIME - TWO_WEEKS_IN_MILLIS],
            dismissals: [],
            completions: [CURRENT_TIME],
          },
        })
      );
    });

    // Impression Events
    [
      {eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS},
      {eventType: AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN},
      {eventType: AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN},
      {eventType: AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN},
      {eventType: AnalyticsEvent.IMPRESSION_SURVEY},
      {eventType: AnalyticsEvent.IMPRESSION_REWARDED_AD},
      {eventType: AnalyticsEvent.IMPRESSION_OFFERS},
    ].forEach(({eventType}) => {
      it(`should not store impression timestamps for event ${eventType} for nondismissible prompts`, async () => {
        autoPromptManager.isClosable_ = false;
        storageMock.expects('get').never();
        storageMock.expects('set').never();

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    [
      {
        eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN,
        action: 'TYPE_NEWSLETTER_SIGNUP',
      },
      {
        eventType: AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN,
        action: 'TYPE_NEWSLETTER_SIGNUP',
      },
      {
        eventType: AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN,
        action: 'TYPE_REGISTRATION_WALL',
      },
      {
        eventType: AnalyticsEvent.IMPRESSION_SURVEY,
        action: 'TYPE_REWARDED_SURVEY',
      },
      {
        eventType: AnalyticsEvent.IMPRESSION_REWARDED_AD,
        action: 'TYPE_REWARDED_AD',
      },
      {
        eventType: AnalyticsEvent.IMPRESSION_OFFERS,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, action}) => {
      it(`for eventType=${eventType}, should set impression timestamps for action=${action}`, async () => {
        autoPromptManager.isClosable_ = true;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [action]: {impressions: [CURRENT_TIME]},
        });

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    it(`should set impression timestamps to existing localstorage`, async () => {
      autoPromptManager.isClosable_ = true;
      expectFrequencyCappingTimestamps(
        storageMock,
        {},
        {'TYPE_REWARDED_SURVEY': {impressions: [CURRENT_TIME]}}
      );

      await eventManagerCallback({
        eventType: AnalyticsEvent.IMPRESSION_SURVEY,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it(`should add impression event to existing localstorage with impression timestamps`, async () => {
      autoPromptManager.isClosable_ = true;
      expectFrequencyCappingTimestamps(
        storageMock,
        {'TYPE_REWARDED_SURVEY': {impressions: [CURRENT_TIME]}},
        {
          'TYPE_REWARDED_SURVEY': {
            impressions: [CURRENT_TIME, CURRENT_TIME],
          },
        }
      );

      await eventManagerCallback({
        eventType: AnalyticsEvent.IMPRESSION_SURVEY,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it(`should set impression timestamps for existing local storage timestamp but no impressions`, async () => {
      autoPromptManager.isClosable_ = true;
      expectFrequencyCappingTimestamps(
        storageMock,
        {'TYPE_REWARDED_SURVEY': {dismissals: [CURRENT_TIME]}},
        {
          'TYPE_REWARDED_SURVEY': {
            dismissals: [CURRENT_TIME],
            impressions: [CURRENT_TIME],
          },
        }
      );

      await eventManagerCallback({
        eventType: AnalyticsEvent.IMPRESSION_SURVEY,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it(`should set all event timestamps for a given prompt on storing impressions`, async () => {
      autoPromptManager.isClosable_ = true;
      storageMock
        .expects('get')
        .withExactArgs(StorageKeys.TIMESTAMPS, /* useLocalStorage */ true)
        .resolves('')
        .once();
      storageMock
        .expects('set')
        .withExactArgs(
          StorageKeys.TIMESTAMPS,
          JSON.stringify({
            'TYPE_REWARDED_SURVEY': {
              impressions: [CURRENT_TIME],
              dismissals: [],
              completions: [],
            },
          }),
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.storeImpression('TYPE_REWARDED_SURVEY');
    });

    // Dismissal Events
    [
      {eventType: AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED},
      {eventType: AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_REGWALL_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_SURVEY_CLOSED},
      {eventType: AnalyticsEvent.ACTION_REWARDED_AD_CLOSE},
      {eventType: AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED},
    ].forEach(({eventType}) => {
      it(`should not store dismissal timestamps for event ${eventType} for nondismissible prompts`, async () => {
        autoPromptManager.isClosable_ = false;
        storageMock.expects('get').never();
        storageMock.expects('set').never();

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    [
      {
        eventType: AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_CLOSE,
        action: 'TYPE_NEWSLETTER_SIGNUP',
      },
      {
        eventType: AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE,
        action: 'TYPE_NEWSLETTER_SIGNUP',
      },
      {
        eventType: AnalyticsEvent.ACTION_REGWALL_OPT_IN_CLOSE,
        action: 'TYPE_REGISTRATION_WALL',
      },
      {
        eventType: AnalyticsEvent.ACTION_SURVEY_CLOSED,
        action: 'TYPE_REWARDED_SURVEY',
      },
      {
        eventType: AnalyticsEvent.ACTION_REWARDED_AD_CLOSE,
        action: 'TYPE_REWARDED_AD',
      },
      {
        eventType: AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, action}) => {
      it(`for eventType=${eventType}, should set dismissals via local storage for action=${action}`, async () => {
        autoPromptManager.isClosable_ = true;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [action]: {dismissals: [CURRENT_TIME]},
        });

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    it(`should add dismissals to existing local storage timestamps`, async () => {
      autoPromptManager.isClosable_ = true;
      expectFrequencyCappingTimestamps(
        storageMock,
        {'TYPE_REWARDED_SURVEY': {dismissals: [CURRENT_TIME]}},
        {
          'TYPE_REWARDED_SURVEY': {
            dismissals: [CURRENT_TIME, CURRENT_TIME],
          },
        }
      );

      await eventManagerCallback({
        eventType: AnalyticsEvent.ACTION_SURVEY_CLOSED,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it(`should add dismissals to existing local storage timestamp but no dismissals`, async () => {
      autoPromptManager.isClosable_ = true;
      expectFrequencyCappingTimestamps(
        storageMock,
        {'TYPE_REWARDED_SURVEY': {impressions: [CURRENT_TIME]}},
        {
          'TYPE_REWARDED_SURVEY': {
            impressions: [CURRENT_TIME],
            dismissals: [CURRENT_TIME],
          },
        }
      );

      await eventManagerCallback({
        eventType: AnalyticsEvent.ACTION_SURVEY_CLOSED,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it(`should set all event timestamps for a given prompt on storing dismissals`, async () => {
      autoPromptManager.isClosable_ = true;
      storageMock
        .expects('get')
        .withExactArgs(StorageKeys.TIMESTAMPS, /* useLocalStorage */ true)
        .resolves('')
        .once();
      storageMock
        .expects('set')
        .withExactArgs(
          StorageKeys.TIMESTAMPS,
          JSON.stringify({
            'TYPE_REWARDED_SURVEY': {
              impressions: [],
              dismissals: [CURRENT_TIME],
              completions: [],
            },
          }),
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.storeDismissal('TYPE_REWARDED_SURVEY');
    });

    // Completion Events
    [
      {eventType: AnalyticsEvent.EVENT_CONTRIBUTION_PAYMENT_COMPLETE},
      {eventType: AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_BUTTON_CLICK},
      {eventType: AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT},
      {eventType: AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK},
      {eventType: AnalyticsEvent.ACTION_SURVEY_SUBMIT_CLICK},
      {eventType: AnalyticsEvent.ACTION_REWARDED_AD_VIEW},
      {eventType: AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE},
    ].forEach(({eventType}) => {
      it(`should not store completion timestamps for event ${eventType} for nondismissible prompts`, async () => {
        autoPromptManager.isClosable_ = false;
        storageMock.expects('get').never();
        storageMock.expects('set').never();

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    [
      {
        eventType: AnalyticsEvent.EVENT_CONTRIBUTION_PAYMENT_COMPLETE,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_BUTTON_CLICK,
        action: 'TYPE_NEWSLETTER_SIGNUP',
      },
      {
        eventType: AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT,
        action: 'TYPE_NEWSLETTER_SIGNUP',
      },
      {
        eventType: AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK,
        action: 'TYPE_REGISTRATION_WALL',
      },
      {
        eventType: AnalyticsEvent.ACTION_SURVEY_SUBMIT_CLICK,
        action: 'TYPE_REWARDED_SURVEY',
      },
      {
        eventType: AnalyticsEvent.ACTION_REWARDED_AD_VIEW,
        action: 'TYPE_REWARDED_AD',
      },
      {
        eventType: AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, action}) => {
      it(`for eventType=${eventType}, should set completions via local storage for action=${action}`, async () => {
        autoPromptManager.isClosable_ = true;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [action]: {completions: [CURRENT_TIME]},
        });

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    it(`should add completions to existing local storage timestamps`, async () => {
      autoPromptManager.isClosable_ = true;
      expectFrequencyCappingTimestamps(
        storageMock,
        {'TYPE_REWARDED_SURVEY': {completions: [CURRENT_TIME]}},
        {
          'TYPE_REWARDED_SURVEY': {
            completions: [CURRENT_TIME, CURRENT_TIME],
          },
        }
      );

      await eventManagerCallback({
        eventType: AnalyticsEvent.ACTION_SURVEY_SUBMIT_CLICK,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    it(`should add completions to existing local storage timestamps but no completions`, async () => {
      autoPromptManager.isClosable_ = true;
      expectFrequencyCappingTimestamps(
        storageMock,
        {'TYPE_REWARDED_SURVEY': {impressions: [CURRENT_TIME]}},
        {
          'TYPE_REWARDED_SURVEY': {
            impressions: [CURRENT_TIME],
            completions: [CURRENT_TIME],
          },
        }
      );

      await eventManagerCallback({
        eventType: AnalyticsEvent.ACTION_SURVEY_SUBMIT_CLICK,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });
    });

    [
      {
        eventType: AnalyticsEvent.EVENT_PAYMENT_FAILED,
        autoPromptType: AutoPromptType.CONTRIBUTION,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.EVENT_PAYMENT_FAILED,
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.EVENT_PAYMENT_FAILED,
        autoPromptType: AutoPromptType.SUBSCRIPTION,
        action: 'TYPE_SUBSCRIPTION',
      },
      {
        eventType: AnalyticsEvent.EVENT_PAYMENT_FAILED,
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, autoPromptType, action}) => {
      it(`for generic eventType=${eventType}, should set completions via local storage for autoPromptType=${autoPromptType}`, async () => {
        autoPromptManager.isClosable_ = true;
        autoPromptManager.autoPromptType_ = autoPromptType;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [action]: {completions: [CURRENT_TIME]},
        });

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    it(`should set all event timestamps for a given prompt on storing completions`, async () => {
      autoPromptManager.isClosable_ = true;
      storageMock
        .expects('get')
        .withExactArgs(StorageKeys.TIMESTAMPS, /* useLocalStorage */ true)
        .resolves('')
        .once();
      storageMock
        .expects('set')
        .withExactArgs(
          StorageKeys.TIMESTAMPS,
          JSON.stringify({
            'TYPE_REWARDED_SURVEY': {
              impressions: [],
              dismissals: [],
              completions: [CURRENT_TIME],
            },
          }),
          /* useLocalStorage */ true
        )
        .resolves(null)
        .once();

      await autoPromptManager.storeCompletion('TYPE_REWARDED_SURVEY');
    });
  });

  describe('Miniprompt', () => {
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

    it('should not display a prompt if autoprompttype is NONE', async () => {
      entitlementsManagerMock.expects('getEntitlements').never();
      entitlementsManagerMock.expects('getArticle').never();
      clientConfigManagerMock.expects('getClientConfig').never();
      storageMock.expects('get').never();
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.NONE,
      });
      await tick(10);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.equal(null);
      expect(contributionPromptFnSpy).to.not.be.called;
      expect(subscriptionPromptFnSpy).to.not.be.called;
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
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ false);
      const clientConfig = new ClientConfig({uiPredicates});
      clientConfigManagerMock
        .expects('getClientConfig')
        .returns(clientConfig)
        .once();
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({});
      await tick(10);

      expect(contributionPromptFnSpy).to.not.be.called;
      expect(subscriptionPromptFnSpy).to.not.be.called;
    });

    it('should not display the mini contribution prompt if the article is null', async () => {
      const entitlements = new Entitlements();
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      entitlementsManagerMock.expects('getArticle').resolves(null).once();
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({uiPredicates});
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
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
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({uiPredicates});
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
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
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({uiPredicates});
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();
      miniPromptApiMock.expects('create').once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      });
      await tick(10);

      expect(subscriptionPromptFnSpy).to.not.be.called;
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
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({uiPredicates});
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      await tick(10);

      expect(contributionPromptFnSpy).to.not.be.called;
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
              actions: [], // No action is eligible
              engineId: '123',
            },
          })
          .once();

        const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
        const clientConfig = new ClientConfig({
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

      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
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
      });
      await tick(10);

      expect(contributionPromptFnSpy).to.not.be.called;
    });

    [
      {
        miniPromptEventType:
          AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
        largePromptEventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
        dismissableEventType: AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED,
        autoPromptType: 'TYPE_CONTRIBUTION',
      },
      {
        miniPromptEventType:
          AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT,
        largePromptEventType: AnalyticsEvent.IMPRESSION_OFFERS,
        dismissableEventType: AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED,
        autoPromptType: 'TYPE_SUBSCRIPTION',
      },
    ].forEach((params) => {
      const {
        miniPromptEventType,
        largePromptEventType,
        dismissableEventType,
        autoPromptType,
      } = params;
      it(`should not store an impression for ${autoPromptType} if a previous miniprompt impression has been stored`, async () => {
        autoPromptManager.isClosable_ = true;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [autoPromptType]: {impressions: [CURRENT_TIME]},
        });
        expectFrequencyCappingTimestamps(
          storageMock,
          {[autoPromptType]: {impressions: [CURRENT_TIME]}},
          {
            [autoPromptType]: {
              impressions: [CURRENT_TIME],
              dismissals: [CURRENT_TIME],
            },
          }
        );

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

    // Impression Events
    [
      {eventType: AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT},
      {eventType: AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT},
    ].forEach(({eventType}) => {
      it(`should not store miniprompt impression timestamps for event ${eventType} for nondismissible prompts`, async () => {
        autoPromptManager.isClosable_ = false;
        storageMock.expects('get').never();
        storageMock.expects('set').never();

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    [
      {
        eventType: AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, action}) => {
      it(`for miniprompt eventType=${eventType}, should set impression timestamps for action=${action}`, async () => {
        autoPromptManager.isClosable_ = true;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [action]: {impressions: [CURRENT_TIME]},
        });

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    // Dismissal Events
    [
      {eventType: AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED},
      {eventType: AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_REGWALL_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_SURVEY_CLOSED},
      {eventType: AnalyticsEvent.ACTION_REWARDED_AD_CLOSE},
      {eventType: AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED},
    ].forEach(({eventType}) => {
      it(`should not store dismissal timestamps for miniprompt event ${eventType} for nondismissible prompts`, async () => {
        autoPromptManager.isClosable_ = false;
        storageMock.expects('get').never();
        storageMock.expects('set').never();

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    [
      {
        eventType: AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, action}) => {
      it(`for miniprompt eventType=${eventType}, should set dismissal timestamps for action=${action}`, async () => {
        autoPromptManager.isClosable_ = true;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [action]: {dismissals: [CURRENT_TIME]},
        });

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    it('should log events when a large prompt overrides the miniprompt', async () => {
      win./*OK*/ innerWidth = 500;
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

    it('should replace the contribution miniprompt with a large prompt if viewport is wider than 480px', async () => {
      win./*OK*/ innerWidth = 500;
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
        alwaysShow: true,
      });
      await tick(10);

      expect(contributionPromptFnSpy).to.be.calledOnce;
    });

    it('should replace the subscription miniprompt with a large prompt if viewport is wider than 480px', async () => {
      win./*OK*/ innerWidth = 500;
      miniPromptApiMock.expects('create').never();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.SUBSCRIPTION,
        alwaysShow: true,
      });
      await tick(10);

      expect(subscriptionPromptFnSpy).to.be.calledOnce;
    });

    it('should not replace the miniprompt with a large prompt when the viewport is narrower than 480px', async () => {
      win./*OK*/ innerWidth = 450;
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
  });

  describe('Call to Action (CTA) Button', () => {
    [
      {
        eventType: AnalyticsEvent.ACTION_SWG_BUTTON_SHOW_OFFERS_CLICK,
      },
      {
        eventType: AnalyticsEvent.ACTION_SWG_BUTTON_SHOW_CONTRIBUTIONS_CLICK,
      },
    ].forEach(({eventType}) => {
      it(`should set promptIsFromCtaButton on cta button action: ${eventType}`, async () => {
        autoPromptManager.frequencyCappingLocalStorageEnabled_ = true;
        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
        expect(autoPromptManager.promptIsFromCtaButton_).to.be.true;
      });
    });

    [
      {
        eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.IMPRESSION_OFFERS,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, action}) => {
      it(`for autoprompt eventType=${eventType} and promptIsFromCta_ = true, should not set impressions for action=${action}`, async () => {
        autoPromptManager.promptIsFromCtaButton_ = true;
        autoPromptManager.isClosable_ = true;
        storageMock.expects('get').never();
        storageMock.expects('set').never();

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    [
      {
        eventType: AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, action}) => {
      it(`for autoprompt eventType=${eventType} and promptIsFromCta_ = true, should set dismissals for action=${action}`, async () => {
        autoPromptManager.promptIsFromCtaButton_ = true;
        autoPromptManager.isClosable_ = true;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [action]: {dismissals: [CURRENT_TIME]},
        });

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
    });

    [
      {
        eventType: AnalyticsEvent.EVENT_CONTRIBUTION_PAYMENT_COMPLETE,
        action: 'TYPE_CONTRIBUTION',
      },
      {
        eventType: AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE,
        action: 'TYPE_SUBSCRIPTION',
      },
    ].forEach(({eventType, action}) => {
      it(`for autoprompt eventType=${eventType} and promptIsFromCta_ = true, should set completion for action=${action}`, async () => {
        autoPromptManager.promptIsFromCtaButton_ = true;
        autoPromptManager.isClosable_ = true;
        expectFrequencyCappingTimestamps(storageMock, '', {
          [action]: {completions: [CURRENT_TIME]},
        });

        await eventManagerCallback({
          eventType,
          eventOriginator: EventOriginator.UNKNOWN_CLIENT,
          isFromUserAction: null,
          additionalParameters: null,
        });
      });
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
        })
        .once();
    });

    it('should not show any prompt if there are no audience actions', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [],
            engineId: '123',
          },
        })
        .once();
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

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
        })
        .once();
      expectFrequencyCappingTimestamps(storageMock, {});

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('survey is ineligible if there are completion timestamps', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
        })
        .once();
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_REWARDED_SURVEY': {
          impressions: [CURRENT_TIME],
          completions: [CURRENT_TIME],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should show the prompt after the specified delay', async () => {
      const displayDelaySeconds = 99;
      autoPromptConfig = new AutoPromptConfig({displayDelaySeconds});
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      expectFrequencyCappingTimestamps(storageMock);
      winMock
        .expects('setTimeout')
        .withExactArgs(sandbox.match.any, displayDelaySeconds)
        .once();

      await autoPromptManager.showAutoPrompt({});
      await tick(20);
    });

    it('should show the first prompt and log an error if the FrequencyCapConfig is invalid', async () => {
      autoPromptConfig = new AutoPromptConfig({});
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      expectFrequencyCappingTimestamps(storageMock);

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(contributionPromptFnSpy).to.have.been.calledOnce;
      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_FREQUENCY_CAP_CONFIG_NOT_FOUND_ERROR,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
    });

    it('should show the first prompt if there are no stored impressions', async () => {
      expectFrequencyCappingTimestamps(storageMock);

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show the first prompt if the frequency cap is not met', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              10 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              10 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show the first prompt if the first prompt was abandoned', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME - globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({alwaysShow: false});
      await tick(20);

      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show the first contribution prompt if it is not dismissible', async () => {
      expectFrequencyCappingTimestamps(storageMock);

      await autoPromptManager.showAutoPrompt({isClosable: false});
      await tick(20);

      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show the first prompt and log an error if the timestamps parsed from localstorage is invalid', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          notImpressions: [
            CURRENT_TIME -
              10 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(contributionPromptFnSpy).to.have.been.calledOnce;
      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_LOCAL_STORAGE_TIMESTAMPS_PARSING_ERROR,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
    });

    it('should show the first prompt if frequency cap has passed', async () => {
      const contributionTimestamps =
        CURRENT_TIME -
        (contributionFrequencyCapDurationSeconds + 1) * SECOND_IN_MS;
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [contributionTimestamps],
          dismissals: [contributionTimestamps],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show the second prompt if the frequency cap for contributions is met', async () => {
      const contributionTimestamps =
        CURRENT_TIME -
        (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS;
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [contributionTimestamps],
          dismissals: [contributionTimestamps],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should show the second prompt if the frequency cap for contributions is met via completions', async () => {
      // Note, a contribution completion completes the funnel, but should be
      // treated the same as dismissals in terms of prompt frequency.
      const contributionTimestamps =
        CURRENT_TIME -
        (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS;
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [contributionTimestamps],
          completions: [contributionTimestamps],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(25);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should show the second prompt if the global frequency cap is undefined and prompt frequency cap for contributions is met', async () => {
      autoPromptConfig = new AutoPromptConfig({
        promptFrequencyCaps,
      });
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      const contributionTimestamps =
        CURRENT_TIME -
        (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS;
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [contributionTimestamps],
          dismissals: [contributionTimestamps],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should show the second prompt if the frequency cap for contributions is undefined and the default anyPromptFrequencyCap is met', async () => {
      autoPromptConfig = new AutoPromptConfig({
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
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(25);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CONFIG_NOT_FOUND,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should show the second prompt if the second prompt frequency has passed', async () => {
      autoPromptConfig = new AutoPromptConfig({
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
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              (surveyFrequencyCapDurationSeconds + 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (surveyFrequencyCapDurationSeconds + 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(25);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CONFIG_NOT_FOUND,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should show the third prompt if the frequency cap for contributions is met and survey analytics is not configured', async () => {
      setWinWithAnalytics(/* gtag */ false, /* ga */ false);
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should show the third prompt if the frequency caps for contributions and surveys are met', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              (surveyFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (surveyFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(30);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should show the third prompt if the frequency caps for contributions and surveys are undefined and the default anyPromptFrequencyCap is met', async () => {
      autoPromptConfig = new AutoPromptConfig({
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
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(30);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should show the third prompt if the third prompt frequency has passed', async () => {
      autoPromptConfig = new AutoPromptConfig({
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
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
        'TYPE_NEWSLETTER_SIGNUP': {
          impressions: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds + 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds + 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(30);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });

    it('should not show any prompt if the global frequency cap is met', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_AD': {
          completions: [CURRENT_TIME],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(50);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should not show any prompt if the global frequency cap is met via nanos', async () => {
      autoPromptConfig = new AutoPromptConfig({
        anyPromptFrequencyCapDurationNano:
          anyPromptFrequencyCapDurationSeconds * SECOND_IN_NANO,
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
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(50);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should not show any prompt if the frequency cap is met for all prompts (but global cap is not)', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_NEWSLETTER_SIGNUP': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(50);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should not show any prompt if the frequency cap is met for all prompts via completions (but global cap is not)', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          completions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          completions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_NEWSLETTER_SIGNUP': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          completions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(50);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should not show any prompt if the frequency cap undefined for all prompts and the default anyPromptFrequencyCap is met (but global cap is not)', async () => {
      autoPromptConfig = new AutoPromptConfig({
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
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
        'TYPE_NEWSLETTER_SIGNUP': {
          impressions: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (anyPromptFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should show the first nondismissible subscription prompt for metered flow despite past dismissals', async () => {
      autoPromptManager.isClosable_ = false;
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
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: false,
        calledManually: false,
      });
    });

    it('should show the second dismissible prompt if the frequency cap is met for dismissible subscription', async () => {
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
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              (surveyFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (surveyFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({isClosable: true});
      await tick(50);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CONFIG_NOT_FOUND,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(autoPromptManager.isClosable_).to.equal(true);
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: true,
        calledManually: false,
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
        })
        .once();
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({isClosable: true});
      await tick(50);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(autoPromptManager.isClosable_).to.equal(true);
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('should display a monetization prompt for an unknown autoprompt type if the next action is a monetization prompt', async () => {
      expectFrequencyCappingTimestamps(storageMock);

      await autoPromptManager.showAutoPrompt({autoPromptType: 'unknown'});
      await tick(25);

      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(contributionPromptFnSpy).to.be.calledOnce;
      expect(startSpy).to.not.have.been.called;
    });

    it('should display a dismissible prompt for an unknown autoprompt type if the next action is a nonmonetization prompt', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({autoPromptType: 'unknown'});
      await tick(25);

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
    });
  });

  describe('Helper Functions', () => {
    [
      '12345',
      'this is a string',
      [],
      JSON.stringify({
        'TYPE_CONTRIBUTION': {},
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
        },
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
          dismissals: [0, '12345'],
          completions: [],
        },
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
          dismissals: [0, 'not a timestamps'],
          completions: [],
        },
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
          dismissals: [0],
          completions: [],
          extraField: [],
        },
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
          dismissals: [0],
          completions: [],
        },
        'TYPE WITH EMPTY TIMESTAMPS': {},
      }),
    ].forEach((timestamps) => {
      it('isValidActionsTimestamps_ should return false for invalid timestamps', async () => {
        const isValid = autoPromptManager.isValidActionsTimestamps_(timestamps);
        expect(isValid).to.be.false;
      });
    });

    [
      '',
      '{}',
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
          dismissals: [0],
          completions: [],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [],
          dismissals: [],
          completions: [],
        },
        'SOME_TYPE': {
          impressions: [],
          dismissals: [],
          completions: [],
        },
      }),
    ].forEach((timestamps) => {
      it('isValidActionsTimestamps_ should return true for valid timestamps', async () => {
        const isValid = autoPromptManager.isValidActionsTimestamps_(timestamps);
        expect(isValid).to.be.false;
      });
    });

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
        configurationId: null,
      });
      expect(action).to.equal(CONTRIBUTION_INTERVENTION);
    });
  });

  describe('AudienceActionLocalFlow', () => {
    let getArticleExpectation;
    let actionLocalFlowStub;
    let startLocalSpy;

    beforeEach(() => {
      const entitlements = new Entitlements();
      entitlementsManagerMock
        .expects('getEntitlements')
        .resolves(entitlements)
        .once();
      const autoPromptConfig = new AutoPromptConfig({});
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

      await autoPromptManager.showAutoPrompt({});

      await tick(7);

      expect(actionLocalFlowStub).to.have.been.calledOnce.calledWith(deps, {
        action: 'TYPE_REWARDED_AD',
        configurationId: 'rewarded_ad_config_id',
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: false,
        monetizationFunction: sandbox.match.any,
        calledManually: false,
      });
      expect(startLocalSpy).to.have.been.calledOnce;
      expect(startSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
    });

    it('is rendered for BYOP TYPE_NEWSLETTER_SIGNUP', async () => {
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

      await autoPromptManager.showAutoPrompt({});

      await tick(7);

      expect(actionLocalFlowStub).to.have.been.calledOnce.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
      });
      expect(startLocalSpy).to.have.been.calledOnce;
      expect(startSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
    });
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

  function expectFrequencyCappingTimestamps(
    storageMock,
    get = {},
    set = undefined
  ) {
    if (get) {
      get = JSON.stringify(
        Object.entries(get).reduce((acc, [key, values]) => {
          return {
            ...acc,
            [key]: {
              impressions: [],
              dismissals: [],
              completions: [],
              ...values,
            },
          };
        }, {})
      );
    }
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.TIMESTAMPS, /* useLocalStorage */ true)
      .resolves(get);
    if (set != undefined) {
      set = JSON.stringify(
        Object.entries(set).reduce((acc, [key, values]) => {
          return {
            ...acc,
            [key]: {
              impressions: [],
              dismissals: [],
              completions: [],
              ...values,
            },
          };
        }, {})
      );
      storageMock
        .expects('set')
        .withExactArgs(StorageKeys.TIMESTAMPS, set, /* useLocalStorage */ true)
        .resolves(null)
        .once();
    }
  }
});
