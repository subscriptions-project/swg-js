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

import {
    ActivityPort,
  } from 'web-activities/activity-ports';
import {ConfiguredRuntime} from './runtime';
import {
  SwgOffersFlow,
} from './swg-offers-flow';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from './pay-flow';
import * as sinon from 'sinon';


describes.realWin('SwgOffersFlow', {}, env => {
  let win;
  let offersFlow;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let port;
  let messageCallback;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    offersFlow = new SwgOffersFlow(runtime, {'isClosable': false});
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    messageCallback = undefined;
    sandbox.stub(port, 'onMessage', callback => {
      messageCallback = callback;
    });
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
  });

  it('should have valid OffersFlow constructed', () => {
    callbacksMock.expects('triggerFlowStarted')
        .withExactArgs('showOffers')
        .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          list: 'default',
          skus: null,
          isClosable: false,
        })
        .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should trigger on cancel', () => {
    callbacksMock.expects('triggerFlowStarted')
        .withExactArgs('showOffers')
        .once();
    callbacksMock.expects('triggerFlowCanceled')
        .withExactArgs('showOffers')
        .once();
    port.acceptResult = () => Promise.reject(
        new DOMException('cancel', 'AbortError'));
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          list: 'default',
          skus: null,
          isClosable: false,
        })
        .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should have valid OffersFlow constructed with a list', () => {
    offersFlow = new SwgOffersFlow(runtime, {list: 'other'});
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          list: 'other',
          skus: null,
          isClosable: false,
        })
        .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should have valid OffersFlow constructed with skus', () => {
    offersFlow = new SwgOffersFlow(runtime, {skus: ['sku1', 'sku2']});
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          list: 'default',
          skus: ['sku1', 'sku2'],
          isClosable: false,
        })
        .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should request native offers', () => {
    runtime.callbacks().setOnSubscribeRequest(function() {});
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: true,
          list: 'default',
          skus: null,
          isClosable: false,
        })
        .returns(Promise.resolve(port));
    offersFlow = new SwgOffersFlow(runtime);
    return offersFlow.start();
  });

  it('should activate pay, login and native offers', () => {
    const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const nativeStub = sandbox.stub(
        runtime.callbacks(), 'triggerSubscribeRequest');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return offersFlow.start().then(() => {
      // Unrlated message.
      messageCallback({});
      expect(payStub).to.not.be.called;
      expect(loginStub).to.not.be.called;
      expect(nativeStub).to.not.be.called;
      // Pay message.
      messageCallback({'sku': 'sku1'});
      expect(payStub).to.be.calledOnce;
      expect(loginStub).to.not.be.called;
      expect(nativeStub).to.not.be.called;
      // Login message.
      messageCallback({'alreadySubscribed': true});
      expect(loginStub).to.be.calledOnce
          .calledWithExactly({linkRequested: false});
      expect(payStub).to.be.calledOnce;  // Dind't change.
      expect(nativeStub).to.not.be.called;
      // Native message.
      messageCallback({'native': true});
      expect(nativeStub).to.be.calledOnce.calledWithExactly();
      expect(loginStub).to.be.calledOnce;  // Dind't change.
      expect(payStub).to.be.calledOnce;  // Dind't change.
    });
  });

  it('should activate login with linking', () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return offersFlow.start().then(() => {
      messageCallback({
        'alreadySubscribed': true,
        'linkRequested': true,
      });
      expect(loginStub).to.be.calledOnce
          .calledWithExactly({linkRequested: true});
    });
  });
});

