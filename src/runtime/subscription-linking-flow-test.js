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
import {SubscriptionLinkingCompleteResponse} from '../proto/api_messages';
import {SubscriptionLinkingFlow} from './subscription-linking-flow';

describes.realWin('SubscriptionLinkingFlow', {}, (env) => {
  let win;
  let pageConfig;
  let runtime;
  let dialogManagerMock;
  let messageMap;
  let subscriptionLinkingFlow;

  const PUBLICATION_ID = 'pub1';
  const REQUEST = {publisherProvidedId: 'ppid'};

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
      expect(pathname).to.equal('/swg/_/ui/v1/linksaveiframe');
      expect(searchParams.get('subscriptionLinking')).to.equal('true');
      expect(searchParams.get('ppid')).to.equal(REQUEST.publisherProvidedId);
      const args = activityIframeView.args_;
      expect(args['publicationId']).to.equal(PUBLICATION_ID);
      expect(activityIframeView.shouldFadeBody_).to.be.true;
      expect(hidden).to.be.false;
      expect(dialogConfig).to.deep.equal({
        desktopConfig: {isCenterPositioned: true},
      });
      dialogManagerMock.verify();
    });
  });

  it('throws an error if publisherProvidedId is missing', async () => {
    const request = {...REQUEST, publisherProvidedId: undefined};
    await expect(
      subscriptionLinkingFlow.start(request)
    ).to.eventually.be.rejectedWith(Error, 'publisherProvidedId');
  });

  describe('on SubscriptionLinkingCompleteResponse', () => {
    it('resolves promise with response data', async () => {
      dialogManagerMock.expects('openView').once().returns(Promise.resolve());
      const response = new SubscriptionLinkingCompleteResponse();
      response.setPublisherProvidedId('abc');
      response.setSuccess(true);

      const resultPromise = subscriptionLinkingFlow.start(REQUEST);
      const handler = messageMap[response.label()];
      handler(response);

      const result = await resultPromise;
      expect(result).to.deep.equal({publisherProvidedId: 'abc', success: true});
    });

    it('resolves with success=false if missing from response', async () => {
      dialogManagerMock.expects('openView').once().returns(Promise.resolve());
      const response = new SubscriptionLinkingCompleteResponse();
      response.setPublisherProvidedId('abc');

      const resultPromise = subscriptionLinkingFlow.start(REQUEST);
      const handler = messageMap[response.label()];
      handler(response);

      const result = await resultPromise;
      expect(result).to.deep.equal({
        publisherProvidedId: 'abc',
        success: false,
      });
    });
  });
});
