/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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
  CompleteAudienceActionResponse,
  EntitlementsResponse,
} from '../proto/api_messages';
import {AudienceActionFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ConfiguredRuntime} from './runtime';
import {Constants} from '../utils/constants';
import {PageConfig} from '../model/page-config';
import {ProductType} from '../api/subscriptions';
import {Toast} from '../ui/toast';

const WINDOW_LOCATION_DOMAIN = 'https://www.test.com';

describes.realWin('AudienceActionFlow', {}, (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let entitlementsManagerMock;
  let storageMock;
  let pageConfig;
  let port;
  let messageCallback;
  let messageMap;
  let fallbackSpy;

  beforeEach(() => {
    win = env.win;
    messageMap = {};
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager());
    storageMock = sandbox.mock(runtime.storage());
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    sandbox.stub(port, 'on').callsFake(function (ctor, cb) {
      const messageType = new ctor();
      const messageLabel = messageType.label();
      messageMap[messageLabel] = cb;
    });
    sandbox.stub(runtime, 'win').returns({
      location: {href: WINDOW_LOCATION_DOMAIN + '/page/1'},
      document: win.document,
    });
    fallbackSpy = sandbox.spy();
  });

  [
    {action: 'TYPE_REGISTRATION_WALL', path: 'regwalliframe'},
    {action: 'TYPE_NEWSLETTER_SIGNUP', path: 'newsletteriframe'},
  ].forEach(({action, path}) => {
    it(`opens a correct AudienceActionFlow constructed with params for ${action}`, async () => {
      const audienceActionFlow = new AudienceActionFlow(runtime, {
        action,
        fallback: fallbackSpy,
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      });
      activitiesMock
        .expects('openIframe')
        .withExactArgs(
          sandbox.match((arg) => arg.tagName == 'IFRAME'),
          `$frontend$/swg/_/ui/v1/${path}?_=_&publicationId=pub1&origin=${encodeURIComponent(
            WINDOW_LOCATION_DOMAIN
          )}`,
          {
            _client: 'SwG $internalRuntimeVersion$',
            productType: ProductType.SUBSCRIPTION,
            supportsEventManager: true,
          }
        )
        .resolves(port);

      await audienceActionFlow.start();

      activitiesMock.verify();
      expect(fallbackSpy).to.not.be.called;
    });
  });

  it('calls the fallback when an AudienceActionFlow is cancelled and one it provided', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      fallback: fallbackSpy,
    });
    activitiesMock.expects('openIframe').resolves(port);
    sandbox
      .stub(port, 'acceptResult')
      .callsFake(() =>
        Promise.reject(new DOMException('cancel', 'AbortError'))
      );

    await audienceActionFlow.start();

    activitiesMock.verify();
    expect(fallbackSpy).to.be.calledOnce;
  });

  [
    {userToken: 'testUserToken', timesStoreSetCalled: 1},
    {userToken: undefined, timesStoreSetCalled: 0},
  ].forEach(({userToken, timesStoreSetCalled}) => {
    it('correctly handles a CompleteAudienceActionResponse with action completed when returned from the flow', async () => {
      const audienceActionFlow = new AudienceActionFlow(runtime, {
        action: 'TYPE_REGISTRATION_WALL',
        fallback: fallbackSpy,
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      });
      activitiesMock.expects('openIframe').resolves(port);
      entitlementsManagerMock.expects('clear').once();
      entitlementsManagerMock.expects('getEntitlements').once();
      storageMock
        .expects('set')
        .withExactArgs(Constants.USER_TOKEN, userToken, true)
        .exactly(timesStoreSetCalled);

      let toast;
      const toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });

      await audienceActionFlow.start();
      const completeAudienceActionResponse = new CompleteAudienceActionResponse();
      completeAudienceActionResponse.setActionCompleted(true);
      completeAudienceActionResponse.setSwgUserToken(userToken);
      const messageCallback = messageMap[completeAudienceActionResponse.label()];
      messageCallback(completeAudienceActionResponse);

      entitlementsManagerMock.verify();
      storageMock.verify();
      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=basic');
    });
  });

  [
    {action: 'TYPE_REGISTRATION_WALL', toastMessage: 'You have registered before.'},
    {action: 'TYPE_NEWSLETTER_SIGNUP', toastMessage: 'You have signed up before.'},
  ].forEach(({action, toastMessage}) => {
    it('correctly handles a CompleteAudienceActionResponse with action not completed when returned from the flow', async () => {
      const audienceActionFlow = new AudienceActionFlow(runtime, {
        action,
        fallback: fallbackSpy,
        autoPromptType: AutoPromptType.SUBSCRIPTION,
      });
      activitiesMock.expects('openIframe').resolves(port);
      entitlementsManagerMock.expects('clear').once();
      entitlementsManagerMock.expects('getEntitlements').once();
      storageMock
        .expects('set')
        .withExactArgs(Constants.USER_TOKEN, 'fake user token', true)
        .exactly(1);

      let toast;
      const toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });

      await audienceActionFlow.start();
      const completeAudienceActionResponse = new CompleteAudienceActionResponse();
      completeAudienceActionResponse.setActionCompleted(false);
      completeAudienceActionResponse.setSwgUserToken('fake user token');
      const messageCallback = messageMap[completeAudienceActionResponse.label()];
      messageCallback(completeAudienceActionResponse);

      entitlementsManagerMock.verify();
      storageMock.verify();
      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=custom');
      expect(decodeURI(toast.src_)).to.contain(toastMessage);
    });
  });

  it('should trigger login flow for a registered user', async () => {
    const loginStub = sandbox.stub(runtime.callbacks(), 'triggerLoginRequest');
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      fallback: fallbackSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);

    await audienceActionFlow.start();
    const response = new AlreadySubscribedResponse();
    response.setSubscriberOrMember(true);
    messageCallback = messageMap['AlreadySubscribedResponse'];
    messageCallback(response);
    expect(loginStub).to.be.calledOnce.calledWithExactly({
      linkRequested: false,
    });
  });

  it('should send an empty EntitlementsResponse to show the no entitlement found toast on Activity iFrame view', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      fallback: fallbackSpy,
      autoPromptType: AutoPromptType.SUBSCRIPTION,
    });
    activitiesMock.expects('openIframe').resolves(port);

    await audienceActionFlow.start();

    const activityIframeViewMock = sandbox.mock(
      audienceActionFlow.activityIframeView_
    );
    activityIframeViewMock
      .expects('execute')
      .withExactArgs(new EntitlementsResponse())
      .once();

    await audienceActionFlow.showNoEntitlementFoundToast();

    activityIframeViewMock.verify();
  });
});
