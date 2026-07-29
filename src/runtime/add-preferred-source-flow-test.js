/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActivityIframePort} from '../components/activities';
import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {ClientConfigManager} from './client-config-manager';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';

describes.realWin('AddPreferredSourceFlow', (env) => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let dialogManagerMock;
  let port;
  let flow;
  let clientConfigManager;
  let clientConfigManagerMock;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1', true);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    port = sandbox.createStubInstance(ActivityIframePort);
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () =>
      Promise.resolve({
        data: {
          'data': [1],
          'label': 'AddPreferredSourceResponse',
        },
        origin: 'https://news.google.com',
        originVerified: true,
        secureChannel: true,
      });

    clientConfigManager = new ClientConfigManager(runtime);
    clientConfigManagerMock = sandbox.mock(clientConfigManager);
    sandbox.stub(runtime, 'clientConfigManager').returns(clientConfigManager);

    flow = new AddPreferredSourceFlow(runtime);
  });

  afterEach(() => {
    activitiesMock.verify();
    dialogManagerMock.verify();
    clientConfigManagerMock.verify();
  });

  it('starts flow in popup window with language parameter', async () => {
    let onResultCallback;
    activitiesMock
      .expects('onResult')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match((arg) => {
          onResultCallback = arg;
          return typeof arg == 'function';
        })
      )
      .once();

    activitiesMock
      .expects('open')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match(
          (url) => url.includes('/addpreferredsource') && url.includes('hl=en')
        ),
        '_blank',
        sandbox.match.object,
        sandbox.match.object
      )
      .once();

    const startPromise = flow.start();
    onResultCallback(port);
    const result = await startPromise;
    expect(result).to.deep.equal({
      'data': [1],
      'label': 'AddPreferredSourceResponse',
    });
  });

  it('passes custom language from clientConfigManager', async () => {
    sandbox.stub(clientConfigManager, 'getLanguage').returns('fr-FR');
    let onResultCallback;
    activitiesMock
      .expects('onResult')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match((arg) => {
          onResultCallback = arg;
          return typeof arg == 'function';
        })
      )
      .once();
    activitiesMock
      .expects('open')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match((url) => url.includes('hl=fr-FR')),
        '_blank',
        sandbox.match.object,
        sandbox.match.object
      )
      .once();

    const startPromise = flow.start();
    onResultCallback(port);
    await startPromise;
  });
});
