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

import {AbbrvOfferFlow, OffersFlow, SubscribeOptionFlow} from './offers-flow';
import {ActivityPort} from '../components/activities';
import {ActivityResult} from 'web-activities/activity-ports';
import {
  AlreadySubscribedResponse,
  EntitlementsResponse,
  SkuSelectedResponse,
  SubscribeResponse,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {AnalyticsEvent} from '../proto/api_messages';
import {ClientConfig} from '../model/client-config';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from './pay-flow';
import {ProductType} from '../api/subscriptions';
import {acceptPortResultData} from './../utils/activity-utils';

const SHOW_OFFERS_ARGS = {
  skus: ['*'],
  source: 'SwG',
};

describes.realWin('OffersFlow', {}, (env) => {
  let win;
  let offersFlow;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let dialogManagerMock;
  let eventManagerMock;
  let pageConfig;
  let port;
  let messageCallback;
  let messageMap;

  beforeEach(() => {
    win = env.win;
    messageMap = {};
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    const eventManager = new ClientEventManager(Promise.resolve());
    eventManagerMock = sandbox.mock(eventManager);
    sandbox.stub(runtime, 'eventManager').callsFake(() => eventManager);
    offersFlow = new OffersFlow(runtime, {'isClosable': false});
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
    eventManagerMock.verify();
  });

  it('should have valid OffersFlow constructed', async () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showOffers', SHOW_OFFERS_ARGS)
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: null,
          isClosable: false,
        })
      )
      .resolves(port);
    await offersFlow.start();
  });

  it('should have valid OffersFlow constructed, routed to the new offers iframe', async () => {
    sandbox
      .stub(runtime.clientConfigManager(), 'getClientConfig')
      .resolves(new ClientConfig({useUpdatedOfferFlows: true}));
    offersFlow = new OffersFlow(runtime, {'isClosable': false});
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showOffers', SHOW_OFFERS_ARGS)
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/subscriptionoffersiframe?_=_&publicationId=pub1',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: null,
          isClosable: false,
        })
      )
      .resolves(port);
    await offersFlow.start();
  });

  it('constructs valid OffersFlow with forced language', async () => {
    const clientConfigManager = runtime.clientConfigManager();
    sandbox
      .stub(clientConfigManager, 'getClientConfig')
      .resolves(new ClientConfig({useUpdatedOfferFlows: true}));
    sandbox.stub(clientConfigManager, 'shouldForceLangInIframes').returns(true);
    sandbox.stub(clientConfigManager, 'getLanguage').returns('fr-CA');
    offersFlow = new OffersFlow(runtime, {'isClosable': false});
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showOffers', SHOW_OFFERS_ARGS)
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/subscriptionoffersiframe?_=_&hl=fr-CA&publicationId=pub1',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: null,
          isClosable: false,
        })
      )
      .resolves(port);
    await offersFlow.start();
  });

  it('start should not show offers if predicates disable', async () => {
    sandbox.stub(runtime.clientConfigManager(), 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: true,
        uiPredicates: {canDisplayAutoPrompt: false},
      })
    );
    offersFlow = new OffersFlow(runtime, {'isClosable': false});
    callbacksMock.expects('triggerFlowStarted').never();

    await offersFlow.start();
  });

  it('start should show offers if predicates enable', async () => {
    sandbox.stub(runtime.clientConfigManager(), 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: true,
        uiPredicates: {canDisplayAutoPrompt: true},
      })
    );
    offersFlow = new OffersFlow(runtime, {'isClosable': false});
    callbacksMock.expects('triggerFlowStarted').once();

    activitiesMock.expects('openIframe').resolves(port);

    await offersFlow.start();
  });

  it('opens dialog without desktop config when useUpdatedOfferFlows=false', async () => {
    sandbox.stub(runtime.clientConfigManager(), 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: false,
      })
    );
    offersFlow = new OffersFlow(runtime, {'isClosable': false});
    dialogManagerMock
      .expects('openView')
      .withExactArgs(sandbox.match.any, false, {})
      .once();
    await offersFlow.start();
  });

  it('opens dialog with desktop config when useUpdatedOfferFlows=true', async () => {
    sandbox.stub(runtime.clientConfigManager(), 'getClientConfig').resolves(
      new ClientConfig({
        useUpdatedOfferFlows: true,
      })
    );
    offersFlow = new OffersFlow(runtime, {'isClosable': false});
    dialogManagerMock
      .expects('openView')
      .withExactArgs(sandbox.match.any, false, {
        desktopConfig: {isCenterPositioned: true, supportsWideScreen: true},
      })
      .once();
    await offersFlow.start();
  });

  it('should trigger on cancel', async () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showOffers', SHOW_OFFERS_ARGS)
      .once();
    callbacksMock
      .expects('triggerFlowCanceled')
      .withExactArgs('showOffers')
      .once();
    port.acceptResult = () =>
      Promise.reject(new DOMException('cancel', 'AbortError'));
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: null,
          isClosable: false,
        })
      )
      .resolves(port);
    await offersFlow.start();
  });

  it('should have valid OffersFlow constructed with a list', async () => {
    offersFlow = new OffersFlow(runtime, {list: 'other'});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'other',
          skus: null,
          isClosable: false,
        })
      )
      .resolves(port);
    await offersFlow.start();
  });

  it('should have valid OffersFlow constructed with skus', async () => {
    offersFlow = new OffersFlow(runtime, {skus: ['sku1', 'sku2']});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: ['sku1', 'sku2'],
          isClosable: false,
        })
      )
      .resolves(port);
    await offersFlow.start();
  });

  it('should have valid OffersFlow constructed with skus and oldSku', async () => {
    offersFlow = new OffersFlow(runtime, {
      skus: ['sku1', 'sku2'],
      oldSku: 'old_sku',
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: ['sku1', 'sku2'],
          oldSku: 'old_sku',
          isClosable: false,
        })
      )
      .resolves(port);
    await offersFlow.start();
  });

  it('should throw error if calling OffersFlow with oldSku but no skus', () => {
    try {
      offersFlow = new OffersFlow(runtime, {
        oldSku: 'old_sku',
      });
    } catch (err) {
      expect(err)
        .to.be.an.instanceOf(Error)
        .with.property('message', 'Need a sku list if old sku is provided!');
    }
  });

  it('should remove oldSku if skus contains it', async () => {
    offersFlow = new OffersFlow(runtime, {
      skus: ['sku1', 'sku2', 'sku3'],
      oldSku: 'sku1',
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: ['sku2', 'sku3'],
          oldSku: 'sku1',
          isClosable: false,
        })
      )
      .resolves(port);
    await offersFlow.start();
  });

  it('should auto-redirect to payments if only one update option given', async () => {
    const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
    offersFlow = new OffersFlow(runtime, {
      skus: ['sku1', 'sku2'],
      oldSku: 'sku1',
    });
    activitiesMock.expects('openIframe').never();
    expect(payStub).to.be.calledOnce;
    await offersFlow.start();
  });

  it('should request native offers', async () => {
    runtime.callbacks().setOnSubscribeRequest(() => {});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        runtime.activities().addDefaultArguments({
          showNative: true,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: null,
          isClosable: false,
        })
      )
      .resolves(port);
    offersFlow = new OffersFlow(runtime);
    await offersFlow.start();
  });

  it('should activate pay, login and native offers', async () => {
    const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const nativeStub = sandbox.stub(
      runtime.callbacks(),
      'triggerSubscribeRequest'
    );
    activitiesMock.expects('openIframe').resolves(port);
    await offersFlow.start();

    // Unrelated message.
    expect(payStub).to.not.be.called;
    expect(loginStub).to.not.be.called;
    expect(nativeStub).to.not.be.called;
    const skuSelected = new SkuSelectedResponse();
    skuSelected.setSku('sku1');

    // Pay message.
    let messageCallback = messageMap[skuSelected.label()];
    messageCallback(skuSelected);
    expect(payStub).to.be.calledOnce;
    expect(loginStub).to.not.be.called;
    expect(nativeStub).to.not.be.called;

    // Login message.
    const response = new AlreadySubscribedResponse();
    response.setSubscriberOrMember(true);
    response.setLinkRequested(false);
    messageCallback = messageMap[response.label()];
    messageCallback(response);
    expect(loginStub).to.be.calledOnce.calledWithExactly({
      linkRequested: false,
    });
    expect(payStub).to.be.calledOnce; // Didn't change.
    expect(nativeStub).to.not.be.called;

    // Native message.
    const viewSubscriptionsResponse = new ViewSubscriptionsResponse();
    viewSubscriptionsResponse.setNative(true);
    messageCallback = messageMap[viewSubscriptionsResponse.label()];
    messageCallback(viewSubscriptionsResponse);
    expect(nativeStub).to.be.calledOnce.calledWithExactly();
    expect(loginStub).to.be.calledOnce; // Didn't change.
    expect(payStub).to.be.calledOnce; // Didn't change.
  });

  it('should activate login with linking and EntitlementsResponse', async () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').resolves(port);

    await offersFlow.start();
    const response = new AlreadySubscribedResponse();
    response.setSubscriberOrMember(true);
    response.setLinkRequested(true);
    messageCallback = messageMap[response.label()];
    messageCallback(response);
    expect(loginStub).to.be.calledOnce.calledWithExactly({
      linkRequested: true,
    });

    const entitlementsResponse = new EntitlementsResponse();
    entitlementsResponse.setJwt('abc');
    entitlementsResponse.setSwgUserToken('123');
    messageCallback = messageMap[response.label()];
    messageCallback(response);
  });

  it('should send an empty EntitlementsResponse to show "no subscription found" toast on Activity iFrame view', async () => {
    offersFlow = new OffersFlow(runtime, {skus: ['sku1', 'sku2']});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        runtime.activities().addDefaultArguments({
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: ['sku1', 'sku2'],
          isClosable: false,
        })
      )
      .resolves(port);
    // OffersFlow needs to start first in order to have a valid ActivityIframeView
    await offersFlow.start();

    const activityIframeView = await offersFlow.activityIframeViewPromise_;
    const activityIframeViewMock = sandbox.mock(activityIframeView);
    activityIframeViewMock
      .expects('execute')
      .withExactArgs(new EntitlementsResponse())
      .once();

    await offersFlow.showNoEntitlementFoundToast();

    activityIframeViewMock.verify();
  });
});

