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
import {
  ActivityPorts,
  ActivityIframePort,
  ActivityResult,
} from 'web-activities/activity-ports';

describes.realWin('AnalyticsService', {}, env => {
  let win;
  let src;
  let doc;
  let activityPorts;
  let activityIframePort;
  let analyticsService;
  const activityArgs = {
    'publicationId': 'pub1',
  };
  beforeEach(() => {
    win = env.win;
    doc = new GlobalDoc(win);
    activityPorts = new ActivityPorts(win);
    src = '/serviceiframe';
    analyticsService =
        new AnalyticsService(doc, activityPorts, activityArgs);
    activityIframePort = new ActivityIframePort(
        analyticsService.getIframe().getElement(),
        feUrl(src), activityPorts);

    sandbox.stub(
        activityIframePort,
        'whenReady',
        () => Promise.resolve(true));

    sandbox.stub(
        activityPorts,
        'openIframe',
        () => Promise.resolve(activityIframePort));

  });

  describe('AnalyticsService', () => {
    it('should have analyticsService constructed', () => {
      const activityIframe = analyticsService.getElement();
      expect(activityIframe.nodeType).to.equal(1);
      expect(activityIframe.nodeName).to.equal('IFRAME');
      expect(activityIframe.getAttribute('visibility')).to.equal('hidden');
    });

    it('should start analytics service', function* () {
      const startPromise = analyticsService.start();
      yield analyticsService.getIframe().whenReady();
      return startPromise.then(() => {
        expect(activityPorts.openIframe).to.have.been.calledOnce;
        const firstArgument = activityPorts.openIframe.getCall(0).args[0];
        expect(activityPorts.openIframe).to.have.been.calledOnce;
        expect(firstArgument.nodeName).to.equal('IFRAME');
        const secondArgument = activityPorts.openIframe.getCall(0).args[1];
        expect(secondArgument).to.equal(feUrl(src));
        const thirdArgument = activityPorts.openIframe.getCall(0).args[2];
        expect(thirdArgument).to.deep.equal(feArgs(activityArgs));
      });
    });

    it('should accept port and result', function* () {
      const result = new ActivityResult('OK');
      sandbox.stub(
          activityIframePort,
          'acceptResult',
          () => Promise.resolve(result));

      const startPromise = analyticsService.start();
      yield analyticsService.getIframe().whenReady();
      return startPromise.then(() => {
        expect(activityIframePort.whenReady).to.have.been.calledOnce;
        return analyticsService.port().then(actualPort => {
          expect(actualPort).to.equal(activityIframePort);
          return analyticsService.acceptResult().then(actualResult => {
            expect(actualResult).to.equal(result);
          });
        });
      });
    });

    it('should yield cancel callback', function* () {
      sandbox.stub(
          activityIframePort,
          'acceptResult',
          () => Promise.reject(new DOMException('cancel', 'AbortError')));
      const startPromise = analyticsService.start();
      yield analyticsService.getIframe().whenReady();
      return startPromise.then(() => {
        return new Promise(resolve => {
          analyticsService.onCancel(resolve);
        });
      });
    });

    it('should yield onMessage callback', function* () {
      let messageCallback = undefined;
      sandbox.stub(activityIframePort, 'onMessage', cb => {
        messageCallback = cb;
      });
      const startPromise = analyticsService.start();
      let messageReceived;
      analyticsService.onMessage(data => {
        messageReceived = data;
      });
      yield analyticsService.getIframe().whenReady();
      return startPromise.then(() => {
        messageCallback({'sku': 'basic'});
        expect(messageReceived).to.deep.equal({'sku': 'basic'});
      });
    });

    it('should pass on message to port', function* () {
      sandbox.stub(
          activityIframePort,
          'message'
      );
      const startPromise = analyticsService.start();
      yield analyticsService.getIframe().whenReady();
      analyticsService.message({'something': 'important'});
      return startPromise.then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument).to.deep.equal({'something': 'important'});
      });
    });
  });
});
