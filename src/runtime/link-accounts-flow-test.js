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
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {
  AnalyticsEvent,
  LinkSaveTokenRequest,
  LinkingInfoResponse,
} from '../proto/api_messages';
import {ConfiguredRuntime} from './runtime';
import {Dialog} from '../components/dialog';
import {GlobalDoc} from '../model/doc';
import {
  LinkCompleteFlow,
  LinkSaveFlow,
  LinkbackFlow,
} from './link-accounts-flow';
import {PageConfig} from '../model/page-config';
import {createCancelError} from '../utils/errors';
import {tick} from '../../test/tick';

describes.realWin('LinkbackFlow', {}, (env) => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let dialogManagerMock;
  let triggerFlowStartSpy;
  let linkbackFlow;
  let receivedType;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:prod1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    receivedType = null;
    sandbox.stub(runtime.eventManager(), 'logSwgEvent').callsFake((type) => {
      receivedType = type;
    });
    linkbackFlow = new LinkbackFlow(runtime);
    triggerFlowStartSpy = sandbox.stub(
      runtime.callbacks(),
      'triggerFlowStarted'
    );
  });

  afterEach(() => {
    activitiesMock.verify();
  });

  it('should start correctly', () => {
    const popupWin = {};
    dialogManagerMock.expects('popupOpened').withExactArgs(popupWin).once();
    activitiesMock
      .expects('open')
      .withExactArgs(
        'swg-link',
        '$frontend$/swg/_/ui/v1/linkbackstart?_=_',
        '_blank',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'publicationId': 'pub1',
        },
        {}
      )
      .returns({targetWin: popupWin})
      .once();
    linkbackFlow.start();
    expect(receivedType).to.equal(AnalyticsEvent.IMPRESSION_LINK);
    expect(triggerFlowStartSpy).to.be.calledOnce.calledWithExactly(
      'linkAccount'
    );
  });

  it('should pass along ampReaderId param', () => {
    const popupWin = {};
    dialogManagerMock.expects('popupOpened').withExactArgs(popupWin).once();
    activitiesMock
      .expects('open')
      .withExactArgs(
        'swg-link',
        '$frontend$/swg/_/ui/v1/linkbackstart?_=_',
        '_blank',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'publicationId': 'pub1',
          'ampReaderId': 'ari1',
        },
        {}
      )
      .returns({targetWin: popupWin})
      .once();
    linkbackFlow.start({ampReaderId: 'ari1'});
    expect(receivedType).to.equal(AnalyticsEvent.IMPRESSION_LINK);
    expect(triggerFlowStartSpy).to.be.calledOnce.calledWithExactly(
      'linkAccount'
    );
  });

  it('should force redirect mode', () => {
    runtime.configure({windowOpenMode: 'redirect'});
    dialogManagerMock.expects('popupOpened').withExactArgs(undefined).once();
    activitiesMock
      .expects('open')
      .withExactArgs(
        'swg-link',
        '$frontend$/swg/_/ui/v1/linkbackstart?_=_',
        '_top',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'publicationId': 'pub1',
        },
        {}
      )
      .returns(undefined)
      .once();
    linkbackFlow.start();
    expect(receivedType).to.equal(AnalyticsEvent.IMPRESSION_LINK);
  });
});

