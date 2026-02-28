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

import * as Utils from '../utils/survey-utils';
import {
  AlreadySubscribedResponse,
  AnalyticsEvent,
  CompleteAudienceActionResponse,
  EntitlementsResponse,
  EventOriginator,
  RewardedAdAlternateActionRequest,
  RewardedAdLoadAdRequest,
  RewardedAdLoadAdResponse,
  RewardedAdViewAdRequest,
  SurveyDataTransferRequest,
} from '../proto/api_messages';
import {AudienceActionIframeFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {GisLoginFlow} from './gis/gis-login-flow';
import {InterventionType} from '../api/intervention-type';
import {MockActivityPort} from '../../test/mock-activity-port';
import {PageConfig} from '../model/page-config';
import {ProductType} from '../api/subscriptions';
import {PromptPreference} from './intervention';
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
import {isAudienceActionType} from './audience-action-flow';

const WINDOW_LOCATION_DOMAIN = 'https://www.test.com';
const WINDOW_INNER_HEIGHT = 424242;
const CURRENT_TIME = 1615416442000;
const EXPECTED_TIME_STRING = '1615416442000';

const TEST_OPTINCONFIGID = 'optin onResult config id';
const TEST_EMAIL = 'test email';
const TEST_DISPLAY_NAME = 'test display name';
const TEST_GIVEN_NAME = 'test given name';
const TEST_FAMILY_NAME = 'test family name';

const TEST_OPTINRESULT = {
  email: TEST_EMAIL,
  displayName: TEST_DISPLAY_NAME,
  givenName: TEST_GIVEN_NAME,
  familyName: TEST_FAMILY_NAME,
  termsAndConditionsConsent: true,
};

const TEST_OPTINONRESULT = {
  configurationId: TEST_OPTINCONFIGID,
  data: TEST_OPTINRESULT,
};

const COMPLETE_RESPONSE = `
{
  "updated": true,
  "alreadyCompleted": true,
  "swgUserToken": "xyz"
}`;

describes.realWin('AudienceActionIframeFlow', (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let entitlementsManagerMock;
  let storageMock;
  let pageConfig;
  let port;
  let messageMap;
  let onCancelSpy;
  let dialogManagerMock;
  let clientOptions;
  let eventManagerMock;
  let rewardedSlot;
  let pubadsobj;
  let eventListeners;
  let clock;

  beforeEach(() => {
    rewardedSlot = {
      addService: () => {},
    };
    eventListeners = {};
    pubadsobj = {
      addEventListener: (event, handler) => {
        eventListeners[event] = handler;
      },
      removeEventListener: sandbox.spy(),
      refresh: sandbox.spy(),
    };
    const googletag = {
      cmd: [],
      defineOutOfPageSlot: () => rewardedSlot,
      enums: {OutOfPageFormat: {REWARDED: 'REWARDED'}},
      pubads: () => pubadsobj,
      enableServices: () => {},
      display: () => {},
      destroySlots: sandbox.spy(),
      apiReady: true,
      getVersion: () => 'GOOGLETAG_VERSION',
    };
    const adsbygoogle = [];
    win = Object.assign(
      {},
      {
        location: {href: WINDOW_LOCATION_DOMAIN + '/page/1'},
        document: env.win.document,
        gtag: () => {},
        innerHeight: WINDOW_INNER_HEIGHT,
        googletag,
        adsbygoogle,
        fetch: sandbox.stub(),
      }
    );
    messageMap = {};
    pageConfig = new PageConfig('pub1:label1', /**locked=*/ true);
    clientOptions = {};
    runtime = new ConfiguredRuntime(
      env.win,
      pageConfig,
      /* integr */ undefined,
      /* config */ undefined,
      clientOptions
    );
    activitiesMock = sandbox.mock(runtime.activities());
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager());
    storageMock = sandbox.mock(runtime.storage());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    const eventManager = new ClientEventManager(Promise.resolve());
    eventManagerMock = sandbox.mock(eventManager);
    sandbox.stub(runtime, 'eventManager').callsFake(() => eventManager);
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    sandbox.stub(port, 'on').callsFake((ctor, cb) => {
      const messageType = new ctor();
      const messageLabel = messageType.label();
      messageMap[messageLabel] = cb;
    });
    sandbox.stub(runtime, 'win').returns(win);
    onCancelSpy = sandbox.spy();
    clock = sandbox.useFakeTimers(CURRENT_TIME);
    sandbox.stub(self.console, 'warn');
  });

  afterEach(() => {
    eventManagerMock.verify();
    self.console.warn.reset();
  });

  [
    {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'reg_config',
      path: 'regwalliframe',
    },
    {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: 'newsletter_config',
      path: 'newsletteriframe',
    },
    {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'survey_config',
      path: 'surveyiframe',
    },
    {
      // undefined configurationId
      action: 'TYPE_REWARDED_SURVEY',
      path: 'surveyiframe',
    },
    {
      action: 'TYPE_BYO_CTA',
      configurationId: 'byo_cta_config',
      path: 'byoctaiframe',
    },
    {
      action: 'TYPE_REWARDED_AD',
      configurationId: 'rewarded_ad_config',
      path: 'rewardedadiframe',
    },
  ].forEach(({action, configurationId, path}) => {
    it(`opens an AudienceActionIframeFlow constructed with params for ${action}`, async () => {
      sandbox.stub(runtime.storage(), 'get').resolves(null);
      const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
        action,
        configurationId,
        onCancel: onCancelSpy,
        autoPromptType: AutoPromptType.SUBSCRIPTION,
        calledManually: false,
      });
      activitiesMock
        .expects('openIframe')
        .withExactArgs(
          sandbox.match((arg) => arg.tagName == 'IFRAME'),
          `https://news.google.com/swg/ui/v1/${path}?_=_&origin=${encodeURIComponent(
            WINDOW_LOCATION_DOMAIN
          )}&configurationId=${
            configurationId === undefined ? '' : configurationId
          }&isClosable=false&calledManually=false&previewEnabled=false`,
          {
            _client: 'SwG 0.0.0',
            productType: ProductType.SUBSCRIPTION,
            supportsEventManager: true,
            windowHeight: WINDOW_INNER_HEIGHT,
          }
        )
        .resolves(port);

      await audienceActionFlow.start();

      activitiesMock.verify();
      expect(onCancelSpy).to.not.be.called;
    });
  });

  it('opens an AudienceActionIframeFlow with query param locale set to client configuration language', async () => {
    clientOptions.lang = 'pt-BR';
    clientOptions.forceLangInIframes = true;
    sandbox.stub(runtime.storage(), 'get').resolves(null);
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        `https://news.google.com/swg/ui/v1/regwalliframe?_=_&origin=${encodeURIComponent(
          WINDOW_LOCATION_DOMAIN
        )}&configurationId=configId&isClosable=false&calledManually=false&previewEnabled=false&hl=pt-BR`,
        {
          _client: 'SwG 0.0.0',
          productType: ProductType.SUBSCRIPTION,
          supportsEventManager: true,
          windowHeight: WINDOW_INNER_HEIGHT,
        }
      )
      .resolves(port);

    await audienceActionFlow.start();

    activitiesMock.verify();
    expect(onCancelSpy).to.not.be.called;
  });

  it('calls the onCancel when an AudienceActionIframeFlow is cancelled and one it provided', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    sandbox
      .stub(port, 'acceptResult')
      .callsFake(() =>
        Promise.reject(new DOMException('cancel', 'AbortError'))
      );

    await audienceActionFlow.start();

    activitiesMock.verify();
    expect(onCancelSpy).to.be.calledOnce;
  });

  it('handles a CompleteAudienceActionResponse with regwall completed and opens a custom toast', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);

    let toast;
    const toastOpenStub = sandbox
      .stub(Toast.prototype, 'open')
      .callsFake(function () {
        toast = this;
      });

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=custom');
    expect(decodeURIComponent(toast.src_)).to.contain(
      'Created an account with xxx@gmail.com'
    );
  });

  it('handles a CompleteAudienceActionResponse with newsletter completed and opens a custom toast', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);

    let toast;
    const toastOpenStub = sandbox
      .stub(Toast.prototype, 'open')
      .callsFake(function () {
        toast = this;
      });

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=custom');
    expect(decodeURIComponent(toast.src_)).to.contain(
      'Signed up with xxx@gmail.com'
    );
  });

  it('handles a CompleteAudienceActionResponse with regwall completed before and opens a basic toast', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);

    let toast;
    const toastOpenStub = sandbox
      .stub(Toast.prototype, 'open')
      .callsFake(function () {
        toast = this;
      });

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=basic');
  });

  it('handles a CompleteAudienceActionResponse with regwall failure and opens a failure toast', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);

    let toast;
    const toastOpenStub = sandbox
      .stub(Toast.prototype, 'open')
      .callsFake(function () {
        toast = this;
      });

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(false);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=custom');
    expect(decodeURI(toast.src_)).to.contain(
      'Registration failed. Try registering again.'
    );
  });

  it(`handles a CompleteAudienceActionResponse with newsletter not completed and opens a custom toast indicating that the user has completed the newsletter before`, async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);

    let toast;
    const toastOpenStub = sandbox
      .stub(Toast.prototype, 'open')
      .callsFake(function () {
        toast = this;
      });

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=custom');
    expect(decodeURI(toast.src_)).to.contain('You have signed up before.');
  });

  it(`handles a CompleteAudienceActionResponse with newsletter failure and opens a custom toast indicating that the sign up has failed`, async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);

    let toast;
    const toastOpenStub = sandbox
      .stub(Toast.prototype, 'open')
      .callsFake(function () {
        toast = this;
      });

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(false);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=custom');
    expect(decodeURI(toast.src_)).to.contain(
      'Sign-up failed. Try signing up again.'
    );
  });

  it('handles a CompleteAudienceActionResponse with survey completed and does not open a custom toast', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);
    const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).not.to.be.called;
  });

  it(`handles a CompleteAudienceActionResponse with survey already completed and does not open a custom toast.`, async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);
    const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).not.to.be.called;
  });

  it(`handles a CompleteAudienceActionResponse with survey failure and does not open a custom toast.`, async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);
    const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(false);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).not.to.be.called;
  });

  it(`handles CompleteAudienceActionResponse for OptIn with onResult`, async () => {
    const onResultMock = sandbox
      .mock()
      .withExactArgs(TEST_OPTINONRESULT)
      .resolves(true)
      .once();
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: TEST_OPTINCONFIGID,
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      onResult: onResultMock,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);
    const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(false);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail(TEST_EMAIL);
    completeAudienceActionResponse.setDisplayName(TEST_DISPLAY_NAME);
    completeAudienceActionResponse.setGivenName(TEST_GIVEN_NAME);
    completeAudienceActionResponse.setFamilyName(TEST_FAMILY_NAME);
    completeAudienceActionResponse.setTermsAndConditionsConsent(true);
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    onResultMock.verify();
  });

  it(`suppresses toasts`, async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
      suppressToast: true,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);

    const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).not.to.be.called;
  });

  it('should trigger login flow for a registered user', async () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);

    await audienceActionFlow.start();
    const response = new AlreadySubscribedResponse();
    response.setSubscriberOrMember(true);
    const messageCallback = messageMap['AlreadySubscribedResponse'];
    messageCallback(response);

    expect(loginStub).to.be.calledOnce.calledWithExactly({
      linkRequested: false,
    });
  });

  it('should trigger login callback if provided', async () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const loginCallbackSpy = sandbox.spy();
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
      onSignIn: loginCallbackSpy,
    });
    activitiesMock.expects('openIframe').resolves(port);

    await audienceActionFlow.start();
    const response = new AlreadySubscribedResponse();
    response.setSubscriberOrMember(true);
    const messageCallback = messageMap['AlreadySubscribedResponse'];
    messageCallback(response);

    expect(loginStub).to.not.be.called;
    expect(loginCallbackSpy).to.be.called;
  });

  it('should send an empty EntitlementsResponse to show the no entitlement found toast on Activity iFrame view', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);

    await audienceActionFlow.start();

    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );
    activityIframeViewMock
      .expects('execute')
      .withExactArgs(new EntitlementsResponse())
      .once();

    await audienceActionFlow.showNoEntitlementFoundToast();

    activityIframeViewMock.verify();
  });

  it('handleSurveyDataTransferRequest called on SurveyDataTransferRequest', async () => {
    const surveyDataTransferRequest = new SurveyDataTransferRequest();
    const handleSurveyDataTransferRequestSpy = sandbox.spy(
      Utils,
      'handleSurveyDataTransferRequest'
    );
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
      calledManually: false,
    });

    activitiesMock.expects('openIframe').resolves(port);
    await audienceActionFlow.start();
    const messageCallback = messageMap[surveyDataTransferRequest.label()];
    messageCallback(surveyDataTransferRequest);

    expect(handleSurveyDataTransferRequestSpy).to.be.called;
  });

  it('opens dialog with scrolling disabled', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    dialogManagerMock
      .expects('openView')
      .withExactArgs(
        sandbox.match.any,
        false,
        sandbox.match({shouldDisableBodyScrolling: true})
      )
      .once();
    await audienceActionFlow.start();
    dialogManagerMock.verify();
  });

  it('opens dialog with closeOnBackgroundClick=false by default', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    dialogManagerMock
      .expects('openView')
      .withExactArgs(
        sandbox.match.any,
        false,
        sandbox.match({
          closeOnBackgroundClick: false,
        })
      )
      .once();
    await audienceActionFlow.start();
    dialogManagerMock.verify();
  });

  it('opens dialog with closeOnBackgroundClick=false when isClosable=false', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      isClosable: false,
      calledManually: false,
    });
    dialogManagerMock
      .expects('openView')
      .withExactArgs(
        sandbox.match.any,
        false,
        sandbox.match({
          closeOnBackgroundClick: false,
        })
      )
      .once();
    await audienceActionFlow.start();
    dialogManagerMock.verify();
  });

  it('opens dialog with closeOnBackgroundClick=true when isClosable=true', async () => {
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      isClosable: true,
      calledManually: false,
    });
    dialogManagerMock
      .expects('openView')
      .withExactArgs(
        sandbox.match.any,
        false,
        sandbox.match({
          closeOnBackgroundClick: true,
        })
      )
      .once();
    await audienceActionFlow.start();
    dialogManagerMock.verify();
  });

  it(`opens an AudienceActionIframeFlow and passes isClosable in query param`, async () => {
    sandbox.stub(runtime.storage(), 'get').resolves(null);
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: undefined,
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      isClosable: true,
      calledManually: false,
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        `https://news.google.com/swg/ui/v1/surveyiframe?_=_&origin=${encodeURIComponent(
          WINDOW_LOCATION_DOMAIN
        )}&configurationId=&isClosable=true&calledManually=false&previewEnabled=false`,
        {
          _client: 'SwG 0.0.0',
          productType: ProductType.SUBSCRIPTION,
          supportsEventManager: true,
          windowHeight: WINDOW_INNER_HEIGHT,
        }
      )
      .resolves(port);

    await audienceActionFlow.start();

    activitiesMock.verify();
    expect(onCancelSpy).to.not.be.called;
  });

  it(`opens an AudienceActionIframeFlow and passes shouldRenderPreview in query param`, async () => {
    sandbox.stub(runtime.storage(), 'get').resolves(null);
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: undefined,
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      isClosable: true,
      calledManually: false,
      shouldRenderPreview: true,
    });
    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        `https://news.google.com/swg/ui/v1/surveyiframe?_=_&origin=${encodeURIComponent(
          WINDOW_LOCATION_DOMAIN
        )}&configurationId=&isClosable=true&calledManually=false&previewEnabled=true`,
        {
          _client: 'SwG 0.0.0',
          productType: ProductType.SUBSCRIPTION,
          supportsEventManager: true,
          windowHeight: WINDOW_INNER_HEIGHT,
        }
      )
      .resolves(port);

    await audienceActionFlow.start();

    activitiesMock.verify();
    activityIframeViewMock.expects('getElement').once();
    expect(onCancelSpy).to.not.be.called;
  });

  describe('rewarded ad', async () => {
    let alternateActionSpy;
    let audienceActionFlow;
    let activityIframeViewMock;

    async function setupRewardedAds(opt) {
      activitiesMock.expects('openIframe').resolves(port);
      alternateActionSpy = sandbox.spy();
      audienceActionFlow = new AudienceActionIframeFlow(runtime, {
        action: 'TYPE_REWARDED_AD',
        configurationId: 'configId',
        preference: opt?.adSense
          ? PromptPreference.PREFERENCE_ADSENSE_REWARDED_AD
          : undefined,
        onCancel: onCancelSpy,
        autoPromptType: AutoPromptType.SUBSCRIPTION,
        calledManually: false,
        onAlternateAction: opt?.setAlternateActionCallback
          ? alternateActionSpy
          : undefined,
      });
      activityIframeViewMock = sandbox.mock(
        audienceActionFlow.activityIframeView_
      );

      await audienceActionFlow.start();
      const rewardedAdLoadAdRequest = new RewardedAdLoadAdRequest();
      rewardedAdLoadAdRequest.setAdUnit('adunit');
      const rewardedAdLoadAdRequestCallback =
        messageMap[rewardedAdLoadAdRequest.label()];
      rewardedAdLoadAdRequestCallback(rewardedAdLoadAdRequest);
    }

    function setupGranted() {
      storageMock
        .expects('get')
        .withArgs(StorageKeys.USER_TOKEN)
        .resolves('abc')
        .atLeast(0);
      const completeResponse = new Response(null, {status: 200});
      completeResponse.text = sandbox
        .stub()
        .returns(Promise.resolve(COMPLETE_RESPONSE));
      win.fetch.onCall(0).returns(Promise.resolve(completeResponse));
      storageMock
        .expects('get')
        .withArgs(StorageKeys.USER_TOKEN)
        .resolves('abc')
        .exactly(1);
      storageMock.expects('set').withArgs(StorageKeys.USER_TOKEN).exactly(1);
      storageMock.expects('set').withArgs(StorageKeys.READ_TIME).exactly(1);
      entitlementsManagerMock.expects('clear').once();
      entitlementsManagerMock.expects('getEntitlements').once();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_REWARDED_AD_GRANTED,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
          configurationId: null,
        },
        undefined,
        undefined
      );
    }

    function verifyGranted() {
      expect(win.fetch).to.be.calledWith(
        'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=configId&audienceActionType=TYPE_REWARDED_AD'
      );
      entitlementsManagerMock.verify();
      storageMock.verify();
    }

    it('handles load and view', async () => {
      await setupRewardedAds();
      win.googletag.cmd[0]();

      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(true);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();

      const readyEventArg = {
        makeRewardedVisible: sandbox.spy(),
      };
      eventListeners['rewardedSlotReady'](readyEventArg);
      eventListeners['slotRenderEnded']({
        slot: rewardedSlot,
        isEmpty: false,
      });

      const rewardedAdViewAdRequest = new RewardedAdViewAdRequest();
      const rewardedAdViewAdRequestCallback =
        messageMap[rewardedAdViewAdRequest.label()];
      rewardedAdViewAdRequestCallback(rewardedAdViewAdRequest);
      expect(readyEventArg.makeRewardedVisible).to.be.called;

      activityIframeViewMock.verify();
    });

    it('handles granted', async () => {
      await setupRewardedAds();
      setupGranted();

      win.googletag.cmd[0]();
      await eventListeners['rewardedSlotGranted']();

      expect(win.googletag.destroySlots).to.be.called;
      verifyGranted();
    });

    it('handles close', async () => {
      await setupRewardedAds({setAlternateActionCallback: true});
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
          configurationId: null,
        },
        undefined,
        undefined
      );
      dialogManagerMock.expects('completeView').once();

      win.googletag.cmd[0]();

      eventListeners['rewardedSlotClosed']();
      expect(alternateActionSpy).to.be.called;
      dialogManagerMock.verify();
    });

    it('handles rewarded ad timout', async () => {
      await setupRewardedAds();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_REWARDED_AD_GPT_ERROR,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
          configurationId: null,
        },
        undefined,
        undefined
      );
      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();

      await clock.tick(10000);

      activityIframeViewMock.verify();
    });

    it('handles rewarded no fill', async () => {
      await setupRewardedAds();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_REWARDED_AD_NOT_FILLED,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
          configurationId: null,
        },
        undefined,
        undefined
      );
      win.googletag.cmd[0]();
      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();
      eventListeners['slotRenderEnded']({
        slot: rewardedSlot,
        isEmpty: true,
      });

      activityIframeViewMock.verify();
    });

    it('handles missing googletag', async () => {
      win.googletag = undefined;
      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_REWARDED_AD_GPT_MISSING_ERROR,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
          configurationId: null,
        },
        undefined,
        undefined
      );

      await setupRewardedAds({disableDefineOutOfPageSlot: true});
    });

    it('handles improper page set up', async () => {
      win.googletag.defineOutOfPageSlot = () => {};

      await setupRewardedAds();

      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_REWARDED_AD_PAGE_ERROR,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
          configurationId: null,
        },
        undefined,
        undefined
      );

      win.googletag.cmd[0]();
    });

    it('handles rewarded ad alternate action', async () => {
      await setupRewardedAds({setAlternateActionCallback: true});
      const rewardedAdAlternateActionRequest =
        new RewardedAdAlternateActionRequest();
      const rewardedAdAlternateActionRequestCallback =
        messageMap[rewardedAdAlternateActionRequest.label()];
      rewardedAdAlternateActionRequestCallback(
        rewardedAdAlternateActionRequest
      );

      expect(alternateActionSpy).to.be.called;
    });

    it('handles adsense load and view', async () => {
      await setupRewardedAds({adSense: true});

      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(true);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();

      const showSpy = sandbox.spy();
      win.adsbygoogle[0]['params']['google_acr']({
        show: showSpy,
      });

      const rewardedAdViewAdRequest = new RewardedAdViewAdRequest();
      const rewardedAdViewAdRequestCallback =
        messageMap[rewardedAdViewAdRequest.label()];
      rewardedAdViewAdRequestCallback(rewardedAdViewAdRequest);
      expect(showSpy).to.be.called;

      activityIframeViewMock.verify();
    });

    it('handles adsense failed to load', async () => {
      win.adsbygoogle = undefined;
      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_REWARDED_AD_ADSENSE_MISSING_ERROR,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: false,
          additionalParameters: null,
          configurationId: null,
        },
        undefined,
        undefined
      );

      await setupRewardedAds({adSense: true});

      activityIframeViewMock.verify();
    });

    it('handles adsense failed to fill', async () => {
      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();

      await setupRewardedAds({adSense: true});

      win.adsbygoogle[0]['params']['google_acr'](undefined);

      activityIframeViewMock.verify();
    });

    it('handles adsense granted', async () => {
      await setupRewardedAds({adSense: true});
      setupGranted();

      let grantedCallback;
      win.adsbygoogle[0]['params']['google_acr']({
        show: (c) => (grantedCallback = c),
      });

      const rewardedAdViewAdRequest = new RewardedAdViewAdRequest();
      const rewardedAdViewAdRequestCallback =
        messageMap[rewardedAdViewAdRequest.label()];
      rewardedAdViewAdRequestCallback(rewardedAdViewAdRequest);

      await grantedCallback({
        status: 'viewed',
        reward: {type: 'foo', amount: 3},
      });

      verifyGranted();
    });

    it('handles adsense not granted', async () => {
      await setupRewardedAds({adSense: true, setAlternateActionCallback: true});
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
          configurationId: null,
        },
        undefined,
        undefined
      );
      dialogManagerMock.expects('completeView').once();

      let grantedCallback;
      win.adsbygoogle[0]['params']['google_acr']({
        show: (c) => (grantedCallback = c),
      });

      const rewardedAdViewAdRequest = new RewardedAdViewAdRequest();
      const rewardedAdViewAdRequestCallback =
        messageMap[rewardedAdViewAdRequest.label()];
      rewardedAdViewAdRequestCallback(rewardedAdViewAdRequest);

      await grantedCallback({status: 'foo', reward: undefined});

      expect(alternateActionSpy).to.be.called;
      dialogManagerMock.verify();
    });

    it('sets google_adtest based on query param', async () => {
      win.location.search = '?google_adtest=on';
      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(true);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();

      await setupRewardedAds({adSense: true});

      expect(win.adsbygoogle[0]['params']['google_adtest']).to.equal('on');
      activityIframeViewMock.verify();
    });

    it('sets google_adtest to null if query param not set', async () => {
      win.location.search = '';
      const rewardedAdLoadAdResponse = new RewardedAdLoadAdResponse();
      rewardedAdLoadAdResponse.setSuccess(true);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(rewardedAdLoadAdResponse)
        .once();

      await setupRewardedAds({adSense: true});

      expect(win.adsbygoogle[0]['params']['google_adtest']).to.be.null;
      activityIframeViewMock.verify();
    });
  });

  it('creates GisLoginFlow when clientId and onGisIdToken are present', async () => {
    clientOptions.gisClientId = 'clientId';
    clientOptions.onGisIdToken = () => {};
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    expect(audienceActionFlow.gisLoginFlow).to.not.be.undefined;
  });

  it('does not create GisLoginFlow when clientId is missing', async () => {
    clientOptions.gisClientId = undefined;
    clientOptions.onGisIdToken = () => {};
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    expect(audienceActionFlow.gisLoginFlow).to.be.undefined;
  });

  it('does not create GisLoginFlow when onGisIdToken is missing', async () => {
    clientOptions.gisClientId = 'clientId';
    clientOptions.onGisIdToken = undefined;
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    expect(audienceActionFlow.gisLoginFlow).to.be.undefined;
  });

  it('disposes GisLoginFlow on complete', async () => {
    clientOptions.gisClientId = 'clientId';
    clientOptions.onGisIdToken = () => {};
    const gisLoginFlowDisposeSpy = sandbox.spy(
      GisLoginFlow.prototype,
      'dispose'
    );
    const audienceActionFlow = new AudienceActionIframeFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      calledManually: false,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);

    sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    completeAudienceActionResponse.setUserEmail('xxx@gmail.com');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    await messageCallback(completeAudienceActionResponse);

    expect(gisLoginFlowDisposeSpy).to.be.calledOnce;
  });

  it('isAudienceActionType returns correct value for InterventionType', () => {
    expect(isAudienceActionType(InterventionType.TYPE_SUBSCRIPTION)).to.be
      .false;
    expect(isAudienceActionType(InterventionType.TYPE_CONTRIBUTION)).to.be
      .false;
    expect(isAudienceActionType(InterventionType.TYPE_BYO_CTA)).to.be.true;
    expect(isAudienceActionType(InterventionType.TYPE_NEWSLETTER_SIGNUP)).to.be
      .true;
    expect(isAudienceActionType(InterventionType.TYPE_REGISTRATION_WALL)).to.be
      .true;
    expect(isAudienceActionType(InterventionType.TYPE_REWARDED_AD)).to.be.true;
    expect(isAudienceActionType(InterventionType.TYPE_REWARDED_SURVEY)).to.be
      .true;
  });
});
