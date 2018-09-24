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
import {LoggingServiceApi} from './logging-service-api';
import {PageConfig} from '../model/page-config';
import * as sinon from 'sinon';

describes.realWin('LoggingServiceApi', {}, env => {
  let win;
  let runtime;
  let activitiesMock;
  let pageConfig;
  let loggingServiceApi;
  let resultResolver;
  let port;
  let dialogManagerMock;
  let resultPromise;
  const productId = 'pub1:label1';
  const publicationId = 'pub1';

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    port = new ActivityPort();
    port.message = () => {};
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    loggingServiceApi = new LoggingServiceApi(runtime);
    resultResolver = null;
    resultPromise = new Promise(resolve => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
  });

  afterEach(() => {
    activitiesMock.verify();
    dialogManagerMock.verify();
  });

  it('should start the flow correctly', () => {
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/serviceiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId,
          productId,
          userConsent: false,
        })
        .returns(Promise.resolve(port));

    return loggingServiceApi.start();
  });

  it('should handle failure', () => {
    activitiesMock.expects('openIframe')
        .returns(Promise.resolve(port));
    resultResolver(Promise.reject(new Error('broken')));
    dialogManagerMock.expects('completeView').once();
    resultPromise.then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/broken/);
    });
    return loggingServiceApi.start();
  });
});
