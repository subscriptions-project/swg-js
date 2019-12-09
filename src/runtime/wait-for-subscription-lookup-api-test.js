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
import {PageConfig} from '../model/page-config';
import {WaitForSubscriptionLookupApi} from './wait-for-subscription-lookup-api';

describes.realWin('WaitForSubscriptionLookupApi', {}, env => {
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
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    accountPromise = Promise.resolve(account);
    waitingApi = new WaitForSubscriptionLookupApi(runtime, accountPromise);
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

  it('should start the flow correctly', async () => {
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/waitforsubscriptionlookupiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId,
          productId,
        }
      )
      .returns(Promise.resolve(port));
    dialogManagerMock.expects('completeView').once();
    waitingApi.start();
    await waitingApi.openViewPromise_;
  });

  it('should return the account on success', async () => {
    const foundAccount = await waitingApi.start();
    expect(foundAccount).to.equal(account);
  });

  it('it should fail correctly', async () => {
    const noAccountFound = 'no account found';
    accountPromise = Promise.reject(noAccountFound);
    waitingApi = new WaitForSubscriptionLookupApi(runtime, accountPromise);
    resultResolver(Promise.reject(new Error(noAccountFound)));

    dialogManagerMock.expects('completeView').once();
    await expect(waitingApi.start()).to.be.rejectedWith(noAccountFound);
  });

  it('should reject null account promise', async () => {
    waitingApi = new WaitForSubscriptionLookupApi(runtime);
    dialogManagerMock.expects('completeView').once();
    await expect(waitingApi.start()).to.be.rejectedWith(
      'No account promise provided'
    );
  });
});
