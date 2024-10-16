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
import {MockActivityPort} from '../../test/mock-activity-port';
import {PageConfig} from '../model/page-config';
import {StorageKeys} from '../utils/constants';
import {createCancelError} from '../utils/errors';
import {tick} from '../../test/tick';

describes.realWin('LinkbackFlow', (env) => {
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
        'https://news.google.com/swg/ui/v1/linkbackstart?_=_',
        '_blank',
        {
          '_client': 'SwG 0.0.0',
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
        'https://news.google.com/swg/ui/v1/linkbackstart?_=_',
        '_blank',
        {
          '_client': 'SwG 0.0.0',
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
        'https://news.google.com/swg/ui/v1/linkbackstart?_=_',
        '_top',
        {
          '_client': 'SwG 0.0.0',
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

describes.realWin('LinkCompleteFlow', (env) => {
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

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_LINK_CONTINUE, true);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_LINK_ACCOUNT_SUCCESS);

    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    const activityResultData = {'index': '1'};
    const result = new ActivityResult(
      ActivityResultCode.OK,
      activityResultData,
      'IFRAME',
      'https://news.google.com',
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
    const caughtResponse = instance.response_;
    expect(caughtResponse).to.equal(activityResultData);
    expect(triggerFlowCancelSpy).to.not.be.called;
  });

  it('should trigger on cancelled link response', async () => {
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
    entitlementsManagerMock.expects('unblockNextNotification').once();
    LinkCompleteFlow.configurePending(runtime);
    expect(handler).to.exist;
    expect(triggerLinkProgressSpy).to.not.be.called;
    expect(triggerLinkCompleteSpy).to.not.be.called;
    expect(triggerFlowCancelSpy).to.not.be.called;

    port = new MockActivityPort();
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

  it('should trigger on (non-cancelled) failed link response', async () => {
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
    entitlementsManagerMock.expects('unblockNextNotification').once();
    LinkCompleteFlow.configurePending(runtime);
    expect(handler).to.exist;
    expect(triggerLinkProgressSpy).to.not.be.called;
    expect(triggerLinkCompleteSpy).to.not.be.called;
    expect(triggerFlowCancelSpy).to.not.be.called;

    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.reject(new Error());

    const startStub = sandbox.stub(LinkCompleteFlow.prototype, 'start');

    handler(port);
    expect(triggerLinkProgressSpy).to.be.calledOnce.calledWithExactly();
    expect(triggerLinkCompleteSpy).to.not.be.called;

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_LINK_CONTINUE, true);

    await tick(2);

    expect(triggerFlowCancelSpy).to.not.be.called;
    expect(startStub).to.not.be.called;
  });

  [
    {
      description: 'should default index to 0',
      activityResultData: null,
      expectedPath:
        'https://news.google.com/swg/u/0/ui/v1/linkconfirmiframe?_=_',
    },
    {
      description: 'should use index in response',
      activityResultData: {index: '1'},
      expectedPath:
        'https://news.google.com/swg/u/1/ui/v1/linkconfirmiframe?_=_',
    },
  ].forEach(({description, activityResultData, expectedPath}) => {
    it(description, async () => {
      dialogManagerMock.expects('popupClosed').once();
      linkCompleteFlow = new LinkCompleteFlow(runtime, activityResultData);
      port = new MockActivityPort();
      port.onResizeRequest = () => {};
      port.whenReady = () => Promise.resolve();

      const activityResult = new ActivityResult(
        ActivityResultCode.OK,
        {},
        'IFRAME',
        'https://news.google.com',
        true,
        true
      );
      port.acceptResult = () => Promise.resolve(activityResult);

      activitiesMock
        .expects('openIframe')
        .withExactArgs(
          sandbox.match((arg) => arg.tagName === 'IFRAME'),
          expectedPath,
          {
            '_client': 'SwG 0.0.0',
            'productId': 'pub1:prod1',
            'publicationId': 'pub1',
          }
        )
        .resolves(port)
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
  });

  it('should not open linkconfirmiframe if the response came from a saveAndRefresh flow', async () => {
    const storageMock = sandbox.mock(runtime.storage());
    linkCompleteFlow = new LinkCompleteFlow(runtime, {
      linked: true,
      saveAndRefresh: true,
      swgUserToken: 'test-token',
    });

    dialogManagerMock.expects('popupClosed').once();
    activitiesMock.expects('openIframe').never();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_GOOGLE_UPDATED_CLOSE, true);
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock.expects('reset').withExactArgs(true).once();
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'test-token', true)
      .exactly(1);

    await linkCompleteFlow.start();
  });

  it('should trigger events and reset entitlements', async () => {
    dialogManagerMock.expects('popupClosed').once();
    port = new MockActivityPort();
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
        'https://news.google.com/swg/u/1/ui/v1/linkconfirmiframe?_=_',
        {
          '_client': 'SwG 0.0.0',
          'productId': 'pub1:prod1',
          'publicationId': 'pub1',
        }
      )
      .resolves(port)
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
      'https://news.google.com',
      true,
      true
    );
    resultResolver(result);

    await linkCompleteFlow.whenComplete();
    expect(triggerLinkCompleteSpy).to.be.calledOnce.calledWithExactly();
    expect(triggerLinkProgressSpy).to.not.be.called;
  });

  it('should reset entitlements for unsuccessful response', async () => {
    dialogManagerMock.expects('popupClosed').once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    let resultResolver;
    const resultPromise = new Promise((resolve) => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    activitiesMock.expects('openIframe').resolves(port).once();
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
      'https://news.google.com',
      true,
      true
    );
    resultResolver(result);

    await linkCompleteFlow.whenComplete();
    expect(triggerLinkCompleteSpy).to.be.calledOnce;
    expect(triggerLinkProgressSpy).to.not.be.called;
  });

  it('should set swgUserToken for successful response', async () => {
    const storageMock = sandbox.mock(runtime.storage());
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .exactly(1);
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    let resultResolver;
    const resultPromise = new Promise((resolve) => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    activitiesMock.expects('openIframe').resolves(port).once();
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

    const result = new ActivityResult(
      ActivityResultCode.OK,
      {success: true, swgUserToken: 'fake user token'},
      'IFRAME',
      'https://news.google.com',
      true,
      true
    );
    resultResolver(result);

    await linkCompleteFlow.whenComplete();

    storageMock.verify();
  });

  it('handles completion errors', async () => {
    const storageMock = sandbox.mock(runtime.storage());
    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, 'fake user token', true)
      .throws(new Error('example error'));
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    let resultResolver;
    const resultPromise = new Promise((resolve) => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    activitiesMock.expects('openIframe').resolves(port).once();
    await linkCompleteFlow.start();
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {success: true, swgUserToken: 'fake user token'},
      'IFRAME',
      'https://news.google.com',
      true,
      true
    );
    resultResolver(result);

    // Capture function that rethrows completion error.
    let rethrowCompletionErrorFn;
    win.setTimeout = (c) => {
      rethrowCompletionErrorFn = c;
    };
    linkCompleteFlow.whenComplete();
    await tick(2);

    expect(rethrowCompletionErrorFn).to.throw('example error');
  });
});

describes.realWin('LinkSaveFlow', (env) => {
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
    port = new MockActivityPort();
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
        'https://news.google.com/swg/ui/v1/linksaveiframe?_=_',
        defaultArguments
      )
      .resolves(port);
    linkSaveFlow.start();
    await linkSaveFlow.openPromise;
  });

  it('should open dialog in hidden mode', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    const dialog = new Dialog(new GlobalDoc(win));
    activitiesMock.expects('openIframe').resolves(port);
    dialogManagerMock
      .expects('openDialog')
      .withExactArgs(/* hidden */ true, {})
      .returns(dialog.open());
    linkSaveFlow.start();
    await linkSaveFlow.openPromise;
  });

  it('should return false when linking not accepted', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {'linked': false},
      'IFRAME',
      'https://news.google.com',
      true,
      true
    );
    resultResolver(result);
    activitiesMock.expects('openIframe').resolves(port);
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
    activitiesMock.expects('openIframe').resolves(port);
    dialogManagerMock.expects('completeView').twice();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL, true);

    const result = await linkSaveFlow.start();
    expect(result).to.be.false;
    expect(triggerFlowStartSpy.notCalled).to.be.true;
    expect(triggerFlowCanceledSpy.called).to.be.true;
  });

  it('rethrows non-cancel errors', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    resultResolver(Promise.reject(new Error('linking failed')));
    activitiesMock.expects('openIframe').resolves(port);
    dialogManagerMock.expects('completeView').once();

    await expect(linkSaveFlow.start()).to.eventually.be.rejectedWith(
      'linking failed'
    );
  });

  it('should test linking success', async () => {
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_SAVE_SUBSCRIPTION_SUCCESS);

    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    const result = new ActivityResult(
      ActivityResultCode.OK,
      {'index': 1, 'linked': true},
      'IFRAME',
      'https://news.google.com',
      true,
      true
    );
    resultResolver(result);
    activitiesMock.expects('openIframe').resolves(port);
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
      .withExactArgs(/* hidden */ true, {})
      .returns(dialog.open());
    linkSaveFlow = new LinkSaveFlow(runtime, () => reqPromise);
    activitiesMock.expects('openIframe').resolves(port);
    linkSaveFlow.start();

    await linkSaveFlow.openPromise;
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
    activitiesMock.expects('openIframe').resolves(port);
    linkSaveFlow.start();

    await linkSaveFlow.openPromise;
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
    activitiesMock.expects('openIframe').resolves(port);
    linkSaveFlow.start();

    await linkSaveFlow.openPromise;
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
    activitiesMock.expects('openIframe').resolves(port);
    linkSaveFlow.start();

    await linkSaveFlow.openPromise;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    cb(response);

    await linkSaveFlow.getRequestPromise();
    expect(messageStub).to.be.calledOnce.calledWith(saveToken);
  });

  it('closes dialog when callback returns rejected promise', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => Promise.reject('no token'));
    activitiesMock.expects('openIframe').resolves(port);
    linkSaveFlow.start();

    await linkSaveFlow.openPromise;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    dialogManagerMock.expects('completeView').once();
    cb(response);

    await expect(linkSaveFlow.getRequestPromise()).to.be.rejectedWith(
      /no token/
    );
  });

  it('closes dialog when callback throws synchronous error', async () => {
    linkSaveFlow = new LinkSaveFlow(runtime, () => {
      throw new Error('callback failed');
    });
    activitiesMock.expects('openIframe').resolves(port);
    linkSaveFlow.start();

    await linkSaveFlow.openPromise;
    const response = new LinkingInfoResponse();
    response.setRequested(true);
    const cb = messageMap[response.label()];
    dialogManagerMock.expects('completeView').once();
    cb(response);

    await expect(linkSaveFlow.getRequestPromise()).to.be.rejectedWith(
      /callback failed/
    );
  });

  it('bails if save is not requested', async () => {
    dialogManagerMock.expects('completeView').never();

    linkSaveFlow = new LinkSaveFlow(runtime, () => {
      throw new Error('callback failed');
    });
    activitiesMock.expects('openIframe').resolves(port);
    linkSaveFlow.start();

    await linkSaveFlow.openPromise;
    const response = new LinkingInfoResponse();
    response.setRequested(false);
    const cb = messageMap[response.label()];
    cb(response);
    await linkSaveFlow.getRequestPromise();
  });

  it('should test link complete flow start', async () => {
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_SAVE_SUBSCRIPTION_SUCCESS);

    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    LinkCompleteFlow.prototype.start = () => Promise.resolve();
    LinkCompleteFlow.prototype.whenComplete = () => Promise.resolve();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/linksaveiframe?_=_',
        defaultArguments
      )
      .resolves(port);
    const startPromise = linkSaveFlow.start();
    linkSaveFlow.openPromise.then(() => {
      const result = new ActivityResult(
        ActivityResultCode.OK,
        {
          'index': 1,
          'linked': true,
        },
        'IFRAME',
        'https://news.google.com',
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
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_SAVE_SUBSCRIPTION_SUCCESS);

    linkSaveFlow = new LinkSaveFlow(runtime, () => {});
    LinkCompleteFlow.prototype.start = () =>
      Promise.reject(createCancelError('unable to open iframe'));
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/linksaveiframe?_=_',
        defaultArguments
      )
      .resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL, true);
    const startPromise = linkSaveFlow.start();
    linkSaveFlow.openPromise.then(() => {
      const result = new ActivityResult(
        ActivityResultCode.OK,
        {
          'index': 1,
          'linked': true,
        },
        'IFRAME',
        'https://news.google.com',
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
        'https://news.google.com/swg/ui/v1/linksaveiframe?_=_',
        defaultArguments
      )
      .resolves(port);
    // Saving subscription succeeded, but showing the confirmation iframe failed.
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.EVENT_SAVE_SUBSCRIPTION_SUCCESS);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL, true);
    const startPromise = linkSaveFlow.start();
    linkSaveFlow.openPromise.then(() => {
      const result = new ActivityResult(
        ActivityResultCode.OK,
        {
          'index': 1,
          'linked': true,
        },
        'IFRAME',
        'https://news.google.com',
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
