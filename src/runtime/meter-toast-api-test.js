/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActivityPort} from '../components/activities';
import {AnalyticsEvent} from '../proto/api_messages';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {
  IFRAME_BOX_SHADOW,
  MINIMIZED_IFRAME_SIZE,
  MeterToastApi,
} from './meter-toast-api';
import {PageConfig} from '../model/page-config';
import {
  ToastCloseRequest,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {getStyle} from '../utils/style';

const AUTO_PINGBACK_TIMEOUT = 10000;
const TOAST_CLOSE_REQUEST = new ToastCloseRequest();
TOAST_CLOSE_REQUEST.setClose(true);

describes.realWin('MeterToastApi', {}, (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let eventManagerMock;
  let pageConfig;
  let messageMap;
  let meterToastApi;
  let port;
  let dialogManagerMock;
  let onConsumeCallbackFake;
  let isMobile;
  const productId = 'pub1:label1';

  beforeEach(() => {
    win = env.win;
    sandbox.stub(win, 'matchMedia').returns({
      'matches': true,
      'addListener': (callback) => callback,
    });
    messageMap = {};
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    const eventManager = new ClientEventManager(Promise.resolve());
    eventManagerMock = sandbox.mock(eventManager);
    sandbox.stub(runtime, 'eventManager').callsFake(() => eventManager);
    meterToastApi = new MeterToastApi(runtime, {'isClosable': true});
    isMobile = true;
    sandbox.stub(meterToastApi, 'isMobile_').returns(isMobile);
    onConsumeCallbackFake = sandbox.fake();
    meterToastApi.setOnConsumeCallback(onConsumeCallbackFake);
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    sandbox.stub(port, 'on').callsFake((ctor, callback) => {
      const messageType = new ctor();
      const messageLabel = messageType.label();
      messageMap[messageLabel] = callback;
    });
    sandbox.stub(self.console, 'warn');
    sandbox.stub(self.console, 'error');
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    dialogManagerMock.verify();
    eventManagerMock.verify();
    self.console.warn.restore();
    self.console.error.restore();
  });

  it('should start the flow correctly without native subscribe request', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    const iframeArgs = meterToastApi.activityPorts_.addDefaultArguments({
      isClosable: true,
      hasSubscriptionCallback: runtime
        .callbacks()
        .hasSubscribeRequestCallback(),
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/metertoastiframe?_=_',
        iframeArgs
      )
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_METER_TOAST);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_OFFERED_METER);
    await meterToastApi.start();
    const errorMessage =
      '[swg.js]: `setOnNativeSubscribeRequest` has not been ' +
      'set before starting the metering flow, so users will not be able to ' +
      'subscribe from the metering dialog directly. Please call ' +
      '`setOnNativeSubscribeRequest` with a subscription flow callback before ' +
      'starting metering.';
    expect(self.console.warn).to.be.calledWithExactly(errorMessage);
  });

  it('should start the flow correctly with native subscribe request', async () => {
    runtime.callbacks().setOnSubscribeRequest(() => {});
    callbacksMock.expects('triggerFlowStarted').once();
    const iframeArgs = meterToastApi.activityPorts_.addDefaultArguments({
      isClosable: true,
      hasSubscriptionCallback: runtime
        .callbacks()
        .hasSubscribeRequestCallback(),
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/metertoastiframe?_=_',
        iframeArgs
      )
      .returns(Promise.resolve(port));
    meterToastApi = new MeterToastApi(runtime, {'isClosable': true});
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_METER_TOAST);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_OFFERED_METER);
    await meterToastApi.start();
  });

  it('should activate native subscribe request', async () => {
    const nativeStub = sandbox.stub(
      runtime.callbacks(),
      'triggerSubscribeRequest'
    );
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    await meterToastApi.start();
    // Native message.
    const viewSubscriptionsResponse = new ViewSubscriptionsResponse();
    viewSubscriptionsResponse.setNative(true);
    const messageCallback = messageMap[viewSubscriptionsResponse.label()];
    messageCallback(viewSubscriptionsResponse);
    expect(nativeStub).to.be.calledOnce.calledWithExactly();
    // event listeners should be removed.
    const messageStub = sandbox.stub(port, 'execute');
    await win.dispatchEvent(new Event('click'));
    expect(messageStub).to.not.be.called;
    expect(onConsumeCallbackFake).to.not.be.called;
  });

  it('should close iframe on click', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    await meterToastApi.start();
    const $body = win.document.body;
    expect($body.style.overflow).to.equal('hidden');
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION,
        true
      );
    await win.dispatchEvent(new Event('click'));
    // next three should have no effect
    await win.dispatchEvent(new Event('touchstart'));
    await win.dispatchEvent(new Event('mousedown'));
    expect(messageStub).to.be.calledOnce.calledWith(TOAST_CLOSE_REQUEST);
    expect(onConsumeCallbackFake).to.be.calledOnce;
  });

  it('should not close iframe on scroll events on mobile', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    await meterToastApi.start();
    const $body = win.document.body;
    expect($body.style.overflow).to.equal('hidden');
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION,
        true
      )
      .never();
    await win.dispatchEvent(new Event('scroll'));
    expect(messageStub).to.not.be.called;
    expect(onConsumeCallbackFake).to.not.be.called;
  });

  it('should close iframe on long scroll events on desktop', async () => {
    win.scrollY = 0;
    meterToastApi.isMobile_.restore();
    sandbox.stub(meterToastApi, 'isMobile_').returns(false);
    sandbox.stub(win, 'setTimeout').callsFake((callback, ms) => {
      if (ms != AUTO_PINGBACK_TIMEOUT) {
        callback();
      }
      return 5;
    });
    callbacksMock.expects('triggerFlowStarted').once();
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    await meterToastApi.start();
    const $body = win.document.body;
    expect($body.style.overflow).to.equal('');
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION,
        true
      );
    await win.dispatchEvent(new Event('scroll'));
    expect(onConsumeCallbackFake).to.not.be.called;
    win.pageYOffset = 10;
    await win.dispatchEvent(new Event('scroll'));
    expect(onConsumeCallbackFake).to.not.be.called;
    win.pageYOffset = 500;
    await win.dispatchEvent(new Event('scroll'));
    expect(messageStub).to.be.calledOnce.calledWith(TOAST_CLOSE_REQUEST);
    expect(onConsumeCallbackFake).to.be.calledOnce;
  });

  it('should call onConsume if port is rejected.', async () => {
    meterToastApi.isMobile_.restore();
    callbacksMock.expects('triggerFlowStarted').once();
    port.acceptResult = () => Promise.reject(new Error('rejected'));
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    const messageStub = sandbox.stub(port, 'execute');
    await meterToastApi.start();
    expect(messageStub).to.not.be.called;
    expect(onConsumeCallbackFake).to.be.calledOnce;
    expect(self.console.error).to.be.calledWithExactly(
      '[swg.js]: Error occurred during meter toast handling: Error: rejected'
    );
  });

  it('should not throw on AbortError.', async () => {
    meterToastApi.isMobile_.restore();
    callbacksMock.expects('triggerFlowStarted').once();
    port.acceptResult = () =>
      Promise.reject(new DOMException('abort', 'AbortError'));
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    const messageStub = sandbox.stub(port, 'execute');
    await meterToastApi.start();
    expect(messageStub).to.not.be.called;
    expect(onConsumeCallbackFake).to.be.calledOnce;
    expect(self.console.error).to.not.be.called;
  });

  it('should close iframe on touchstart', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    await meterToastApi.start();
    const $body = win.document.body;
    expect($body.style.overflow).to.equal('hidden');
    const toastCloseRequest = new ToastCloseRequest();
    toastCloseRequest.setClose(true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION,
        true
      );
    await win.dispatchEvent(new Event('touchstart'));
    // next three should have no effect
    await win.dispatchEvent(new Event('scroll'));
    await win.dispatchEvent(new Event('click'));
    await win.dispatchEvent(new Event('mousedown'));
    expect(messageStub).to.be.calledOnce.calledWith(toastCloseRequest);
    expect(onConsumeCallbackFake).to.be.calledOnce;
  });

  it('should close iframe on mousedown', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));

    await meterToastApi.start();
    const $body = win.document.body;
    expect($body.style.overflow).to.equal('hidden');
    const toastCloseRequest = new ToastCloseRequest();
    toastCloseRequest.setClose(true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION,
        true
      );
    await win.dispatchEvent(new Event('mousedown'));
    // next three should have no effect
    await win.dispatchEvent(new Event('scroll'));
    await win.dispatchEvent(new Event('touchstart'));
    await win.dispatchEvent(new Event('click'));
    expect(messageStub).to.be.calledOnce.calledWith(toastCloseRequest);
    expect(onConsumeCallbackFake).to.be.calledOnce;
  });

  it('removeCloseEventListener should remove all event listeners', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    await meterToastApi.start();
    meterToastApi.removeCloseEventListener();
    await win.dispatchEvent(new Event('click'));
    await win.dispatchEvent(new Event('scroll'));
    await win.dispatchEvent(new Event('touchstart'));
    await win.dispatchEvent(new Event('mousedown'));
    expect(messageStub).to.not.be.called;
    const $body = win.document.body;
    expect($body.style.overflow).to.equal('visible');
  });

  it('should update desktop UI for loading screen', async () => {
    const iframeArgs = meterToastApi.activityPorts_.addDefaultArguments({
      isClosable: true,
      hasSubscriptionCallback: runtime
        .callbacks()
        .hasSubscribeRequestCallback(),
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/metertoastiframe?_=_',
        iframeArgs
      )
      .returns(Promise.resolve(port));
    await meterToastApi.start();

    const element = runtime
      .dialogManager()
      .getDialog()
      .getLoadingView()
      .getElement();
    expect(getStyle(element, 'width')).to.equal(MINIMIZED_IFRAME_SIZE);
    expect(getStyle(element, 'margin')).to.equal('auto');
  });

  it('should update box shadow for iframe on mobile', async () => {
    const iframeArgs = meterToastApi.activityPorts_.addDefaultArguments({
      isClosable: true,
      hasSubscriptionCallback: runtime
        .callbacks()
        .hasSubscribeRequestCallback(),
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/metertoastiframe?_=_',
        iframeArgs
      )
      .returns(Promise.resolve(port));
    await meterToastApi.start();
    const element = runtime.dialogManager().getDialog().getElement();
    expect(getStyle(element, 'box-shadow')).to.equal(IFRAME_BOX_SHADOW);
  });

  it('isMobile_ works as expected', async () => {
    let window = {
      navigator: {
        userAgent: 'Inception 1.4 (iPhone; iPhone OS 4.3.1; en_US)',
      },
    };
    let run = new ConfiguredRuntime(Object.assign({}, win, window), pageConfig);
    meterToastApi = new MeterToastApi(run);
    expect(meterToastApi.isMobile_()).to.be.true;

    window = {
      navigator: {
        userAgent:
          'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1',
      },
    };
    run = new ConfiguredRuntime(Object.assign({}, win, window), pageConfig);
    meterToastApi = new MeterToastApi(run);
    expect(meterToastApi.isMobile_()).to.be.false;
  });
});
