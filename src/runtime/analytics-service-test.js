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
import {feArgs, feUrl} from './services';
import {PageConfig} from '../model/page-config';
import {getStyle} from '../utils/style';
import {AnalyticsEvent, AnalyticsRequest} from '../proto/api_messages';
import {ConfiguredRuntime} from './runtime';
import {TransactionId} from './transaction-id';

import {
  ActivityIframePort,
} from 'web-activities/activity-ports';

describes.realWin('AnalyticsService', {}, env => {
  let win;
  let src;
  let activityPorts;
  let activityIframePort;
  let analyticsService;
  let pageConfig;
  let messageCallback;
  let xid;
  let runtime;
  const productId = 'pub1:label1';

  beforeEach(() => {
    win = env.win;
    src = '/serviceiframe';
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activityPorts = runtime.activities();
    xid = new TransactionId(runtime);
    analyticsService = new AnalyticsService(runtime, xid);
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
    sandbox.stub(
        xid,
        'get',
        () => Promise.resolve('google-transaction-0')
    );
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
        analyticsService.logEvent(AnalyticsEvent.UNKNOWN);
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
          new AnalyticsRequest(firstArgument['buf']);
        expect(request.getEvent()).to.deep.equal(AnalyticsEvent.UNKNOWN);
      });
    });

    it('should create correct context for logging', () => {
      sandbox.stub(
          activityIframePort,
          'message'
      );
      AnalyticsService.prototype.getQueryString_ = () => {
        return '?utm_source=scenic&utm_medium=email&utm_name=campaign';
      };
      AnalyticsService.prototype.getReferrer_ = () => {
        return 'https://scenic-2017.appspot.com/landing.html';
      };
      const startPromise = analyticsService.start();
      return startPromise.then(() => {
        analyticsService.logEvent(AnalyticsEvent.UNKNOWN);
        analyticsService.setSku('basic');
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
            new AnalyticsRequest(firstArgument['buf']);
        expect(request.getEvent()).to.deep.equal(AnalyticsEvent.UNKNOWN);
        expect(request.getContext()).to.not.be.null;
        expect(request.getContext().getReferringOrigin()).to.equal(
            'https://scenic-2017.appspot.com/landing.html');
        expect(request.getContext().getUtmMedium()).to.equal('email');
        expect(request.getContext().getUtmSource()).to.equal('scenic');
        expect(request.getContext().getUtmName()).to.equal('campaign');
        expect(request.getContext().getTransactionId()).to.equal(
            'google-transaction-0');
        expect(request.getContext().getSku()).to.equal('basic');
      });
    });
  });
});
