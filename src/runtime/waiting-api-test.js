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
import {WaitingApi} from './waiting-api';
import {PageConfig} from '../model/page-config';
import * as sinon from 'sinon';

describes.realWin('WaitingApi', {}, env => {
  let win;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let waitingApi;
  let accountPromise;
  let resultResolver;
  let port;
  let dialogManagerMock;
  const productId = 'pub1:label1';
  const publicationId = 'pub1';
  const account = 'found account!';

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    port = new ActivityPort();
    port.message = () => {};
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    // accountPromise = new Promise(resolve => {
    //   return account;
    // });
    accountPromise = Promise.resolve(account);
    waitingApi = new WaitingApi(runtime, accountPromise);
    resultResolver = null;
    const resultPromise = new Promise(resolve => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    dialogManagerMock.verify();
  });

  it('should start the flow correctly', () => {
    callbacksMock.expects('triggerFlowStarted').once();
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/loginWaitingiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId,
          productId,
          accountPromise,
        })
        .returns(Promise.resolve(port));
    waitingApi.start();
    return waitingApi.openViewPromise_;
  });



  it.only('should return the account on success', () => {
    activitiesMock.expects('openIframe')
        .returns(Promise.resolve(port));
    // dialogManagerMock.expects('completeView').once();
    const bla = waitingApi.start();
    return bla.then(foundAccount => {
      expect(foundAccount).to.equal(account);
    });
  });

  it('it should start the Deferred Account Creation Flow on failure', () => {
    const noAccountFound = 'no account found';
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    resultResolver(Promise.reject(new Error(noAccountFound)));
    dialogManagerMock.expects('completeView').once();
    const promise = waitingApi.start();
    return promise.then(foundAccount => {
      throw new Error('test failed. ' + foundAccount + ' should not be found');
    }, reason => {
      expect(reason).to.equal(noAccountFound);
      //TODO(chenshay): stub account creation flow here and make sure it was called.
    });
  });
});
