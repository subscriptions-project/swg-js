/**
 * Copyright 2025 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {ActivityPorts} from '../components/activities';
import {ClientConfig, UiPredicates} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {CompleteAudienceActionResponse} from '../proto/api_messages';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {GlobalDoc} from '../model/doc';
import {InlincCtaApi} from './inline-cta-api';
import {MockActivityPort} from '../../test/mock-activity-port';
import {MockDeps} from '../../test/mock-deps';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
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
const CURRENT_TIME = 1615416442000;
const EXPECTED_TIME_STRING = '1615416442000';

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
  let clientConfigManagerMock;
  let getArticleExpectation;
  let entitlements;
  let getEntitlementsExpectation;
  let newsletterSnippet;
  let port;
  let activitiesMock;
  let onResizeRequestCallback;
  let storageMock;
  let toast;
  let toastOpenStub;
  let messageMap;
  const productId = 'pub1:label1';
  const pubId = 'pub1';

  beforeEach(() => {
    deps = new MockDeps();
    messageMap = {};
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

    const clientConfigManager = new ClientConfigManager(deps, pubId, fetcher);
    clientConfigManagerMock = sandbox.mock(clientConfigManager);
    sandbox.stub(deps, 'clientConfigManager').returns(clientConfigManager);

    const activityPort = new ActivityPorts(deps);
    activitiesMock = sandbox.mock(activityPort);
    sandbox.stub(deps, 'activities').returns(activityPort);

    sandbox.stub(ActivityIframeView.prototype, 'on').callsFake((ctor, cb) => {
      const messageType = new ctor();
      const label = messageType.label();
      messageMap[label] = cb;
    });

    const storage = new Storage(win, pageConfig);
    storage.set = () => Promise.resolve(null);
    storageMock = sandbox.mock(storage);
    sandbox.stub(deps, 'storage').returns(storage);

    inlineCtaApi = new InlincCtaApi(deps);

    port = new MockActivityPort();
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    sandbox.stub(port, 'onResizeRequest').callsFake((callback) => {
      onResizeRequestCallback = callback;
      return true;
    });
    sandbox.useFakeTimers(CURRENT_TIME);
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

    it('clearInlineCta remove inline CTA from page', () => {
      const inlineCta = createElement(win.document, 'iframe');
      newsletterSnippet.appendChild(inlineCta);

      inlineCtaApi.clearInlineCta_(newsletterSnippet);

      expect(newsletterSnippet.firsChild).to.equal(undefined);
    });

    it('showAlreadyOptedInToast shows basic toast', () => {
      toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });

      inlineCtaApi.showAlreadyOptedInToast_('TYPE_REGISTRATION_WALL');

      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=basic');
    });

    it('showAlreadyOptedInToast show no toast if other types', () => {
      const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

      inlineCtaApi.showAlreadyOptedInToast_('TYPE_REWARDED_SURVEY');

      expect(toastOpenStub).not.to.be.called;
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
      activitiesMock.verify();
    });

    it('should not show any CTA if there are no audience actions', async () => {
      setEntitlements();
      setArticleResponse();

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe).to.equal(null);
    });

    it('should not show any CTA if actions not match inline config', async () => {
      setEntitlements();
      setArticleResponse([CONTRIBUTION_INTERVENTION, SURVEY_INTERVENTION]);

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
      setEntitlements();
      setArticleResponse([
        CONTRIBUTION_INTERVENTION,
        SURVEY_INTERVENTION,
        NEWSLETTER_INTERVENTION,
      ]);

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe).to.equal(null);
    });

    it('should not show any CTA if there are entitlements', async () => {
      setEntitlements(true);
      setArticleResponse([NEWSLETTER_INTERVENTION]);

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe).to.equal(null);
    });

    it('should not show any CTA if action type is not in mapping', async () => {
      win.document.body.removeChild(newsletterSnippet);
      const contributionSnippet = createElement(win.document, 'div', {
        'rrm-inline-cta': CONTRIBUTION_INTERVENTION.configurationId,
      });
      win.document.body.append(contributionSnippet);
      setEntitlements();
      setArticleResponse([
        CONTRIBUTION_INTERVENTION,
        SURVEY_INTERVENTION,
        NEWSLETTER_INTERVENTION,
      ]);

      await inlineCtaApi.attachInlineCtasWithAttribute({});

      const iframe = win.document.querySelector('iframe');
      expect(iframe).to.equal(null);
    });

    it('should render CTA if action is active', async () => {
      setEntitlements();
      setArticleResponse([
        CONTRIBUTION_INTERVENTION,
        SURVEY_INTERVENTION,
        NEWSLETTER_INTERVENTION,
      ]);
      expectOpenIframe();

      await inlineCtaApi.attachInlineCtasWithAttribute({});
      const iframe = win.document.querySelector('iframe');

      expect(iframe.nodeType).to.equal(1);
    });

    it('adjust CTA height on resize callback', async () => {
      setEntitlements();
      setArticleResponse([
        CONTRIBUTION_INTERVENTION,
        SURVEY_INTERVENTION,
        NEWSLETTER_INTERVENTION,
      ]);
      expectOpenIframe();

      await inlineCtaApi.attachInlineCtasWithAttribute({});
      const iframe = win.document.querySelector('iframe');

      expect(port.onResizeRequest).to.have.been.calledOnce;
      onResizeRequestCallback(100);
      expect(iframe.style.height).to.equal('100px');
    });
  });

  describe('Action Completion', () => {
    beforeEach(() => {
      entitlementsManagerMock.expects('clear').resolves(null).once();
      entitlementsManagerMock.expects('getEntitlements').resolves(null).once();
      storageMock
        .expects('set')
        .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
        .once();
      storageMock
        .expects('set')
        .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
        .once();
    });

    afterEach(() => {
      entitlementsManagerMock.verify();
      storageMock.verify();
    });

    it('newsletter action on completion new sign up', async () => {
      win.document.body.appendChild(newsletterSnippet);
      const toastOpenStub = sandbox.stub(Toast.prototype, 'open');
      inlineCtaApi.renderInlineCtaWithAttribute_(newsletterSnippet, [
        CONTRIBUTION_INTERVENTION,
        SURVEY_INTERVENTION,
        NEWSLETTER_INTERVENTION,
      ]);
      const completeAudienceActionResponse = getCompleteAudienceActionResponse(
        /*alreadyCompleted*/ false
      );
      const messageCallback =
        messageMap[completeAudienceActionResponse.label()];

      messageCallback(completeAudienceActionResponse);

      expect(toastOpenStub).not.to.be.called;
      const iframe = win.document.querySelector('iframe');
      expect(iframe.nodeType).to.equal(1);
    });

    it('newsletter action on completion already signed up before', async () => {
      toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });
      inlineCtaApi.renderInlineCtaWithAttribute_(newsletterSnippet, [
        CONTRIBUTION_INTERVENTION,
        SURVEY_INTERVENTION,
        NEWSLETTER_INTERVENTION,
      ]);
      const completeAudienceActionResponse = getCompleteAudienceActionResponse(
        /*alreadyCompleted*/ true
      );
      const messageCallback =
        messageMap[completeAudienceActionResponse.label()];

      messageCallback(completeAudienceActionResponse);

      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=custom');
      expect(decodeURI(toast.src_)).to.contain('You have signed up before.');
      expect(newsletterSnippet.firsChild).to.equal(undefined);
    });
  });

  function setEntitlements(enablesThis = false) {
    sandbox.stub(entitlements, 'enablesThis').returns(enablesThis);
    getEntitlementsExpectation.resolves(entitlements).once();
  }

  function setArticleResponse(actions = []) {
    getArticleExpectation
      .resolves({
        audienceActions: {
          actions,
          engineId: '123',
        },
      })
      .once();
  }

  function expectOpenIframe() {
    activitiesMock.expects('openIframe').resolves(port);
  }

  function getCompleteAudienceActionResponse(alreadyCompleted) {
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(true);
    completeAudienceActionResponse.setAlreadyCompleted(alreadyCompleted);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    return completeAudienceActionResponse;
  }
});