describes.realWin('LinkCompleteFlow', {}, (env) => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let entitlementsManagerMock;
  let dialogManagerMock;
  let linkCompleteFlow;
  let triggerLinkProgressSpy, triggerLinkCompleteSpy, triggerFlowCancelSpy;
  let port;
  let eventManagerMock;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:prod1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    eventManagerMock = sandbox.mock(runtime.eventManager());
    linkCompleteFlow = new LinkCompleteFlow(runtime, {'index': '1'});
    triggerLinkProgressSpy = sandbox.stub(
      runtime.callbacks(),
      'triggerLinkProgress'
    );
    triggerLinkCompleteSpy = sandbox.stub(
      runtime.callbacks(),
      'triggerLinkComplete'
    );
    triggerFlowCancelSpy = sandbox.stub(
      runtime.callbacks(),
      'triggerFlowCanceled'
    );
  });

  afterEach(() => {
    activitiesMock.verify();
    entitlementsManagerMock.verify();
    eventManagerMock.verify();
  });

  it('should trigger on link response', async () => {
    dialogManagerMock.expects('popupClosed').once();
    let handler;
    activitiesMock
      .expects('onResult')
      .withExactArgs(
        'swg-link',
        sandbox.match((arg) => {
          handler = arg;
          return typeof arg == 'function';
        })
      )
      .once();
    entitlementsManagerMock.expects('blockNextNotification').once();
    LinkCompleteFlow.configurePending(runtime);
    expect(handler).to.exist;
    expect(triggerLinkProgressSpy).to.not.be.called;
    expect(triggerLinkCompleteSpy).to.not.be.called;

    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {'index': '1'},
      'IFRAME',
      '$frontend$',
      true,
      true
    );
    port.acceptResult = () => Promise.resolve(result);

    let startResolver;
    const startPromise = new Promise((resolve) => {
      startResolver = resolve;
    });
    let instance;
    const startStub = sandbox
      .stub(LinkCompleteFlow.prototype, 'start')
      .callsFake(function () {
        instance = this;
        startResolver();
      });

    handler(port);
    expect(triggerLinkProgressSpy).to.be.calledOnce.calledWithExactly();
    expect(triggerLinkCompleteSpy).to.not.be.called;

    await startPromise;
    expect(startStub).to.be.calledWithExactly();
    expect(instance.activityIframeView_.src_).to.contain('/u/1/');
    expect(triggerFlowCancelSpy).to.not.be.called;
  });

  it('should trigger on failed link response', async () => {
    dialogManagerMock.expects('popupClosed').once();
    let handler;
    activitiesMock
      .expects('onResult')
      .withExactArgs(
        'swg-link',
        sandbox.match((arg) => {
          handler = arg;
          return typeof arg == 'function';
        })
      )
      .once();
    entitlementsManagerMock.expects('blockNextNotification').once();
    LinkCompleteFlow.configurePending(runtime);
    expect(handler).to.exist;
    expect(triggerLinkProgressSpy).to.not.be.called;
    expect(triggerLinkCompleteSpy).to.not.be.called;
    expect(triggerFlowCancelSpy).to.not.be.called;

    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () =>
      Promise.reject(new DOMException('cancel', 'AbortError'));

    const startStub = sandbox.stub(LinkCompleteFlow.prototype, 'start');

    handler(port);
    expect(triggerLinkProgressSpy).to.be.calledOnce.calledWithExactly();
    expect(triggerLinkCompleteSpy).to.not.be.called;

    await tick(2);

    expect(triggerFlowCancelSpy).to.be.calledOnce;
    expect(startStub).to.not.be.called;
  });

  it('should default index to 0', async () => {
    dialogManagerMock.expects('popupClosed').once();
    linkCompleteFlow = new LinkCompleteFlow(runtime, {});
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();

    const activityResult = new ActivityResult(
      ActivityResultCode.OK,
      {},
      'IFRAME',
      '$frontend$',
      true,
      true
    );
    port.acceptResult = () => Promise.resolve(activityResult);

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/u/0/swg/_/ui/v1/linkconfirmiframe?_=_',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'productId': 'pub1:prod1',
          'publicationId': 'pub1',
        }
      )
      .returns(Promise.resolve(port))
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_GOOGLE_UPDATED, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_GOOGLE_UPDATED, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_GOOGLE_UPDATED_CLOSE, true);
    await linkCompleteFlow.start();
  });

  it('should trigger events and reset entitlements', async () => {
    dialogManagerMock.expects('popupClosed').once();
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    let resultResolver;
    const resultPromise = new Promise((resolve) => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/u/1/swg/_/ui/v1/linkconfirmiframe?_=_',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'productId': 'pub1:prod1',
          'publicationId': 'pub1',
        }
      )
      .returns(Promise.resolve(port))
      .once();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock.expects('reset').withExactArgs(true).once();
    entitlementsManagerMock
      .expects('unblockNextNotification')
      .withExactArgs()
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_GOOGLE_UPDATED, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_GOOGLE_UPDATED, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_GOOGLE_UPDATED_CLOSE, true);

    await linkCompleteFlow.start();
    expect(triggerLinkCompleteSpy).to.not.be.called;
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {success: true},
      'IFRAME',
      '$frontend$',
      true,
      true
    );
    resultResolver(result);

    await linkCompleteFlow.whenComplete();
    expect(triggerLinkCompleteSpy).to.be.calledOnce.calledWithExactly();
    expect(triggerLinkProgressSpy).to.not.be.called;
  });

  it('should push new entitlements when available', async () => {
    dialogManagerMock.expects('popupClosed').once();
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    let resultResolver;
    const resultPromise = new Promise((resolve) => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/u/1/swg/_/ui/v1/linkconfirmiframe?_=_',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'productId': 'pub1:prod1',
          'publicationId': 'pub1',
        }
      )
      .returns(Promise.resolve(port))
      .once();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    const order = [];
    entitlementsManagerMock
      .expects('reset')
      .withExactArgs(
        sandbox.match((arg) => {
          if (order.indexOf('reset') == -1) {
            order.push('reset');
          }
          return arg === true; // Expected positive.
        })
      )
      .once();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(
        sandbox.match((arg) => {
          if (order.indexOf('pushNextEntitlements') == -1) {
            order.push('pushNextEntitlements');
          }
          return arg === 'ENTITLEMENTS_JWT';
        })
      )
      .once();
    entitlementsManagerMock
      .expects('unblockNextNotification')
      .withExactArgs()
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_GOOGLE_UPDATED, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_GOOGLE_UPDATED, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_GOOGLE_UPDATED_CLOSE, true);

    await linkCompleteFlow.start();
    expect(triggerLinkCompleteSpy).to.not.be.called;
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {
        'success': true,
        'entitlements': 'ENTITLEMENTS_JWT',
      },
      'IFRAME',
      '$frontend$',
      true,
      true
    );
    resultResolver(result);

    await linkCompleteFlow.whenComplete();
    expect(triggerLinkCompleteSpy).to.be.calledOnce.calledWithExactly();
    expect(triggerLinkProgressSpy).to.not.be.called;
    // Order must be strict: first reset, then pushNextEntitlements.
    expect(order).to.deep.equal(['reset', 'pushNextEntitlements']);
  });

  it('should reset entitlements for unsuccessful response', async () => {
    dialogManagerMock.expects('popupClosed').once();
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    let resultResolver;
    const resultPromise = new Promise((resolve) => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    activitiesMock.expects('openIframe').returns(Promise.resolve(port)).once();
    entitlementsManagerMock.expects('reset').withExactArgs(false).once();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock
      .expects('unblockNextNotification')
      .withExactArgs()
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_GOOGLE_UPDATED, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_GOOGLE_UPDATED, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_GOOGLE_UPDATED_CLOSE, true);

    await linkCompleteFlow.start();
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {},
      'IFRAME',
      '$frontend$',
      true,
      true
    );
    resultResolver(result);

    await linkCompleteFlow.whenComplete();
    expect(triggerLinkCompleteSpy).to.be.calledOnce;
    expect(triggerLinkProgressSpy).to.not.be.called;
  });
});

