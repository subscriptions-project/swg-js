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
import {ClientTheme} from '../api/subscriptions';
import {MockDeps} from '../../test/mock-deps';
import {XhrFetcher} from './fetcher';

describes.realWin('ClientConfigManager', (env) => {
  let clientConfigManager;
  let config;
  let fetcher;
  let fetcherMock;
  let deps;
  let depsMock;
  let entitlementsManagerMock;

  beforeEach(() => {
    deps = new MockDeps();

    // Mock config.
    config = {};
    deps.config = () => config;

    fetcher = new XhrFetcher(env.win);
    fetcherMock = sandbox.mock(fetcher);
    depsMock = sandbox.mock(deps);
    entitlementsManagerMock = depsMock.expects('entitlementsManager').returns({
      getArticle: () => Promise.resolve(),
    });
    clientConfigManager = new ClientConfigManager(deps, 'pubId', fetcher);
    sandbox.stub(self.console, 'warn');
  });

  afterEach(() => {
    fetcherMock.verify();
  });

  it('getClientConfig should return default config', async () => {
    const clientConfig = await clientConfigManager.getClientConfig();
    expect(clientConfig).to.deep.equal(new ClientConfig({}));
  });

  it('getClientConfig should include skipAccountCreation override if specified', async () => {
    clientConfigManager = new ClientConfigManager(deps, 'pubId', fetcher, {
      skipAccountCreationScreen: true,
    });
    const clientConfig = await clientConfigManager.getClientConfig();
    expect(clientConfig).to.deep.equal(
      new ClientConfig({
        skipAccountCreationScreen: true,
      })
    );
  });

  it('fetchClientConfig should fetch the client config', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({autoPromptConfig: {impressionConfig: {maxImpressions: 1}}})
      .once();

    let clientConfig = await clientConfigManager.fetchClientConfig();
    const expectedAutoPromptConfig = new AutoPromptConfig({maxImpressions: 1});
    const expectedClientConfig = new ClientConfig({
      autoPromptConfig: expectedAutoPromptConfig,
    });
    expect(clientConfig).to.deep.equal(expectedClientConfig);

    clientConfig = await clientConfigManager.getClientConfig();
    expect(clientConfig).to.deep.equal(expectedClientConfig);
  });

  it('fetchClientConfig should include skipAccountCreationScreen override', async () => {
    clientConfigManager = new ClientConfigManager(deps, 'pubId', fetcher, {
      skipAccountCreationScreen: true,
    });
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({autoPromptConfig: {impressionConfig: {maxImpressions: 1}}})
      .once();

    let clientConfig = await clientConfigManager.fetchClientConfig();
    const expectedAutoPromptConfig = new AutoPromptConfig({maxImpressions: 1});
    const expectedClientConfig = new ClientConfig({
      autoPromptConfig: expectedAutoPromptConfig,
      skipAccountCreationScreen: true,
    });
    expect(clientConfig).to.deep.equal(expectedClientConfig);

    clientConfig = await clientConfigManager.getClientConfig();
    expect(clientConfig).to.deep.equal(expectedClientConfig);
  });

  it('fetchClientConfig should use article from entitlementsManager if provided', async () => {
    const article = {
      clientConfig: new ClientConfig({
        autoPromptConfig: new AutoPromptConfig({maxImpressions: 1}),
      }),
    };
    entitlementsManagerMock.returns({
      getArticle: () => Promise.resolve(article),
    });

    const clientConfig = await clientConfigManager.fetchClientConfig();

    expect(clientConfig).to.deep.equal(article.clientConfig);
  });

  it('fetchClientConfig should wait on the readyPromise before fetching if provided', async () => {
    let sequence = 0;
    const readyPromise = Promise.resolve().then(() => sequence++);
    entitlementsManagerMock.returns({
      getArticle: () =>
        new Promise((resolve) => {
          sequence++;
          resolve({
            clientConfig: new ClientConfig({}),
          });
        }),
    });

    await clientConfigManager.fetchClientConfig(readyPromise);

    expect(sequence).to.equal(
      2,
      '2 sequenced promises should have been called'
    );
    expect(await readyPromise).to.equal(
      0,
      'readyPromise should have been called first'
    );
  });

  it('fetchClientConfig should throw an error for undefined publication ID', async () => {
    clientConfigManager = new ClientConfigManager(deps, undefined, fetcher);
    fetcherMock.expects('fetchCredentialedJson').never();

    expect(() => {
      clientConfigManager.fetchClientConfig();
    }).to.throw('fetchClientConfig requires publicationId');
  });

  it('getAutoPromptConfig should return undefined if the autoPromptConfig is not present in the response', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({})
      .once();

    const autoPromptConfig = await clientConfigManager.getAutoPromptConfig();
    expect(autoPromptConfig).to.be.undefined;
  });

  it('getAutoPromptConfig should return AutoPromptConfig object even if part of the config is missing', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({autoPromptConfig: {impressionConfig: {maxImpressions: 3}}})
      .once();

    const autoPromptConfig = await clientConfigManager.getAutoPromptConfig();
    expect(autoPromptConfig.impressionConfig.maxImpressions).to.equal(3);
    expect(autoPromptConfig.clientDisplayTrigger).to.not.be.undefined;
    expect(autoPromptConfig.explicitDismissalConfig).to.not.be.undefined;
  });

  it('getAutoPromptConfig should return AutoPromptConfig object', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({
        autoPromptConfig: {
          clientDisplayTrigger: {displayDelaySeconds: 2},
          explicitDismissalConfig: {
            backOffSeconds: 3,
            maxDismissalsPerWeek: 4,
            maxDismissalsResultingHideSeconds: 5,
          },
          impressionConfig: {
            backOffSeconds: 6,
            maxImpressions: 7,
            maxImpressionsResultingHideSeconds: 8,
          },
        },
      })
      .once();

    const autoPromptConfig = await clientConfigManager.getAutoPromptConfig();
    expect(autoPromptConfig.clientDisplayTrigger.displayDelaySeconds).to.equal(
      2
    );
    expect(autoPromptConfig.explicitDismissalConfig.backOffSeconds).to.equal(3);
    expect(
      autoPromptConfig.explicitDismissalConfig.maxDismissalsPerWeek
    ).to.equal(4);
    expect(
      autoPromptConfig.explicitDismissalConfig.maxDismissalsResultingHideSeconds
    ).to.equal(5);
    expect(autoPromptConfig.impressionConfig.backOffSeconds).to.equal(6);
    expect(autoPromptConfig.impressionConfig.maxImpressions).to.equal(7);
    expect(
      autoPromptConfig.impressionConfig.maxImpressionsResultingHideSeconds
    ).to.equal(8);
  });

  it('getClientConfig should return a Promise with an empty config if fetchClientConfig is not called', async () => {
    const clientConfig = await clientConfigManager.getClientConfig();
    const expectedClientConfig = new ClientConfig({usePrefixedHostPath: true});
    expect(clientConfig).to.deep.equal(expectedClientConfig);
  });

  describe('prefers `paySwgVersion` from `deps.config()`, if available', () => {
    it('before fetching client config', async () => {
      config.paySwgVersion = '123';

      const clientConfig = await clientConfigManager.getClientConfig();

      expect(clientConfig.paySwgVersion).to.equal('123');
    });

    it('after fetching client config', async () => {
      config.paySwgVersion = '123';

      // Mock response.
      const expectedUrl =
        'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
      fetcherMock
        .expects('fetchCredentialedJson')
        .withExactArgs(expectedUrl)
        .resolves({paySwgVersion: '999'})
        .once();

      const clientConfig = await clientConfigManager.fetchClientConfig();

      expect(clientConfig.paySwgVersion).to.equal('123');
    });
  });

  it('should return default client options if unspecified', () => {
    expect(clientConfigManager.getLanguage()).to.equal('en');
    expect(clientConfigManager.getTheme()).to.equal(ClientTheme.LIGHT);
  });

  it('should default theme to dark if the user prefers it', () => {
    const mockMatchMedia = sandbox
      .mock(self, 'matchMedia')
      .expects('matchMedia')
      .withExactArgs('(prefers-color-scheme: dark)')
      .returns({matches: true});

    expect(clientConfigManager.getTheme()).to.equal(ClientTheme.DARK);

    mockMatchMedia.verify();
  });

  it('should return the language set in the constructor', () => {
    clientConfigManager = new ClientConfigManager(deps, 'pubId', fetcher, {
      lang: 'fr',
    });
    expect(clientConfigManager.getLanguage()).to.equal('fr');
    expect(clientConfigManager.getTheme()).to.equal(ClientTheme.LIGHT);
  });

  it('should return the theme set in the constructor', () => {
    clientConfigManager = new ClientConfigManager(deps, 'pubId', fetcher, {
      theme: ClientTheme.DARK,
    });
    expect(clientConfigManager.getTheme()).to.equal(ClientTheme.DARK);
    expect(clientConfigManager.getLanguage()).to.equal('en');
  });

  describe('shouldAllowScroll', () => {
    const testCases = [
      {
        description: 'allowScroll is not set',
        clientOptions: {},
        expected: false,
      },
      {
        description: 'allowScroll is set false',
        clientOptions: {
          allowScroll: false,
        },
        expected: false,
      },
      {
        description: 'allowScroll is set true',
        clientOptions: {
          allowScroll: true,
        },
        expected: true,
      },
    ];
    for (const testCase of testCases) {
      it(`shouldAllowScroll returns ${testCase.expected} when ${testCase.description}`, () => {
        clientConfigManager = new ClientConfigManager(
          deps,
          'pubId',
          fetcher,
          testCase.clientOptions
        );
        expect(clientConfigManager.shouldAllowScroll()).to.equal(
          testCase.expected
        );
      });
    }
  });

  describe('shouldForceLangInIframes', () => {
    const testCases = [
      {
        description: 'forceLangInIframes=true and lang is set',
        clientOptions: {
          forceLangInIframes: true,
          lang: 'fr-CA',
        },
        expected: true,
      },
      {
        description: 'forceLangInIframes=true and lang is not set',
        clientOptions: {
          forceLangInIframes: true,
        },
        expected: false,
      },
      {
        description: 'forceLangInIframes=false and lang is set',
        clientOptions: {
          forceLangInIframes: false,
          lang: 'fr-CA',
        },
        expected: false,
      },
      {
        description: 'forceLangInIframes is not set',
        clientOptions: {
          lang: 'fr-CA',
        },
        expected: false,
      },
    ];

    for (const testCase of testCases) {
      it(`returns ${testCase.expected} when ${testCase.description}`, () => {
        clientConfigManager = new ClientConfigManager(
          deps,
          'pubId',
          fetcher,
          testCase.clientOptions
        );
        expect(clientConfigManager.shouldForceLangInIframes()).to.equal(
          testCase.expected
        );
      });
    }
  });

  it('shouldEnableButton should return false if disableButton is set to be true in ClientOptions', async () => {
    clientConfigManager = new ClientConfigManager(deps, 'pubId', fetcher, {
      disableButton: true,
    });

    const shouldEnableButton = await clientConfigManager.shouldEnableButton();
    expect(shouldEnableButton).to.equal(false);
  });

  it('shouldEnableButton should return true if ClientConfig has UI predicate canDisplayButton set to be true', async () => {
    clientConfigManager = new ClientConfigManager(deps, 'pubId', fetcher, {
      disableButton: false, // this will be ignored
    });

    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({
        uiPredicates: {
          canDisplayButton: true,
        },
      })
      .once();

    const data = await clientConfigManager.shouldEnableButton();
    expect(data).to.be.true;
  });

  it('shouldEnableButton should return undefined if ClientConfig has UI predicate canDisplayButton is not set', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({})
      .once();

    const data = await clientConfigManager.shouldEnableButton();
    expect(data).to.be.undefined;
  });

  it('getClientConfig should have paySwgVersion after fetch', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({paySwgVersion: '2'})
      .once();

    const clientConfig = await clientConfigManager.fetchClientConfig();
    expect(clientConfig.paySwgVersion).to.equal('2');
  });

  it('getClientConfig should have useUpdatedOfferFlows after fetch', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({useUpdatedOfferFlows: true})
      .once();

    const clientConfig = await clientConfigManager.fetchClientConfig();
    expect(clientConfig.useUpdatedOfferFlows).to.be.true;
  });

  it('getClientConfig should use default useUpdatedOfferFlows value after fetch if the response did not contain a useUpdatedOfferFlows value', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({useUpdatedOfferFlows: false})
      .once();

    const clientConfig = await clientConfigManager.fetchClientConfig();
    expect(clientConfig.useUpdatedOfferFlows).to.be.false;
  });

  it('getClientConfig should have uiPredicates after fetch if the response did not contain a useUpdatedOfferFlows value', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({
        uiPredicates: {
          canDisplayAutoPrompt: true,
          canDisplayButton: true,
        },
      })
      .once();

    const clientConfig = await clientConfigManager.fetchClientConfig();
    expect(clientConfig.uiPredicates.canDisplayButton).to.be.true;
    expect(clientConfig.uiPredicates.canDisplayAutoPrompt).to.be.true;
  });

  it('getClientConfig should have attributionParams', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pubId/clientconfiguration';
    const expectedDisplayName = 'Display Name';
    const expectedAvatarUrl = 'avatar.png';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({
        attributionParams: {
          displayName: expectedDisplayName,
          avatarUrl: expectedAvatarUrl,
        },
      })
      .once();

    const clientConfig = await clientConfigManager.fetchClientConfig();
    expect(clientConfig.attributionParams.displayName).to.equal(
      expectedDisplayName
    );
    expect(clientConfig.attributionParams.avatarUrl).to.equal(
      expectedAvatarUrl
    );
  });
});
