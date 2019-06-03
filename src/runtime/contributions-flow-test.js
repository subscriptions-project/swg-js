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

import {ActivityIframePort} from '../model/activities';
import {ConfiguredRuntime} from './runtime';
import {
  ContributionsFlow,
} from './contributions-flow';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from './pay-flow';
import {ProductType} from '../api/subscriptions';
import * as sinon from 'sinon';
import {Dialog} from '../components/dialog';
import {GlobalDoc} from '../model/doc';

describes.realWin('ContributionsFlow', {}, env => {
  let win;
  let contributionsFlow;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let port;
  let dialog;
  let messageCallback;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    contributionsFlow = new ContributionsFlow(runtime, {'isClosable': true});
    dialog = new Dialog(new GlobalDoc(win), {height: '100px'});
    port = new ActivityIframePort(dialog.getElement(), '/hello');
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    messageCallback = undefined;
    sandbox.stub(port, 'onMessageDeprecated', callback => {
      messageCallback = callback;
    });
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
  });

  it('should have valid ContributionsFlow constructed with a list', () => {
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/contributionsiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          'productType': ProductType.UI_CONTRIBUTION,
          list: 'other',
          skus: null,
          isClosable: true,
        })
        .returns(Promise.resolve(port));
    return contributionsFlow.start();
  });

  it('should have valid ContributionsFlow constructed with skus', () => {
    contributionsFlow =
        new ContributionsFlow(runtime, {skus: ['sku1', 'sku2']});
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/contributionsiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          'productType': ProductType.UI_CONTRIBUTION,
          list: 'default',
          skus: ['sku1', 'sku2'],
          isClosable: true,
        })
        .returns(Promise.resolve(port));
    return contributionsFlow.start();
  });

  it('should activate pay, login', () => {
    const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const nativeStub = sandbox.stub(
        runtime.callbacks(), 'triggerSubscribeRequest');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return contributionsFlow.start().then(() => {
      // Unrelated message.
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
      messageCallback({'alreadyMember': true});
      expect(loginStub).to.be.calledOnce
          .calledWithExactly({linkRequested: false});
      expect(payStub).to.be.calledOnce;  // Dind't change.
      expect(nativeStub).to.not.be.called;
    });
  });

  it('should activate login with linking', () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return contributionsFlow.start().then(() => {
      messageCallback({
        'alreadyMember': true,
        'linkRequested': true,
      });
      expect(loginStub).to.be.calledOnce
          .calledWithExactly({linkRequested: true});
    });
  });
});
