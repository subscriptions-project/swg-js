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
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {ConfiguredRuntime} from './runtime';
import {
  LinkCompleteFlow,
  LinkbackFlow,
  LinkSaveFlow,
} from './link-accounts-flow';
import {PageConfig} from '../model/page-config';
import * as sinon from 'sinon';


describes.realWin('LinkbackFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let dialogManagerMock;
  let triggerFlowStartSpy;
  let linkbackFlow;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:prod1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    linkbackFlow = new LinkbackFlow(runtime);
    triggerFlowStartSpy = sandbox.stub(
        runtime.callbacks(), 'triggerFlowStarted');
  });

  afterEach(() => {
    activitiesMock.verify();
  });

  it('should start correctly', () => {
    const popupWin = {};
    dialogManagerMock.expects('popupOpened')
        .withExactArgs(popupWin)
        .once();
    activitiesMock.expects('open').withExactArgs(
        'swg-link',
        '$frontend$/swg/_/ui/v1/linkbackstart?_=_',
        '_blank', {
          '_client': 'SwG $internalRuntimeVersion$',
          'publicationId': 'pub1',
        }, {})
        .returns({targetWin: popupWin})
        .once();
    linkbackFlow.start();
    expect(triggerFlowStartSpy).to.be.calledOnce
        .calledWithExactly('linkAccount');
  });
});


describes.realWin('LinkCompleteFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let entitlementsManagerMock;
  let dialogManagerMock;
  let linkCompleteFlow;
  let triggerLinkProgressSpy, triggerLinkCompleteSpy, triggerFlowCancelSpy;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:prod1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    linkCompleteFlow = new LinkCompleteFlow(runtime, {'index': '1'});
    triggerLinkProgressSpy = sandbox.stub(
        runtime.callbacks(), 'triggerLinkProgress');
    triggerLinkCompleteSpy = sandbox.stub(
        runtime.callbacks(), 'triggerLinkComplete');
    triggerFlowCancelSpy = sandbox.stub(
        runtime.callbacks(), 'triggerFlowCanceled');
  });

  afterEach(() => {
    activitiesMock.verify();
    entitlementsManagerMock.verify();
  });

  it('should trigger on link response', () => {
    dialogManagerMock.expects('popupClosed').once();
    let handler;
    activitiesMock.expects('onResult')
        .withExactArgs('swg-link', sinon.match(arg => {
          handler = arg;
          return typeof arg == 'function';
        }))
        .once();
    entitlementsManagerMock.expects('blockNextNotification').once();
    LinkCompleteFlow.configurePending(runtime);
    expect(handler).to.exist;
    expect(triggerLinkProgressSpy).to.not.be.called;
    expect(triggerLinkCompleteSpy).to.not.be.called;

    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    const result = new ActivityResult(
          ActivityResultCode.OK,
          {'index': '1'},
          'IFRAME', location.origin, true, true);
    port.acceptResult = () => Promise.resolve(result);

    let startResolver;
    const startPromise = new Promise(resolve => {
      startResolver = resolve;
    });
    let instance;
    const startStub = sandbox.stub(LinkCompleteFlow.prototype, 'start',
        function() {
          instance = this;
          startResolver();
        });

    handler(port);
    expect(triggerLinkProgressSpy).to.be.calledOnce.calledWithExactly();
    expect(triggerLinkCompleteSpy).to.not.be.called;
    return startPromise.then(() => {
      expect(startStub).to.be.calledWithExactly();
      expect(instance.activityIframeView_.src_).to.contain('/u/1/');
      expect(triggerFlowCancelSpy).to.not.be.called;
    });
  });

  it('should trigger on failed link response', () => {
    dialogManagerMock.expects('popupClosed').once();
    let handler;
    activitiesMock.expects('onResult')
        .withExactArgs('swg-link', sinon.match(arg => {
          handler = arg;
          return typeof arg == 'function';
        }))
        .once();
    entitlementsManagerMock.expects('blockNextNotification').once();
    LinkCompleteFlow.configurePending(runtime);
    expect(handler).to.exist;
    expect(triggerLinkProgressSpy).to.not.be.called;
    expect(triggerLinkCompleteSpy).to.not.be.called;
    expect(triggerFlowCancelSpy).to.not.be.called;

    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.reject(
        new DOMException('cancel', 'AbortError'));

    const startStub = sandbox.stub(LinkCompleteFlow.prototype, 'start');

    handler(port);
    expect(triggerLinkProgressSpy).to.be.calledOnce.calledWithExactly();
    expect(triggerLinkCompleteSpy).to.not.be.called;
    return Promise.resolve().then(() => {
      // Skip microtask.
      return Promise.resolve();
    }).then(() => {
      expect(triggerFlowCancelSpy).to.be.calledOnce;
      expect(startStub).to.not.be.called;
    });
  });

  it('should default index to 0', () => {
    dialogManagerMock.expects('popupClosed').once();
    linkCompleteFlow = new LinkCompleteFlow(runtime, {});
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/u/0/swg/_/ui/v1/linkconfirmiframe?_=_',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'productId': 'pub1:prod1',
          'publicationId': 'pub1',
        })
        .returns(Promise.resolve(port))
        .once();
    return linkCompleteFlow.start();
  });

  it('should trigger events and reset entitlements', () => {
    dialogManagerMock.expects('popupClosed').once();
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    let resultResolver;
    const resultPromise = new Promise(resolve => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/u/1/swg/_/ui/v1/linkconfirmiframe?_=_',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'productId': 'pub1:prod1',
          'publicationId': 'pub1',
        })
        .returns(Promise.resolve(port))
        .once();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock.expects('reset').withExactArgs(true).once();
    entitlementsManagerMock.expects('unblockNextNotification')
        .withExactArgs().once();
    return linkCompleteFlow.start().then(() => {
      expect(triggerLinkCompleteSpy).to.not.be.called;
      const result = new ActivityResult(
          ActivityResultCode.OK,
          {success: true},
          'IFRAME', location.origin, true, true);
      resultResolver(result);
      return linkCompleteFlow.whenComplete();
    }).then(() => {
      expect(triggerLinkCompleteSpy).to.be.calledOnce.calledWithExactly();
      expect(triggerLinkProgressSpy).to.not.be.called;
    });
  });

  it('should reset entitlements for unsuccessful response', () => {
    dialogManagerMock.expects('popupClosed').once();
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    let resultResolver;
    const resultPromise = new Promise(resolve => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
    activitiesMock.expects('openIframe')
        .returns(Promise.resolve(port))
        .once();
    entitlementsManagerMock.expects('reset').withExactArgs(false).once();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock.expects('unblockNextNotification')
        .withExactArgs().once();
    return linkCompleteFlow.start().then(() => {
      const result = new ActivityResult(
          ActivityResultCode.OK,
          {},
          'IFRAME', location.origin, true, true);
      resultResolver(result);
      return linkCompleteFlow.whenComplete();
    }).then(() => {
      expect(triggerLinkCompleteSpy).to.be.calledOnce;
      expect(triggerLinkProgressSpy).to.not.be.called;
    });
  });

});