describes.realWin('SubscribeOptionFlow', {}, (env) => {
  let win;
  let offersFlow;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let port;
  let messageMap;
  let messageCallback;
  let eventManagerMock;

  beforeEach(() => {
    messageMap = {};
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    const eventManager = new ClientEventManager(Promise.resolve());
    eventManagerMock = sandbox.mock(eventManager);
    sandbox.stub(runtime, 'eventManager').callsFake(() => eventManager);
    offersFlow = new SubscribeOptionFlow(runtime);
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    sandbox.stub(port, 'on').callsFake((ctor, callback) => {
      const messageType = new ctor();
      const messageLabel = messageType.label();
      messageMap[messageLabel] = callback;
    });
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    eventManagerMock.verify();
  });

  it('should have valid SubscribeOptionFlow constructed', async () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showSubscribeOption')
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/optionsiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          list: 'default',
          skus: null,
          isClosable: true,
        }
      )
      .resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    await offersFlow.start();
  });

  it('should report cancel', async () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showSubscribeOption')
      .once();
    callbacksMock
      .expects('triggerFlowCanceled')
      .withExactArgs('showSubscribeOption')
      .once();
    port.acceptResult = () =>
      Promise.reject(new DOMException('cancel', 'AbortError'));
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/optionsiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          list: 'default',
          skus: null,
          isClosable: true,
        }
      )
      .resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    await offersFlow.start();
  });

  it('should propagate list args', async () => {
    offersFlow = new SubscribeOptionFlow(runtime, {
      list: 'other',
      skus: ['sku1'],
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/optionsiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          list: 'other',
          skus: ['sku1'],
          isClosable: true,
        }
      )
      .resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    await offersFlow.start();
  });

  it('should trigger offers flow when accepted', async () => {
    const offersStartStub = sandbox.stub(OffersFlow.prototype, 'start');
    activitiesMock.expects('openIframe').resolves(port);
    expect(offersStartStub).to.not.be.called;
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_VIEW_OFFERS, true);

    await offersFlow.start();
    expect(offersStartStub).to.not.be.called;
    // Subscribe message.
    const response = new SubscribeResponse();
    response.setSubscribe(true);
    messageCallback = messageMap[response.label()];
    messageCallback(response);
    expect(offersStartStub).to.be.calledOnce;
  });

  it('should trigger offers flow with options', async () => {
    const options = {list: 'other'};
    const optionFlow = new SubscribeOptionFlow(runtime, options);
    let offersFlow;
    sandbox.stub(OffersFlow.prototype, 'start').callsFake(function () {
      offersFlow = this;
      return Promise.resolve();
    });
    activitiesMock.expects('openIframe').resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_VIEW_OFFERS, true);

    await optionFlow.start();
    const response = new SubscribeResponse();
    response.setSubscribe(true);
    messageCallback = messageMap[response.label()];
    messageCallback(response);
    const activityIframeView = await offersFlow.activityIframeViewPromise_;
    expect(activityIframeView.args_['list']).to.equal('other');
  });
});

