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
import {
  AnalyticsEvent,
  CtaMode,
  EventOriginator,
  EventParams,
  SurveyAnswer,
  SurveyDataTransferRequest,
  SurveyDataTransferResponse,
  SurveyQuestion,
} from '../proto/api_messages';
import {ClientEventManager} from '../runtime/client-event-manager';
import {Constants} from './constants';
import {MockDeps} from '../../test/mock-deps';
import {PageConfig} from '../model/page-config';
import {Storage} from '../runtime/storage';
import {handleSurveyDataTransferRequest} from './survey-utils';
import {tick} from '../../test/tick';

const productId = 'pub1:label1';
const TEST_SURVEYONRESULTCONFIGID = 'survey onsResult config id';
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
const TEST_SURVEYQUESTION_1 = new SurveyQuestion();
const TEST_SURVEYANSWER_1 = new SurveyAnswer();

TEST_SURVEYANSWER_1.setAnswerCategory(TEST_ANSWER_CATEGORY_1);
TEST_SURVEYANSWER_1.setAnswerText(TEST_ANSWER_TEXT_1);
TEST_SURVEYANSWER_1.setPpsValue(TEST_ANSWER_PPS_1);

const TEST_SURVEYANSWER_2 = new SurveyAnswer();
TEST_SURVEYANSWER_2.setAnswerCategory(TEST_ANSWER_CATEGORY_2);
TEST_SURVEYANSWER_2.setAnswerText(TEST_ANSWER_TEXT_2);
TEST_SURVEYANSWER_2.setPpsValue(TEST_ANSWER_PPS_2);

TEST_SURVEYQUESTION_1.setQuestionCategory(TEST_QUESTION_CATEGORY_1);
TEST_SURVEYQUESTION_1.setQuestionText(TEST_QUESTION_TEXT_1);
TEST_SURVEYQUESTION_1.setSurveyAnswersList([
  TEST_SURVEYANSWER_1,
  TEST_SURVEYANSWER_2,
]);

const TEST_SURVEYQUESTION_2 = new SurveyQuestion();
TEST_SURVEYQUESTION_2.setQuestionCategory(TEST_QUESTION_CATEGORY_2);
TEST_SURVEYQUESTION_2.setQuestionText(TEST_QUESTION_TEXT_2);
TEST_SURVEYQUESTION_2.setSurveyAnswersList([TEST_SURVEYANSWER_2]);

const TEST_SURVEYDATATRANSFERREQUEST = new SurveyDataTransferRequest();
TEST_SURVEYDATATRANSFERREQUEST.setSurveyQuestionsList([
  TEST_SURVEYQUESTION_1,
  TEST_SURVEYQUESTION_2,
]);
const TEST_SURVEYONRESULTRESPONSE = {
  configurationId: TEST_SURVEYONRESULTCONFIGID,
  data: TEST_SURVEYDATATRANSFERREQUEST,
};
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
const TEST_SURVEYDATATRANSFERREQUEST_WITHPPS_NOVALUES =
  new SurveyDataTransferRequest();
TEST_SURVEYDATATRANSFERREQUEST_WITHPPS_NOVALUES.setStorePpsInLocalStorage(true);

