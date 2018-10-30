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

import {ActivityIframePort} from 'web-activities/activity-ports';
import {AnalyticsEvent, AnalyticsRequest} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {feArgs, feUrl} from './services';
import {getStyle} from '../utils/style';
import {setExperimentsStringForTesting} from './experiments';


describes.realWin('AnalyticsService', {}, env => {
  let win;
  let src;
  let activityPorts;
  let activityIframePort;
  let analyticsService;
  let pageConfig;
  let messageCallback;
  let runtime;
  const productId = 'pub1:label1';

  beforeEach(() => {
    win = env.win;
    src = '/serviceiframe';
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activityPorts = runtime.activities();
    analyticsService = new AnalyticsService(runtime);
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

  afterEach(() => {
    setExperimentsStringForTesting('');
  });

  describe('AnalyticsService', () => {
    it('should have analyticsService constructed', () => {
      const activityIframe = analyticsService.getElement();
      const transactionId = analyticsService.getTransactionId();
      expect(analyticsService.getTransactionId()).to.equal(transactionId);
      expect(analyticsService.getTransactionId())
          .to.match(/^.{8}-.{4}-.{4}-.{4}-.{12}$/g);
      expect(activityIframe.nodeType).to.equal(1);
      expect(activityIframe.nodeName).to.equal('IFRAME');
      expect(getStyle(activityIframe, 'display')).to.equal('none');
      const txId = 'tx-id-101';
      analyticsService.setTransactionId(txId);
      expect(analyticsService.getTransactionId()).to.equal(txId);
    });

    it('should yield onMessage callback and call openIframe', () => {
      let messageReceived;
      analyticsService.onMessage(data => {
        messageReceived = data;
      });
      return analyticsService.lastAction_.then(() => {
        messageCallback({'something': 'irrelevant'});
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
        return activityIframePort.whenReady();
      }).then(() => {
        expect(messageReceived).to.deep.equal({'something': 'irrelevant'});
      });
    });

    it('should send message on port and openIframe called only once', () => {
      sandbox.stub(
          activityIframePort,
          'message'
      );
      analyticsService.logEvent(AnalyticsEvent.UNKNOWN);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
          new AnalyticsRequest(firstArgument['buf']);
        expect(request.getEvent()).to.deep.equal(AnalyticsEvent.UNKNOWN);
        analyticsService.logEvent(AnalyticsEvent.IMPRESSION_PAYWALL);
        return analyticsService.lastAction_;
      }).then(() => {
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
        const messageArgument = activityIframePort.message.getCall(1).args[0];
        expect(messageArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
          new AnalyticsRequest(messageArgument['buf']);
        expect(request.getEvent()).to.deep.equal(
            AnalyticsEvent.IMPRESSION_PAYWALL);
      });
    });

    it('should create correct context for logging', () => {
      sandbox.stub(
          activityIframePort,
          'message'
      );
      AnalyticsService.prototype.getQueryString_ = () => {
        return '?utm_source=scenic&utm_medium=email&utm_campaign=campaign';
      };
      AnalyticsService.prototype.getReferrer_ = () => {
        return 'https://scenic-2017.appspot.com/landing.html';
      };
      analyticsService.setReadyToPay(true);
      analyticsService.setSku('basic');
      analyticsService.logEvent(AnalyticsEvent.ACTION_SUBSCRIBE);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
            new AnalyticsRequest(firstArgument['buf']);
        expect(request.getEvent()).to.deep.equal(
            AnalyticsEvent.ACTION_SUBSCRIBE);
        expect(request.getContext()).to.not.be.null;
        expect(request.getContext().getReferringOrigin()).to.equal(
            'https://scenic-2017.appspot.com');
        expect(request.getContext().getUtmMedium()).to.equal('email');
        expect(request.getContext().getUtmSource()).to.equal('scenic');
        expect(request.getContext().getUtmName()).to.equal('campaign');
        expect(request.getContext().getTransactionId())
            .to.match(/^.{8}-.{4}-.{4}-.{4}-.{12}$/g);
        expect(request.getContext().getSku()).to.equal('basic');
        expect(request.getContext().getReadyToPay()).to.be.true;
      });
    });

    it('should set context for empty experiments', () => {
      setExperimentsStringForTesting('');
      sandbox.stub(
          activityIframePort,
          'message'
      );
      analyticsService.logEvent(AnalyticsEvent.ACTION_SUBSCRIBE);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
            new AnalyticsRequest(firstArgument['buf']);
        expect(request.getContext().getLabel()).to.deep.equal([]);
      });
    });

    it('should set context for non-empty experiments', () => {
      setExperimentsStringForTesting('experiment-A,experiment-B');
      sandbox.stub(
          activityIframePort,
          'message'
      );
      analyticsService.logEvent(AnalyticsEvent.ACTION_SUBSCRIBE);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
            new AnalyticsRequest(firstArgument['buf']);
        expect(request.getContext().getLabel())
            .to.deep.equal(['experiment-A', 'experiment-B']);
      });
    });

    it('should add additional labels to experiments', () => {
      analyticsService.addLabels(['L1', 'L2']);
      setExperimentsStringForTesting('E1,E2');
      sandbox.stub(
          activityIframePort,
          'message'
      );
      analyticsService.logEvent(AnalyticsEvent.ACTION_SUBSCRIBE);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        const request = new AnalyticsRequest(firstArgument['buf']);
        expect(request.getContext().getLabel())
            .to.deep.equal(['L1', 'L2', 'E1', 'E2']);

        analyticsService.addLabels(['L3', 'L4']);
        analyticsService.logEvent(AnalyticsEvent.ACTION_SUBSCRIBE);
        return analyticsService.lastAction_;
      }).then(() => {
        const firstArgument = activityIframePort.message.getCall(1).args[0];
        const request = new AnalyticsRequest(firstArgument['buf']);
        expect(request.getContext().getLabel())
            .to.deep.equal(['L1', 'L2', 'E1', 'E2', 'L3', 'L4']);
      });
    });

    it('should dedupe duplicate labels', () => {
      analyticsService.addLabels(['L1', 'L2', 'L1', 'L2']);
      expect(analyticsService.context_.getLabel())
          .to.deep.equal(['L1', 'L2']);
      analyticsService.addLabels(['L1', 'L2', 'L3']);
      expect(analyticsService.context_.getLabel())
          .to.deep.equal(['L1', 'L2', 'L3']);
    });
  });
});
