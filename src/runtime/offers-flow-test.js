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

import {ActivityResult} from 'web-activities/activity-ports';
import {ActivityPort} from '../components/activities';
import {AnalyticsEvent} from '../proto/api_messages';
import {acceptPortResultData} from './../utils/activity-utils';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {AbbrvOfferFlow, OffersFlow, SubscribeOptionFlow} from './offers-flow';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from './pay-flow';
import {ProductType} from '../api/subscriptions';
import {
  SkuSelectedResponse,
  AlreadySubscribedResponse,
  ViewSubscriptionsResponse,
  SubscribeResponse,
} from '../proto/api_messages';

describes.realWin('OffersFlow', {}, env => {
  let win;
  let offersFlow;
  let runtime;
  let activitiesMock;
  let eventManagerMock;
  let callbacksMock;
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
    eventManagerMock.verify();
  });

  it('should have valid OffersFlow constructed', () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showOffers')
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: null,
          isClosable: false,
        }
      )
      .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should trigger on cancel', () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showOffers')
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
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: null,
          isClosable: false,
        }
      )
      .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should have valid OffersFlow constructed with a list', () => {
    offersFlow = new OffersFlow(runtime, {list: 'other'});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'other',
          skus: null,
          isClosable: false,
        }
      )
      .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should have valid OffersFlow constructed with skus', () => {
    offersFlow = new OffersFlow(runtime, {skus: ['sku1', 'sku2']});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: ['sku1', 'sku2'],
          isClosable: false,
        }
      )
      .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should have valid OffersFlow constructed with skus and oldSku', () => {
    offersFlow = new OffersFlow(runtime, {
      skus: ['sku1', 'sku2'],
      oldSku: 'old_sku',
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: ['sku1', 'sku2'],
          oldSku: 'old_sku',
          isClosable: false,
        }
      )
      .returns(Promise.resolve(port));
    return offersFlow.start();
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

  it('should remove oldSku if skus contains it', () => {
    offersFlow = new OffersFlow(runtime, {
      skus: ['sku1', 'sku2', 'sku3'],
      oldSku: 'sku1',
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: false,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: ['sku2', 'sku3'],
          oldSku: 'sku1',
          isClosable: false,
        }
      )
      .returns(Promise.resolve(port));
    return offersFlow.start();
  });

  it('should auto-redirect to payments if only one update option given', () => {
    const payClientMock = sandbox.mock(runtime.payClient());
    payClientMock.expects('start').once();
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('subscribe', {
        skuId: 'sku2',
        oldSku: 'sku1',
        replaceSkuProrationMode: undefined,
      })
      .once();
    offersFlow = new OffersFlow(runtime, {
      skus: ['sku1', 'sku2'],
      oldSku: 'sku1',
    });
    activitiesMock.expects('openIframe').never();
    payClientMock.verify();
    return offersFlow.start();
  });

  it('should request native offers', () => {
    runtime.callbacks().setOnSubscribeRequest(function() {});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/offersiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          showNative: true,
          productType: ProductType.SUBSCRIPTION,
          list: 'default',
          skus: null,
          isClosable: false,
        }
      )
      .returns(Promise.resolve(port));
    offersFlow = new OffersFlow(runtime);
    return offersFlow.start();
  });

  it('should activate pay, login and native offers', () => {
    const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const nativeStub = sandbox.stub(
      runtime.callbacks(),
      'triggerSubscribeRequest'
    );
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return offersFlow.start().then(() => {
      // Unrlated message.
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
      expect(payStub).to.be.calledOnce; // Dind't change.
      expect(nativeStub).to.not.be.called;
      // Native message.
      const viewSubscriptionsResponse = new ViewSubscriptionsResponse();
      viewSubscriptionsResponse.setNative(true);
      messageCallback = messageMap[viewSubscriptionsResponse.label()];
      messageCallback(viewSubscriptionsResponse);
      expect(nativeStub).to.be.calledOnce.calledWithExactly();
      expect(loginStub).to.be.calledOnce; // Dind't change.
      expect(payStub).to.be.calledOnce; // Dind't change.
    });
  });

  it('should activate login with linking', () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return offersFlow.start().then(() => {
      const response = new AlreadySubscribedResponse();
      response.setSubscriberOrMember(true);
      response.setLinkRequested(true);
      messageCallback = messageMap[response.label()];
      messageCallback(response);
      expect(loginStub).to.be.calledOnce.calledWithExactly({
        linkRequested: true,
      });
    });
  });

  it('should log IMPRESSION_OFFERS on start', () => {
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_OFFERS);
    offersFlow.start();
  });
});

