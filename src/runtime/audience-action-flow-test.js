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

import {
  AlreadySubscribedResponse,
  AnalyticsEvent,
  CompleteAudienceActionResponse,
  EntitlementsResponse,
  EventOriginator,
  SurveyAnswer,
  SurveyDataTransferRequest,
  SurveyDataTransferResponse,
  SurveyQuestion,
} from '../proto/api_messages';
import {AudienceActionFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {Constants} from '../utils/constants';
import {MockActivityPort} from '../../test/mock-activity-port';
import {PageConfig} from '../model/page-config';
import {ProductType} from '../api/subscriptions';
import {Toast} from '../ui/toast';
import {tick} from '../../test/tick';

const WINDOW_LOCATION_DOMAIN = 'https://www.test.com';
const WINDOW_INNER_HEIGHT = 424242;
const CURRENT_TIME = 1615416442000;
const EXPECTED_TIME_STRING = '1615416442000';

const TEST_QUESTION_CATEGORY_1 = 'Test Question Category 1';
const TEST_QUESTION_TEXT_1 = 'Test Question 1';
const TEST_QUESTION_CATEGORY_2 = 'Test Question Category 2';
const TEST_QUESTION_TEXT_2 = 'Test Question 2';
const TEST_ANSWER_CATEGORY_1 = 'Test Answer Category 1';
const TEST_ANSWER_TEXT_1 = 'Test Answer 1';
const TEST_ANSWER_PPS_1 = '1';
const TEST_ANSWER_CATEGORY_2 = 'Test Answer Category 2';
const TEST_ANSWER_TEXT_2 = 'Test Answer 2';
const TEST_ANSWER_PPS_2 = '2';
const TEST_QUESTION_CATEGORY_3 = 'Test Question Category 3';
const TEST_QUESTION_TEXT_3 = 'Test Question 3';
const TEST_ANSWER_CATEGORY_3 = 'Test Answer Category 3';
const TEST_ANSWER_TEXT_3 = 'Test Answer 3';

const TEST_SURVEYANSWER_1 = new SurveyAnswer();
TEST_SURVEYANSWER_1.setAnswerCategory(TEST_ANSWER_CATEGORY_1);
TEST_SURVEYANSWER_1.setAnswerText(TEST_ANSWER_TEXT_1);
TEST_SURVEYANSWER_1.setPpsValue(TEST_ANSWER_PPS_1);
const TEST_SURVEYQUESTION_1 = new SurveyQuestion();
TEST_SURVEYQUESTION_1.setQuestionCategory(TEST_QUESTION_CATEGORY_1);
TEST_SURVEYQUESTION_1.setQuestionText(TEST_QUESTION_TEXT_1);
TEST_SURVEYQUESTION_1.setSurveyAnswersList([TEST_SURVEYANSWER_1]);

const TEST_SURVEYANSWER_2 = new SurveyAnswer();
TEST_SURVEYANSWER_2.setAnswerCategory(TEST_ANSWER_CATEGORY_2);
TEST_SURVEYANSWER_2.setAnswerText(TEST_ANSWER_TEXT_2);
TEST_SURVEYANSWER_2.setPpsValue(TEST_ANSWER_PPS_2);
const TEST_SURVEYQUESTION_2 = new SurveyQuestion();
TEST_SURVEYQUESTION_2.setQuestionCategory(TEST_QUESTION_CATEGORY_2);
TEST_SURVEYQUESTION_2.setQuestionText(TEST_QUESTION_TEXT_2);
TEST_SURVEYQUESTION_2.setSurveyAnswersList([TEST_SURVEYANSWER_2]);

const TEST_SURVEYDATATRANSFERREQUEST = new SurveyDataTransferRequest();
TEST_SURVEYDATATRANSFERREQUEST.setSurveyQuestionsList([
  TEST_SURVEYQUESTION_1,
  TEST_SURVEYQUESTION_2,
]);

const TEST_SURVEYANSWER_EMPTY = new SurveyAnswer();
const TEST_SURVEYQUESTION_EMPTY = new SurveyQuestion();
TEST_SURVEYQUESTION_EMPTY.setSurveyAnswersList([TEST_SURVEYANSWER_EMPTY]);
const TEST_EMPTY_SURVEYDATATRANSFERREQUEST = new SurveyDataTransferRequest();
TEST_EMPTY_SURVEYDATATRANSFERREQUEST.setSurveyQuestionsList([
  TEST_SURVEYQUESTION_EMPTY,
]);

const TEST_SURVEYDATATRANSFERREQUEST_WITHPPS = new SurveyDataTransferRequest();
TEST_SURVEYDATATRANSFERREQUEST_WITHPPS.setSurveyQuestionsList([
  TEST_SURVEYQUESTION_1,
  TEST_SURVEYQUESTION_2,
]);
TEST_SURVEYDATATRANSFERREQUEST_WITHPPS.setStorePpsInLocalStorage(true);

const TEST_SURVEYANSWER_3 = new SurveyAnswer();
TEST_SURVEYANSWER_3.setAnswerCategory(TEST_ANSWER_CATEGORY_3);
TEST_SURVEYANSWER_3.setAnswerText(TEST_ANSWER_TEXT_3);
const TEST_SURVEYQUESTION_3 = new SurveyQuestion();
TEST_SURVEYQUESTION_3.setQuestionCategory(TEST_QUESTION_CATEGORY_3);
TEST_SURVEYQUESTION_3.setQuestionText(TEST_QUESTION_TEXT_3);
TEST_SURVEYQUESTION_3.setSurveyAnswersList([TEST_SURVEYANSWER_3]);
const TEST_SURVEYDATATRANSFERREQUEST_WITHPPS_NOVALUES =
  new SurveyDataTransferRequest();
TEST_SURVEYDATATRANSFERREQUEST_WITHPPS_NOVALUES.setStorePpsInLocalStorage(true);

describes.realWin('AudienceActionFlow', (env) => {
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

  beforeEach(() => {
    win = Object.assign(
      {},
      {
        location: {href: WINDOW_LOCATION_DOMAIN + '/page/1'},
        document: env.win.document,
        gtag: () => {},
        innerHeight: WINDOW_INNER_HEIGHT,
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
    sandbox.useFakeTimers(CURRENT_TIME);
    sandbox.stub(self.console, 'warn');
  });

  afterEach(() => {
    eventManagerMock.verify();
    self.console.warn.reset();
  });

  function setWinWithoutGtag() {
    const winWithNoGtag = Object.assign({}, win);
    delete winWithNoGtag.gtag;
    runtime.win.restore();
    sandbox.stub(runtime, 'win').returns(winWithNoGtag);
  }

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
  ].forEach(({action, configurationId, path}) => {
    it(`opens an AudienceActionFlow constructed with params for ${action}`, async () => {
      sandbox.stub(runtime.storage(), 'get').resolves(null);
      const audienceActionFlow = new AudienceActionFlow(runtime, {
        action,
        configurationId,
        onCancel: onCancelSpy,
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      });
      activitiesMock
        .expects('openIframe')
        .withExactArgs(
          sandbox.match((arg) => arg.tagName == 'IFRAME'),
          `https://news.google.com/swg/ui/v1/${path}?_=_&origin=${encodeURIComponent(
            WINDOW_LOCATION_DOMAIN
          )}&configurationId=${
            configurationId === undefined ? '' : configurationId
          }&hl=en&isClosable=false`,
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

  it('opens an AudienceActionFlow with query param locale set to client configuration language', async () => {
    clientOptions.lang = 'pt-BR';
    sandbox.stub(runtime.storage(), 'get').resolves(null);
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        `https://news.google.com/swg/ui/v1/regwalliframe?_=_&origin=${encodeURIComponent(
          WINDOW_LOCATION_DOMAIN
        )}&configurationId=configId&hl=pt-BR&isClosable=false`,
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

  it('calls the onCancel when an AudienceActionFlow is cancelled and one it provided', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
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
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
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
    messageCallback(completeAudienceActionResponse);

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
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
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
    messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=custom');
    expect(decodeURIComponent(toast.src_)).to.contain(
      'Signed up with xxx@gmail.com for the newsletter'
    );
  });

  it('handles a CompleteAudienceActionResponse with regwall completed before and opens a basic toast', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
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
    messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=basic');
  });

  it('handles a CompleteAudienceActionResponse with regwall failure and opens a failure toast', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
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
    messageCallback(completeAudienceActionResponse);

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
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
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
    messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=custom');
    expect(decodeURI(toast.src_)).to.contain('You have signed up before.');
  });

  it(`handles a CompleteAudienceActionResponse with newsletter failure and opens a custom toast indicating that the sign up has failed`, async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_NEWSLETTER_SIGNUP',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
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
    messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).to.be.called;
    expect(toast).not.to.be.null;
    expect(toast.src_).to.contain('flavor=custom');
    expect(decodeURI(toast.src_)).to.contain(
      'Signup failed. Try signing up again.'
    );
  });

  it('handles a CompleteAudienceActionResponse with survey completed and does not open a custom toast', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);
    const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).not.to.be.called;
  });

  it(`handles a CompleteAudienceActionResponse with survey already completed and does not open a custom toast.`, async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);
    const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(true);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).not.to.be.called;
  });

  it(`handles a CompleteAudienceActionResponse with survey failure and does not open a custom toast.`, async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock.expects('clear').once();
    entitlementsManagerMock.expects('getEntitlements').once();
    storageMock
      .expects('set')
      .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    storageMock
      .expects('set')
      .withExactArgs(Constants.READ_TIME, EXPECTED_TIME_STRING, false)
      .exactly(1);
    const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

    await audienceActionFlow.start();
    const completeAudienceActionResponse = new CompleteAudienceActionResponse();
    completeAudienceActionResponse.setActionCompleted(false);
    completeAudienceActionResponse.setAlreadyCompleted(false);
    completeAudienceActionResponse.setSwgUserToken('fake user token');
    const messageCallback = messageMap[completeAudienceActionResponse.label()];
    messageCallback(completeAudienceActionResponse);

    entitlementsManagerMock.verify();
    storageMock.verify();
    expect(toastOpenStub).not.to.be.called;
  });

  it('should trigger login flow for a registered user', async () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
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

  it('should send an empty EntitlementsResponse to show the no entitlement found toast on Activity iFrame view', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
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

  it(`handles a SurveyDataTransferRequest with successful Google Analytics logging`, async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
    });
    activitiesMock.expects('openIframe').resolves(port);

    eventManagerMock
      .expects('logEvent')
      .withExactArgs(
        {
          eventType: AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
        },
        {
          googleAnalyticsParameters: {
            'event_category': TEST_QUESTION_CATEGORY_1,
            'event_label': TEST_ANSWER_TEXT_1,
            'survey_question': TEST_QUESTION_TEXT_1,
            'survey_question_category': TEST_QUESTION_CATEGORY_1,
            'survey_answer': TEST_ANSWER_TEXT_1,
            'survey_answer_category': TEST_ANSWER_CATEGORY_1,
          },
        }
      )
      .once();
    eventManagerMock
      .expects('logEvent')
      .withExactArgs(
        {
          eventType: AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
        },
        {
          googleAnalyticsParameters: {
            'event_category': TEST_QUESTION_CATEGORY_2,
            'event_label': TEST_ANSWER_TEXT_2,
            'survey_question': TEST_QUESTION_TEXT_2,
            'survey_question_category': TEST_QUESTION_CATEGORY_2,
            'survey_answer': TEST_ANSWER_TEXT_2,
            'survey_answer_category': TEST_ANSWER_CATEGORY_2,
          },
        }
      )
      .once();
    eventManagerMock.expects('logEvent').withExactArgs({
      eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: true,
      additionalParameters: null,
    });

    await audienceActionFlow.start();

    const successSurveyDataTransferResponse = new SurveyDataTransferResponse();
    successSurveyDataTransferResponse.setSuccess(true);
    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );
    activityIframeViewMock
      .expects('execute')
      .withExactArgs(successSurveyDataTransferResponse)
      .once();

    const messageCallback = messageMap[TEST_SURVEYDATATRANSFERREQUEST.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST);

    await tick(10);

    activityIframeViewMock.verify();
  });

  it(`handles a SurveyDataTransferRequest with failed Google Analytics logging`, async () => {
    setWinWithoutGtag();
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
    });
    activitiesMock.expects('openIframe').resolves(port);
    eventManagerMock
      .expects('logEvent')
      .withExactArgs({
        eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
      })
      .once();
    await audienceActionFlow.start();

    const successSurveyDataTransferResponse = new SurveyDataTransferResponse();
    successSurveyDataTransferResponse.setSuccess(false);
    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );
    activityIframeViewMock
      .expects('execute')
      .withExactArgs(successSurveyDataTransferResponse)
      .once();

    const messageCallback = messageMap[TEST_SURVEYDATATRANSFERREQUEST.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST);

    await tick(10);

    activityIframeViewMock.verify();
  });

  it(`handles a SurveyDataTransferRequest with successful onResult logging`, async () => {
    const onResultMock = sandbox
      .mock()
      .withExactArgs(TEST_SURVEYDATATRANSFERREQUEST)
      .resolves(true)
      .once();

    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
      onResult: onResultMock,
    });

    activitiesMock.expects('openIframe').resolves(port);

    eventManagerMock.expects('logEvent').withExactArgs({
      eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: true,
      additionalParameters: null,
    });

    await audienceActionFlow.start();

    const successSurveyDataTransferResponse = new SurveyDataTransferResponse();
    successSurveyDataTransferResponse.setSuccess(true);

    const activityIframeViewMock = sandbox
      .mock(audienceActionFlow.activityIframeView_)
      .expects('execute')
      .withExactArgs(successSurveyDataTransferResponse)
      .once();

    const messageCallback = messageMap[TEST_SURVEYDATATRANSFERREQUEST.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST);

    await tick(10);

    activityIframeViewMock.verify();
    onResultMock.verify();
  });

  it(`handles a SurveyDataTransferRequest with failed onResult logging`, async () => {
    const onResultMock = sandbox
      .mock()
      .withExactArgs(TEST_SURVEYDATATRANSFERREQUEST)
      .resolves(false)
      .once();

    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
      onResult: onResultMock,
    });

    activitiesMock.expects('openIframe').resolves(port);

    eventManagerMock
      .expects('logEvent')
      .withExactArgs({
        eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
      })
      .once();

    await audienceActionFlow.start();

    const failSurveyDataTransferResponse = new SurveyDataTransferResponse();
    failSurveyDataTransferResponse.setSuccess(false);

    const activityIframeViewMock = sandbox
      .mock(audienceActionFlow.activityIframeView_)
      .expects('execute')
      .withExactArgs(failSurveyDataTransferResponse)
      .once();

    const messageCallback = messageMap[TEST_SURVEYDATATRANSFERREQUEST.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST);

    await tick(10);

    activityIframeViewMock.verify();
    onResultMock.verify();
  });

  it(`handles a SurveyDataTransferRequest with onResult logging exception`, async () => {
    const onResultMock = sandbox
      .mock()
      .withExactArgs(TEST_SURVEYDATATRANSFERREQUEST)
      .throws(new Error('Test Callback Exception'))
      .once();

    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
      onResult: onResultMock,
    });

    activitiesMock.expects('openIframe').resolves(port);

    eventManagerMock
      .expects('logEvent')
      .withExactArgs({
        eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
      })
      .once();

    await audienceActionFlow.start();

    const failSurveyDataTransferResponse = new SurveyDataTransferResponse();
    failSurveyDataTransferResponse.setSuccess(false);

    const activityIframeViewMock = sandbox
      .mock(audienceActionFlow.activityIframeView_)
      .expects('execute')
      .withExactArgs(failSurveyDataTransferResponse)
      .once();

    const messageCallback = messageMap[TEST_SURVEYDATATRANSFERREQUEST.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST);

    await tick(10);

    expect(self.console.warn).to.have.been.calledWithExactly(
      '[swg.js] Exception in publisher provided logging callback: Error: Test Callback Exception'
    );
    activityIframeViewMock.verify();
    onResultMock.verify();
  });

  it(`handles a SurveyDataTransferRequest with onResult logging rejection`, async () => {
    const onResultMock = sandbox
      .mock()
      .withExactArgs(TEST_SURVEYDATATRANSFERREQUEST)
      .rejects(new Error('Test Callback Exception'))
      .once();

    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
      onResult: onResultMock,
    });

    activitiesMock.expects('openIframe').resolves(port);

    eventManagerMock
      .expects('logEvent')
      .withExactArgs({
        eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
      })
      .once();

    await audienceActionFlow.start();

    const failSurveyDataTransferResponse = new SurveyDataTransferResponse();
    failSurveyDataTransferResponse.setSuccess(false);

    const activityIframeViewMock = sandbox
      .mock(audienceActionFlow.activityIframeView_)
      .expects('execute')
      .withExactArgs(failSurveyDataTransferResponse)
      .once();

    const messageCallback = messageMap[TEST_SURVEYDATATRANSFERREQUEST.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST);

    await tick(10);

    expect(self.console.warn).to.have.been.calledWithExactly(
      '[swg.js] Exception in publisher provided logging callback: Error: Test Callback Exception'
    );
    activityIframeViewMock.verify();
    onResultMock.verify();
  });

  it(`handles an empty SurveyDataTransferRequest without onResult logging`, async () => {
    eventManagerMock
      .expects('logEvent')
      .withExactArgs(
        {
          eventType: AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
        },
        {
          googleAnalyticsParameters: {
            'event_category': '',
            'event_label': '',
            'survey_question': '',
            'survey_question_category': '',
            'survey_answer': '',
            'survey_answer_category': '',
          },
        }
      )
      .once();

    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
    });

    activitiesMock.expects('openIframe').resolves(port);

    eventManagerMock.expects('logEvent').withExactArgs({
      eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: true,
      additionalParameters: null,
    });

    await audienceActionFlow.start();

    const successSurveyDataTransferResponse = new SurveyDataTransferResponse();
    successSurveyDataTransferResponse.setSuccess(true);

    const messageCallback =
      messageMap[TEST_EMPTY_SURVEYDATATRANSFERREQUEST.label()];
    messageCallback(TEST_EMPTY_SURVEYDATATRANSFERREQUEST);

    await tick(10);
  });

  it(`handles a SurveyDataTransferRequest with successful PPS storage in empty localStorage`, async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
    });
    activitiesMock.expects('openIframe').resolves(port);

    const newIabTaxonomyMap = {
      [Constants.PPS_AUDIENCE_TAXONOMY_KEY]: {values: ['1', '2']},
    };
    storageMock
      .expects('set')
      .withExactArgs('ppstaxonomies', JSON.stringify(newIabTaxonomyMap), true)
      .once();

    await audienceActionFlow.start();
    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );
    activityIframeViewMock.expects('execute').once();

    const messageCallback =
      messageMap[TEST_SURVEYDATATRANSFERREQUEST_WITHPPS.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST_WITHPPS);

    await tick(10);

    storageMock.verify();
    activityIframeViewMock.verify();
  });

  it(`handles a SurveyDataTransferRequest with successful PPS storage in populated localStorage`, async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
    });
    activitiesMock.expects('openIframe').resolves(port);

    const existingIabTaxonomyMap = {
      [Constants.PPS_AUDIENCE_TAXONOMY_KEY]: {values: ['2', '3', '4']},
    };
    const newIabTaxonomyMap = {
      [Constants.PPS_AUDIENCE_TAXONOMY_KEY]: {
        values: ['1', '2', '3', '4'],
      },
    };

    storageMock
      .expects('get')
      .withExactArgs('ppstaxonomies', true)
      .resolves(JSON.stringify(existingIabTaxonomyMap))
      .once();

    storageMock
      .expects('set')
      .withExactArgs('ppstaxonomies', JSON.stringify(newIabTaxonomyMap), true)
      .once();

    await audienceActionFlow.start();
    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );
    activityIframeViewMock.expects('execute').once();

    const messageCallback =
      messageMap[TEST_SURVEYDATATRANSFERREQUEST_WITHPPS.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST_WITHPPS);

    await tick(10);

    storageMock.verify();
    activityIframeViewMock.verify();
  });

  it(`handles a SurveyDataTransferRequest with successful PPS storage with no PPS ppstaxonomies but flag enabled`, async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
    });
    activitiesMock.expects('openIframe').resolves(port);

    await audienceActionFlow.start();
    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );

    const messageCallback =
      messageMap[TEST_SURVEYDATATRANSFERREQUEST_WITHPPS_NOVALUES.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST_WITHPPS_NOVALUES);

    await tick(10);

    activityIframeViewMock.verify();
  });

  it(`handles a SurveyDataTransferRequest with improper existing PPS`, async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.CONTRIBUTION,
    });
    activitiesMock.expects('openIframe').resolves(port);

    const existingIabTaxonomyMapBadFormat = {
      'test': {'values': ['5']},
    };
    const newIabTaxonomyMap = {
      [Constants.PPS_AUDIENCE_TAXONOMY_KEY]: {values: ['1', '2']},
    };

    storageMock
      .expects('get')
      .withExactArgs('ppstaxonomies', true)
      .resolves(JSON.stringify(existingIabTaxonomyMapBadFormat))
      .once();

    storageMock
      .expects('set')
      .withExactArgs('ppstaxonomies', JSON.stringify(newIabTaxonomyMap), true)
      .once();

    await audienceActionFlow.start();
    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );
    activityIframeViewMock.expects('execute').once();

    const messageCallback =
      messageMap[TEST_SURVEYDATATRANSFERREQUEST_WITHPPS.label()];
    messageCallback(TEST_SURVEYDATATRANSFERREQUEST_WITHPPS);

    await tick(10);

    storageMock.verify();
    activityIframeViewMock.verify();
  });

  it('opens dialog with scrolling disabled', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      configurationId: 'configId',
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
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

  it(`opens an AudienceActionFlow and passes isClosable in query param`, async () => {
    sandbox.stub(runtime.storage(), 'get').resolves(null);
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REWARDED_SURVEY',
      configurationId: undefined,
      onCancel: onCancelSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
      isClosable: true,
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        `https://news.google.com/swg/ui/v1/surveyiframe?_=_&origin=${encodeURIComponent(
          WINDOW_LOCATION_DOMAIN
        )}&configurationId=&hl=en&isClosable=true`,
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