describes.realWin('AbbrvOfferFlow', {}, (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let abbrvOfferFlow;
  let port;
  let messageMap;
  let messageCallback;
  let eventManagerMock;
  let dialogManagerMock;

  beforeEach(() => {
    win = env.win;
    messageMap = {};
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    const eventManager = new ClientEventManager(Promise.resolve());
    eventManagerMock = sandbox.mock(eventManager);
    sandbox.stub(runtime, 'eventManager').callsFake(() => eventManager);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    abbrvOfferFlow = new AbbrvOfferFlow(runtime);
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.acceptResult = () => Promise.resolve();
    port.whenReady = () => Promise.resolve();
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
    eventManagerMock.verify();
  });

  it('should have valid AbbrvOfferFlow constructed', async () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showAbbrvOffer')
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/abbrvofferiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          list: 'default',
          skus: null,
          showNative: false,
          isClosable: true,
        }
      )
      .resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    await abbrvOfferFlow.start();
  });

  it('should have valid AbbrvOfferFlow constructed w/native', async () => {
    runtime.callbacks().setOnSubscribeRequest(function () {});
    abbrvOfferFlow = new AbbrvOfferFlow(runtime);
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/abbrvofferiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          list: 'default',
          skus: null,
          showNative: true,
          isClosable: true,
        }
      )
      .resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    await abbrvOfferFlow.start();
  });

  it('should report cancel', async () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showAbbrvOffer')
      .once();
    callbacksMock
      .expects('triggerFlowCanceled')
      .withExactArgs('showAbbrvOffer')
      .once();
    port.acceptResult = () =>
      Promise.reject(new DOMException('cancel', 'AbortError'));
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/abbrvofferiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          list: 'default',
          skus: null,
          showNative: false,
          isClosable: true,
        }
      )
      .resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    await abbrvOfferFlow.start();
  });

  it('should propagate list args', async () => {
    abbrvOfferFlow = new AbbrvOfferFlow(runtime, {
      list: 'other',
      skus: ['sku1'],
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/abbrvofferiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          list: 'other',
          skus: ['sku1'],
          showNative: false,
          isClosable: true,
        }
      )
      .resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    await abbrvOfferFlow.start();
  });

  it('should trigger login flow for a subscribed user with linking', async () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ALREADY_SUBSCRIBED, true);

    await abbrvOfferFlow.start();
    const response = new AlreadySubscribedResponse();
    response.setLinkRequested(true);
    response.setSubscriberOrMember(true);
    messageCallback = messageMap['AlreadySubscribedResponse'];
    messageCallback(response);
    expect(loginStub).to.be.calledOnce.calledWithExactly({
      linkRequested: true,
    });
  });

  it('should trigger login flow for subscibed user without linking', async () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ALREADY_SUBSCRIBED, true);

    await abbrvOfferFlow.start();
    const response = new AlreadySubscribedResponse();
    response.setSubscriberOrMember(true);
    response.setLinkRequested(false);
    messageCallback = messageMap[response.label()];
    messageCallback(response);
    expect(loginStub).to.be.calledOnce.calledWithExactly({
      linkRequested: false,
    });
  });

  it('should trigger offers flow when requested', async () => {
    const offersStartStub = sandbox.stub(OffersFlow.prototype, 'start');
    activitiesMock.expects('openIframe').resolves(port);
    expect(offersStartStub).to.not.be.called;
    const result = new ActivityResult(
      'OK',
      {'viewOffers': true},
      'MODE',
      'https://example.com',
      true,
      true
    );
    result.data = {'viewOffers': true};
    const resultPromise = Promise.resolve(result);
    sandbox.stub(port, 'acceptResult').callsFake(() => resultPromise);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_VIEW_OFFERS, true);

    await abbrvOfferFlow.start();
    await resultPromise;
    expect(offersStartStub).to.be.calledOnce;
  });

  it('should not trigger offers flow when cancelled', async () => {
    const offersStartStub = sandbox.stub(OffersFlow.prototype, 'start');
    activitiesMock.expects('openIframe').resolves(port);
    expect(offersStartStub).to.not.be.called;
    sandbox
      .stub(port, 'acceptResult')
      .callsFake(() =>
        Promise.reject(new DOMException('cancel', 'AbortError'))
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );

    await abbrvOfferFlow.start();

    await expect(
      acceptPortResultData(port, 'https://example.com', true, true)
    ).to.be.rejectedWith(/cancel/);
  });

  it('should trigger offers flow with options', async () => {
    const options = {list: 'other'};
    const optionFlow = new AbbrvOfferFlow(runtime, options);
    let offersFlow;
    sandbox.stub(OffersFlow.prototype, 'start').callsFake(function () {
      offersFlow = this;
      return Promise.resolve();
    });
    activitiesMock.expects('openIframe').resolves(port);
    const result = new ActivityResult(
      'OK',
      {'viewOffers': true},
      'MODE',
      'https://example.com',
      true,
      true
    );
    result.data = {'viewOffers': true};
    const resultPromise = Promise.resolve(result);
    sandbox.stub(port, 'acceptResult').callsFake(() => resultPromise);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_VIEW_OFFERS, true);

    await optionFlow.start();
    await resultPromise;
    const activityIframeView = await offersFlow.activityIframeViewPromise_;
    expect(activityIframeView.args_['list']).to.equal('other');
  });

  it('should trigger subscribe request and complete view', async () => {
    const options = {list: 'other'};
    const optionFlow = new AbbrvOfferFlow(runtime, options);
    activitiesMock.expects('openIframe').resolves(port);
    const result = new ActivityResult(
      'OK',
      {'native': true},
      'MODE',
      'https://example.com',
      true,
      true
    );
    result.data = {'native': true};
    const resultPromise = Promise.resolve(result);
    sandbox.stub(port, 'acceptResult').callsFake(() => resultPromise);
    callbacksMock.expects('triggerSubscribeRequest').withExactArgs().once();
    dialogManagerMock
      .expects('completeView')
      .withExactArgs(optionFlow.activityIframeView_)
      .once();

    await optionFlow.start();
  });
});
