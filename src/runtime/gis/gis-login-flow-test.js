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
  CtaMode,
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
  let clock;

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
    clock = sandbox.useFakeTimers({
      global: win,
      toFake: ['setTimeout', 'clearTimeout'],
    });
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
      expect(getStyle(overlays[0], 'overflow')).to.equal('hidden');
      expect(getStyle(overlays[0], 'pointer-events')).to.equal('auto');

      expect(win.google.accounts.id.renderButton).to.have.been.calledWith(
        overlays[0],
        {
          'type': 'standard',
          'theme': 'outline',
          'text': 'continue_with',
          'logo_alignment': 'left',
          'width': 190,
          'click_listener': sandbox.match.func,
        }
      );
    });

    it('sets pointer-events to none when coordinate is disabled', () => {
      const disabledCoords = new ElementCoordinates();
      disabledCoords.setId('1');
      disabledCoords.setLeft(10);
      disabledCoords.setTop(10);
      disabledCoords.setWidth(100);
      disabledCoords.setHeight(30);
      disabledCoords.setDisabled(true);

      const disabledMessage = new LoginButtonCoordinates();
      disabledMessage.setLoginButtonCoordinatesList([disabledCoords]);

      messageMap[disabledMessage.label()](disabledMessage);

      const overlays = win.document.body.querySelectorAll('div');
      expect(overlays.length).to.equal(1);
      expect(getStyle(overlays[0], 'pointer-events')).to.equal('none');
    });

    it('updates pointer-events from none to auto when coordinate is re-enabled', () => {
      const disabledCoords = new ElementCoordinates();
      disabledCoords.setId('1');
      disabledCoords.setLeft(10);
      disabledCoords.setTop(10);
      disabledCoords.setWidth(100);
      disabledCoords.setHeight(30);
      disabledCoords.setDisabled(true);

      const disabledMessage = new LoginButtonCoordinates();
      disabledMessage.setLoginButtonCoordinatesList([disabledCoords]);
      messageMap[disabledMessage.label()](disabledMessage);

      const overlays = win.document.body.querySelectorAll('div');
      expect(overlays.length).to.equal(1);
      expect(getStyle(overlays[0], 'pointer-events')).to.equal('none');

      const enabledCoords = new ElementCoordinates();
      enabledCoords.setId('1');
      enabledCoords.setLeft(10);
      enabledCoords.setTop(10);
      enabledCoords.setWidth(100);
      enabledCoords.setHeight(30);
      enabledCoords.setDisabled(false);

      const enabledMessage = new LoginButtonCoordinates();
      enabledMessage.setLoginButtonCoordinatesList([enabledCoords]);
      messageMap[enabledMessage.label()](enabledMessage);

      expect(getStyle(overlays[0], 'pointer-events')).to.equal('auto');
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

      gisInteropManagerMock.setCompleteLoginCallback.resetHistory();
      clickListener();

      expect(activityIframeView.execute).to.not.have.been.called;
      expect(
        gisInteropManagerMock.setCompleteLoginCallback
      ).to.have.been.calledWith(sandbox.match.func);
      expect(
        gisInteropManagerMock.setRegwallClickPending
      ).to.have.been.calledWith(true);

      expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
        AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK,
        true,
        sandbox.match((eventParams) => {
          return (
            eventParams.getGisMode() === GisModeProto.GIS_MODE_OVERLAY &&
            eventParams.getCtaMode() === CtaMode.CTA_MODE_POPUP
          );
        }),
        undefined,
        undefined
      );
    });

    it('positions overlay relative to iframe bounding rect and scroll offset for inline CTA', () => {
      gisLoginFlow.dispose();
      const el = activityIframeView.getElement();
      el.getBoundingClientRect.returns({
        width: 500,
        height: 400,
        left: 80,
        top: 300,
        right: 580,
        bottom: 700,
      });
      win.scrollX = 20;
      win.scrollY = 150;
      activityIframeView.onResize.resetHistory();

      gisLoginFlow = new GisLoginFlow(
        depsMock,
        activityIframeView,
        'inline-config-id',
        CtaMode.CTA_MODE_INLINE
      );

      expect(activityIframeView.onResize).to.not.have.been.called;

      messageMap[message.label()](message);

      const overlays = win.document.body.querySelectorAll('div');
      expect(overlays.length).to.equal(1);
      // offsetLeft = 80 + 20 + 10 = 110
      // offsetTop = 300 + 150 + 10 = 460
      expect(getStyle(overlays[0], 'left')).to.equal('110px');
      expect(getStyle(overlays[0], 'top')).to.equal('460px');

      const renderButtonArgs =
        win.google.accounts.id.renderButton.lastCall.args;
      const clickListener = renderButtonArgs[1].click_listener;
      clickListener();

      expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
        AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK,
        true,
        sandbox.match((eventParams) => {
          return (
            eventParams.getGisMode() === GisModeProto.GIS_MODE_OVERLAY &&
            eventParams.getCtaMode() === CtaMode.CTA_MODE_INLINE
          );
        }),
        undefined,
        'inline-config-id'
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

    describe('renderButton retries', () => {
      let gisInitialized;

      function createMessage(ids) {
        const msg = new LoginButtonCoordinates();
        msg.setLoginButtonCoordinatesList(
          ids.map((id) => {
            const coords = new ElementCoordinates();
            coords.setId(id);
            coords.setLeft(10);
            coords.setTop(10);
            coords.setWidth(100);
            coords.setHeight(30);
            return coords;
          })
        );
        return msg;
      }

      beforeEach(() => {
        gisInitialized = false;
        sandbox.spy(win, 'setTimeout');
        // Mimics GIS: renderButton is a no-op until initialize() is called,
        // after which it renders a child into the parent.
        win.google.accounts.id.renderButton = sandbox.spy((parent) => {
          if (gisInitialized) {
            parent.textContent = '';
            parent.appendChild(win.document.createElement('div'));
          }
        });
      });

      it('renders the button once and does not retry when GIS is initialized', () => {
        gisInitialized = true;

        messageMap[message.label()](message);

        expect(win.google.accounts.id.renderButton).to.have.been.calledOnce;
        expect(win.setTimeout).to.not.have.been.called;
      });

      it('renders the button after the overlay is attached and styled', () => {
        win.google.accounts.id.renderButton = sandbox.spy((parent) => {
          expect(parent.parentNode).to.equal(win.document.body);
          expect(getStyle(parent, 'width')).to.equal('100px');
          expect(getStyle(parent, 'height')).to.equal('30px');
        });

        messageMap[message.label()](message);

        expect(win.google.accounts.id.renderButton).to.have.been.calledOnce;
      });

      it('retries with exponential backoff until GIS is initialized and then stops', () => {
        messageMap[message.label()](message);
        const overlay = win.document.body.querySelector('div');
        expect(overlay.firstElementChild).to.be.null;
        expect(win.google.accounts.id.renderButton).to.have.been.calledOnce;
        expect(win.setTimeout).to.have.been.calledOnceWith(
          sandbox.match.func,
          250
        );

        clock.tick(249);
        expect(win.google.accounts.id.renderButton).to.have.been.calledOnce;
        clock.tick(1);
        expect(win.google.accounts.id.renderButton).to.have.been.calledTwice;
        expect(win.setTimeout.lastCall.args[1]).to.equal(500);

        gisInitialized = true;
        clock.tick(500);

        expect(win.google.accounts.id.renderButton).to.have.been.calledThrice;
        expect(win.google.accounts.id.renderButton.lastCall.args[0]).to.equal(
          overlay
        );
        expect(overlay.firstElementChild).to.not.be.null;
        expect(win.setTimeout).to.have.been.calledTwice;
      });

      it('caps the backoff delay and stops after the maximum number of retries', () => {
        messageMap[message.label()](message);

        clock.tick(60000);

        expect(
          win.setTimeout.getCalls().map((call) => call.args[1])
        ).to.deep.equal([250, 500, 1000, 2000, 4000, 8000, 8000, 8000]);
        // 1 initial attempt + 8 retries.
        expect(win.google.accounts.id.renderButton.callCount).to.equal(9);
      });

      it('retries renderButton on later coordinate updates while the overlay is empty', () => {
        messageMap[message.label()](message);
        const overlay = win.document.body.querySelector('div');
        expect(overlay.firstElementChild).to.be.null;

        gisInitialized = true;
        messageMap[message.label()](message);

        expect(win.google.accounts.id.renderButton).to.have.been.calledTwice;
        expect(overlay.firstElementChild).to.not.be.null;

        // Once rendered, further updates do not re-render the button.
        messageMap[message.label()](message);
        expect(win.google.accounts.id.renderButton).to.have.been.calledTwice;
      });

      it('retries renderButton on resize while the overlay is empty', () => {
        messageMap[message.label()](message);
        const overlay = win.document.body.querySelector('div');

        gisInitialized = true;
        onResizeCallback();

        expect(win.google.accounts.id.renderButton).to.have.been.calledTwice;
        expect(overlay.firstElementChild).to.not.be.null;
      });

      it('keeps polling for an empty overlay without re-rendering a rendered one', () => {
        gisInitialized = true;
        messageMap[message.label()](createMessage(['1']));
        const overlay1 = win.document.body.querySelector('div');
        expect(overlay1.firstElementChild).to.not.be.null;

        gisInitialized = false;
        messageMap[message.label()](createMessage(['1', '2']));
        const overlay2 = win.document.body.querySelectorAll(':scope > div')[1];
        expect(overlay2.firstElementChild).to.be.null;

        clock.tick(250);
        gisInitialized = true;
        clock.tick(500);

        expect(overlay2.firstElementChild).to.not.be.null;
        const renderedParents = win.google.accounts.id.renderButton
          .getCalls()
          .map((call) => call.args[0]);
        expect(renderedParents.filter((el) => el === overlay1).length).to.equal(
          1
        );
        expect(renderedParents.filter((el) => el === overlay2).length).to.equal(
          3
        );
      });

      it('cancels a pending retry on dispose', () => {
        messageMap[message.label()](message);
        expect(win.google.accounts.id.renderButton).to.have.been.calledOnce;

        gisLoginFlow.dispose();
        gisLoginFlow = null;
        clock.tick(60000);

        expect(win.google.accounts.id.renderButton).to.have.been.calledOnce;
      });

      it('does not schedule another poll while one is pending', () => {
        messageMap[message.label()](message);
        messageMap[message.label()](message);

        expect(win.setTimeout).to.have.been.calledOnce;
      });
    });

    it('cancels existing requestAnimationFrame on scheduleUpdate', () => {
      messageMap[message.label()](message);
      expect(cancelAnimationFrameSpy).to.have.not.been.called;

      messageMap[message.label()](message);
      expect(cancelAnimationFrameSpy).to.have.been.called;
    });
  });
});
