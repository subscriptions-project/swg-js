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

  it('has valid AddPreferredSourceFlow construct and iframe configuration', () => {
    flow = new AddPreferredSourceFlow(runtime);
    
    // Assert the View is correctly configured
    expect(flow.activityIframeView_.src_).to.contain('/addpreferredsource');
    expect(flow.activityIframeView_.args_.source).to.equal(win.location.href);
    expect(flow.activityIframeView_.shouldFadeBody_).to.be.false;
  });

  it('starts flow correctly', async () => {
    sandbox.stub(flow.activityIframeView_, 'acceptResultAndVerify').resolves({
      'data': [1],
      'label': 'AddPreferredSourceResponse',
    });
    dialogManagerMock.expects('openView').once();
    dialogManagerMock.expects('completeView').once();

    await flow.start();
    
    expect(flow.activityIframeView_.acceptResultAndVerify).to.have.been.calledOnce;
    const acceptArgs = flow.activityIframeView_.acceptResultAndVerify.getCall(0).args;
    expect(acceptArgs[0]).to.equal('https://news.google.com'); // feOrigin()
    expect(acceptArgs[1]).to.be.true; // requireOriginVerified
    expect(acceptArgs[2]).to.be.true; // requireSecureChannel
  });

  it('handles cancellation properly', async () => {
    sandbox
      .stub(flow.activityIframeView_, 'acceptResultAndVerify')
      .rejects(new Error('cancel'));

    dialogManagerMock.expects('openView').once();
    dialogManagerMock.expects('completeView').once();

    await expect(flow.start()).to.be.rejectedWith('cancel');
  });
});
