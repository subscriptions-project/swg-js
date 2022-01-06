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

import {AnalyticsEvent} from '../proto/api_messages';
import {AudienceActionFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {MiniPromptApi} from './mini-prompt-api';
import {assert} from '../utils/log';

const STORAGE_KEY_IMPRESSIONS = 'autopromptimp';
const STORAGE_KEY_DISMISSALS = 'autopromptdismiss';
const STORAGE_DELIMITER = ',';
const WEEK_IN_MILLIS = 604800000;
const SECOND_IN_MILLIS = 1000;

/** @const {!Array<!AnalyticsEvent>} */
const impressionEvents = [
  AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
  AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT,
  AnalyticsEvent.IMPRESSION_OFFERS,
  AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
  AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN,
  AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN,
];
/** @const {!Array<!AnalyticsEvent>} */
const dismissEvents = [
  AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE,
  AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE,
  AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED,
  AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED,
];

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

    /** @private @const {!./storage.Storage} */
    this.storage_ = deps.storage();

    this.deps_
      .eventManager()
      .registerEventListener(this.handleClientEvent_.bind(this));

    /** @private @const {!MiniPromptApi} */
    this.miniPromptAPI_ = this.getMiniPromptApi();
    this.miniPromptAPI_.init();

    /** @private {boolean} */
    this.autoPromptDisplayed_ = false;
  }

  /**
   * Returns an instance of MiniPromptApi. Can be overwridden by subclasses,
   * such as in order to instantiate a different implementation of
   * MiniPromptApi.
   * @return {!MiniPromptApi}
   * @protected
   */
  getMiniPromptApi() {
    return new MiniPromptApi(this.deps_);
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
   *   displayLargePromptFn: (function()|undefined),
   * }} params
   * @return {!Promise}
   */
  showAutoPrompt(params) {
    // Manual override of display rules, mainly for demo purposes.
    if (params.alwaysShow) {
      this.showPrompt_(params.autoPromptType, params.displayLargePromptFn);
      return Promise.resolve();
    }

    // Fetch entitlements and the client config from the server, so that we have
    // the information we need to determine whether and which prompt should be
    // displayed.
    return Promise.all([
      this.clientConfigManager_.getClientConfig(),
      this.entitlementsManager_.getEntitlements(),
      this.entitlementsManager_.getArticle(),
    ]).then((values) => {
      this.showAutoPrompt_(values[0], values[1], values[2], params);
    });
  }

  /**
   * Displays the appropriate auto prompt, depending on the fetched prompt
   * configuration, entitlement state, and options specified in params.
   * @param {!../model/client-config.ClientConfig|undefined} clientConfig
   * @param {!../api/entitlements.Entitlements} entitlements
   * @param {?./entitlements-manager.Article} article
   * @param {{
   *   autoPromptType: (AutoPromptType|undefined),
   *   alwaysShow: (boolean|undefined),
   *   displayLargePromptFn: (function()|undefined),
   * }} params
   * @return {!Promise}
   */
  showAutoPrompt_(clientConfig, entitlements, article, params) {
    return this.shouldShowAutoPrompt_(
      clientConfig,
      entitlements,
      params.autoPromptType
    ).then((shouldShowAutoPrompt) => {
      const promptFn =
        article.audienceActions?.actions?.length > 0
          ? this.showAudienceActionPrompt_({
              action: article.audienceActions.actions[0].type,
              autoPromptType: params.autoPromptType,
              fallback: params.displayLargePromptFn,
            })
          : params.displayLargePromptFn;

      if (!shouldShowAutoPrompt) {
        if (this.shouldShowLockedContentPrompt_(entitlements) && promptFn) {
          promptFn();
        }
        return;
      }
      this.deps_.win().setTimeout(() => {
        this.autoPromptDisplayed_ = true;
        this.showPrompt_(params.autoPromptType, params.displayLargePromptFn);
      }, (clientConfig?.autoPromptConfig.clientDisplayTrigger.displayDelaySeconds || 0) * SECOND_IN_MILLIS);
    });
  }

  /**
   * Determines whether a mini prompt for contributions or subscriptions should
   * be shown.
   * @param {!../model/client-config.ClientConfig|undefined} clientConfig
   * @param {!../api/entitlements.Entitlements} entitlements
   * @param {!AutoPromptType|undefined} autoPromptType
   * @returns {!Promise<boolean>}
   */
  shouldShowAutoPrompt_(clientConfig, entitlements, autoPromptType) {
    // If false publication predicate was returned in the response, don't show
    // the prompt.
    if (
      clientConfig.uiPredicates &&
      !clientConfig.uiPredicates.canDisplayAutoPrompt
    ) {
      return Promise.resolve(false);
    }

    // If the auto prompt type is not supported, don't show the prompt.
    if (
      autoPromptType === undefined ||
      autoPromptType === AutoPromptType.NONE
    ) {
      return Promise.resolve(false);
    }

    // If we found a valid entitlement, don't show the prompt.
    if (entitlements.enablesThis()) {
      return Promise.resolve(false);
    }

    // The auto prompt is only for non-paygated content.
    if (this.pageConfig_.isLocked()) {
      return Promise.resolve(false);
    }

    // Don't cap subscription prompts.
    if (
      autoPromptType === AutoPromptType.SUBSCRIPTION ||
      autoPromptType === AutoPromptType.SUBSCRIPTION_LARGE
    ) {
      return Promise.resolve(true);
    }

    // If no auto prompt config was returned in the response, don't show
    // the prompt.
    let autoPromptConfig = undefined;
    if (
      clientConfig === undefined ||
      clientConfig.autoPromptConfig === undefined
    ) {
      return Promise.resolve(false);
    } else {
      autoPromptConfig = clientConfig.autoPromptConfig;
    }

    // Fetched config returned no maximum cap.
    if (autoPromptConfig.maxImpressionsPerWeek === undefined) {
      return Promise.resolve(true);
    }

    // See if we should display the auto prompt based on the config and logged
    // events.
    return Promise.all([this.getImpressions_(), this.getDismissals_()]).then(
      (values) => {
        const impressions = values[0];
        const dismissals = values[1];

        // If the user has reached the maxDismissalsPerWeek, and
        // maxDismissalsResultingHideSeconds has not yet passed, don't show the
        // prompt.
        if (
          autoPromptConfig.explicitDismissalConfig.maxDismissalsPerWeek !==
            undefined &&
          dismissals.length >=
            autoPromptConfig.explicitDismissalConfig.maxDismissalsPerWeek &&
          Date.now() - dismissals[dismissals.length - 1] <
            (autoPromptConfig.explicitDismissalConfig
              .maxDismissalsResultingHideSeconds || 0) *
              SECOND_IN_MILLIS
        ) {
          return false;
        }

        // If the user has previously dismissed the prompt, and backoffSeconds has
        // not yet passed, don't show the prompt.
        if (
          autoPromptConfig.explicitDismissalConfig.backoffSeconds !==
            undefined &&
          dismissals.length > 0 &&
          Date.now() - dismissals[dismissals.length - 1] <
            autoPromptConfig.explicitDismissalConfig.backoffSeconds *
              SECOND_IN_MILLIS
        ) {
          return false;
        }

        // If the user has reached maxImpressionsPerWeek, don't show the prompt.
        if (
          autoPromptConfig.maxImpressionsPerWeek !== undefined &&
          impressions.length >= autoPromptConfig.maxImpressionsPerWeek
        ) {
          return false;
        }
        return true;
      }
    );
  }

  /**
   * @param {{
   *  action: (string|undefined),
   *  autoPromptType: (AutoPromptType|undefined),
   *  fallback: (function()|undefined)
   * }} params
   * @return {!function()}
   */
  audienceActionPrompt_({action, autoPromptType, fallback}) {
    return () => {
      const params = {
        action,
        fallback:
          autoPromptType === AutoPromptType.SUBSCRIPTION ||
          autoPromptType === AutoPromptType.SUBSCRIPTION_LARGE
            ? fallback
            : undefined,
      };

      new AudienceActionFlow(this.deps_, params).start();
    };
  }

  /**
   * Shows the prompt based on the type specified.
   * @param {AutoPromptType|undefined} autoPromptType
   * @param {function()|undefined} displayLargePromptFn
   * @returns
   */
  showPrompt_(autoPromptType, displayLargePromptFn) {
    if (
      autoPromptType === AutoPromptType.SUBSCRIPTION ||
      autoPromptType === AutoPromptType.CONTRIBUTION
    ) {
      this.miniPromptAPI_.create({
        autoPromptType,
        clickCallback: displayLargePromptFn,
      });
    } else if (
      (autoPromptType === AutoPromptType.SUBSCRIPTION_LARGE ||
        autoPromptType === AutoPromptType.CONTRIBUTION_LARGE) &&
      displayLargePromptFn
    ) {
      displayLargePromptFn();
    }
  }

  /**
   * Determines whether a larger, blocking prompt should be shown.
   * @param {!../api/entitlements.Entitlements} entitlements
   * @returns {boolean}
   */
  shouldShowLockedContentPrompt_(entitlements) {
    return this.pageConfig_.isLocked() && !entitlements.enablesThis();
  }

  /**
   * Listens for relevant prompt impression and dismissal events, and logs them
   * to local storage for use in determining whether to display the prompt in
   * the future.
   * @param {../api/client-event-manager-api.ClientEvent} event
   * @return {!Promise}
   */
  handleClientEvent_(event) {
    // Impressions and dimissals of forced (for paygated) or manually triggered
    // prompts do not count toward the frequency caps.
    if (
      !this.autoPromptDisplayed_ ||
      this.pageConfig_.isLocked() ||
      !event.eventType
    ) {
      return Promise.resolve();
    }

    if (impressionEvents.includes(event.eventType)) {
      return this.storeEvent_(STORAGE_KEY_IMPRESSIONS);
    }

    if (dismissEvents.includes(event.eventType)) {
      return this.storeEvent_(STORAGE_KEY_DISMISSALS);
    }

    return Promise.resolve();
  }

  /**
   * Stores the current time to local storage, under the storageKey provided.
   * Removes times older than a week in the process.
   * @param {string} storageKey
   */
  storeEvent_(storageKey) {
    return this.storage_
      .get(storageKey, /* useLocalStorage */ true)
      .then((value) => {
        const dateValues = this.filterOldValues_(
          this.storedValueToDateArray_(value)
        );
        dateValues.push(Date.now());
        const valueToStore = this.arrayToStoredValue_(dateValues);
        this.storage_.set(storageKey, valueToStore, /* useLocalStorage */ true);
      });
  }

  /**
   * Retrieves the locally stored impressions of the auto prompt, within a week
   * of the current time.
   * @return {!Promise<!Array<number>>}
   */
  getImpressions_() {
    return this.getEvent_(STORAGE_KEY_IMPRESSIONS);
  }

  /**
   * Retrieves the locally stored dismissals of the auto prompt, within a week
   * of the current time.
   * @return {!Promise<!Array<number>>}
   */
  getDismissals_() {
    return this.getEvent_(STORAGE_KEY_DISMISSALS);
  }

  /**
   * Retrieves the current time to local storage, under the storageKey provided.
   * Filters out timestamps older than a week.
   * @param {string} storageKey
   * @return {!Promise<!Array<number>>}
   */
  getEvent_(storageKey) {
    return this.storage_
      .get(storageKey, /* useLocalStorage */ true)
      .then((value) => {
        return this.filterOldValues_(this.storedValueToDateArray_(value));
      });
  }

  /**
   * Converts a stored series of timestamps to an array of numbers.
   * @param {?string} value
   * @return {!Array<number>}
   */
  storedValueToDateArray_(value) {
    if (value === null) {
      return [];
    }
    return value
      .split(STORAGE_DELIMITER)
      .map((dateStr) => parseInt(dateStr, 10));
  }

  /**
   * Converts an array of numbers to a concatenated string of timestamps for
   * storage.
   * @param {!Array<number>} dateArray
   * @return {string}
   */
  arrayToStoredValue_(dateArray) {
    return dateArray.join(STORAGE_DELIMITER);
  }

  /**
   * Filters out values that are older than a week.
   * @param {!Array<number>} dateArray
   * @return {!Array<number>}
   */
  filterOldValues_(dateArray) {
    const now = Date.now();
    let sliceIndex = dateArray.length;
    for (let i = 0; i < dateArray.length; i++) {
      // The arrays are sorted in time, so if you find a time in the array
      // that's within the week boundary, we can skip over the remainder because
      // the rest of the array else should be too.
      if (now - dateArray[i] <= WEEK_IN_MILLIS) {
        sliceIndex = i;
        break;
      }
    }
    return dateArray.slice(sliceIndex);
  }
}
