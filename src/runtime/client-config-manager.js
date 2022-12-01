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
import {ClientConfig, UiPredicates} from '../model/client-config';
import {ClientTheme} from '../api/basic-subscriptions';
import {serviceUrl} from './services';
import {warn} from '../utils/log';

/**
 * Manager of how the client should be configured. Fetches and stores
 * configuration details from the server.
 */
export class ClientConfigManager {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {string} publicationId
   * @param {!./fetcher.Fetcher} fetcher
   * @param {!../api/basic-subscriptions.ClientOptions=} clientOptions
   */
  constructor(deps, publicationId, fetcher, clientOptions) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!../api/basic-subscriptions.ClientOptions} */
    this.clientOptions_ = clientOptions || {};

    /** @private @const {string} */
    this.publicationId_ = publicationId;

    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;

    /** @private {?Promise<!ClientConfig>} */
    this.responsePromise_ = null;

    /** @private @const {ClientConfig} */
    this.defaultConfig_ = new ClientConfig({
      skipAccountCreationScreen: this.clientOptions_.skipAccountCreationScreen,
      usePrefixedHostPath: true,
    });
  }

  /**
   * Fetches the client config from the server.
   * @param {Promise<void>=} readyPromise optional promise to wait on before
   * attempting to fetch the clientConfiguration.
   * @return {!Promise<!ClientConfig>}
   */
  fetchClientConfig(readyPromise) {
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
   * @return {!Promise<!ClientConfig>}
   */
  getClientConfig() {
    return this.responsePromise_ || Promise.resolve(this.defaultConfig_);
  }

  /**
   * Convenience method for retrieving the auto prompt portion of the client
   * configuration.
   * @return {!Promise<!../model/auto-prompt-config.AutoPromptConfig|undefined>}
   */
  getAutoPromptConfig() {
    if (!this.responsePromise_) {
      this.fetchClientConfig();
    }
    return this.responsePromise_.then(
      (clientConfig) => clientConfig.autoPromptConfig
    );
  }

  /**
   * Gets the language the UI should be displayed in. See
   * src/api/basic-subscriptions.ClientOptions.lang.
   * @return {string}
   */
  getLanguage() {
    return this.clientOptions_.lang || 'en';
  }

  /**
   * Gets the theme the UI should be displayed in. See
   * src/api/basic-subscriptions.ClientOptions.theme.
   * @return {!../api/basic-subscriptions.ClientTheme}
   */
  getTheme() {
    const themeDefault = self.matchMedia(`(prefers-color-scheme: dark)`).matches
      ? ClientTheme.DARK
      : ClientTheme.LIGHT;
    return this.clientOptions_.theme || themeDefault;
  }

  /**
   * Returns whether scrolling on main page should be allowed when
   * subscription or contribution dialog is displayed.
   * @return {boolean}
   */
  shouldAllowScroll() {
    return !!this.clientOptions_.allowScroll;
  }

  /**
   * Returns whether iframes should also use the language specified in the
   * client options, rather than the default of letting the iframes decide the
   * display language. Note that this will return false if the lang option is
   * not set, even if forceLangInIframes was set.
   * @return {boolean}
   */
  shouldForceLangInIframes() {
    return (
      !!this.clientOptions_.forceLangInIframes && !!this.clientOptions_.lang
    );
  }

  /**
   * Determines whether a subscription or contribution button should be disabled.
   * @returns {!Promise<boolean|undefined>}
   */
  shouldEnableButton() {
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
    return this.responsePromise_.then((clientConfig) => {
      if (clientConfig.uiPredicates?.canDisplayButton) {
        return true;
      } else {
        return false;
      }
    });
  }

  /**
   * Fetches the client config from the server.
   * @return {!Promise<!ClientConfig>}
   */
  fetch_() {
    return this.deps_
      .entitlementsManager()
      .getArticle()
      .then((article) => {
        if (article) {
          return this.parseClientConfig_(article['clientConfig']);
        } else {
          // If there was no article from the entitlement manager, we need
          // to fetch our own using the internal version.
          const url = serviceUrl(
            '/publication/' +
              encodeURIComponent(this.publicationId_) +
              '/clientconfiguration'
          );
          return this.fetcher_.fetchCredentialedJson(url).then((json) => {
            if (json.errorMessages && json.errorMessages.length > 0) {
              for (const errorMessage of json.errorMessages) {
                warn('SwG ClientConfigManager: ' + errorMessage);
              }
            }
            return this.parseClientConfig_(json);
          });
        }
      });
  }

  /**
   * Parses the fetched config into the ClientConfig container object.
   * @param {!Object} json
   * @return {!ClientConfig}
   */
  parseClientConfig_(json) {
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
      usePrefixedHostPath: json['usePrefixedHostPath'],
      useUpdatedOfferFlows: json['useUpdatedOfferFlows'],
      skipAccountCreationScreen: this.clientOptions_.skipAccountCreationScreen,
      uiPredicates,
      attributionParams,
    });
  }
}
