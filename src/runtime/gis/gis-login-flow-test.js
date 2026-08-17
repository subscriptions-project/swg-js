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
  LoginButtonCoordinates,
} from '../../proto/api_messages';
import {GisLoginFlow} from './gis-login-flow';
import {GisMode} from './gis-utils';
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

    const el = win.document.createElement('iframe');
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

    const depsMock = {
      doc: () => doc,
      eventManager: () => eventManagerMock,
      gisInteropManager: () => ({
        setCompleteLoginCallback: sandbox.stub(),
        setRegwallClickPending: sandbox.stub(),
      }),
    };

    gisLoginFlow = new GisLoginFlow(
      depsMock,
      activityIframeView,
      GisMode.GisModeOverlay
    );
  });

  afterEach(() => {
    gisLoginFlow?.dispose();
    delete self.google;
  });

  describe('GisModeOverlay', () => {
    it('listens for resize events from both window and activityIframeView', () => {
      expect(win.addEventListener).to.have.been.calledWith('resize');
      expect(activityIframeView.onResize).to.have.been.called;

      // Verify callback triggers a frame request
      onResizeCallback();
      expect(win.requestAnimationFrame).to.have.been.called;
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

    it('ignores invalid coordinate payload', () => {
      const invalidMessage = new LoginButtonCoordinates();
      invalidMessage.setLoginButtonCoordinatesList([new ElementCoordinates()]);

      messageMap[invalidMessage.label()](invalidMessage);

      const overlays = win.document.body.querySelectorAll('div');
      expect(overlays.length).to.equal(0);
    });

    it('logs event when renderButton click_listener is invoked', async () => {
      messageMap[message.label()](message);

      const renderButtonArgs =
        win.google.accounts.id.renderButton.firstCall.args;
      const clickListener = renderButtonArgs[1].click_listener;

      clickListener();

      expect(activityIframeView.execute).to.not.have.been.called;

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

    it('cancels existing requestAnimationFrame on scheduleUpdate', () => {
      messageMap[message.label()](message);
      expect(cancelAnimationFrameSpy).to.have.not.been.called;

      messageMap[message.label()](message);
      expect(cancelAnimationFrameSpy).to.have.been.called;
    });
  });
});
