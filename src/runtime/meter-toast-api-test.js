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
import {ConfiguredRuntime} from './runtime';
import {MeterToastApi} from './meter-toast-api';
import {PageConfig} from '../model/page-config';
import {
  ToastCloseRequest,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';

describes.realWin('MeterToastApi', {}, (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let messageMap;
  let meterToastApi;
  let port;
  let dialogManagerMock;
  const productId = 'pub1:label1';
  const publicationId = 'pub1';

  beforeEach(() => {
    win = env.win;
    messageMap = {};
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    meterToastApi = new MeterToastApi(runtime, {'isClosable': true});
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    sandbox.stub(port, 'on').callsFake((ctor, callback) => {
      const messageType = new ctor();
      const messageLabel = messageType.label();
      messageMap[messageLabel] = callback;
    });
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    dialogManagerMock.verify();
  });

  it('should start the flow correctly', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/metertoastiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId,
          productId,
          hasSubscriptionCallback: false,
        }
      )
      .returns(Promise.resolve(port));
    await meterToastApi.start();
  });

  it('should start the flow correctly with native subscribe request', async () => {
    runtime.callbacks().setOnSubscribeRequest(() => {});
    callbacksMock.expects('triggerFlowStarted').once();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/metertoastiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId,
          productId,
          hasSubscriptionCallback: true,
        }
      )
      .returns(Promise.resolve(port));
    meterToastApi = new MeterToastApi(runtime, {'isClosable': true});
    await meterToastApi.start();
  });

  it('should activate native subscribe request', async () => {
    const nativeStub = sandbox.stub(
      runtime.callbacks(),
      'triggerSubscribeRequest'
    );
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    const onConsumeCallbackFake = sandbox.fake();
    meterToastApi.setOnConsumeCallback(onConsumeCallbackFake);
    await meterToastApi.start();
    // Native message.
    const viewSubscriptionsResponse = new ViewSubscriptionsResponse();
    viewSubscriptionsResponse.setNative(true);
    const messageCallback = messageMap[viewSubscriptionsResponse.label()];
    messageCallback(viewSubscriptionsResponse);
    expect(nativeStub).to.be.calledOnce.calledWithExactly();
    expect(onConsumeCallbackFake).to.not.be.called;
  });

  it('should close iframe on different events', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    const onConsumeCallbackFake = sandbox.fake();
    meterToastApi.setOnConsumeCallback(onConsumeCallbackFake);
    await meterToastApi.start();
    const $body = win.document.body;
    expect($body.style.overflow).to.equal('hidden');
    const toastCloseRequest = new ToastCloseRequest();
    toastCloseRequest.setClose(true);
    await win.dispatchEvent(new Event('click'));
    await win.dispatchEvent(new Event('wheel'));
    await win.dispatchEvent(new Event('touchstart'));
    await win.dispatchEvent(new Event('mousedown'));
    expect(messageStub).to.be.callCount(4).calledWith(toastCloseRequest);
    expect(onConsumeCallbackFake).to.be.callCount(4);
  });

  it('removeCloseEventListener should remove all event listeners', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    await meterToastApi.start();
    meterToastApi.removeCloseEventListener();
    await win.dispatchEvent(new Event('click'));
    await win.dispatchEvent(new Event('wheel'));
    await win.dispatchEvent(new Event('touchstart'));
    await win.dispatchEvent(new Event('mousedown'));
    expect(messageStub).to.not.be.called;
    const $body = win.document.body;
    expect($body.style.overflow).to.equal('visible');
  });
});