describes.realWin('LinkSaveFlow', {}, env => {
  let win;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let linkSaveFlow;
  let port;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.acceptResult = () => Promise.resolve();
    port.whenReady = () => Promise.resolve();
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
  });

  it('should have valid LinkSaveFlow constructed with token', () => {
    linkSaveFlow = new LinkSaveFlow(runtime, {token: 'test'});
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/linksaveiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          token: 'test',
          isClosable: true,
        })
        .returns(Promise.resolve(port));
    return linkSaveFlow.start();
  });

  it('should have valid LinkSaveFlow constructed with authCode', () => {
    linkSaveFlow = new LinkSaveFlow(runtime, {authCode: 'testCode'});
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/linksaveiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          authCode: 'testCode',
          isClosable: true,
        })
        .returns(Promise.resolve(port));
    return linkSaveFlow.start();
  });

  it('should throw error both token and authCode', () => {
    linkSaveFlow = new LinkSaveFlow(
      runtime, {token: 'token', authCode: 'testCode'});
    expect(() => {
      linkSaveFlow.start();
    }).to.throw(/Both authCode and token are available/);
  });

  it('should throw error no token or authCode', () => {
    linkSaveFlow = new LinkSaveFlow(runtime, {});
    expect(() => {
      linkSaveFlow.start();
    }).to.throw(/Neither token or authCode is available/);
  });

  it('should return false when cancelled', () => {
    linkSaveFlow = new LinkSaveFlow(runtime, {token: 'test'});
    port.acceptResult = () => Promise.reject(
        new DOMException('cancel', 'AbortError'));
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return linkSaveFlow.start().then(result => {
      expect(result).to.be.false;
    });
  });

  it('should return false when linking not accepted', () => {
    linkSaveFlow = new LinkSaveFlow(runtime, {token: 'test'});
    const result = new ActivityResult(ActivityResultCode.OK,
      {'linked': false},
      'IFRAME', location.origin, true, true);
    port.acceptResult = () => Promise.resolve(result);
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return linkSaveFlow.start().then(result => {
      expect(result).to.be.false;
    });
  });

  it('should return false if error occurs', () => {
    linkSaveFlow = new LinkSaveFlow(runtime, {token: 'test'});
    port.acceptResult = () => Promise.reject(
        new Error('linking failed'));
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return linkSaveFlow.start().then(result => {
      expect(result).to.be.false;
    });
  });

  it('should return true when linking succeeds', () => {
    linkSaveFlow = new LinkSaveFlow(runtime, {token: 'test'});
    const result = new ActivityResult(ActivityResultCode.OK,
      {'linked': true},
      'IFRAME', location.origin, true, true);
    port.acceptResult = () => Promise.resolve(result);
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    return linkSaveFlow.start().then(result => {
      expect(result).to.be.true;
    });
  });
});
