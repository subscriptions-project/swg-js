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
  const REQUEST = {publisherProvidedId: 'ppid'};
  const MULTI_REQUEST = {
    linkTo: [
      {publicationId: PUBLICATION_ID, publisherProvidedId: 'ppid'},
      {publicationId: PUBLICATION_ID + '2', publisherProvidedId: 'ppid2'},
    ],
  };

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig(`${PUBLICATION_ID}:prod1`);
    runtime = new ConfiguredRuntime(win, pageConfig);
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
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
  });

  describe('start', () => {
    it('opens /linksaveiframe in an ActivityIframeView', async () => {
      let activityIframeView;
      let hidden;
      let dialogConfig;
      dialogManagerMock
        .expects('openView')
        .once()
        .callsFake((viewArg, hiddenArg, dialogConfigArg) => {
          activityIframeView = viewArg;
          hidden = hiddenArg;
          dialogConfig = dialogConfigArg;
          return Promise.resolve();
        });

      subscriptionLinkingFlow.start(REQUEST);

      const url = new URL(activityIframeView.src_);
      const {pathname, searchParams} = url;
      expect(pathname).to.equal('/swg/ui/v1/linksaveiframe');
      expect(searchParams.get('subscriptionLinking')).to.equal('true');
      expect(searchParams.get('linkTo')).to.equal(
        `${PUBLICATION_ID},${REQUEST.publisherProvidedId}`
      );
      const args = activityIframeView.args_;
      expect(args['publicationId']).to.equal(PUBLICATION_ID);
      expect(activityIframeView.shouldFadeBody_).to.be.false;
      expect(hidden).to.be.false;
      expect(dialogConfig).to.deep.equal({
        desktopConfig: {isCenterPositioned: false},
      });
      dialogManagerMock.verify();
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
      let activityIframeView;
      let hidden;
      let dialogConfig;
      dialogManagerMock
        .expects('openView')
        .once()
        .callsFake((viewArg, hiddenArg, dialogConfigArg) => {
          activityIframeView = viewArg;
          hidden = hiddenArg;
          dialogConfig = dialogConfigArg;
          return Promise.resolve();
        });

      subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST);

      const url = new URL(activityIframeView.src_);
      const {pathname, searchParams} = url;
      expect(pathname).to.equal('/swg/ui/v1/linksaveiframe');
      expect(searchParams.get('subscriptionLinking')).to.equal('true');
      const links = activityIframeView.src_.split('linkTo=');
      expect(links.length).to.equal(3);
      expect(links[1]).to.equal(
        encodeURIComponent(`${PUBLICATION_ID},${REQUEST.publisherProvidedId}`) +
          '&'
      );
      expect(links[2]).to.equal(encodeURIComponent(`${PUBLICATION_ID}2,ppid2`));
      const args = activityIframeView.args_;
      expect(args['publicationId']).to.equal(PUBLICATION_ID);
      expect(activityIframeView.shouldFadeBody_).to.be.false;
      expect(hidden).to.be.false;
      expect(dialogConfig).to.deep.equal({
        desktopConfig: {isCenterPositioned: false},
      });
      dialogManagerMock.verify();
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
      linkResult.setPublisherProvidedId('abc');
      const response = new SubscriptionLinkingCompleteResponse();
      response.setLinkResultsList([linkResult]);
      response.setSuccess(true);
      response.setPublisherProvidedId('abc');

      const resultPromise = subscriptionLinkingFlow.start(REQUEST);
      const handler = messageMap[response.label()];
      handler(response);

      const result = await resultPromise;
      expect(result).to.deep.equal({publisherProvidedId: 'abc', success: true});
    });

    it('resolves with success=false if missing from response', async () => {
      dialogManagerMock.expects('openView').once().resolves();
      const linkResult = new SubscriptionLinkingLinkResult();
      linkResult.setSwgPublicationId(PUBLICATION_ID);
      linkResult.setPublisherProvidedId('abc');
      linkResult.setSuccess(false);
      const response = new SubscriptionLinkingCompleteResponse();
      response.setPublisherProvidedId('abc');
      response.setLinkResultsList([linkResult]);
      response.setSuccess(false);

      const resultPromise = subscriptionLinkingFlow.start(REQUEST);
      const handler = messageMap[response.label()];
      handler(response);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        publisherProvidedId: 'abc',
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
    it('resolves promise with response data', async () => {
      dialogManagerMock.expects('openView').once().resolves();
      const results = [
        new SubscriptionLinkingLinkResult(),
        new SubscriptionLinkingLinkResult(),
      ];
      results[0].setSuccess(true);
      results[0].setSwgPublicationId(PUBLICATION_ID + '2');
      results[0].setPublisherProvidedId('def');
      results[1].setSuccess(true);
      results[1].setSwgPublicationId(PUBLICATION_ID);
      results[1].setPublisherProvidedId('abc');
      const response = new SubscriptionLinkingCompleteResponse();
      response.setLinkResultsList(results);
      response.setSuccess(true);
      response.setPublisherProvidedId('abc');

      const resultPromise =
        subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST);
      const handler = messageMap[response.label()];
      handler(response);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        anyFailure: false,
        anySuccess: true,
        links: [
          {
            publicationId: PUBLICATION_ID + '2',
            publisherProvidedId: 'def',
            success: true,
          },
          {
            publicationId: PUBLICATION_ID,
            publisherProvidedId: 'abc',
            success: true,
          },
        ],
      });
    });

    it('resolves with success=false if missing from response', async () => {
      dialogManagerMock.expects('openView').once().resolves();
      const results = [
        new SubscriptionLinkingLinkResult(),
        new SubscriptionLinkingLinkResult(),
      ];
      results[0].setSuccess(false);
      results[0].setSwgPublicationId(PUBLICATION_ID + '2');
      results[0].setPublisherProvidedId('def');
      results[1].setSuccess(false);
      results[1].setSwgPublicationId(PUBLICATION_ID);
      results[1].setPublisherProvidedId('abc');
      const response = new SubscriptionLinkingCompleteResponse();
      response.setPublisherProvidedId('abc');
      response.setLinkResultsList(results);
      response.setSuccess(false);

      const resultPromise =
        subscriptionLinkingFlow.startMultipleLinks(MULTI_REQUEST);
      const handler = messageMap[response.label()];
      handler(response);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        anyFailure: true,
        anySuccess: false,
        links: [
          {
            publicationId: PUBLICATION_ID + '2',
            publisherProvidedId: 'def',
            success: false,
          },
          {
            publicationId: PUBLICATION_ID,
            publisherProvidedId: 'abc',
            success: false,
          },
        ],
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

  it('resolves promise with success=false when cancelled', async () => {
    dialogManagerMock.expects('openView').once().resolves();

    const resultPromise = subscriptionLinkingFlow.start(REQUEST);

    cancelCallback();

    const result = await resultPromise;
    expect(result).to.deep.equal({publisherProvidedId: 'ppid', success: false});
  });
});
