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
import {AutoPromptConfig} from '../model/auto-prompt-config';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfig, UiPredicates} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {GlobalDoc} from '../model/doc';
import {InlincCtaApi} from './inline-cta-api';
import {MiniPromptApi} from './mini-prompt-api';
import {MockDeps} from '../../test/mock-deps';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {XhrFetcher} from './fetcher';

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
const REGWALL_INTERVENTION = {
  type: 'TYPE_REGISTRATION_WALL',
  configurationId: 'regwall_config_id',
};
const SUBSCRIPTION_INTERVENTION = {
  type: 'TYPE_SUBSCRIPTION',
  configurationId: 'subscription_config_id',
};

describes.realWin('InlineCtaApi', (env) => {
  let inlineCtaApi;
  let win;
  let deps;
  let doc;
  let pageConfig;
  let fetcher;
  let eventManager;
  let eventManagerCallback;
  let entitlementsManager;
  let entitlementsManagerMock;
  let clientConfigManager;
  let clientConfigManagerMock;
  let storageMock;
  let actionFlowSpy;
  let startSpy;
  let runtime;
  const productId = 'pub1:label1';
  const pubId = 'pub1';

  beforeEach(() => {
    deps = new MockDeps();

    win = Object.assign({}, env.win, {
      gtag: () => {},
      ga: () => {},
      dataLayer: {push: () => {}},
    });
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

    sandbox.stub(MiniPromptApi.prototype, 'init');
    inlineCtaApi = new InlincCtaApi(deps);

    actionFlowSpy = sandbox.spy(audienceActionFlow, 'AudienceActionIframeFlow');
    startSpy = sandbox.stub(
      audienceActionFlow.AudienceActionIframeFlow.prototype,
      'start'
    );
  });

  afterEach(() => {
    entitlementsManagerMock.verify();
    clientConfigManagerMock.verify();
    storageMock.verify();
  });

  it('should be listening for events from the events manager', () => {
    expect(eventManagerCallback).to.not.be.null;
  });

  describe('Helper Functions', () => {
    const actions = [
      NEWSLETTER_INTERVENTION,
      REGWALL_INTERVENTION,
      CONTRIBUTION_INTERVENTION,
    ];
    [
      {
        configId: SURVEY_INTERVENTION.configurationId,
        resultPrefix: '',
      },
      {
        configId: SURVEY_INTERVENTION.configurationId,
        resultPrefix: '',
      },
      {
        configId: REGWALL_INTERVENTION.configurationId,
        resultPrefix: '/regwalliframe',
      },
      {
        configId: NEWSLETTER_INTERVENTION.configurationId,
        resultPrefix: '/newsletteriframe',
      },
      {
        configId: CONTRIBUTION_INTERVENTION.configurationId,
        resultPrefix: '',
      },
    ].forEach(({configId, resultPrefix}) => {
      it('Action type mapped to right UrlPrefix', async () => {
        const urlPrefix = inlineCtaApi.actionToUrlPrefix_(configId, actions);

        expect(urlPrefix).to.equal(resultPrefix);
      });
    });
  });
});
