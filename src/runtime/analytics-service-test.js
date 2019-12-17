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

import {ActivityIframePort} from '../components/activities';
import {
  AnalyticsEvent,
  EventOriginator,
  EventParams,
  FinishedLoggingResponse,
} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {ClientEventManager} from './client-event-manager';
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
  let runtime;
  let eventManagerCallback;

  const productId = 'pub1:label1';
  const defEventType = AnalyticsEvent.IMPRESSION_PAYWALL;
  const event = {
    eventType: defEventType,
    eventOriginator: EventOriginator.SWG_CLIENT,
    isFromUserAction: null,
    additionalParameters: {},
  };

  beforeEach(() => {
    sandbox
      .stub(ClientEventManager.prototype, 'registerEventListener')
      .callsFake(callback => (eventManagerCallback = callback));
    win = env.win;
    src = '/serviceiframe';
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activityPorts = runtime.activities();
    analyticsService = new AnalyticsService(runtime);
    activityIframePort = new ActivityIframePort(
      analyticsService.getElement(),
      feUrl(src)
    );

    sandbox
      .stub(activityPorts, 'openIframe')
      .callsFake(() => Promise.resolve(activityIframePort));

    sandbox
      .stub(activityIframePort, 'whenReady')
      .callsFake(() => Promise.resolve(true));
  });

  afterEach(() => {
    setExperimentsStringForTesting('');
  });

  describe('Construction', () => {
    it('should be listening for events from events manager', () => {
      expect(eventManagerCallback).to.not.be.null;
    });

    it('should have analyticsService constructed', () => {
      const activityIframe = analyticsService.getElement();
      const transactionId = analyticsService.getTransactionId();
      expect(analyticsService.getTransactionId()).to.equal(transactionId);
      expect(analyticsService.getTransactionId()).to.match(
        /^.{8}-.{4}-.{4}-.{4}-.{12}$/g
      );
      expect(activityIframe.nodeType).to.equal(1);
      expect(activityIframe.nodeName).to.equal('IFRAME');
      expect(getStyle(activityIframe, 'display')).to.equal('none');
      const txId = 'tx-id-101';
      analyticsService.setTransactionId(txId);
      expect(analyticsService.getTransactionId()).to.equal(txId);
    });
  });

  describe('Communications', () => {
    let iframeCallback;

    beforeEach(() => {
      iframeCallback = null;
      sandbox
        .stub(activityIframePort, 'on')
        .callsFake((constructor, callback) => {
          if (constructor === FinishedLoggingResponse) {
            iframeCallback = callback;
          }
        });
    });
    afterEach(() => {
      // Ensure that analytics service registers a callback to listen for when
      // logging is finished.
      expect(iframeCallback).to.not.be.null;
    });

    it('should call openIframe after client event', () => {
      analyticsService.handleClientEvent_(event);

      expect(activityPorts.openIframe).to.have.been.calledOnce;
      const firstArgument = activityPorts.openIframe.getCall(0).args[0];
      expect(activityPorts.openIframe).to.have.been.calledOnce;
      expect(firstArgument.nodeName).to.equal('IFRAME');
      const secondArgument = activityPorts.openIframe.getCall(0).args[1];
      expect(secondArgument).to.equal(feUrl(src));
      const thirdArgument = activityPorts.openIframe.getCall(0).args[2];
      expect(thirdArgument).to.deep.equal(
        feArgs({
          publicationId: pageConfig.getPublicationId(),
        })
      );
      return activityIframePort.whenReady();
    });

    it('should send message on port and openIframe called only once', async () => {
      // This ensure nothing gets sent to the server.
      sandbox.stub(activityIframePort, 'execute').callsFake(() => {});

      // This triggers an event.
      eventManagerCallback({
        eventType: AnalyticsEvent.UNKNOWN,
        eventOriginator: EventOriginator.UNKNOWN_CLIENT,
        isFromUserAction: null,
        additionalParameters: null,
      });

      // These wait for analytics server to be ready to send data.
      await analyticsService.lastAction_;
      await activityIframePort.whenReady();

      // These enusre the right event was communicated.
      expect(activityIframePort.execute).to.be.calledOnce;
      const /* {?AnalyticsRequest} */ requestSent = activityIframePort.execute.getCall(
          0
        ).args[0];
      expect(requestSent.getEvent()).to.deep.equal(AnalyticsEvent.UNKNOWN);
      expect(requestSent.getMeta().getEventOriginator()).to.deep.equal(
        EventOriginator.UNKNOWN_CLIENT
      );
      expect(requestSent.getMeta().getIsFromUserAction()).to.be.null;

      // This sends another event and waits for it to be sent
      eventManagerCallback({
        eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: true,
        additionalParameters: {droppedData: true},
      });
      await analyticsService.lastAction_;

      // This ensures communications were successful
      expect(activityPorts.openIframe).to.have.been.calledOnce;
      const firstArgument = activityPorts.openIframe.getCall(0).args[0];
      expect(firstArgument.nodeName).to.equal('IFRAME');
      const secondArgument = activityPorts.openIframe.getCall(0).args[1];
      expect(secondArgument).to.equal(feUrl(src));
      const thirdArgument = activityPorts.openIframe.getCall(0).args[2];
      expect(thirdArgument).to.deep.equal(
        feArgs({
          publicationId: pageConfig.getPublicationId(),
        })
      );
      const /* {?AnalyticsRequest} */ request = activityIframePort.execute.getCall(
          1
        ).args[0];
      expect(request).to.not.be.null;
      const meta = request.getMeta();
      expect(request.getEvent()).to.deep.equal(
        AnalyticsEvent.IMPRESSION_PAYWALL
      );
      expect(meta.getEventOriginator()).to.equal(EventOriginator.SWG_CLIENT);
      expect(meta.getIsFromUserAction()).to.be.true;

      // It should have a working logging promise
      const p = analyticsService.getLoggingPromise();

      // It should be waiting for 2 logging responses
      expect(p).to.not.deep.equal(Promise.resolve());
      const loggingResponse = new FinishedLoggingResponse();
      loggingResponse.setComplete(true);
      // Simulate 1 logging response
      iframeCallback(loggingResponse);

      // It should still be waiting for 1
      expect(analyticsService.getLoggingPromise()).to.not.deep.equal(
        Promise.resolve()
      );
      iframeCallback(loggingResponse);

      // Ensure it is done waiting
      await p;
      await analyticsService.getLoggingPromise();
    });
  });

  it('should not log the subscription state change event', () => {
    analyticsService.lastAction_ = null;
    event.eventType = AnalyticsEvent.EVENT_SUBSCRIPTION_STATE;
    eventManagerCallback(event);
    expect(analyticsService.lastAction_).to.be.null;
    event.eventType = defEventType;
  });

  describe('Context, experiments & labels', () => {
    it('should create correct context for logging', async () => {
      sandbox.stub(activityIframePort, 'execute').callsFake(() => {});
      AnalyticsService.prototype.getQueryString_ = () => {
        return '?utm_source=scenic&utm_medium=email&utm_campaign=campaign';
      };
      AnalyticsService.prototype.getReferrer_ = () => {
        return 'https://scenic-2017.appspot.com/landing.html';
      };
      analyticsService.setReadyToPay(true);
      analyticsService.setSku('basic');
      eventManagerCallback(event);

      await analyticsService.lastAction_;
      await activityIframePort.whenReady();
      expect(activityIframePort.execute).to.be.calledOnce;
      const /* {?AnalyticsRequest} */ request = activityIframePort.execute.getCall(
          0
        ).args[0];
      expect(request).to.not.be.null;
      expect(request.getEvent()).to.deep.equal(defEventType);
      expect(request.getContext()).to.not.be.null;
      expect(request.getContext().getReferringOrigin()).to.equal(
        'https://scenic-2017.appspot.com'
      );
      expect(request.getContext().getUtmMedium()).to.equal('email');
      expect(request.getContext().getUtmSource()).to.equal('scenic');
      expect(request.getContext().getUtmCampaign()).to.equal('campaign');
      expect(request.getContext().getTransactionId()).to.match(
        /^.{8}-.{4}-.{4}-.{4}-.{12}$/g
      );
      expect(request.getContext().getSku()).to.equal('basic');
      expect(request.getContext().getReadyToPay()).to.be.true;
    });

    it('should set context for empty experiments', async () => {
      setExperimentsStringForTesting('');
      sandbox.stub(activityIframePort, 'execute').callsFake(() => {});
      eventManagerCallback(event);
      await analyticsService.lastAction_;
      await activityIframePort.whenReady();
      expect(activityIframePort.execute).to.be.calledOnce;
      const /* {?AnalyticsRequest} */ request = activityIframePort.execute.getCall(
          0
        ).args[0];
      expect(request).to.not.be.null;
      expect(request.getContext().getLabelList()).to.deep.equal([]);
    });

    it('should set context for non-empty experiments', async () => {
      setExperimentsStringForTesting('experiment-A,experiment-B');
      sandbox.stub(activityIframePort, 'execute').callsFake(() => {});
      eventManagerCallback(event);
      await analyticsService.lastAction_;
      await activityIframePort.whenReady();
      expect(activityIframePort.execute).to.be.calledOnce;
      const /* {?AnalyticsRequest} */ request = activityIframePort.execute.getCall(
          0
        ).args[0];
      expect(request).to.not.be.null;
      expect(request.getContext().getLabelList()).to.deep.equal([
        'experiment-A',
        'experiment-B',
      ]);
    });

    it('should add additional labels to experiments', async () => {
      analyticsService.addLabels(['L1', 'L2']);
      setExperimentsStringForTesting('E1,E2');
      sandbox.stub(activityIframePort, 'execute').callsFake(() => {});
      eventManagerCallback(event);
      await analyticsService.lastAction_;
      await activityIframePort.whenReady();
      const /** {?AnalyticsRequest} */ request1 = activityIframePort.execute.getCall(
          0
        ).args[0];
      expect(request1.getContext().getLabelList()).to.deep.equal([
        'L1',
        'L2',
        'E1',
        'E2',
      ]);

      analyticsService.addLabels(['L3', 'L4']);
      eventManagerCallback(event);
      await analyticsService.lastAction_;
      const /** {?AnalyticsRequest} */ request2 = activityIframePort.execute.getCall(
          1
        ).args[0];
      expect(request2.getContext().getLabelList()).to.deep.equal([
        'L1',
        'L2',
        'E1',
        'E2',
        'L3',
        'L4',
      ]);
    });

    it('should dedupe duplicate labels', () => {
      analyticsService.addLabels(['L1', 'L2', 'L1', 'L2']);
      expect(analyticsService.context_.getLabelList()).to.deep.equal([
        'L1',
        'L2',
      ]);
      analyticsService.addLabels(['L1', 'L2', 'L3']);
      expect(analyticsService.context_.getLabelList()).to.deep.equal([
        'L1',
        'L2',
        'L3',
      ]);
    });
  });

  describe('Publisher Events', () => {
    /**
     * Ensure that analytics service is only logging events from the passed
     * originator if shouldLog is true.
     * @param {!EventOriginator} originator
     * @param {boolean} shouldLog
     * @param {AnalyticsEvent=} eventType
     */
    const testOriginator = function(originator, shouldLog, eventType) {
      const prevOriginator = event.eventOriginator;
      const prevType = event.eventType;
      analyticsService.lastAction_ = null;
      event.eventOriginator = originator;
      if (eventType) {
        event.eventType = eventType;
      }
      eventManagerCallback(event);
      const didLog = analyticsService.lastAction_ !== null;
      expect(shouldLog).to.equal(didLog);
      event.eventOriginator = prevOriginator;
      if (eventType) {
        event.eventType = prevType;
      }
    };

    it('should not log publisher events by default', () => {
      testOriginator(EventOriginator.SWG_CLIENT, true);
      testOriginator(EventOriginator.SWG_SERVER, true);
      testOriginator(EventOriginator.AMP_CLIENT, false);
      testOriginator(EventOriginator.PROPENSITY_CLIENT, false);
      testOriginator(EventOriginator.PUBLISHER_CLIENT, false);
    });

    it('should log publisher events if configured', () => {
      runtime.configure({enableSwgAnalytics: true});
      testOriginator(EventOriginator.SWG_CLIENT, true);
      testOriginator(EventOriginator.AMP_CLIENT, true);
      testOriginator(EventOriginator.PROPENSITY_CLIENT, true);
      testOriginator(EventOriginator.PUBLISHER_CLIENT, true);
    });

    it('should always log page load event in AMP', () => {
      testOriginator(
        EventOriginator.AMP_CLIENT,
        true,
        AnalyticsEvent.IMPRESSION_PAGE_LOAD
      );
    });
  });

  describe('EventParams', () => {
    it('should ignore additionalParameters', () => {
      const logRequest = analyticsService.createLogRequest_(event);
      expect(logRequest.setParams()).to.be.undefined;
    });

    it('should process EventParams', () => {
      event.additionalParameters = new EventParams();
      const logRequest = analyticsService.createLogRequest_(event);
      expect(logRequest.getParams()).to.be.instanceOf(EventParams);
      event.additionalParameters = {};
    });
  });

  describe('getHasLogged', () => {
    it('should initially not have logged anything', () => {
      expect(analyticsService.getHasLogged()).to.be.false;
    });

    it('should remember it logged something', async () => {
      sandbox.stub(activityIframePort, 'execute').callsFake(() => {});
      analyticsService.handleClientEvent_(event);
      await analyticsService.lastAction_;
      expect(analyticsService.getHasLogged()).to.be.true;
    });
  });
});
