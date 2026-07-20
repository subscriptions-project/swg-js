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

import {ActivityPort} from '../components/activities';
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
    port = new ActivityPort();
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

    clientConfigManager = new ClientConfigManager(runtime.deps());
    clientConfigManagerMock = sandbox.mock(clientConfigManager);
    sandbox.stub(runtime, 'clientConfigManager').returns(clientConfigManager);

    flow = new AddPreferredSourceFlow(runtime.deps());
  });

  afterEach(() => {
    activitiesMock.verify();
    dialogManagerMock.verify();
    clientConfigManagerMock.verify();
  });

  it('has valid AddPreferredSourceFlow construct', () => {
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/u/0/ui/v1/addpreferredsource?_=_',
        {
          source: win.location.href,
        }
      )
      .returns(Promise.resolve(port));
    flow = new AddPreferredSourceFlow(runtime.deps());
  });

  it('starts flow correctly', async () => {
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    dialogManagerMock.expects('openView').once();
    dialogManagerMock.expects('completeView').once();

    await flow.start();
  });

  it('handles cancellation properly', async () => {
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    port.acceptResult = () => Promise.reject(new Error('cancel'));

    dialogManagerMock.expects('openView').once();
    dialogManagerMock.expects('completeView').once();

    await expect(flow.start()).to.be.rejectedWith('cancel');
  });
});