describes.realWin('SubscribeOptionFlow', {}, env => {
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

  it('should have valid SubscribeOptionFlow constructed', () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showSubscribeOption')
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
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
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    return offersFlow.start();
  });

  it('should report cancel', () => {
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
        sandbox.match(arg => arg.tagName == 'IFRAME'),
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
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    return offersFlow.start();
  });

  it('should propagate list args', () => {
    offersFlow = new SubscribeOptionFlow(runtime, {
      list: 'other',
      skus: ['sku1'],
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
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
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    return offersFlow.start();
  });

  it('should trigger offers flow when accepted', () => {
    const offersStartStub = sandbox.stub(OffersFlow.prototype, 'start');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    expect(offersStartStub).to.not.be.called;
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_VIEW_OFFERS, true);
    return offersFlow.start().then(() => {
      expect(offersStartStub).to.not.be.called;
      // Subscribe message.
      const response = new SubscribeResponse();
      response.setSubscribe(true);
      messageCallback = messageMap[response.label()];
      messageCallback(response);
      expect(offersStartStub).to.be.calledOnce;
    });
  });

  it('should trigger offers flow with options', () => {
    const options = {list: 'other'};
    const optionFlow = new SubscribeOptionFlow(runtime, options);
    let offersFlow;
    sandbox.stub(OffersFlow.prototype, 'start').callsFake(function() {
      offersFlow = this;
      return Promise.resolve();
    });
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_VIEW_OFFERS, true);
    return optionFlow.start().then(() => {
      const response = new SubscribeResponse();
      response.setSubscribe(true);
      messageCallback = messageMap[response.label()];
      messageCallback(response);
      expect(offersFlow.activityIframeView_.args_['list']).to.equal('other');
    });
  });
});

describes.realWin('AbbrvOfferFlow', {}, env => {
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
    eventManagerMock.verify();
  });

  it('should have valid AbbrvOfferFlow constructed', () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('showAbbrvOffer')
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
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
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    return abbrvOfferFlow.start();
  });

  it('should have valid AbbrvOfferFlow constructed w/native', () => {
    runtime.callbacks().setOnSubscribeRequest(function() {});
    abbrvOfferFlow = new AbbrvOfferFlow(runtime);
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
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
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    return abbrvOfferFlow.start();
  });

  it('should report cancel', () => {
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
        sandbox.match(arg => arg.tagName == 'IFRAME'),
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
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    return abbrvOfferFlow.start();
  });

  it('should propagate list args', () => {
    abbrvOfferFlow = new AbbrvOfferFlow(runtime, {
      list: 'other',
      skus: ['sku1'],
    });
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
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
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    return abbrvOfferFlow.start();
  });

  it('should trigger login flow for a subscribed user with linking', () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ALREADY_SUBSCRIBED, true);
    return abbrvOfferFlow.start().then(() => {
      const response = new AlreadySubscribedResponse();
      response.setLinkRequested(true);
      response.setSubscriberOrMember(true);
      messageCallback = messageMap['AlreadySubscribedResponse'];
      messageCallback(response);
      expect(loginStub).to.be.calledOnce.calledWithExactly({
        linkRequested: true,
      });
    });
  });

  it('should trigger login flow for subscibed user without linking', () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ALREADY_SUBSCRIBED, true);
    return abbrvOfferFlow.start().then(() => {
      const response = new AlreadySubscribedResponse();
      response.setSubscriberOrMember(true);
      response.setLinkRequested(false);
      messageCallback = messageMap[response.label()];
      messageCallback(response);
      expect(loginStub).to.be.calledOnce.calledWithExactly({
        linkRequested: false,
      });
    });
  });

  it('should trigger offers flow when requested', () => {
    const offersStartStub = sandbox.stub(OffersFlow.prototype, 'start');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
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
    return abbrvOfferFlow.start().then(() => {
      return resultPromise.then(() => {
        expect(offersStartStub).to.be.calledOnce;
      });
    });
  });

  it('should not trigger offers flow when cancelled', () => {
    const offersStartStub = sandbox.stub(OffersFlow.prototype, 'start');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    expect(offersStartStub).to.not.be.called;
    const error = new Error();
    error.name = 'AbortError';
    sandbox.stub(port, 'acceptResult').callsFake(() => {
      return Promise.reject(error);
    });
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
      );
    return abbrvOfferFlow.start().then(() => {
      return acceptPortResultData(port, 'https://example.com', true, true).then(
        () => {
          throw new Error('must have failed');
        },
        reason => {
          expect(reason.name).to.equal('AbortError');
        }
      );
      expect(offersStartStub).to.not.be.called;
    });
  });

  it('should trigger offers flow with options', () => {
    const options = {list: 'other'};
    const optionFlow = new AbbrvOfferFlow(runtime, options);
    let offersFlow;
    sandbox.stub(OffersFlow.prototype, 'start').callsFake(function() {
      offersFlow = this;
      return Promise.resolve();
    });
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
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
    return optionFlow.start().then(() => {
      return resultPromise.then(() => {
        expect(offersFlow.activityIframeView_.args_['list']).to.equal('other');
      });
    });
  });
});
