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
import {ConfiguredRuntime} from './runtime';
import {LoginPromptApi} from './login-prompt-api';
import {PageConfig} from '../model/page-config';

describes.realWin('LoginPromptApi', {}, (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let loginPromptApi;
  let resultResolver;
  let port;
  let dialogManagerMock;
  const productId = 'pub1:label1';
  const publicationId = 'pub1';

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    loginPromptApi = new LoginPromptApi(runtime);
    resultResolver = null;
    const resultPromise = new Promise((resolve) => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    dialogManagerMock.verify();
  });

  it('should start the flow correctly', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/loginiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId,
          productId,
          userConsent: true,
        }
      )
      .returns(Promise.resolve(port));

    loginPromptApi.start();
    await loginPromptApi.openViewPromise_;
  });

  it('should handle cancel', async () => {
    callbacksMock.expects('triggerFlowCanceled').once();
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));

    resultResolver(Promise.reject(new DOMException('cancel', 'AbortError')));
    dialogManagerMock.expects('completeView').once();
    await expect(loginPromptApi.start()).to.be.rejectedWith(/cancel/);
  });

  it('should handle failure', async () => {
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    resultResolver(Promise.reject(new Error('broken')));
    dialogManagerMock.expects('completeView').once();
    await expect(loginPromptApi.start()).to.be.rejectedWith(/broken/);
  });
});
