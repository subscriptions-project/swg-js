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
import {SwgClientEventManager} from './swg-client-event-manager';
import {EventOriginator} from '../proto/api_messages';
import {ExperimentFlags} from './experiment-flags';


describes.realWin('AnalyticsService', {}, env => {
  let win;
  let src;
  let activityPorts;
  let activityIframePort;
  let analyticsService;
  let pageConfig;
  let messageCallback;
  let runtime;
  let eventManagerMock;

  const productId = 'pub1:label1';
  const defaultEvent = {
    eventType: AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
    eventOriginator: EventOriginator.SWG_CLIENT,
    isFromUserAction: null,
  };

  beforeEach(() => {
    win = env.win;
    src = '/serviceiframe';
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activityPorts = runtime.activities();


    eventManagerMock = sandbox.mock(new SwgClientEventManager());
    sandbox.stub(
        runtime,
        'getEventManager',
        () => Promise.resolve(eventManagerMock));

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

    it('should send events to event manager', () => {
      eventManagerMock.expects('logEvent').withExactArgs(defaultEvent);
      analyticsService
          .logEvent(defaultEvent.eventType,defaultEvent.isFromUserAction)
          .then(() => eventManagerMock.verify());
    });

    it('should send message on port and openIframe called only once', () => {
      sandbox.stub(
          activityIframePort,
          'message'
      );
      analyticsService.listener_(defaultEvent);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
          new AnalyticsRequest(firstArgument['buf']);
        expect(request.getEvent()).to.equal(defaultEvent.eventType);
        expect(request.getMeta().getEventOriginator()).to
            .equal(EventOriginator.SWG_CLIENT);
        expect(request.getMeta().getIsFromUserAction()).to
            .equal(defaultEvent.isFromUserAction);
        analyticsService.listener_(defaultEvent);
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
        expect(request.getEvent()).to.equal(defaultEvent.eventType);
        expect(request.getMeta().getEventOriginator()).to
            .equal(EventOriginator.SWG_CLIENT);
        expect(request.getMeta().getIsFromUserAction()).to
            .equal(defaultEvent.isFromUserAction);
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
      analyticsService.listener_(defaultEvent);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
            new AnalyticsRequest(firstArgument['buf']);
        expect(request.getEvent()).to.equal(defaultEvent.eventType);
        expect(request.getMeta().getEventOriginator()).to
            .equal(EventOriginator.SWG_CLIENT);
        expect(request.getMeta().getIsFromUserAction()).to
            .equal(defaultEvent.isFromUserAction);
        expect(request.getContext()).to.not.be.null;
        expect(request.getContext().getReferringOrigin()).to.equal(
            'https://scenic-2017.appspot.com');
        expect(request.getContext().getUtmMedium()).to.equal('email');
        expect(request.getContext().getUtmSource()).to.equal('scenic');
        expect(request.getContext().getUtmCampaign()).to.equal('campaign');
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
      analyticsService.listener_(defaultEvent);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
            new AnalyticsRequest(firstArgument['buf']);
        expect(request.getContext().getLabelList()).to.deep.equal([]);
      });
    });

    it('should set context for non-empty experiments', () => {
      setExperimentsStringForTesting('experiment-A,experiment-B');
      sandbox.stub(
          activityIframePort,
          'message'
      );
      analyticsService.listener_(defaultEvent);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        expect(activityIframePort.message).to.be.calledOnce;
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        expect(firstArgument['buf']).to.not.be.null;
        const /* {?AnalyticsRequest} */ request =
            new AnalyticsRequest(firstArgument['buf']);
        expect(request.getContext().getLabelList())
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
      analyticsService.listener_(defaultEvent);
      return analyticsService.lastAction_.then(() => {
        return activityIframePort.whenReady();
      }).then(() => {
        const firstArgument = activityIframePort.message.getCall(0).args[0];
        const request = new AnalyticsRequest(firstArgument['buf']);
        expect(request.getContext().getLabelList())
            .to.deep.equal(['L1', 'L2', 'E1', 'E2']);

        analyticsService.addLabels(['L3', 'L4']);
        analyticsService.listener_(defaultEvent);
        return analyticsService.lastAction_;
      }).then(() => {
        const firstArgument = activityIframePort.message.getCall(1).args[0];
        const request = new AnalyticsRequest(firstArgument['buf']);
        expect(request.getContext().getLabelList())
            .to.deep.equal(['L1', 'L2', 'E1', 'E2', 'L3', 'L4']);
      });
    });

    it('should dedupe duplicate labels', () => {
      analyticsService.addLabels(['L1', 'L2', 'L1', 'L2']);
      expect(analyticsService.context_.getLabelList())
          .to.deep.equal(['L1', 'L2']);
      analyticsService.addLabels(['L1', 'L2', 'L3']);
      expect(analyticsService.context_.getLabelList())
          .to.deep.equal(['L1', 'L2', 'L3']);
    });

    it('should ignore events it is configured to ignore', () => {
      analyticsService.lastAction_ = null;
      analyticsService.listener_({
        eventType: AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
        eventOriginator: EventOriginator.PROPENSITY_CLIENT,
        isFromUserAction: null,
      });
      expect(analyticsService.lastAction_).to.be.null;

      analyticsService.listener_({
        eventType: AnalyticsEvent.UNKNOWN,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: null,
      });
      expect(analyticsService.lastAction_).to.be.null;
    });

    it('should log propensity events if configured to do so', () => {
      sandbox.stub(
          activityIframePort,
          'message'
      );
      setExperimentsStringForTesting(
          ExperimentFlags.LOG_PROPENSITY_TO_ANALYTICS);
      analyticsService = new AnalyticsService(runtime);
      analyticsService.listener_({
        eventType: AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
        eventOriginator: EventOriginator.PROPENSITY_CLIENT,
        isFromUserAction: false,
      });
      return analyticsService.lastAction_
          .then(() => activityIframePort.whenReady())
          .then(() => {
            const firstArgument = activityIframePort.message.getCall(0).args[0];
            const request = new AnalyticsRequest(firstArgument['buf']);
            expect(request.getMeta().getEventOriginator()).to
                .equal(EventOriginator.PROPENSITY_CLIENT);
            expect(request.getMeta().getIsFromUserAction()).to.be.false;
            expect(request.getEvent()).to
                .equal(AnalyticsEvent.ACTION_PAYMENT_COMPLETE);
          });
    });

    it('should respect properties passed to its listener', () => {
      sandbox.stub(
          activityIframePort,
          'message'
      );
      analyticsService.listener_({
        eventType: AnalyticsEvent.ACTION_ACCOUNT_CREATED,
        eventOriginator: EventOriginator.AMP_CLIENT,
        isFromUserAction: true,
      });
      return analyticsService.lastAction_
          .then(() => activityIframePort.whenReady())
          .then(() => {
            const firstArgument = activityIframePort.message.getCall(0).args[0];
            const request = new AnalyticsRequest(firstArgument['buf']);
            expect(request.getMeta().getEventOriginator()).to
                .equal(EventOriginator.AMP_CLIENT);
            expect(request.getMeta().getIsFromUserAction()).to.be.true;
            expect(request.getEvent()).to
                .equal(AnalyticsEvent.ACTION_ACCOUNT_CREATED);
          });
    });
  });
});
