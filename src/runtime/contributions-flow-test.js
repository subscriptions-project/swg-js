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

import {ActivityPort} from '../components/activities';
import {
  AlreadySubscribedResponse,
  EntitlementsResponse,
  SkuSelectedResponse,
} from '../proto/api_messages';
import {ClientConfig} from '../model/client-config';
import {ConfiguredRuntime} from './runtime';
import {ContributionsFlow} from './contributions-flow';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from './pay-flow';
import {ProductType} from '../api/subscriptions';

describes.realWin('ContributionsFlow', {}, (env) => {
  let win;
  let contributionsFlow;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let port;
  let messageMap;
  let dialogManagerMock;

  beforeEach(() => {
    win = env.win;
    messageMap = {};
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    contributionsFlow = new ContributionsFlow(runtime, {'isClosable': true});
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    sandbox.stub(port, 'on').callsFake(function (ctor, cb) {
      const messageType = new ctor();
      const messageLabel = messageType.label();
      messageMap[messageLabel] = cb;
    });
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    dialogManagerMock.verify();
  });

  it('has valid ContributionsFlow constructed with a list', async () => {
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/contributionsiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          'productType': ProductType.UI_CONTRIBUTION,
          list: 'other',
          skus: null,
          isClosable: true,
          supportsEventManager: true,
        }
      )
      .resolves(port);
    await contributionsFlow.start();
  });

  it('allows non-closable dialogs', async () => {
    const isClosable = false;
    contributionsFlow = new ContributionsFlow(runtime, {
      isClosable,
      list: 'other',
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/contributionsiframe?_=_',
        {
          isClosable,
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          'productType': ProductType.UI_CONTRIBUTION,
          list: 'other',
          skus: null,
          supportsEventManager: true,
        }
      )
      .resolves(port);
    await contributionsFlow.start();
  });

  it('has valid ContributionsFlow constructed with skus', async () => {
    contributionsFlow = new ContributionsFlow(runtime, {
      skus: ['sku1', 'sku2'],
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/contributionsiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          'productType': ProductType.UI_CONTRIBUTION,
          list: 'default',
          skus: ['sku1', 'sku2'],
          isClosable: true,
          supportsEventManager: true,
        }
      )
      .resolves(port);
    await contributionsFlow.start();
  });

  it('sends an empty EntitlementsResponse to show "no contribution found" toast on Activity iFrame view', async () => {
    contributionsFlow = new ContributionsFlow(runtime, {
      skus: ['sku1', 'sku2'],
    });

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/contributionsiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          'productType': ProductType.UI_CONTRIBUTION,
          list: 'default',
          skus: ['sku1', 'sku2'],
          isClosable: true,
          supportsEventManager: true,
        }
      )
      .resolves(port);
    // ContributionsFlow needs to start first in order to have a valid ActivityIframeView
    await contributionsFlow.start();

    const activityIframeView =
      await contributionsFlow.activityIframeViewPromise_;
    const activityIframeViewMock = sandbox.mock(activityIframeView);
    activityIframeViewMock
      .expects('execute')
      .withExactArgs(new EntitlementsResponse())
      .once();

    await contributionsFlow.showNoEntitlementFoundToast();

    activityIframeViewMock.verify();
  });

  it('has valid ContributionsFlow constructed, routed to the new contributions iframe', async () => {
    sandbox
      .stub(runtime.clientConfigManager(), 'getClientConfig')
      .resolves(new ClientConfig({useUpdatedOfferFlows: true}));
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/contributionoffersiframe?_=_&publicationId=pub1',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          'productType': ProductType.UI_CONTRIBUTION,
          list: 'other',
          skus: null,
          isClosable: true,
          supportsEventManager: true,
        }
      )
      .resolves(port);
    await contributionsFlow.start();
  });

  it('constructs valid ContributionsFlow with forced language', async () => {
    const clientConfigManager = runtime.clientConfigManager();
    sandbox
      .stub(clientConfigManager, 'getClientConfig')
      .resolves(new ClientConfig({useUpdatedOfferFlows: true}));
    sandbox.stub(clientConfigManager, 'shouldForceLangInIframes').returns(true);
    sandbox.stub(clientConfigManager, 'getLanguage').returns('fr-CA');
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/contributionoffersiframe?_=_&hl=fr-CA&publicationId=pub1',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          productType: ProductType.UI_CONTRIBUTION,
          list: 'other',
          skus: null,
          isClosable: true,
          supportsEventManager: true,
        }
      )
      .resolves(port);
    await contributionsFlow.start();
  });

  it('start should not show contributions if predicates disable', async () => {
    sandbox.stub(runtime.clientConfigManager(), 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: true,
        uiPredicates: {canDisplayAutoPrompt: false},
      })
    );
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    callbacksMock.expects('triggerFlowStarted').never();

    await contributionsFlow.start();
  });

  it('start should show contributions if predicates enable', async () => {
    sandbox.stub(runtime.clientConfigManager(), 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: true,
        uiPredicates: {canDisplayAutoPrompt: true},
      })
    );
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    callbacksMock.expects('triggerFlowStarted').once();

    activitiesMock.expects('openIframe').resolves(port);

    await contributionsFlow.start();
  });

  it('opens dialog without dialog config when useUpdatedOfferFlows=false', async () => {
    sandbox.stub(runtime.clientConfigManager(), 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: false,
        uiPredicates: {canDisplayAutoPrompt: true},
      })
    );
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    dialogManagerMock
      .expects('openView')
      .withExactArgs(sandbox.match.any, false, /* dialogConfig */ {})
      .once();
    await contributionsFlow.start();
  });

  it('opens dialog with scrolling disabled when useUpdatedOfferFlows=true', async () => {
    sandbox.stub(runtime.clientConfigManager(), 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: true,
        uiPredicates: {canDisplayAutoPrompt: true},
      })
    );
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    dialogManagerMock
      .expects('openView')
      .withExactArgs(
        sandbox.match.any,
        false,
        sandbox.match({shouldDisableBodyScrolling: true})
      )
      .once();
    await contributionsFlow.start();
  });

  it('opens dialog with scrolling enabled when useUpdatedOfferFlows=false and allowScroll=true', async () => {
    const clientConfigManager = runtime.clientConfigManager();
    sandbox.stub(clientConfigManager, 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: false,
        uiPredicates: {canDisplayAutoPrompt: true},
      })
    );
    sandbox.stub(clientConfigManager, 'shouldAllowScroll').returns(true);
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    dialogManagerMock
      .expects('openView')
      .withExactArgs(sandbox.match.any, false, /* dialogConfig */ {})
      .once();
    await contributionsFlow.start();
  });

  it('opens dialog with scrolling enabled when useUpdatedOfferFlows=true and allowScroll=true', async () => {
    const clientConfigManager = runtime.clientConfigManager();
    sandbox.stub(clientConfigManager, 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: true,
        uiPredicates: {canDisplayAutoPrompt: true},
      })
    );
    sandbox.stub(clientConfigManager, 'shouldAllowScroll').returns(true);
    contributionsFlow = new ContributionsFlow(runtime, {list: 'other'});
    dialogManagerMock
      .expects('openView')
      .withExactArgs(sandbox.match.any, false, /* dialogConfig */ {})
      .once();
    await contributionsFlow.start();
  });

  it('activates pay, login', async () => {
    const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const nativeStub = sandbox.stub(
      runtime.callbacks(),
      'triggerSubscribeRequest'
    );
    activitiesMock.expects('openIframe').resolves(port);

    await contributionsFlow.start();
    let callback = messageMap['SkuSelectedResponse'];
    expect(callback).to.not.be.null;
    // Unrelated message.
    expect(payStub).to.not.be.called;
    expect(loginStub).to.not.be.called;
    expect(nativeStub).to.not.be.called;
    const skuSelected = new SkuSelectedResponse();
    skuSelected.setSku('sku1');
    // Pay message.
    callback(skuSelected);
    expect(payStub).to.be.calledOnce;
    expect(loginStub).to.not.be.called;
    expect(nativeStub).to.not.be.called;
    // Login message.
    callback = messageMap['AlreadySubscribedResponse'];
    const response = new AlreadySubscribedResponse();
    response.setSubscriberOrMember(true);
    response.setLinkRequested(false);
    callback(response);
    expect(loginStub).to.be.calledOnce.calledWithExactly({
      linkRequested: false,
    });
    expect(payStub).to.be.calledOnce; // Didn't change.
    expect(nativeStub).to.not.be.called;
  });

  it('activates login with linking', async () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').resolves(port);

    await contributionsFlow.start();
    const response = new AlreadySubscribedResponse();
    response.setSubscriberOrMember(true);
    response.setLinkRequested(true);
    const callback = messageMap[response.label()];
    callback(response);
    expect(loginStub).to.be.calledOnce.calledWithExactly({
      linkRequested: true,
    });
  });
});
