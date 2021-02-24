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

import {AutoPromptType} from '../api/basic-subscriptions';
import {assert} from '../utils/log';

/**
 * Manages the display of subscription/contribution prompts automatically
 * displayed to the user.
 */
export class AutoPromptManager {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = deps.pageConfig();

    /** @private @const {!./entitlements-manager.EntitlementsManager} */
    this.entitlementsManager_ = deps.entitlementsManager();

    /** @private @const {?./client-config-manager.ClientConfigManager} */
    this.clientConfigManager_ = deps.clientConfigManager();
    assert(
      this.clientConfigManager_,
      'AutoPromptManager requires an instance of ClientConfigManager.'
    );
  }

  /**
   * Triggers the display of the auto prompt, if preconditions are met.
   * Preconditions are as follows:
   *   - alwaysShow == true, used for demo purposes, OR
   *   - There is no active entitlement found AND
   *   - The user had not reached the maximum impressions allowed, as specified
   *     by the publisher
   * A prompt may not be displayed if the appropriate criteria are not met.
   * @param {{
   *   autoPromptType: (AutoPromptType|undefined),
   *   alwaysShow: (boolean|undefined),
   * }=} options
   * @param {function()=} displayForLockedContentFn
   * @return {!Promise}
   */
  showAutoPrompt(options, displayForLockedContentFn) {
    // Manual override of display rules, mainly for demo purposes.
    if (options.alwaysShow) {
      // TODO(stellachui): Show the mini prompt.
      return Promise.resolve();
    }

    // Fetch entitlements and the client config from the server, so that we have
    // the information we need to determine whether and which prompt should be
    // displayed.
    return Promise.all([
      this.clientConfigManager_.getAutoPromptConfig(),
      this.entitlementsManager_.getEntitlements(),
    ]).then((values) => {
      this.showAutoPrompt_(
        values[0],
        values[1],
        options,
        displayForLockedContentFn
      );
    });
  }

  /**
   * Displays the appropriate auto prompt, depending on the fetched prompt
   * configuration, entitlement state, and options specified.
   * @param {!../model/auto-prompt-config.AutoPromptConfig} autoPromptConfig
   * @param {!../api/entitlements.Entitlements} entitlements
   * @param {{
   *   autoPromptType: (AutoPromptType|undefined),
   *   alwaysShow: (boolean|undefined),
   * }=} options
   * @param {function()=} displayForLockedContentFn
   */
  showAutoPrompt_(
    autoPromptConfig,
    entitlements,
    options,
    displayForLockedContentFn
  ) {
    if (!this.shouldShowMiniPrompt_(autoPromptConfig, entitlements, options)) {
      if (
        this.shouldShowLockedContentPrompt_(entitlements) &&
        displayForLockedContentFn
      ) {
        displayForLockedContentFn();
      }
      return;
    }
    // TODO(stellachui): Show the mini prompt.
  }

  /**
   * Determines whether a mini prompt for contributions or subscriptions should
   * be shown.
   * @param {!../model/auto-prompt-config.AutoPromptConfig} autoPromptConfig
   * @param {!../api/entitlements.Entitlements} entitlements
   * @param {{
   *   autoPromptType: (AutoPromptType|undefined),
   *   alwaysShow: (boolean|undefined),
   * }=} options
   * @returns {boolean}
   */
  shouldShowMiniPrompt_(autoPromptConfig, entitlements, options) {
    // If the mini auto prompt type is not supported, don't show the prompt.
    if (
      options.autoPromptType === undefined ||
      options.autoPromptType == AutoPromptType.NONE
    ) {
      return false;
    }

    // If we found a valid entitlement, don't show the prompt.
    if (entitlements.enablesThis()) {
      return false;
    }

    // The mini auto prompt is only for non-paygated content.
    if (this.pageConfig_.isLocked()) {
      return false;
    }

    // Don't cap subscription prompts.
    if (options.autoPromptType == AutoPromptType.SUBSCRIPTION) {
      return true;
    }

    // If no mini auto prompt config was returned in the response, don't show
    // the prompt.
    if (autoPromptConfig == undefined) {
      return false;
    }

    // Fetched config returned no maximum cap.
    if (autoPromptConfig.maxImpressionsPerWeek == undefined) {
      return true;
    }

    // TODO(stellachui): Check local storage for previous impressions, and
    //   return based on the number vs the max allowed per week.
    return true;
  }

  /**
   * Determines whether a larger, blocking prompt should be shown.
   * @param {!../api/entitlements.Entitlements} entitlements
   * @returns {boolean}
   */
  shouldShowLockedContentPrompt_(entitlements) {
    return this.pageConfig_.isLocked() && !entitlements.enablesThis();
  }
}