describes.realWin('Survey utils', (env) => {
  let deps;
  let win;
  let eventManagerMock;
  let storageMock;
  let activityIframeView;
  let activityIframeViewMock;
  beforeEach(() => {
    deps = new MockDeps();
    win = Object.assign(
      {},
      {
        location: {href: 'https://www.test.com'},
        document: env.win.document,
        gtag: () => {},
      },
      {}
    );
    sandbox.stub(deps, 'win').returns(win);
    const eventManager = new ClientEventManager(Promise.resolve());
    eventManagerMock = sandbox.mock(eventManager);
    sandbox.stub(deps, 'eventManager').returns(eventManager);
    const pageConfig = new PageConfig(productId);
    const storage = new Storage(win, pageConfig);
    storageMock = sandbox.mock(storage);
    sandbox.stub(deps, 'storage').returns(storage);
    sandbox.stub(self.console, 'warn');

    activityIframeView = new ActivityIframeView(
      win,
      deps.activityPorts,
      '',
      {}
    );
    activityIframeViewMock = sandbox.mock(activityIframeView);
  });

  afterEach(() => {
    eventManagerMock.verify();
    self.console.warn.reset();
  });

  describe('handleSurveyDataTransferRequest', () => {
    it(`with successful Google Analytics logging`, async () => {
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
              'content_id': TEST_QUESTION_CATEGORY_1,
              'content_group': TEST_QUESTION_TEXT_1,
              'content_type': TEST_ANSWER_TEXT_1,
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
            // Rendering response for more than first survey answer choice
            googleAnalyticsParameters: {
              'event_category': TEST_QUESTION_CATEGORY_1,
              'event_label': TEST_ANSWER_TEXT_2,
              'survey_question': TEST_QUESTION_TEXT_1,
              'survey_question_category': TEST_QUESTION_CATEGORY_1,
              'survey_answer': TEST_ANSWER_TEXT_2,
              'survey_answer_category': TEST_ANSWER_CATEGORY_2,
              'content_id': TEST_QUESTION_CATEGORY_1,
              'content_group': TEST_QUESTION_TEXT_1,
              'content_type': TEST_ANSWER_TEXT_2,
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
              'content_id': TEST_QUESTION_CATEGORY_2,
              'content_group': TEST_QUESTION_TEXT_2,
              'content_type': TEST_ANSWER_TEXT_2,
            },
          }
        )
        .once();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
          configurationId: null,
          label: null,
        },
        undefined,
        undefined
      );
      const successSurveyDataTransferResponse =
        new SurveyDataTransferResponse();
      successSurveyDataTransferResponse.setSuccess(true);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(successSurveyDataTransferResponse)
        .once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_POPUP
      );
      await tick(10);

      activityIframeViewMock.verify();
    });

    it(`with successful Google Analytics logging for inline`, async () => {
      eventManagerMock
        .expects('logEvent')
        .withExactArgs(
          {
            eventType: AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction: true,
            additionalParameters: {ctaMode: CtaMode.CTA_MODE_INLINE},
          },
          {
            googleAnalyticsParameters: {
              'event_category': TEST_QUESTION_CATEGORY_1,
              'event_label': TEST_ANSWER_TEXT_1,
              'survey_question': TEST_QUESTION_TEXT_1,
              'survey_question_category': TEST_QUESTION_CATEGORY_1,
              'survey_answer': TEST_ANSWER_TEXT_1,
              'survey_answer_category': TEST_ANSWER_CATEGORY_1,
              'content_id': TEST_QUESTION_CATEGORY_1,
              'content_group': TEST_QUESTION_TEXT_1,
              'content_type': TEST_ANSWER_TEXT_1,
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
            additionalParameters: {ctaMode: CtaMode.CTA_MODE_INLINE},
          },
          {
            // Rendering response for more than first survey answer choice
            googleAnalyticsParameters: {
              'event_category': TEST_QUESTION_CATEGORY_1,
              'event_label': TEST_ANSWER_TEXT_2,
              'survey_question': TEST_QUESTION_TEXT_1,
              'survey_question_category': TEST_QUESTION_CATEGORY_1,
              'survey_answer': TEST_ANSWER_TEXT_2,
              'survey_answer_category': TEST_ANSWER_CATEGORY_2,
              'content_id': TEST_QUESTION_CATEGORY_1,
              'content_group': TEST_QUESTION_TEXT_1,
              'content_type': TEST_ANSWER_TEXT_2,
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
            additionalParameters: {ctaMode: CtaMode.CTA_MODE_INLINE},
          },
          {
            googleAnalyticsParameters: {
              'event_category': TEST_QUESTION_CATEGORY_2,
              'event_label': TEST_ANSWER_TEXT_2,
              'survey_question': TEST_QUESTION_TEXT_2,
              'survey_question_category': TEST_QUESTION_CATEGORY_2,
              'survey_answer': TEST_ANSWER_TEXT_2,
              'survey_answer_category': TEST_ANSWER_CATEGORY_2,
              'content_id': TEST_QUESTION_CATEGORY_2,
              'content_group': TEST_QUESTION_TEXT_2,
              'content_type': TEST_ANSWER_TEXT_2,
            },
          }
        )
        .once();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: new EventParams([
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            CtaMode.CTA_MODE_INLINE,
          ]),
          configurationId: null,
        },
        undefined,
        undefined
      );
      const successSurveyDataTransferResponse =
        new SurveyDataTransferResponse();
      successSurveyDataTransferResponse.setSuccess(true);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(successSurveyDataTransferResponse)
        .once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_INLINE
      );
      await tick(10);

      activityIframeViewMock.verify();
    });

    it(`with failed Google Analytics logging`, async () => {
      const winWithNoGtag = Object.assign({}, win);
      delete winWithNoGtag.gtag;
      deps.win.restore();
      sandbox.stub(deps, 'win').returns(winWithNoGtag);
      const successSurveyDataTransferResponse =
        new SurveyDataTransferResponse();
      successSurveyDataTransferResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(successSurveyDataTransferResponse)
        .once();
      eventManagerMock
        .expects('logEvent')
        .withExactArgs(
          {
            eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction: false,
            additionalParameters: null,
            configurationId: null,
            label: null,
          },
          undefined,
          undefined
        )
        .once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_POPUP
      );
      await tick(10);

      activityIframeViewMock.verify();
    });

    it(`with failed logging for inline CTA`, async () => {
      const winWithNoGtag = Object.assign({}, win);
      delete winWithNoGtag.gtag;
      deps.win.restore();
      sandbox.stub(deps, 'win').returns(winWithNoGtag);
      const successSurveyDataTransferResponse =
        new SurveyDataTransferResponse();
      successSurveyDataTransferResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(successSurveyDataTransferResponse)
        .once();
      eventManagerMock
        .expects('logEvent')
        .withExactArgs(
          {
            eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction: false,
            additionalParameters: new EventParams([
              ,
              ,
              ,
              ,
              ,
              ,
              ,
              ,
              ,
              ,
              ,
              CtaMode.CTA_MODE_INLINE,
            ]),
            configurationId: null,
          },
          undefined,
          undefined
        )
        .once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_INLINE
      );
      await tick(10);

      activityIframeViewMock.verify();
    });

    it(`with successful gtm logging`, async () => {
      const winWithDataLayer = Object.assign({}, win);
      delete winWithDataLayer.gtag;
      winWithDataLayer.dataLayer = {
        push: () => {},
      };
      deps.win.restore();
      sandbox.stub(deps, 'win').returns(winWithDataLayer);

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
              'content_id': TEST_QUESTION_CATEGORY_1,
              'content_group': TEST_QUESTION_TEXT_1,
              'content_type': TEST_ANSWER_TEXT_1,
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
              'event_category': TEST_QUESTION_CATEGORY_1,
              'event_label': TEST_ANSWER_TEXT_2,
              'survey_question': TEST_QUESTION_TEXT_1,
              'survey_question_category': TEST_QUESTION_CATEGORY_1,
              'survey_answer': TEST_ANSWER_TEXT_2,
              'survey_answer_category': TEST_ANSWER_CATEGORY_2,
              'content_id': TEST_QUESTION_CATEGORY_1,
              'content_group': TEST_QUESTION_TEXT_1,
              'content_type': TEST_ANSWER_TEXT_2,
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
              'content_id': TEST_QUESTION_CATEGORY_2,
              'content_group': TEST_QUESTION_TEXT_2,
              'content_type': TEST_ANSWER_TEXT_2,
            },
          }
        )
        .once();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
          configurationId: null,
          label: null,
        },
        undefined,
        undefined
      );

      const successSurveyDataTransferResponse =
        new SurveyDataTransferResponse();
      successSurveyDataTransferResponse.setSuccess(true);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(successSurveyDataTransferResponse)
        .once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_POPUP
      );
      await tick(10);

      activityIframeViewMock.verify();
    });

    it(`with successful onResult logging`, async () => {
      const successSurveyDataTransferResponse =
        new SurveyDataTransferResponse();
      successSurveyDataTransferResponse.setSuccess(true);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(successSurveyDataTransferResponse)
        .once();
      const onResultMock = sandbox
        .mock()
        .withExactArgs(TEST_SURVEYONRESULTRESPONSE)
        .resolves(true)
        .once();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
          configurationId: null,
          label: null,
        },
        undefined,
        undefined
      );

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        TEST_SURVEYONRESULTCONFIGID,
        CtaMode.CTA_MODE_UNSPECIFIED,
        onResultMock
      );
      await tick(10);

      activityIframeViewMock.verify();
      onResultMock.verify();
    });

    it(`with failed onResult logging`, async () => {
      const onResultMock = sandbox
        .mock()
        .withExactArgs(TEST_SURVEYONRESULTRESPONSE)
        .resolves(false)
        .once();

      eventManagerMock
        .expects('logEvent')
        .withExactArgs(
          {
            eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction: false,
            additionalParameters: null,
            configurationId: null,
            label: null,
          },
          undefined,
          undefined
        )
        .once();

      const failSurveyDataTransferResponse = new SurveyDataTransferResponse();
      failSurveyDataTransferResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(failSurveyDataTransferResponse)
        .once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        TEST_SURVEYONRESULTCONFIGID,
        CtaMode.CTA_MODE_UNSPECIFIED,
        onResultMock
      );

      await tick(10);

      activityIframeViewMock.verify();
      onResultMock.verify();
    });

    it(`with onResult logging exception`, async () => {
      const onResultMock = sandbox
        .mock()
        .withExactArgs(TEST_SURVEYONRESULTRESPONSE)
        .throws(new Error('Test Callback Exception'))
        .once();
      eventManagerMock
        .expects('logEvent')
        .withExactArgs(
          {
            eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction: false,
            additionalParameters: null,
            configurationId: null,
            label: null,
          },
          undefined,
          undefined
        )
        .once();

      const failSurveyDataTransferResponse = new SurveyDataTransferResponse();
      failSurveyDataTransferResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(failSurveyDataTransferResponse)
        .once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        TEST_SURVEYONRESULTCONFIGID,
        CtaMode.CTA_MODE_POPUP,
        onResultMock
      );

      await tick(10);

      expect(self.console.warn).to.have.been.calledWithExactly(
        '[swg.js] Exception in publisher provided logging callback: Error: Test Callback Exception'
      );
      activityIframeViewMock.verify();
      onResultMock.verify();
    });

    it(`with onResult logging rejection`, async () => {
      const onResultMock = sandbox
        .mock()
        .withExactArgs(TEST_SURVEYONRESULTRESPONSE)
        .rejects(new Error('Test Callback Exception'))
        .once();

      eventManagerMock
        .expects('logEvent')
        .withExactArgs(
          {
            eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
            eventOriginator: EventOriginator.SWG_CLIENT,
            isFromUserAction: false,
            additionalParameters: null,
            configurationId: null,
            label: null,
          },
          undefined,
          undefined
        )
        .once();

      const failSurveyDataTransferResponse = new SurveyDataTransferResponse();
      failSurveyDataTransferResponse.setSuccess(false);
      activityIframeViewMock
        .expects('execute')
        .withExactArgs(failSurveyDataTransferResponse)
        .once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        TEST_SURVEYONRESULTCONFIGID,
        CtaMode.CTA_MODE_POPUP,
        onResultMock
      );

      await tick(10);

      expect(self.console.warn).to.have.been.calledWithExactly(
        '[swg.js] Exception in publisher provided logging callback: Error: Test Callback Exception'
      );
      activityIframeViewMock.verify();
      onResultMock.verify();
    });

    it(`empty SurveyDataTransferRequest without onResult logging`, async () => {
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
              'content_id': '',
              'content_group': '',
              'content_type': '',
            },
          }
        )
        .once();
      eventManagerMock.expects('logEvent').withExactArgs(
        {
          eventType: AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction: true,
          additionalParameters: null,
          configurationId: null,
          label: null,
        },
        undefined,
        undefined
      );
      const successSurveyDataTransferResponse =
        new SurveyDataTransferResponse();
      successSurveyDataTransferResponse.setSuccess(true);

      handleSurveyDataTransferRequest(
        TEST_EMPTY_SURVEYDATATRANSFERREQUEST,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_POPUP
      );
      await tick(10);
    });

    it(`with successful PPS storage in empty localStorage`, async () => {
      const newIabTaxonomyMap = {
        [Constants.PPS_AUDIENCE_TAXONOMY_KEY]: {values: ['1', '2']},
      };
      storageMock
        .expects('set')
        .withExactArgs('ppstaxonomies', JSON.stringify(newIabTaxonomyMap), true)
        .once();
      activityIframeViewMock.expects('execute').once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST_WITHPPS,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_POPUP
      );
      await tick(10);

      storageMock.verify();
      activityIframeViewMock.verify();
    });

    it(`with successful PPS storage in populated localStorage`, async () => {
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
      activityIframeViewMock.expects('execute').once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST_WITHPPS,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_POPUP
      );
      await tick(10);

      storageMock.verify();
      activityIframeViewMock.verify();
    });

    it(`with successful PPS storage with no PPS ppstaxonomies but flag enabled`, async () => {
      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST_WITHPPS_NOVALUES,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_POPUP
      );

      await tick(10);

      activityIframeViewMock.verify();
    });

    it(`with improper existing PPS`, async () => {
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
      activityIframeViewMock.expects('execute').once();

      handleSurveyDataTransferRequest(
        TEST_SURVEYDATATRANSFERREQUEST_WITHPPS,
        deps,
        activityIframeView,
        'configId',
        CtaMode.CTA_MODE_POPUP
      );
      await tick(10);

      storageMock.verify();
      activityIframeViewMock.verify();
    });
  });
});
