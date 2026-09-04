/**
 * Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActivityIframeView} from '../../ui/activity-iframe-view';
import {ActivityPorts} from '../../components/activities';
import {
  AnalyticsEvent,
  ElementCoordinates,
  GisMode as GisModeProto,
  GisSignIn,
  LoginButtonCoordinates,
} from '../../proto/api_messages';
import {GisLoginFlow} from './gis-login-flow';
import {getStyle} from '../../utils/style';

describes.realWin('GisLoginFlow', (env) => {
  let doc;
  let win;
  let activityIframeView;
  let gisLoginFlow;
  let messageMap;
  let message;
  let cancelAnimationFrameSpy;
  let onResizeCallback;
  let eventManagerMock;
  let gisInteropManagerMock;
  let depsMock;
  let friendlyIframe;

  beforeEach(() => {
    const coordinates = new ElementCoordinates();

    coordinates.setId('1');
    coordinates.setLeft(10);
    coordinates.setTop(10);
    coordinates.setWidth(100);
    coordinates.setHeight(30);

    message = new LoginButtonCoordinates();
    message.setLoginButtonCoordinatesList([coordinates]);

    messageMap = {};

    win = env.win;
    sandbox.stub(win, 'addEventListener').callThrough();
    sandbox.stub(win, 'removeEventListener').callThrough();
    sandbox.stub(win, 'requestAnimationFrame').callsFake((cb) => {
      cb();
      return 1;
    });
    cancelAnimationFrameSpy = sandbox.spy(win, 'cancelAnimationFrame');
    win.google = {
      accounts: {
        id: {
          prompt: sandbox.spy(),
          initialize: (config) => {
            config.callback({credential: 'fakeIdToken'});
          },
          renderButton: sandbox.spy(),
        },
      },
    };

    doc = {
      getWin: () => win,
      getRootNode: () => win.document,
      getBody: () => win.document.body,
      getHead: () => win.document.head,
    };

    friendlyIframe = win.document.createElement('iframe');
    win.document.body.appendChild(friendlyIframe);
    sandbox.stub(friendlyIframe, 'getBoundingClientRect').returns({
      width: 500,
      height: 500,
      left: 250,
      top: 500,
      right: 750,
      bottom: 1000,
    });

    const iframeDoc = friendlyIframe.contentDocument;
    const el = iframeDoc.createElement('iframe');
    iframeDoc.body.appendChild(el);
    sandbox.stub(el, 'getBoundingClientRect').returns({
      width: 500,
      height: 500,
      left: 0,
      top: 0,
      right: 500,
      bottom: 500,
    });

    activityIframeView = new ActivityIframeView(
      win,
      new ActivityPorts({
        win: () => win,
      }),
      'https://example.com/src',
      {},
      'en'
    );
    sandbox.stub(activityIframeView, 'getElement').returns(el);
    sandbox.stub(activityIframeView, 'execute').returns(Promise.resolve());
    sandbox.stub(activityIframeView, 'on').callsFake((ctor, cb) => {
      const messageType = new ctor();
      const messageLabel = messageType.label();
      messageMap[messageLabel] = cb;
    });
    sandbox.stub(activityIframeView, 'onResize').callsFake((cb) => {
      onResizeCallback = cb;
    });

    eventManagerMock = {
      logEvent: sandbox.stub(),
      logSwgEvent: sandbox.stub(),
    };

    gisInteropManagerMock = {
      setCompleteLoginCallback: sandbox.stub(),
      setRegwallClickPending: sandbox.stub(),
    };

    depsMock = {
      doc: () => doc,
      eventManager: () => eventManagerMock,
      gisInteropManager: () => gisInteropManagerMock,
    };

    gisLoginFlow = new GisLoginFlow(depsMock, activityIframeView);
  });

  afterEach(() => {
    gisLoginFlow?.dispose();
    friendlyIframe?.remove();
    delete self.google;
  });

  describe('GisModeOverlay', () => {
    it('registers completeLogin callback on construction and cleans up on dispose', () => {
      expect(
        gisInteropManagerMock.setCompleteLoginCallback
      ).to.have.been.calledWith(sandbox.match.func);

      gisLoginFlow.dispose();
      expect(
        gisInteropManagerMock.setCompleteLoginCallback
      ).to.have.been.calledWith(null);
    });

    it('listens for resize events from both window and activityIframeView', () => {
      expect(win.addEventListener).to.have.been.calledWith('resize');
      expect(activityIframeView.onResize).to.have.been.called;

      // Verify callback triggers a frame request
      onResizeCallback();
      expect(win.requestAnimationFrame).to.have.been.called;
    });

    it('observes iframe resize with ResizeObserver and disconnects on dispose', () => {
      let observerCallback;
      const observeSpy = sandbox.spy();
      const disconnectSpy = sandbox.spy();

      class MockResizeObserver {
        constructor(callback) {
          observerCallback = callback;
        }
        observe = observeSpy;
        disconnect = disconnectSpy;
      }

      win.ResizeObserver = MockResizeObserver;

      gisLoginFlow.dispose();
      gisLoginFlow = new GisLoginFlow(depsMock, activityIframeView);

      expect(observeSpy).to.have.been.calledWith(
        activityIframeView.getElement()
      );
      expect(observeSpy).to.have.been.calledWith(friendlyIframe);

      // Trigger resize callback and verify scheduleUpdate is called after timeout
      const setTimeoutStub = sandbox
        .stub(win, 'setTimeout')
        .callsFake((cb) => cb());
      observerCallback();
      expect(setTimeoutStub).to.have.been.called;

      gisLoginFlow.dispose();
      expect(disconnectSpy).to.have.been.called;
    });

    it('does not observe iframe when ResizeObserver is undefined', () => {
      delete win.ResizeObserver;
      gisLoginFlow.dispose();
      gisLoginFlow = new GisLoginFlow(depsMock, activityIframeView);
      gisLoginFlow.dispose();
    });

    it('creates an overlay bounds on message and styles it appropriately', () => {
      win.innerWidth = 1000;
      win.innerHeight = 1000;

      messageMap[message.label()](message);

      const overlays = win.document.body.querySelectorAll('div');
      expect(overlays.length).to.equal(1);
      // iframe is 500x500. Inner window is 1000x1000.
      // offsetLeft = (1000 - 500) / 2 + 10 = 250 + 10 = 260
      // offsetTop = 1000 - (500 - 10) = 1000 - 490 = 510
      expect(getStyle(overlays[0], 'position')).to.equal('fixed');
      expect(getStyle(overlays[0], 'left')).to.equal('260px');
      expect(getStyle(overlays[0], 'top')).to.equal('510px');
      expect(getStyle(overlays[0], 'width')).to.equal('100px');
      expect(getStyle(overlays[0], 'height')).to.equal('30px');

      expect(win.google.accounts.id.renderButton).to.have.been.calledWith(
        overlays[0],
        {
          'type': 'standard',
          'theme': 'outline',
          'text': 'continue_with',
          'logo_alignment': 'left',
          'click_listener': sandbox.match.func,
        }
      );
    });

    it('correctly calculates overlay position when outer dialog is center-positioned', () => {
      friendlyIframe.getBoundingClientRect.returns({
        width: 500,
        height: 500,
        left: 200,
        top: 150,
        right: 700,
        bottom: 650,
      });

      messageMap[message.label()](message);

      const overlays = win.document.body.querySelectorAll('div');
      expect(overlays.length).to.equal(1);
      // dialogRect.left = 200, innerRect.left = 0, p.left = 10 => 210px
      // dialogRect.top = 150, innerRect.top = 0, p.top = 10 => 160px
      expect(getStyle(overlays[0], 'left')).to.equal('210px');
      expect(getStyle(overlays[0], 'top')).to.equal('160px');
    });

    it('falls back to element bounding rect when element is not inside a friendly iframe', () => {
      const standaloneEl = win.document.createElement('iframe');
      sandbox.stub(standaloneEl, 'getBoundingClientRect').returns({
        width: 400,
        height: 300,
        left: 50,
        top: 60,
        right: 450,
        bottom: 360,
      });
      activityIframeView.getElement.returns(standaloneEl);

      messageMap[message.label()](message);

      const overlays = win.document.body.querySelectorAll('div');
      expect(overlays.length).to.equal(1);
      // innerRect.left = 50, p.left = 10 => 60px
      // innerRect.top = 60, p.top = 10 => 70px
      expect(getStyle(overlays[0], 'left')).to.equal('60px');
      expect(getStyle(overlays[0], 'top')).to.equal('70px');
    });

    it('listens for scroll events from window and cleans up on dispose', () => {
      expect(win.addEventListener).to.have.been.calledWith(
        'scroll',
        sandbox.match.func,
        {passive: true}
      );

      gisLoginFlow.dispose();
      expect(win.removeEventListener).to.have.been.calledWith(
        'scroll',
        sandbox.match.func
      );
    });

    it('ignores invalid coordinate payload', () => {
      const invalidMessage = new LoginButtonCoordinates();
      invalidMessage.setLoginButtonCoordinatesList([new ElementCoordinates()]);

      messageMap[invalidMessage.label()](invalidMessage);

      const overlays = win.document.body.querySelectorAll('div');
      expect(overlays.length).to.equal(0);
    });

    it('logs event and marks click pending when renderButton click_listener is invoked', async () => {
      messageMap[message.label()](message);

      const renderButtonArgs =
        win.google.accounts.id.renderButton.firstCall.args;
      const clickListener = renderButtonArgs[1].click_listener;

      clickListener();

      expect(activityIframeView.execute).to.not.have.been.called;
      expect(
        gisInteropManagerMock.setRegwallClickPending
      ).to.have.been.calledWith(true);

      expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
        AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK,
        true,
        sandbox.match((eventParams) => {
          return eventParams.getGisMode() === GisModeProto.GIS_MODE_OVERLAY;
        }),
        undefined,
        undefined
      );
    });

    it('handles completeLogin callback successfully', async () => {
      const callback =
        gisInteropManagerMock.setCompleteLoginCallback.firstCall.args[0];
      const result = await callback('test-token');

      expect(result).to.be.true;
      expect(activityIframeView.execute).to.have.been.calledWith(
        sandbox.match(
          (msg) =>
            msg instanceof GisSignIn && msg.getSwgUserToken() === 'test-token'
        )
      );
    });

    it('handles completeLogin callback failure and logs error with configurationId', async () => {
      gisLoginFlow.dispose();
      gisLoginFlow = new GisLoginFlow(
        depsMock,
        activityIframeView,
        'config123'
      );
      activityIframeView.execute.rejects(new Error('Execute error'));
      const callback =
        gisInteropManagerMock.setCompleteLoginCallback.lastCall.args[0];
      const result = await callback('test-token');

      expect(result).to.be.false;
      expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
        AnalyticsEvent.EVENT_GIS_LOGIN_ERROR,
        false,
        null,
        undefined,
        'config123'
      );
    });

    it('cancels existing requestAnimationFrame on scheduleUpdate', () => {
      messageMap[message.label()](message);
      expect(cancelAnimationFrameSpy).to.have.not.been.called;

      messageMap[message.label()](message);
      expect(cancelAnimationFrameSpy).to.have.been.called;
    });
  });
});
