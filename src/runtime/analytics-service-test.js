/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

import {AnalyticsService} from './analytics-service';
import {GlobalDoc} from '../model/doc';
import {feArgs, feUrl} from './services';
import {PageConfig} from '../model/page-config';
import {getStyle} from '../utils/style';

import {
  ActivityPorts,
  ActivityIframePort,
} from 'web-activities/activity-ports';

describes.realWin('AnalyticsService', {}, env => {
  let win;
  let src;
  let doc;
  let activityPorts;
  let activityIframePort;
  let analyticsService;
  let pageConfig;
  let messageCallback;
  const productId = 'pub1:label1';

  beforeEach(() => {
    win = env.win;
    doc = new GlobalDoc(win);
    activityPorts = new ActivityPorts(win);
    src = '/serviceiframe';
    pageConfig = new PageConfig(productId);
    analyticsService =
        new AnalyticsService(doc, activityPorts, pageConfig);
    activityIframePort = new ActivityIframePort(
        analyticsService.getElement(),
        feUrl(src), activityPorts);

    sandbox.stub(
        activityPorts,
        'openIframe',
        () => Promise.resolve(activityIframePort));

    sandbox.stub(
        activityIframePort,
        'whenReady',
        () => Promise.resolve(true));

    sandbox.stub(
        activityIframePort,
        'onMessage',
        cb => {
          messageCallback = cb;
        });
  });

  describe('AnalyticsService', () => {
    it('should have analyticsService constructed', () => {
      const activityIframe = analyticsService.getElement();
      expect(activityIframe.nodeType).to.equal(1);
      expect(activityIframe.nodeName).to.equal('IFRAME');
      expect(getStyle(activityIframe, 'display')).to.equal('none');
    });

    it('should start analytics service', () => {
      const startPromise = analyticsService.start();
      return startPromise.then(() => {
        expect(activityPorts.openIframe).to.have.been.calledOnce;
        const firstArgument = activityPorts.openIframe.getCall(0).args[0];
        expect(activityPorts.openIframe).to.have.been.calledOnce;
        expect(firstArgument.nodeName).to.equal('IFRAME');
        const secondArgument = activityPorts.openIframe.getCall(0).args[1];
        expect(secondArgument).to.equal(feUrl(src));
        const thirdArgument = activityPorts.openIframe.getCall(0).args[2];
        expect(thirdArgument).to.deep.equal(feArgs({
          publicationId: pageConfig.getPublicationId(),
        }));
      });
    });

    it('should yield onMessage callback', () => {
      const startPromise = analyticsService.start();
      let messageReceived;
      analyticsService.onMessage(data => {
        messageReceived = data;
      });
      return startPromise.then(() => {
        messageCallback({'something': 'irrelevant'});
        return activityIframePort.whenReady();
      }).then(() => {
        expect(messageReceived).to.deep.equal({'something': 'irrelevant'});
      });
    });

    it('should pass on message to port when ready', () => {
      sandbox.stub(
          activityIframePort,
          'message'
      );
      const startPromise = analyticsService.start();
      return startPromise.then(() => {
        analyticsService.logEvent({'something': 'important'});
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument).to.deep.equal({'something': 'important'});
      });
    });
  });
});
