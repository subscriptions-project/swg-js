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
import {ClientTheme} from '../api/basic-subscriptions';
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

  it('fetchClientConfig should fetch the client config', async () => {
    const expectedUrl =
      '$frontend$/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .returns(Promise.resolve({autoPromptConfig: {maxImpressionsPerWeek: 1}}))
      .once();

    let clientConfig = await clientConfigManager.fetchClientConfig();
    const expectedAutoPromptConfig = new AutoPromptConfig(1);
    const expectedClientConfig = new ClientConfig(expectedAutoPromptConfig);
    expect(clientConfig).to.deep.equal(expectedClientConfig);

    clientConfig = await clientConfigManager.getClientConfig();
    expect(clientConfig).to.deep.equal(expectedClientConfig);
  });

  it('fetchClientConfig should throw an error for undefined publication ID', async () => {
    clientConfigManager = new ClientConfigManager(undefined, fetcher);
    fetcherMock.expects('fetchCredentialedJson').never();

    expect(() => {
      clientConfigManager.fetchClientConfig();
    }).to.throw('fetchClientConfig requires publicationId');
  });

  it('getAutoPromptConfig should return undefined if the autoPromptConfig is not present in the response', async () => {
    const expectedUrl =
      '$frontend$/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .returns(Promise.resolve({}))
      .once();

    const autoPromptConfig = await clientConfigManager.getAutoPromptConfig();
    expect(autoPromptConfig).to.be.undefined;
  });

  it('getAutoPromptConfig should return AutoPromptConfig object even if part of the config is missing', async () => {
    const expectedUrl =
      '$frontend$/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .returns(Promise.resolve({autoPromptConfig: {maxImpressionsPerWeek: 3}}))
      .once();

    const autoPromptConfig = await clientConfigManager.getAutoPromptConfig();
    expect(autoPromptConfig.maxImpressionsPerWeek).to.equal(3);
    expect(autoPromptConfig.clientDisplayTrigger).to.not.be.undefined;
    expect(autoPromptConfig.explicitDismissalConfig).to.not.be.undefined;
  });

  it('getAutoPromptConfig should return AutoPromptConfig object', async () => {
    const expectedUrl =
      '$frontend$/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .returns(
        Promise.resolve({
          autoPromptConfig: {
            maxImpressionsPerWeek: 1,
            clientDisplayTrigger: {dismissalDelaySeconds: 2},
            explicitDismissalConfig: {
              backoffSeconds: 3,
              maxDismissalsPerWeek: 4,
              maxDismissalsResultingHideSeconds: 5,
            },
          },
        })
      )
      .once();

    const autoPromptConfig = await clientConfigManager.getAutoPromptConfig();
    expect(autoPromptConfig.maxImpressionsPerWeek).to.equal(1);
    expect(
      autoPromptConfig.clientDisplayTrigger.dismissalDelaySeconds
    ).to.equal(2);
    expect(autoPromptConfig.explicitDismissalConfig.backoffSeconds).to.equal(3);
    expect(
      autoPromptConfig.explicitDismissalConfig.maxDismissalsPerWeek
    ).to.equal(4);
    expect(
      autoPromptConfig.explicitDismissalConfig.maxDismissalsResultingHideSeconds
    ).to.equal(5);
  });

  it('fetchClientConfig should log errors from the response', async () => {
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

  it('getClientConfig should return a Promise with an empty config if fetchClientConfig is not called', async () => {
    const clientConfig = await clientConfigManager.getClientConfig();
    const expectedClientConfig = new ClientConfig();
    expect(clientConfig).to.deep.equal(expectedClientConfig);
  });

  it('should return default client options if unspecified', () => {
    expect(clientConfigManager.getLanguage()).to.equal('en');
    expect(clientConfigManager.getTheme()).to.equal(ClientTheme.LIGHT);
  });

  it('should return the language set in the constructor', () => {
    clientConfigManager = new ClientConfigManager('pubId', fetcher, {
      lang: 'fr',
    });
    expect(clientConfigManager.getLanguage()).to.equal('fr');
    expect(clientConfigManager.getTheme()).to.equal(ClientTheme.LIGHT);
  });

  it('should return the theme set in the constructor', () => {
    clientConfigManager = new ClientConfigManager('pubId', fetcher, {
      theme: ClientTheme.DARK,
    });
    expect(clientConfigManager.getTheme()).to.equal(ClientTheme.DARK);
    expect(clientConfigManager.getLanguage()).to.equal('en');
  });
});
