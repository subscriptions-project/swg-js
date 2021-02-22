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

import {AutoPromptConfig} from '../model/auto-prompt-config';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {Fetcher} from './fetcher';

describes.realWin('ClientConfigManager', {}, () => {
  let clientConfigManager;
  let fetcher;
  let fetcherMock;

  beforeEach(() => {
    fetcher = new Fetcher();
    fetcherMock = sandbox.mock(fetcher);
    clientConfigManager = new ClientConfigManager('pubId', fetcher);
    sandbox.stub(self.console, 'warn');
  });

  afterEach(() => {
    fetcherMock.verify();
  });

  it('getClientConfig should fetch the client config', async () => {
    const expectedUrl =
      '$frontend$/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .returns(Promise.resolve({autoPromptConfig: {maxImpressionsPerWeek: 1}}))
      .once();

    const clientConfig = await clientConfigManager.getClientConfig();
    const expectedAutoPromptConfig = new AutoPromptConfig(1);
    const expectedClientConfig = new ClientConfig(expectedAutoPromptConfig);
    expect(clientConfig).to.deep.equal(expectedClientConfig);
  });

  it('getClientConfig should throw an error for undefined publication ID', async () => {
    clientConfigManager = new ClientConfigManager(undefined, fetcher);
    fetcherMock.expects('fetchCredentialedJson').never();

    try {
      clientConfigManager.getClientConfig();
    } catch (err) {
      expect(err)
        .to.be.an.instanceOf(Error)
        .with.property('message', 'getClientConfig requires publicationId');
    }
  });

  it('getAutoPromptConfig should return AutoPromptConfig object', async () => {
    const expectedUrl =
      '$frontend$/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .returns(Promise.resolve({autoPromptConfig: {maxImpressionsPerWeek: 3}}))
      .once();

    const expectedAutoPromptConfig = new AutoPromptConfig(3);
    const autoPromptConfig = await clientConfigManager.getAutoPromptConfig();
    expect(autoPromptConfig).to.deep.equal(expectedAutoPromptConfig);
  });

  it('getClientConfig should log errors from the response', async () => {
    const expectedUrl =
      '$frontend$/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .returns(
        Promise.resolve({
          errorMessages: ['Something went wrong'],
        })
      )
      .once();

    await clientConfigManager.getAutoPromptConfig();
    expect(self.console.warn).to.have.been.calledWithExactly(
      'SwG ClientConfigManager: Something went wrong'
    );
  });
});
