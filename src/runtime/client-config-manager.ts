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

import {AttributionParams} from '../model/attribution-params';
import {AutoPromptConfig} from '../model/auto-prompt-config';
import {
  ClientConfig,
  ClientConfigJson,
  UiPredicates,
} from '../model/client-config';
import {ClientOptions, ClientTheme} from '../api/basic-subscriptions';
import {Deps} from './deps';
import {Fetcher} from './fetcher';
import {serviceUrl} from './services';

/**
 * Manager of how the client should be configured. Fetches and stores
 * configuration details from the server.
 */
export class ClientConfigManager {
  private responsePromise_: Promise<ClientConfig> | null = null;
  private readonly defaultConfig_: ClientConfig;

  constructor(
    private readonly deps_: Deps,
    private readonly publicationId_: string,
    private readonly fetcher_: Fetcher,
    private readonly clientOptions_: ClientOptions = {}
  ) {
    this.defaultConfig_ = new ClientConfig({
      skipAccountCreationScreen: clientOptions_.skipAccountCreationScreen,
    });
  }

  /**
   * Fetches the client config from the server.
   * @param readyPromise Optional promise to wait on before attempting to fetch the clientConfiguration.
   */
  fetchClientConfig(readyPromise?: Promise<void>): Promise<ClientConfig> {
    if (!this.publicationId_) {
      throw new Error('fetchClientConfig requires publicationId');
    }
    if (!this.responsePromise_) {
      readyPromise = readyPromise || Promise.resolve();
      this.responsePromise_ = readyPromise.then(() => this.fetch_());
    }
    return this.responsePromise_;
  }

  /**
   * Gets the client config, if already requested. Otherwise returns a Promise
   * with an empty ClientConfig.
   */
  getClientConfig(): Promise<ClientConfig> {
    return this.responsePromise_ || Promise.resolve(this.defaultConfig_);
  }

  /**
   * Convenience method for retrieving the auto prompt portion of the client
   * configuration.
   */
  async getAutoPromptConfig(): Promise<AutoPromptConfig | null | undefined> {
    if (!this.responsePromise_) {
      this.fetchClientConfig();
    }
    const clientConfig = await this.responsePromise_;
    return clientConfig?.autoPromptConfig;
  }

  /**
   * Gets the language the UI should be displayed in. See
   * src/api/basic-subscriptions.ClientOptions.lang.
   */
  getLanguage(): string {
    return this.clientOptions_.lang || 'en';
  }

  /**
   * Gets the theme the UI should be displayed in. See
   * src/api/basic-subscriptions.ClientOptions.theme.
   */
  getTheme(): ClientTheme {
    const themeDefault = self.matchMedia(`(prefers-color-scheme: dark)`).matches
      ? ClientTheme.DARK
      : ClientTheme.LIGHT;
    return this.clientOptions_.theme || themeDefault;
  }

  /**
   * Returns whether scrolling on main page should be allowed when
   * subscription or contribution dialog is displayed.
   */
  shouldAllowScroll(): boolean {
    return !!this.clientOptions_.allowScroll;
  }

  /**
   * Returns whether iframes should also use the language specified in the
   * client options, rather than the default of letting the iframes decide the
   * display language. Note that this will return false if the lang option is
   * not set, even if forceLangInIframes was set.
   */
  shouldForceLangInIframes(): boolean {
    return (
      !!this.clientOptions_.forceLangInIframes && !!this.clientOptions_.lang
    );
  }

  /**
   * Determines whether a subscription or contribution button should be disabled.
   */
  async shouldEnableButton(): Promise<boolean | void> {
    // Disable button if disableButton is set to be true in clientOptions.
    // If disableButton is set to be false or not set, then always enable button.
    // This is for testing purpose.
    if (this.clientOptions_.disableButton) {
      return Promise.resolve(false);
    }

    if (!this.responsePromise_) {
      this.fetchClientConfig();
    }

    // UI predicates decides whether to enable button.
    const clientConfig = await this.responsePromise_;
    return clientConfig?.uiPredicates?.canDisplayButton;
  }

  /**
   * Fetches the client config from the server.
   */
  async fetch_(): Promise<ClientConfig> {
    const article = await this.deps_.entitlementsManager().getArticle();

    if (article) {
      return this.parseClientConfig_(article['clientConfig']);
    }

    // If there was no article from the entitlement manager, we need
    // to fetch our own using the internal version.
    const url = serviceUrl(
      '/publication/' +
        encodeURIComponent(this.publicationId_) +
        '/clientconfiguration'
    );
    const json = await this.fetcher_.fetchCredentialedJson(url);
    return this.parseClientConfig_(json);
  }

  /**
   * Parses the fetched config into the ClientConfig container object.
   */
  parseClientConfig_(json: ClientConfigJson): ClientConfig {
    const paySwgVersion = json['paySwgVersion'];
    const autoPromptConfigJson = json['autoPromptConfig'];
    let autoPromptConfig = undefined;
    if (autoPromptConfigJson) {
      autoPromptConfig = new AutoPromptConfig({
        displayDelaySeconds:
          autoPromptConfigJson.clientDisplayTrigger?.displayDelaySeconds,
        dismissalBackOffSeconds:
          autoPromptConfigJson.explicitDismissalConfig?.backOffSeconds,
        maxDismissalsPerWeek:
          autoPromptConfigJson.explicitDismissalConfig?.maxDismissalsPerWeek,
        maxDismissalsResultingHideSeconds:
          autoPromptConfigJson.explicitDismissalConfig
            ?.maxDismissalsResultingHideSeconds,
        impressionBackOffSeconds:
          autoPromptConfigJson.impressionConfig?.backOffSeconds,
        maxImpressions: autoPromptConfigJson.impressionConfig?.maxImpressions,
        maxImpressionsResultingHideSeconds:
          autoPromptConfigJson.impressionConfig
            ?.maxImpressionsResultingHideSeconds,
      });
    }

    const uiPredicatesJson = json['uiPredicates'];
    let uiPredicates = undefined;
    if (uiPredicatesJson) {
      uiPredicates = new UiPredicates(
        uiPredicatesJson.canDisplayAutoPrompt,
        uiPredicatesJson.canDisplayButton,
        uiPredicatesJson.purchaseUnavailableRegion
      );
    }

    const attributionParamsJson = json['attributionParams'];
    let attributionParams;
    if (attributionParamsJson) {
      attributionParams = new AttributionParams(
        attributionParamsJson.displayName,
        attributionParamsJson.avatarUrl
      );
    }

    return new ClientConfig({
      autoPromptConfig,
      paySwgVersion,
      useUpdatedOfferFlows: json['useUpdatedOfferFlows'],
      skipAccountCreationScreen: this.clientOptions_.skipAccountCreationScreen,
      uiPredicates,
      attributionParams,
    });
  }
}
