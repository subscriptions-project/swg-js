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

import {ClientConfig, UiPredicates} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {GlobalDoc} from '../model/doc';
import {InlincCtaApi} from './inline-cta-api';
import {MockDeps} from '../../test/mock-deps';
import {PageConfig} from '../model/page-config';
import {XhrFetcher} from './fetcher';
import {createElement} from '../utils/dom';

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
  let getArticleExpectation;
  let entitlements;
  let getEntitlementsExpectation;
  let newsletterSnippet;
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
    newsletterSnippet = createElement(win.document, 'div', {
      'rrm-inline-cta': 'newsletter_config_id',
    });
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

    inlineCtaApi = new InlincCtaApi(deps);
  });

  it('should be listening for events from the events manager', () => {
    expect(eventManagerCallback).to.not.be.null;
  });

  it('should not render CTA if no inline elements', async () => {
    await inlineCtaApi.attachInlineCtasWithAttribute({});

    const iframe = win.document.querySelector('iframe');
    expect(iframe).to.equal(null);
  });

  describe('Helper Functions', () => {
    [
      // No survey passed in from actions
      {configId: SURVEY_INTERVENTION.configurationId, resultPrefix: ''},
      {
        configId: REGWALL_INTERVENTION.configurationId,
        resultPrefix: '/regwalliframe',
      },
      {
        configId: NEWSLETTER_INTERVENTION.configurationId,
        resultPrefix: '/newsletteriframe',
      },
      // Contribution and Subscription not yet supported by mapping
      {
        configId: CONTRIBUTION_INTERVENTION.configurationId,
        resultPrefix: '',
      },
      {
        configId: SUBSCRIPTION_INTERVENTION.configurationId,
        resultPrefix: '',
      },
    ].forEach(({configId, resultPrefix}) => {
      it('Action type mapped to right UrlPrefix', () => {
        const actions = [
          NEWSLETTER_INTERVENTION,
          REGWALL_INTERVENTION,
          CONTRIBUTION_INTERVENTION,
        ];
        const urlPrefix = inlineCtaApi.actionToUrlPrefix_(configId, actions);

        expect(urlPrefix).to.equal(resultPrefix);
      });
    });

    it('getUrl returns correct url', () => {
      const urlPrefix = '/url_prefix';
      const resultUrl =
        'https://news.google.com/swg/ui/v1/url_prefix?_=_&origin=about%3Asrcdoc&configurationId=survey_config_id&isClosable=true&calledManually=false&previewEnabled=false&publicationId=pub1&ctaMode=CTA_MODE_INLINE';

      const url = inlineCtaApi.getUrl_(
        urlPrefix,
        SURVEY_INTERVENTION.configurationId
      );

      expect(url).to.equal(resultUrl);
    });
  });

  describe('Rendering', () => {
    beforeEach(() => {
      win.document.body.appendChild(newsletterSnippet);
      entitlements = new Entitlements();
      getEntitlementsExpectation =
        entitlementsManagerMock.expects('getEntitlements');
      getArticleExpectation = entitlementsManagerMock.expects('getArticle');
      const uiPredicates = new UiPredicates(/* canDisplayAutoPrompt */ true);
      const clientConfig = new ClientConfig({uiPredicates});
      clientConfigManagerMock
        .expects('getClientConfig')
        .returns(clientConfig)
        .once();
    });

    afterEach(() => {
      entitlementsManagerMock.verify();
      clientConfigManagerMock.verify();
    });

    it('should not show any CTA if there are no audience actions', async () => {
      sandbox.stub(entitlements, 'enablesThis').returns(false);
      getEntitlementsExpectation.resolves(entitlements).once();
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [],
            engineId: '123',
          },
        })
        .once();

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe).to.equal(null);
    });

    it('should not show any CTA if actions not match inline config', async () => {
      sandbox.stub(entitlements, 'enablesThis').returns(false);
      getEntitlementsExpectation.resolves(entitlements).once();
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [CONTRIBUTION_INTERVENTION, SURVEY_INTERVENTION],
            engineId: '123',
          },
        })
        .once();

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe).to.equal(null);
    });

    it('should not show any CTA if no inline configId', async () => {
      win.document.body.removeChild(newsletterSnippet);
      const emptySnippet = createElement(win.document, 'div', {
        'rrm-inline-cta': '',
      });
      win.document.body.append(emptySnippet);
      sandbox.stub(entitlements, 'enablesThis').returns(false);
      getEntitlementsExpectation.resolves(entitlements).once();
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [CONTRIBUTION_INTERVENTION, SURVEY_INTERVENTION],
            engineId: '123',
          },
        })
        .once();

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe).to.equal(null);
    });

    it('should not show any CTA if there are entitlements', async () => {
      sandbox.stub(entitlements, 'enablesThis').returns(true);
      getEntitlementsExpectation.resolves(entitlements).once();
      getArticleExpectation
        .resolves({
          audienceActions: {
            actions: [NEWSLETTER_INTERVENTION],
            engineId: '123',
          },
        })
        .once();

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe).to.equal(null);
    });

    it('should render CTA if action is active', async () => {
      sandbox.stub(entitlements, 'enablesThis').returns(false);
      getEntitlementsExpectation.resolves(entitlements).once();
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

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe.nodeType).to.equal(1);
    });
  });
});