describes.realWin('LinkSaveFlow', {}, (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let linkSaveFlow;
  let port;
  let dialogManagerMock;
  let eventManagerMock;
  let resultResolver;
  let triggerFlowStartSpy;
  let triggerFlowCanceledSpy;
  let triggerLinkProgressSpy;
  let messageMap;
  let defaultArguments;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    defaultArguments = runtime
      .activities()
      .addDefaultArguments({isClosable: true});
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    eventManagerMock = sandbox.mock(runtime.eventManager());
    triggerFlowStartSpy = sandbox.stub(
      runtime.callbacks(),
      'triggerFlowStarted'
    );
    triggerFlowCanceledSpy = sandbox.stub(
      runtime.callbacks(),
      'triggerFlowCanceled'
    );
    triggerLinkProgressSpy = sandbox.stub(
      runtime.callbacks(),
      'triggerLinkProgress'
    );
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    messageMap = {};
    sandbox.stub(port, 'on').callsFake((ctor, cb) => {
      const messageType = new ctor();
      const label = messageType.label();
      messageMap[label] = cb;
    });
    const resultPromise = new Promise((resolve) => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_SAVE_SUBSCR_TO_GOOGLE);
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    dialogManagerMock.verify();
    eventManagerMock.verify();
  });

  it('should have constructed valid LinkSaveFlow', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/linksaveiframe?_=_',
        defaultArguments
      )
      .returns(Promise.resolve(port));
    linkSaveFlow.start();
    await linkSaveFlow.openPromise_;
  });

  it('should open dialog in hidden mode', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    const dialog = new Dialog(new GlobalDoc(win));
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    dialogManagerMock
      .expects('openDialog')
      .withExactArgs(/* hidden */ true)
      .returns(dialog.open());
    linkSaveFlow.start();
    await linkSaveFlow.openPromise_;
  });

  it('should return false when linking not accepted', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {'linked': false},
      'IFRAME',
      '$frontend$',
      true,
      true
    );
    resultResolver(result);
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    dialogManagerMock.expects('completeView').twice();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL, true);

    const flowResult = await linkSaveFlow.start();
    expect(flowResult).to.be.false;
    expect(triggerFlowStartSpy.notCalled).to.be.true;
    expect(triggerFlowCanceledSpy.called).to.be.true;
  });

  it('should return false if cancel error occurs', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    resultResolver(Promise.reject(createCancelError('linking failed')));
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    dialogManagerMock.expects('completeView').twice();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL, true);

    const result = await linkSaveFlow.start();
    expect(result).to.be.false;
    expect(triggerFlowStartSpy.notCalled).to.be.true;
    expect(triggerFlowCanceledSpy.called).to.be.true;
  });

  it('should test linking success', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {'index': 1, 'linked': true},
      'IFRAME',
      '$frontend$',
      true,
      true
    );
    resultResolver(result);
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    LinkCompleteFlow.prototype.start = () => Promise.resolve();
    dialogManagerMock.expects('completeView').once();
    LinkCompleteFlow.prototype.whenComplete = () => Promise.resolve();

    const flowResult = await linkSaveFlow.start();
    expect(flowResult).to.be.true;
    expect(triggerLinkProgressSpy.called).to.be.true;
  });

  it('should fail if both token and authCode are present', async () => {
    const reqPromise = Promise.resolve({token: 'test', authCode: 'test'});
    const dialog = new Dialog(new GlobalDoc(win));
    dialogManagerMock
      .expects('openDialog')
      .withExactArgs(/* hidden */ true)
      .returns(dialog.open());
    linkSaveFlow = new LinkSaveFlow(runtime, () => reqPromise);
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    linkSaveFlow.start();

    await linkSaveFlow.openPromise_;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    cb(response);
    dialogManagerMock.expects('completeView').once();

    await expect(linkSaveFlow.getRequestPromise()).to.be.rejectedWith(
      /Both authCode and token are available/
    );
  });

  it('should fail if neither token nor authCode is present', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    linkSaveFlow.start();

    await linkSaveFlow.openPromise_;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    cb(response);
    dialogManagerMock.expects('completeView').once();

    await expect(linkSaveFlow.getRequestPromise()).to.be.rejectedWith(
      /Neither token or authCode is available/
    );
  });

  it('should respond with subscription request with token', async () => {
    const saveToken = new LinkSaveTokenRequest();
    saveToken.setToken('test');
    const reqPromise = new Promise((resolve) => {
      resolve({token: 'test'});
    });
    linkSaveFlow = new LinkSaveFlow(runtime, () => reqPromise);
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    linkSaveFlow.start();

    await linkSaveFlow.openPromise_;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    cb(response);

    await linkSaveFlow.getRequestPromise();
    expect(messageStub).to.be.calledOnce.calledWith(saveToken);
  });

  it('should respond with subscription request with authCode', async () => {
    const saveToken = new LinkSaveTokenRequest();
    saveToken.setAuthCode('testCode');
    const reqPromise = new Promise((resolve) => {
      resolve({authCode: 'testCode'});
    });
    linkSaveFlow = new LinkSaveFlow(runtime, () => reqPromise);
    const messageStub = sandbox.stub(port, 'execute');
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    linkSaveFlow.start();

    await linkSaveFlow.openPromise_;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    cb(response);

    await linkSaveFlow.getRequestPromise();
    expect(messageStub).to.be.calledOnce.calledWith(saveToken);
  });

  it('should callback promise rejected should close dialog', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => Promise.reject('no token'));
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    linkSaveFlow.start();

    await linkSaveFlow.openPromise_;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    cb(response);
    dialogManagerMock.expects('completeView').once();

    await expect(linkSaveFlow.getRequestPromise()).to.be.rejectedWith(
      /no token/
    );
  });

  it('should callback synchronous error should close dialog', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {
      throw new Error('callback failed');
    });
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    linkSaveFlow.start();

    await linkSaveFlow.openPromise_;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    cb(response);
    dialogManagerMock.expects('completeView').once();

    await expect(linkSaveFlow.getRequestPromise()).to.be.rejectedWith(
      /callback failed/
    );
  });

  it('should test link complete flow start', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    LinkCompleteFlow.prototype.start = () => Promise.resolve();
    LinkCompleteFlow.prototype.whenComplete = () => Promise.resolve();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/linksaveiframe?_=_',
        defaultArguments
      )
      .returns(Promise.resolve(port));
    const startPromise = linkSaveFlow.start();
    linkSaveFlow.openPromise_.then(() => {
      const result = new ActivityResult(
        ActivityResultCode.OK,
        {
          'index': 1,
          'linked': true,
        },
        'IFRAME',
        '$frontend$',
        true,
        true
      );
      resultResolver(result);
    });

    const result = await startPromise;
    expect(triggerFlowStartSpy.calledOnce).to.be.true;
    expect(triggerLinkProgressSpy.called).to.be.true;
    expect(result).to.be.true;
  });

  it('should test link complete flow start failure', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    LinkCompleteFlow.prototype.start = () =>
      Promise.reject(createCancelError('unable to open iframe'));
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/linksaveiframe?_=_',
        defaultArguments
      )
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL, true);
    const startPromise = linkSaveFlow.start();
    linkSaveFlow.openPromise_.then(() => {
      const result = new ActivityResult(
        ActivityResultCode.OK,
        {
          'index': 1,
          'linked': true,
        },
        'IFRAME',
        '$frontend$',
        true,
        true
      );
      resultResolver(result);
    });
    dialogManagerMock.expects('completeView').twice();

    const result = await startPromise;
    expect(triggerFlowStartSpy.calledOnce).to.be.true;
    expect(triggerFlowCanceledSpy.called).to.be.true;
    expect(result).to.be.false;
  });

  it('should test link complete flow completion failure', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    LinkCompleteFlow.prototype.start = () => Promise.resolve();
    LinkCompleteFlow.prototype.whenComplete = () =>
      Promise.reject(createCancelError('unable to open iframe'));
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/linksaveiframe?_=_',
        defaultArguments
      )
      .returns(Promise.resolve(port));
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL, true);
    const startPromise = linkSaveFlow.start();
    linkSaveFlow.openPromise_.then(() => {
      const result = new ActivityResult(
        ActivityResultCode.OK,
        {
          'index': 1,
          'linked': true,
        },
        'IFRAME',
        '$frontend$',
        true,
        true
      );
      resultResolver(result);
    });
    dialogManagerMock.expects('completeView').twice();

    const result = await startPromise;
    expect(triggerFlowStartSpy.calledOnce).to.be.true;
    expect(triggerFlowCanceledSpy.called).to.be.true;
    expect(result).to.be.false;
  });
});
