/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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
import {MeterRegwallApi} from './meter-regwall-api';
import {PageConfig} from '../model/page-config';

describes.realWin('MeterRegwallApi', {}, (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;
  let meterRegwallApi;
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
    meterRegwallApi = new MeterRegwallApi(runtime, {'isClosable': true});
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    dialogManagerMock.verify();
  });

  it('should start the flow correctly', async () => {
    callbacksMock.expects('triggerFlowStarted').once();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/meterregwalliframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId,
          productId,
        }
      )
      .returns(Promise.resolve(port));

    await meterRegwallApi.start();
  });
});