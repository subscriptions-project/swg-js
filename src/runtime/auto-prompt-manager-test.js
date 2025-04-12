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
import {AutoPromptType, ContentType} from '../api/basic-subscriptions';
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
    win = Object.assign({}, env.win, {
      gtag: () => {},
      ga: () => {},
      dataLayer: {push: () => {}},
    });
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

    const storage = new Storage(win, pageConfig);
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
        eventType: AnalyticsEvent.IMPRESSION_BYO_CTA,
        action: 'TYPE_BYO_CTA',
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
        eventType: AnalyticsEvent.ACTION_BYO_CTA_CLOSE,
        action: 'TYPE_BYO_CTA',
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
        eventType: AnalyticsEvent.ACTION_BYO_CTA_BUTTON_CLICK,
        action: 'TYPE_BYO_CTA',
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

    [
      {eventType: AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS},
      {eventType: AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN},
      {eventType: AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN},
      {eventType: AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN},
      {eventType: AnalyticsEvent.IMPRESSION_SURVEY},
      {eventType: AnalyticsEvent.IMPRESSION_REWARDED_AD},
      {eventType: AnalyticsEvent.IMPRESSION_OFFERS},
      {eventType: AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED},
      {eventType: AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_REGWALL_OPT_IN_CLOSE},
      {eventType: AnalyticsEvent.ACTION_SURVEY_CLOSED},
      {eventType: AnalyticsEvent.ACTION_REWARDED_AD_CLOSE},
      {eventType: AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED},
      {eventType: AnalyticsEvent.EVENT_CONTRIBUTION_PAYMENT_COMPLETE},
      {eventType: AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_BUTTON_CLICK},
      {eventType: AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT},
      {eventType: AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK},
      {eventType: AnalyticsEvent.ACTION_SURVEY_SUBMIT_CLICK},
      {eventType: AnalyticsEvent.ACTION_REWARDED_AD_VIEW},
      {eventType: AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE},
    ].forEach(({eventType}) => {
      it(`should not store any timestamps for event ${eventType} for Closed contentType`, async () => {
        autoPromptManager.contentType_ = ContentType.CLOSED;
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

    it('should not display the mini contribution prompt if the article returns no actionOrchestration', async () => {
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
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'subscription_config_id',
                  type: 'TYPE_SUBSCRIPTION',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
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
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
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

    it('skip entitlement check when preview enabled', async () => {
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
          previewEnabled: true,
        })
        .once();
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ false);
      const clientConfig = new ClientConfig({uiPredicates});
      clientConfigManagerMock
        .expects('getClientConfig')
        .resolves(clientConfig)
        .once();
      miniPromptApiMock.expects('create').once();

      await autoPromptManager.showAutoPrompt({
        autoPromptType: AutoPromptType.CONTRIBUTION,
      });
      await tick(20);

      expect(contributionPromptFnSpy).to.not.have.been.called;
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
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
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

    [
      {eventType: AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT},
      {eventType: AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT},
      {
        eventType: AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE,
      },
      {
        eventType: AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE,
      },
    ].forEach(({eventType}) => {
      it(`should not store timestamps for event ${eventType} for Closed contentType`, async () => {
        autoPromptManager.contentType_ = ContentType.CLOSED;
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

  describe('Flexible Prompt Architecture', () => {
    let autoPromptConfig;
    let getArticleExpectation;
    let getClientConfigExpectation;
    const globalFrequencyCapDurationSeconds = 100;
    const anyPromptFrequencyCapDurationSeconds = 600;
    const funnelGlobalFrequencyCapDurationSeconds = 120;
    const contributionFrequencyCapDurationSeconds = 10800;
    const surveyFrequencyCapDurationSeconds = 7200;
    const newsletterFrequencyCapDurationSeconds = 3600;
    const promptFrequencyCap = {
      duration: {
        seconds: 300,
      },
    };

    beforeEach(() => {
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
          actionOrchestration: {
            interventionFunnel: {
              globalFrequencyCap: {
                duration: {
                  seconds: funnelGlobalFrequencyCapDurationSeconds,
                },
              },
              interventions: [
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  promptFrequencyCap: {
                    duration: {
                      seconds: contributionFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  promptFrequencyCap: {
                    duration: {
                      seconds: surveyFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'newsletter_config_id',
                  type: 'TYPE_NEWSLETTER_SIGNUP',
                  promptFrequencyCap: {
                    duration: {
                      seconds: newsletterFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
        })
        .once();
    });

    it('should not show prompt if canDisplayAutoPrompt is false', async () => {
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ false);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(subscriptionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('for open content, should not show CTA if actionOrchestration is absent', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SUBSCRIPTION_INTERVENTION],
            engineId: '123',
          },
        })
        .once();
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('for closed content, should not show CTA actionOrchestration is absent and subscription is not eligible', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [CONTRIBUTION_INTERVENTION],
            engineId: '123',
          },
        })
        .once();
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.CLOSED});

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('for closed content, should show the subscription CTA if actionOrchestration is absent and subscription is eligible', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SUBSCRIPTION_INTERVENTION],
            engineId: '123',
          },
        })
        .once();
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.CLOSED});
      await tick(20);

      expect(subscriptionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should not show any prompt if there are no audience actions', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  promptFrequencyCap,
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
        })
        .once();
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await autoPromptManager.showAutoPrompt({});

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should not show any prompt if there are no interventions in actionOrchestration', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [CONTRIBUTION_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [],
            },
          },
        })
        .once();
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await autoPromptManager.showAutoPrompt({});

      expect(contributionPromptFnSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should not show any prompt if only survey is configured and survey is not eligible due to analytics setup', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  promptFrequencyCap,
                  closability: 'DISMISSIBLE',
                },
              ],
            },
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

      expect(actionFlowSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should not show any prompt if only repeatable BYOCTA is configured and BYOCTA is not eligible due to exceeding maximum repeatability', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              {
                type: 'TYPE_BYO_CTA',
                configurationId: 'byocta_config_id',
                numberOfCompletions: 3,
              },
            ],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'byocta_config_id',
                  type: 'TYPE_BYO_CTA',
                  promptFrequencyCap,
                  closability: 'DISMISSIBLE',
                  repeatability: {
                    type: 'FINITE',
                    count: 3,
                  },
                },
              ],
            },
          },
        })
        .once();
      expectFrequencyCappingTimestamps(storageMock, {});

      await autoPromptManager.showAutoPrompt({});
      await tick(20);

      expect(actionFlowSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should not show any prompt if no intervention orchestrations are eligible', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [CONTRIBUTION_INTERVENTION, SURVEY_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  promptFrequencyCap,
                  closability: 'DISMISSIBLE',
                },
              ],
            },
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

      expect(actionFlowSpy).to.not.have.been.called;
      expect(startSpy).to.not.have.been.called;
    });

    it('should not show any prompt if preview enabled but no audience actions', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [],
            engineId: '123',
          },
          previewEnabled: true,
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

    it('skip canDisplayAutoPrompt and frequency capping check when preview enabled', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          previewEnabled: true,
        })
        .once();
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ false);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      storageMock.expects('get').never();
      storageMock.expects('set').never();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: undefined,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: true,
      });
    });

    it('should show an infinitely repeatable intervention, despite past completions', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              {
                type: 'TYPE_BYO_CTA',
                configurationId: 'byocta_config_id',
                numberOfCompletions: 10,
              },
            ],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'byocta_config_id',
                  type: 'TYPE_BYO_CTA',
                  promptFrequencyCap,
                  closability: 'DISMISSIBLE',
                  repeatability: {
                    type: 'INFINITE',
                  },
                },
              ],
            },
          },
        })
        .once();
      expectFrequencyCappingTimestamps(storageMock, {});

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_BYO_CTA',
        configurationId: 'byocta_config_id',
        autoPromptType: undefined,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should not show a repeatable intervention due to past completion within the global frequency cap', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              {
                type: 'TYPE_BYO_CTA',
                configurationId: 'byocta_config_id',
                numberOfCompletions: 10,
              },
            ],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              globalFrequencyCap: {
                duration: {
                  seconds: 500,
                },
              },
              interventions: [
                {
                  configId: 'byocta_config_id',
                  type: 'TYPE_BYO_CTA',
                  duration: {
                    seconds: 100,
                  },
                  closability: 'DISMISSIBLE',
                  repeatability: {
                    type: 'INFINITE',
                  },
                },
              ],
            },
          },
        })
        .once();
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_BYO_CTA': {
          completions: [CURRENT_TIME - 200],
        },
      });

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(startSpy).to.not.have.been.called;
      expect(actionFlowSpy).to.not.have.been.called;
    });

    it('preview should show a dismissble prompt when ContentType OPEN', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          previewEnabled: true,
        })
        .once();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: undefined,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: true,
      });
    });

    it('preview should show a blocking prompt when ContentType CLOSED', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },

          previewEnabled: true,
        })
        .once();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.CLOSED});
      await tick(20);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: undefined,
        isClosable: false,
        calledManually: false,
        shouldRenderPreview: true,
      });
    });

    it('should show the first prompt for contentType CLOSED, despite past dismissals', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [REGWALL_INTERVENTION, SUBSCRIPTION_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              globalFrequencyCap: {
                duration: {
                  seconds: 60,
                },
              },
              interventions: [
                {
                  configId: 'regwall_config_id',
                  type: 'TYPE_REGISTRATION_WALL',
                  closability: 'BLOCKING',
                },
                {
                  configId: 'newsletter_config_id',
                  type: 'TYPE_SUBSCRIPTION',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
        })
        .once();
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({contentType: ContentType.CLOSED});
      await tick(20);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REGISTRATION_WALL',
        configurationId: 'regwall_config_id',
        autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        isClosable: false,
        calledManually: false,
        shouldRenderPreview: false,
      });
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(contributionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show the first prompt if the first prompt was abandoned', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(25);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show the second prompt if the global frequency cap is undefined and prompt frequency cap for contributions is met', async () => {
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
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  promptFrequencyCap: {
                    duration: {
                      seconds: contributionFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  promptFrequencyCap: {
                    duration: {
                      seconds: surveyFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'newsletter_config_id',
                  type: 'TYPE_NEWSLETTER_SIGNUP',
                  promptFrequencyCap: {
                    duration: {
                      seconds: newsletterFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
        })
        .once();

      const contributionTimestamps =
        CURRENT_TIME -
        (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS;
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [contributionTimestamps],
          dismissals: [contributionTimestamps],
        },
      });

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show the second prompt if the prompt frequency cap for contributions is met, despite recent impressions for the second prompt', async () => {
      const contributionTimestamps =
        CURRENT_TIME -
        (contributionFrequencyCapDurationSeconds - 1) * SECOND_IN_MS;
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [contributionTimestamps],
          dismissals: [contributionTimestamps],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [CURRENT_TIME - 1],
        },
      });

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show the second prompt if the frequency cap for contributions is undefined and the default anyPromptFrequencyCap is met', async () => {
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
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  promptFrequencyCap: {
                    duration: {
                      seconds: surveyFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'newsletter_config_id',
                  type: 'TYPE_NEWSLETTER_SIGNUP',
                  promptFrequencyCap: {
                    duration: {
                      seconds: newsletterFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
              ],
            },
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show the second prompt if the second prompt frequency has passed', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              2 * funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              2 * funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(25);

      expect(logEventSpy).to.be.calledWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show the third prompt if the frequency cap for contributions is met and survey analytics is not configured', async () => {
      setWinWithAnalytics({setupGtag: false, setupGa: false, setupGtm: false});
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              2 * funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              2 * funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);

      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
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

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show the third prompt if the third prompt frequency has passed', async () => {
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
        'TYPE_NEWSLETTER_SIGNUP': {
          impressions: [
            CURRENT_TIME -
              (newsletterFrequencyCapDurationSeconds + 1) * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              (newsletterFrequencyCapDurationSeconds + 1) * SECOND_IN_MS,
          ],
        },
      });

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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
      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_NEWSLETTER_SIGNUP',
        configurationId: 'newsletter_config_id',
        autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should not show any prompt if the global frequency cap is met', async () => {
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              0.5 * funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_AD': {
          completions: [CURRENT_TIME],
        },
      });

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
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
          actionOrchestration: {
            interventionFunnel: {
              globalFrequencyCap: {
                duration: {
                  nanos:
                    funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_NANO,
                },
              },
              interventions: [
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  promptFrequencyCap: {
                    duration: {
                      seconds: contributionFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  promptFrequencyCap: {
                    duration: {
                      seconds: surveyFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'newsletter_config_id',
                  type: 'TYPE_NEWSLETTER_SIGNUP',
                  promptFrequencyCap: {
                    duration: {
                      seconds: newsletterFrequencyCapDurationSeconds,
                    },
                  },
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
        })
        .once();
      expectFrequencyCappingTimestamps(storageMock, {
        'TYPE_CONTRIBUTION': {
          impressions: [
            CURRENT_TIME -
              0.5 * funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * funnelGlobalFrequencyCapDurationSeconds * SECOND_IN_MS,
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
              0.5 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              0.5 * surveyFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * surveyFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_NEWSLETTER_SIGNUP': {
          impressions: [
            CURRENT_TIME -
              0.5 * newsletterFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          dismissals: [
            CURRENT_TIME -
              0.5 * newsletterFrequencyCapDurationSeconds * SECOND_IN_MS,
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
              0.5 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          completions: [
            CURRENT_TIME -
              0.5 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_REWARDED_SURVEY': {
          impressions: [
            CURRENT_TIME -
              0.5 * surveyFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          completions: [
            CURRENT_TIME -
              0.5 * surveyFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
        'TYPE_NEWSLETTER_SIGNUP': {
          impressions: [
            CURRENT_TIME -
              0.5 * newsletterFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
          completions: [
            CURRENT_TIME -
              0.5 * newsletterFrequencyCapDurationSeconds * SECOND_IN_MS,
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
          actionOrchestration: {
            interventionFunnel: {
              globalFrequencyCap: {
                duration: {
                  seconds: funnelGlobalFrequencyCapDurationSeconds,
                },
              },
              interventions: [
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'newsletter_config_id',
                  type: 'TYPE_NEWSLETTER_SIGNUP',
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
        })
        .once();
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

    it('should show a dismissible prompt for CLOSED contentType', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.CLOSED});
      await tick(20);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: undefined,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show a subscription intervention', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SUBSCRIPTION_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'subscription_config_id',
                  type: 'TYPE_SUBSCRIPTION',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.CLOSED});
      await tick(20);

      expect(subscriptionPromptFnSpy).to.have.been.calledOnce;
    });

    it('should show a dismissible prompt with Closability DISMISSIBLE', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({});
      await tick(500);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: undefined,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show a blocking prompt with Closability BLOCKING', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({});
      await tick(500);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: undefined,
        isClosable: false,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show a dismissible prompt with unset Closability on OPEN contentType', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                },
              ],
            },
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(500);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: undefined,
        isClosable: true,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show a blocking prompt with unset Closability on CLOSED contentType', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [SURVEY_INTERVENTION],
            engineId: '123',
          },
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'survey_config_id',
                  type: 'TYPE_REWARDED_SURVEY',
                },
              ],
            },
          },
        })
        .once();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.CLOSED});
      await tick(20);

      expect(startSpy).to.have.been.calledOnce;
      expect(actionFlowSpy).to.have.been.calledWith(deps, {
        action: 'TYPE_REWARDED_SURVEY',
        configurationId: 'survey_config_id',
        autoPromptType: undefined,
        isClosable: false,
        calledManually: false,
        shouldRenderPreview: false,
      });
    });

    it('should show the prompt after the specified delay for OPEN contentType', async () => {
      const displayDelaySeconds = 99;
      autoPromptConfig = new AutoPromptConfig({displayDelaySeconds});
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      winMock
        .expects('setTimeout')
        .withExactArgs(sandbox.match.any, displayDelaySeconds)
        .once();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.OPEN});
      await tick(20);
    });

    it('should show the prompt with no delay for CLOSED contentType', async () => {
      const displayDelaySeconds = 99;
      autoPromptConfig = new AutoPromptConfig({displayDelaySeconds});
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates,
        useUpdatedOfferFlows: true,
      });
      getClientConfigExpectation.resolves(clientConfig).once();
      winMock.expects('setTimeout').never();

      await autoPromptManager.showAutoPrompt({contentType: ContentType.CLOSED});
      await tick(20);
    });

    describe('when dismissibility filter experiment enabled', () => {
      const createArticleWithDismissibilityFilterExperiment = (
        intervention,
        closability
      ) => ({
        audienceActions: {actions: [intervention], engineId: '123'},
        actionOrchestration: {
          interventionFunnel: {
            interventions: [
              {
                configId: intervention.configurationId,
                type: intervention.type,
                closability,
              },
            ],
          },
        },
        experimentConfig: {
          experimentFlags: [
            'action_orchestration_experiment',
            'dismissibility_cta_filter_experiment',
          ],
        },
      });
      const readerCannotPurchaseClientConfig = new ClientConfig({
        autoPromptConfig,
        uiPredicates: new UiPredicates(
          /* canDisplayAutoPrompt */ true,
          /* canDisplayButton */ false,
          /* purchaseUnavailableRegion */ true
        ),
        useUpdatedOfferFlows: true,
      });

      it('filters out if open content and reader cannot purchase', async () => {
        getClientConfigExpectation
          .resolves(readerCannotPurchaseClientConfig)
          .once();
        getArticleExpectation
          .resolves(
            createArticleWithDismissibilityFilterExperiment(
              SUBSCRIPTION_INTERVENTION,
              'BLOCKING'
            )
          )
          .once();

        await autoPromptManager.showAutoPrompt({
          contentType: ContentType.OPEN,
        });
        await tick(20);

        expect(subscriptionPromptFnSpy).not.to.have.been.called;
      });

      it('filters out if closed content, dismissible, and reader cannot purchase', async () => {
        getClientConfigExpectation
          .resolves(readerCannotPurchaseClientConfig)
          .once();
        getArticleExpectation
          .resolves(
            createArticleWithDismissibilityFilterExperiment(
              CONTRIBUTION_INTERVENTION,
              'DISMISSIBLE'
            )
          )
          .once();

        await autoPromptManager.showAutoPrompt({
          contentType: ContentType.CLOSED,
        });
        await tick(20);

        expect(contributionPromptFnSpy).not.to.have.been.called;
      });

      it('shows if closed content and non-dismissible even if reader cannot purchase', async () => {
        getClientConfigExpectation
          .resolves(readerCannotPurchaseClientConfig)
          .once();
        getArticleExpectation
          .resolves(
            createArticleWithDismissibilityFilterExperiment(
              CONTRIBUTION_INTERVENTION,
              'UNSPECIFIED'
            )
          )
          .once();

        await autoPromptManager.showAutoPrompt({
          contentType: ContentType.CLOSED,
        });
        await tick(20);

        expect(contributionPromptFnSpy).to.have.been.calledOnce;
      });

      it('shows if reader can purchase', async () => {
        getArticleExpectation
          .resolves(
            createArticleWithDismissibilityFilterExperiment(
              SUBSCRIPTION_INTERVENTION,
              'BLOCKING'
            )
          )
          .once();

        await autoPromptManager.showAutoPrompt({
          contentType: ContentType.OPEN,
        });
        await tick(20);

        expect(subscriptionPromptFnSpy).to.have.been.calledOnce;
      });
    });
  });

  describe('Helper Functions', () => {
    it('Survey is eligible when gTag logging is eligible', async () => {
      setWinWithAnalytics({setupGtam: false});

      const isEligible = autoPromptManager.checkActionEligibility_(
        {type: 'TYPE_REWARDED_SURVEY'},
        {}
      );

      expect(isEligible).to.be.true;
    });

    it('Survey is eligible when GA logging is eligible', async () => {
      setWinWithAnalytics({setupGa: false});

      const isEligible = autoPromptManager.checkActionEligibility_(
        {type: 'TYPE_REWARDED_SURVEY'},
        {}
      );

      expect(isEligible).to.be.true;
    });

    it('Survey is eligible when GTM logging is eligible', async () => {
      setWinWithAnalytics({setupGtm: false});

      const isEligible = autoPromptManager.checkActionEligibility_(
        {type: 'TYPE_REWARDED_SURVEY'},
        {}
      );

      expect(isEligible).to.be.true;
    });

    it('Survey is not eligible when no Analytics logging is eligible', async () => {
      setWinWithAnalytics({setupGtag: false, setupGa: false, setupGtm: false});

      const isEligible = autoPromptManager.checkActionEligibility_(
        {type: 'TYPE_REWARDED_SURVEY'},
        {}
      );

      expect(isEligible).to.be.false;
    });

    it('Survey is not eligible when there are previous completions', async () => {
      const isEligible = autoPromptManager.checkActionEligibility_(
        {type: 'TYPE_REWARDED_SURVEY'},
        {
          'TYPE_REWARDED_SURVEY': {
            'impressions': [],
            'dismissals': [],
            'completions': [123456789],
          },
        }
      );

      expect(isEligible).to.be.false;
    });

    it('Orchestration is not eligible when action is not eligible', async () => {
      const isEligible = autoPromptManager.checkOrchestrationEligibility_(
        {configId: 'not_eligible_id'},
        new Set(),
        new Map()
      );

      expect(isEligible).to.be.false;
    });

    it('Repeatable Orchestration with unspecified repeatability is not eligible with completion', async () => {
      const isEligible = autoPromptManager.checkOrchestrationEligibility_(
        {
          configId: 'action_id',
          type: 'TYPE_REWARDED_AD',
          repeatability: {type: 'UNSPECIFIED'},
        },
        new Set(['action_id']),
        new Map([['action_id', 1]])
      );

      expect(isEligible).to.be.false;
    });

    it('Repeatable Orchestration with finite repeatability is not eligible with completions above the limit', async () => {
      const isEligible = autoPromptManager.checkOrchestrationEligibility_(
        {
          configId: 'action_id',
          type: 'TYPE_REWARDED_AD',
          repeatability: {type: 'FINITE', count: 5},
        },
        new Set(['action_id']),
        new Map([['action_id', 5]])
      );

      expect(isEligible).to.be.false;
    });

    it('Repeatable Orchestration with finite repeatability is eligible with completions below the limit', async () => {
      const isEligible = autoPromptManager.checkOrchestrationEligibility_(
        {
          configId: 'action_id',
          type: 'TYPE_REWARDED_AD',
          repeatability: {type: 'FINITE', count: 5},
        },
        new Set(['action_id']),
        new Map([['action_id', 2]])
      );

      expect(isEligible).to.be.true;
    });

    it('Orchestration with finite eligibility defaults to 1 eligible completion', async () => {
      const isEligible = autoPromptManager.checkOrchestrationEligibility_(
        {
          configId: 'action_id',
          type: 'TYPE_REWARDED_AD',
          repeatability: {type: 'FINITE'},
        },
        new Set(['action_id']),
        new Map([['action_id', 1]])
      );

      expect(isEligible).to.be.false;
    });

    it('Repeatable Orchestration with infinite repeatability is eligible with completions', async () => {
      const isEligible = autoPromptManager.checkOrchestrationEligibility_(
        {
          configId: 'action_id',
          type: 'TYPE_REWARDED_AD',
          repeatability: {type: 'INFINITE'},
        },
        new Set(['action_id']),
        new Map([['action_id', 1]])
      );

      expect(isEligible).to.be.true;
    });

    it('Orchestration with unspecified repeatability is not eligible with completions', async () => {
      const isEligible = autoPromptManager.checkOrchestrationEligibility_(
        {
          configId: 'action_id',
          type: 'TYPE_REWARDED_AD',
        },
        new Set(['action_id']),
        new Map([['action_id', 1]])
      );

      expect(isEligible).to.be.false;
    });

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

    it('getTimestampsForPromptFrequency_ should return dismissals and completions timestamps for DISMISSIBLE closability', async () => {
      const actionsTimestamps = {
        'TYPE_CONTRIBUTION': {
          'impressions': ['c_i1', 'c_i2', 'c_i3'],
          'dismissals': ['c_d1', 'c_d2', 'c_d3'],
          'completions': ['c_c1', 'c_c2', 'c_c3'],
        },
        'TYPE_REWARDED_SURVEY': {
          'impressions': ['s_i1', 's_i2', 's_i3'],
          'dismissals': ['s_d1', 's_d2', 's_d3'],
          'completions': ['s_c1', 's_c2', 's_c3'],
        },
      };

      const timestamps = autoPromptManager.getTimestampsForPromptFrequency_(
        actionsTimestamps,
        {'type': 'TYPE_REWARDED_SURVEY', closability: 'DISMISSIBLE'}
      );

      expect(timestamps.length).to.equal(6);
      expect(timestamps[0]).to.equal('s_d1');
      expect(timestamps[1]).to.equal('s_d2');
      expect(timestamps[2]).to.equal('s_d3');
      expect(timestamps[3]).to.equal('s_c1');
      expect(timestamps[4]).to.equal('s_c2');
      expect(timestamps[5]).to.equal('s_c3');
    });

    it('getTimestampsForPromptFrequency_ should return completions timestamps for BLOCKING closability', async () => {
      const actionsTimestamps = {
        'TYPE_CONTRIBUTION': {
          'impressions': ['c_i1', 'c_i2', 'c_i3'],
          'dismissals': ['c_d1', 'c_d2', 'c_d3'],
          'completions': ['c_c1', 'c_c2', 'c_c3'],
        },
        'TYPE_REWARDED_SURVEY': {
          'impressions': ['s_i1', 's_i2', 's_i3'],
          'dismissals': ['s_d1', 's_d2', 's_d3'],
          'completions': ['s_c1', 's_c2', 's_c3'],
        },
      };

      const timestamps = autoPromptManager.getTimestampsForPromptFrequency_(
        actionsTimestamps,
        {'type': 'TYPE_REWARDED_SURVEY', closability: 'BLOCKING'}
      );

      expect(timestamps.length).to.equal(3);
      expect(timestamps[0]).to.equal('s_c1');
      expect(timestamps[1]).to.equal('s_c2');
      expect(timestamps[2]).to.equal('s_c3');
    });

    it('getPromptFrequencyCapDuration_ should return valid intervention config', async () => {
      const expectedDuration = {seconds: 600};

      const result = autoPromptManager.getPromptFrequencyCapDuration_(
        {},
        {promptFrequencyCap: {duration: expectedDuration}}
      );

      expect(result).to.equal(expectedDuration);
    });

    it('getPromptFrequencyCapDuration_ should return default anyPromptFrequencyCap for invalid intervention config', async () => {
      const expectedDuration = {seconds: 600};

      const result = autoPromptManager.getPromptFrequencyCapDuration_(
        {anyPromptFrequencyCap: {frequencyCapDuration: expectedDuration}},
        {}
      );

      expect(result).to.equal(expectedDuration);
    });

    it('getGlobalFrequencyCapDuration_ should return valid intervention config', async () => {
      const expectedDuration = {seconds: 60};

      const result = autoPromptManager.getGlobalFrequencyCapDuration_(
        {},
        {globalFrequencyCap: {duration: expectedDuration}}
      );

      expect(result).to.equal(expectedDuration);
    });

    it('getGlobalFrequencyCapDuration_ should return defualt globalFrequencyCap for invalid intervention config', () => {
      const expectedDuration = {seconds: 600};

      const result = autoPromptManager.getGlobalFrequencyCapDuration_(
        {globalFrequencyCap: {frequencyCapDuration: expectedDuration}},
        {}
      );

      expect(result).to.equal(expectedDuration);
    });

    it('isFrequencyCapped_ should return false for empty impressions', async () => {
      const duration = {seconds: 60, nanos: 0};

      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        []
      );

      expect(isFrequencyCapped).to.equal(false);
    });

    it('isFrequencyCapped_ should return false for impressions that occurred outside of the cap duration', async () => {
      const duration = {seconds: 60, nanos: 0};
      const impressions = [CURRENT_TIME - 120 * SECOND_IN_MS];

      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );

      expect(isFrequencyCapped).to.equal(false);
    });

    it('isFrequencyCapped_ should return true if the max impression occurred within of the cap duration', async () => {
      const duration = {seconds: 60, nanos: 0};
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
      const duration = {seconds: 60, nanos: 0};
      const impressions = [CURRENT_TIME - 10 * SECOND_IN_MS];

      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );

      expect(isFrequencyCapped).to.equal(true);
    });

    it('isFrequencyCapped_ should return true if the max impression occurred within the cap duration, including nanos', async () => {
      const duration = {seconds: 60, nanos: 60 * SECOND_IN_NANO};
      const impressions = [CURRENT_TIME - 90 * SECOND_IN_MS];

      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );

      expect(isFrequencyCapped).to.equal(true);
    });

    it('isFrequencyCapped_ should return false if the max impression occurred within the cap duration, including negative nanos', async () => {
      const duration = {seconds: 120, nanos: -60 * SECOND_IN_NANO};
      const impressions = [CURRENT_TIME - 90 * SECOND_IN_MS];

      const isFrequencyCapped = autoPromptManager.isFrequencyCapped_(
        duration,
        impressions
      );

      expect(isFrequencyCapped).to.equal(false);
    });

    it('checkOrchestrationEligibility_ should log an error if completion count is missing for a repeatable action', async () => {
      const isEligible = autoPromptManager.checkOrchestrationEligibility_(
        {
          configId: 'action_id',
          type: 'TYPE_REWARDED_AD',
          repeatability: {type: 'FINITE', count: 1},
        },
        new Set(['action_id']),
        new Map()
      );

      expect(logEventSpy).to.be.calledOnceWith({
        eventType:
          AnalyticsEvent.EVENT_COMPLETION_COUNT_FOR_REPEATABLE_ACTION_MISSING_ERROR,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });

      expect(isEligible).to.equal(true);
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
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'rewarded_ad_config_id',
                  type: 'TYPE_REWARDED_AD',
                  closability: 'BLOCKING',
                },
                {
                  configId: 'subscription_config_id',
                  type: 'TYPE_SUBSCRIPTION',
                  closability: 'BLOCKING',
                },
              ],
            },
          },
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
        shouldRenderPreview: false,
      });
      expect(startLocalSpy).to.have.been.calledOnce;
      expect(startSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
    });

    it('is rendered for BYOP TYPE_NEWSLETTER_SIGNUP', async () => {
      getArticleExpectation
        .resolves({
          actionOrchestration: {
            interventionFunnel: {
              interventions: [
                {
                  configId: 'newsletter_config_id',
                  type: 'TYPE_NEWSLETTER_SIGNUP',
                  closability: 'DISMISSIBLE',
                },
                {
                  configId: 'contribution_config_id',
                  type: 'TYPE_CONTRIBUTION',
                  closability: 'DISMISSIBLE',
                },
              ],
            },
          },
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
        shouldRenderPreview: false,
      });
      expect(startLocalSpy).to.have.been.calledOnce;
      expect(startSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
    });

    it('is calls local flow with preview enabled', async () => {
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [
              NEWSLETTER_INTERVENTION_PUBLISHER_PROMPT,
              CONTRIBUTION_INTERVENTION,
            ],
            engineId: '123',
          },
          previewEnabled: true,
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
        shouldRenderPreview: true,
      });
      expect(startLocalSpy).to.have.been.calledOnce;
      expect(startSpy).to.not.have.been.called;
      expect(autoPromptManager.getLastAudienceActionFlow()).to.not.equal(null);
    });
  });

  function setWinWithAnalytics({
    setupGtag = true,
    setupGa = true,
    setupGtm = true,
  }) {
    const winWithAnalytics = Object.assign({}, win);
    if (!setupGtag) {
      delete winWithAnalytics.gtag;
    }
    if (!setupGa) {
      delete winWithAnalytics.ga;
    }
    if (!setupGtm) {
      delete winWithAnalytics.dataLayer;
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
