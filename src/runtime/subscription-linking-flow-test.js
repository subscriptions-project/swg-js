/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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
import {ConfiguredRuntime} from './runtime';
import {MockActivityPort} from '../../test/mock-activity-port';
import {PageConfig} from '../model/page-config';
import {
  SubscriptionLinkingCompleteResponse,
  SubscriptionLinkingLinkResult,
} from '../proto/api_messages';
import {SubscriptionLinkingFlow} from './subscription-linking-flow';

describes.realWin('SubscriptionLinkingFlow', (env) => {
  let win;
  let pageConfig;
  let runtime;
  let dialogManagerMock;
  let messageMap;
  let subscriptionLinkingFlow;
  let cancelCallback;

  const PUBLICATION_ID = 'pub1';
  let REQUEST;
  let MULTI_REQUEST;
  let activitiesMock;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig(`${PUBLICATION_ID}:prod1`);
    runtime = new ConfiguredRuntime(win, pageConfig);
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    activitiesMock = sandbox.mock(runtime.activities());
    messageMap = {};
    sandbox.stub(ActivityIframeView.prototype, 'on').callsFake((ctor, cb) => {
      const messageType = new ctor();
      const label = messageType.label();
      messageMap[label] = cb;
    });
    sandbox.stub(ActivityIframeView.prototype, 'onCancel').callsFake((cb) => {
      cancelCallback = cb;
    });
    subscriptionLinkingFlow = new SubscriptionLinkingFlow(runtime);
    REQUEST = {publisherProvidedId: 'ppid'};
    MULTI_REQUEST = {
      linkTo: [
        {publicationId: PUBLICATION_ID, publisherProvidedId: 'ppid'},
        {publicationId: PUBLICATION_ID + '2', publisherProvidedId: 'ppid2'},
      ],
    };
  });

  describe('start', () => {
    it('Setup the dialog and iframe properly', async () => {
      let activityIframeView;
      let hidden;
      let dialogConfig;
      dialogManagerMock
        .expects('openView')
        .once()
        .callsFake(async (viewArg, hiddenArg, dialogConfigArg) => {
          activityIframeView = viewArg;
          hidden = hiddenArg;
          dialogConfig = dialogConfigArg;
        });

      subscriptionLinkingFlow.start(REQUEST);

      expect(activityIframeView.shouldFadeBody()).to.be.false;
      expect(hidden).to.be.false;
      expect(dialogConfig).to.deep.equal({
        desktopConfig: {isCenterPositioned: false},
      });
      dialogManagerMock.verify();
    });

    it('opens /linksaveiframe in an ActivityIframeView', async () => {
      const port = new MockActivityPort();
      port.onResizeRequest = () => {};
      port.whenReady = () => Promise.resolve();
      activitiesMock
        .expects('openIframe')
        .withExactArgs(
          sandbox.match((arg) => arg.tagName == 'IFRAME'),
          `https://news.google.com/swg/ui/v1/linksaveiframe?_=_&subscriptionLinking=true&linkTo=${PUBLICATION_ID}%2C${REQUEST.publisherProvidedId}`,
          {publicationId: PUBLICATION_ID, _client: 'SwG 0.0.0'}
        )
        .resolves(port);

      subscriptionLinkingFlow.start(REQUEST);
      await subscriptionLinkingFlow.getRenderPromise();

      activitiesMock.verify();
    });

    it('throws an error if publisherProvidedId is missing', async () => {
      const request = {...REQUEST, publisherProvidedId: undefined};
      await expect(
        subscriptionLinkingFlow.start(request)
      ).to.eventually.be.rejectedWith('publisherProvidedId');
    });
  });

  describe('startMultipleLinks', () => {
    it('opens /linksaveiframe in an ActivityIframeView', async () => {
      const port = new MockActivityPort();
      port.onResizeRequest = () => {};
      port.whenReady = () => Promise.resolve();
      activitiesMock
        .expects('openIframe')
        .withExactArgs(
          sandbox.match((arg) => arg.tagName == 'IFRAME'),
          `https://news.google.com/swg/ui/v1/linksaveiframe?_=_&subscriptionLinking=true&linkTo=${PUBLICATION_ID}%2C${REQUEST.publisherProvidedId}&linkTo=${PUBLICATION_ID}2%2Cppid2`,
          {publicationId: PUBLICATION_ID, _client: 'SwG 0.0.0'}
        )
        .resolves(port);

      subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST);
      await subscriptionLinkingFlow.getRenderPromise();

      activitiesMock.verify();
    });

    it('throws an error if linkTo is missing', async () => {
      await expect(
        subscriptionLinkingFlow.startMultipleLinks({})
      ).to.eventually.be.rejectedWith('linkTo');
    });
  });

  describe('singular on SubscriptionLinkingCompleteResponse', () => {
    it('resolves promise with response data', async () => {
      dialogManagerMock.expects('openView').once().resolves();
      const linkResult = new SubscriptionLinkingLinkResult();
      linkResult.setSuccess(true);
      linkResult.setSwgPublicationId(PUBLICATION_ID);
      linkResult.setPublisherProvidedId('ppid');
      const response = new SubscriptionLinkingCompleteResponse();
      response.setLinkResultsList([linkResult]);
      response.setSuccess(true);
      response.setPublisherProvidedId('ppid');

      const resultPromise = subscriptionLinkingFlow.start(REQUEST);
      const handler = messageMap[response.label()];
      handler(response);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        publisherProvidedId: 'ppid',
        success: true,
      });
    });

    it('resolves with success=false if missing from response', async () => {
      dialogManagerMock.expects('openView').once().resolves();
      const linkResult = new SubscriptionLinkingLinkResult();
      linkResult.setSwgPublicationId(PUBLICATION_ID);
      linkResult.setPublisherProvidedId('ppid');
      linkResult.setSuccess(false);
      const response = new SubscriptionLinkingCompleteResponse();
      response.setPublisherProvidedId('ppid');
      response.setLinkResultsList([linkResult]);
      response.setSuccess(false);

      const resultPromise = subscriptionLinkingFlow.start(REQUEST);
      const handler = messageMap[response.label()];
      handler(response);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        publisherProvidedId: 'ppid',
        success: false,
      });
    });

    it('throws an error when rejected', async () => {
      dialogManagerMock
        .expects('openView')
        .once()
        .rejects(new Error('Dialog error'));

      await expect(
        subscriptionLinkingFlow.start(REQUEST)
      ).to.eventually.be.rejectedWith('Dialog error');
    });
  });

  describe('multiple on SubscriptionLinkingCompleteResponse', () => {
    let expectedResults = [
      new SubscriptionLinkingLinkResult(),
      new SubscriptionLinkingLinkResult(),
    ];
    let expectedResponse = new SubscriptionLinkingCompleteResponse();
    beforeEach(() => {
      expectedResults = [
        new SubscriptionLinkingLinkResult(),
        new SubscriptionLinkingLinkResult(),
      ];
      expectedResults[0].setSuccess(true);
      expectedResults[0].setSwgPublicationId(PUBLICATION_ID);
      expectedResults[0].setPublisherProvidedId('ppid');
      expectedResults[1].setSuccess(true);
      expectedResults[1].setSwgPublicationId(PUBLICATION_ID + '2');
      expectedResults[1].setPublisherProvidedId('ppid2');

      expectedResponse = new SubscriptionLinkingCompleteResponse();
      expectedResponse.setLinkResultsList(expectedResults);
      expectedResponse.setSuccess(true);
      expectedResponse.setPublisherProvidedId('ppid');
    });

    it('resolves promise with response data', async () => {
      dialogManagerMock.expects('openView').once().resolves();

      const resultPromise =
        subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST);
      const handler = messageMap[expectedResponse.label()];
      handler(expectedResponse);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        anyFailure: false,
        anySuccess: true,
        links: [
          {
            publicationId: PUBLICATION_ID,
            publisherProvidedId: 'ppid',
            success: true,
          },
          {
            publicationId: PUBLICATION_ID + '2',
            publisherProvidedId: 'ppid2',
            success: true,
          },
        ],
      });
    });

    it('resolves with success=false on failure', async () => {
      dialogManagerMock.expects('openView').once().resolves();

      expectedResults[0].setSuccess(false);
      // This ensures it defaults null to false.
      expectedResults[1].setSuccess(null);
      expectedResponse.setLinkResultsList(expectedResults);
      expectedResponse.setSuccess(false);

      const resultPromise =
        subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST);
      const handler = messageMap[expectedResponse.label()];
      handler(expectedResponse);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        anyFailure: true,
        anySuccess: false,
        links: [
          {
            publicationId: PUBLICATION_ID,
            publisherProvidedId: 'ppid',
            success: false,
          },
          {
            publicationId: PUBLICATION_ID + '2',
            publisherProvidedId: 'ppid2',
            success: false,
          },
        ],
      });
    });

    it('handles no link results', async () => {
      dialogManagerMock.expects('openView').once().resolves();
      expectedResponse.setLinkResultsList(null);
      expectedResponse.setSuccess(false);

      const resultPromise =
        subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST);
      const handler = messageMap[expectedResponse.label()];
      handler(expectedResponse);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        anyFailure: true,
        anySuccess: false,
        links: [],
      });
    });

    it('throws an error when rejected', async () => {
      dialogManagerMock
        .expects('openView')
        .once()
        .rejects(new Error('Dialog error'));

      await expect(
        subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST)
      ).to.eventually.be.rejectedWith('Dialog error');
    });
  });

  it('resolves promise with success=false when cancelled', async () => {
    dialogManagerMock.expects('openView').once().resolves();

    const resultPromise =
      subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST);

    cancelCallback();

    const result = await resultPromise;
    expect(result).to.deep.equal({
      anySuccess: false,
      anyFailure: true,
      links: [
        {
          publicationId: PUBLICATION_ID,
          publisherProvidedId: 'ppid',
          success: false,
        },
        {
          publicationId: PUBLICATION_ID + '2',
          publisherProvidedId: 'ppid2',
          success: false,
        },
      ],
    });
  });
});
