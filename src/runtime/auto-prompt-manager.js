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

import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {AudienceActionFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ExperimentFlags} from './experiment-flags';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {MiniPromptApi} from './mini-prompt-api';
import {StorageKeys} from '../utils/constants';
import {assert} from '../utils/log';
import {isExperimentOn} from './experiments';

const TYPE_CONTRIBUTION = 'TYPE_CONTRIBUTION';
const TYPE_SUBSCRIPTION = 'TYPE_SUBSCRIPTION';
const TYPE_REWARDED_SURVEY = 'TYPE_REWARDED_SURVEY';
const SECOND_IN_MILLIS = 1000;

/** @const {!Array<!AnalyticsEvent>} */
const impressionEvents = [
  AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
  AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT,
  AnalyticsEvent.IMPRESSION_OFFERS,
  AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
];
/** @const {!Array<!AnalyticsEvent>} */
const dismissEvents = [
  AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE,
  AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE,
  AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED,
  AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED,
];

/** @const {Map<AnalyticsEvent, string>} */
const COMPLETED_ACTION_TO_STORAGE_KEY_MAP = new Map([
  [AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER, StorageKeys.SURVEY_COMPLETED],
]);

/**
 * @typedef {{
 *   autoPromptType: (AutoPromptType|undefined),
 *   alwaysShow: (boolean|undefined),
 *   displayLargePromptFn: (function()|undefined),
 *   isAccessibleForFree: (boolean|undefined),
 * }}
 */
export let ShowAutoPromptParams;

/**
 * Manages the display of subscription/contribution prompts automatically
 * displayed to the user.
 */
export class AutoPromptManager {
  /**
   * @param {!./deps.Deps} deps
   * @param {!./runtime.ConfiguredRuntime} configuredRuntime
   */
  constructor(deps, configuredRuntime) {
    /** @private @const {!./deps.Deps} */
    this.deps_ = deps;

    /** @private @const {!../model/doc.Doc} */
    this.doc_ = deps.doc();

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
    this.miniPromptAPI_ = this.getMiniPromptApi(deps);
    this.miniPromptAPI_.init();

    /** @private {boolean} */
    this.wasAutoPromptDisplayed_ = false;

    /** @private {boolean} */
    this.hasStoredImpression = false;

    /** @private {?AudienceActionFlow} */
    this.lastAudienceActionFlow_ = null;

    /** @private {?Intervention} */
    this.interventionDisplayed_ = null;

    /** @private @const {!./client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();

    /** @private @const {!./runtime.ConfiguredRuntime} */
    this.configuredRuntime = configuredRuntime;
  }

  /**
   * Returns an instance of MiniPromptApi. Can be overwridden by subclasses,
   * such as in order to instantiate a different implementation of
   * MiniPromptApi.
   * @param {!./deps.Deps} deps
   * @return {!MiniPromptApi}
   * @protected
   */
  getMiniPromptApi(deps) {
    return new MiniPromptApi(deps);
  }

  /**
   * Triggers the display of the auto prompt, if preconditions are met.
   * Preconditions are as follows:
   *   - alwaysShow == true, used for demo purposes, OR
   *   - There is no active entitlement found AND
   *   - The user had not reached the maximum impressions allowed, as specified
   *     by the publisher
   * A prompt may not be displayed if the appropriate criteria are not met.
   * @param {!ShowAutoPromptParams} params
   * @return {!Promise}
   */
  async showAutoPrompt(params) {
    // Manual override of display rules, mainly for demo purposes.
    if (params.alwaysShow) {
      this.showPrompt_(
        this.getPromptTypeToDisplay_(params.autoPromptType),
        params.displayLargePromptFn
      );
      return Promise.resolve();
    }

    // Fetch entitlements and the client config from the server, so that we have
    // the information we need to determine whether and which prompt should be
    // displayed.
    const [clientConfig, entitlements, article, dismissedPrompts] =
      await Promise.all([
        this.clientConfigManager_.getClientConfig(),
        this.entitlementsManager_.getEntitlements(),
        this.entitlementsManager_.getArticle(),
        this.storage_.get(
          StorageKeys.DISMISSED_PROMPTS,
          /* useLocalStorage */ true
        ),
      ]);

    this.showAutoPrompt_(
      clientConfig,
      entitlements,
      article,
      dismissedPrompts,
      params
    );
  }

  /**
   * Displays the appropriate auto prompt, depending on the fetched prompt
   * configuration, entitlement state, and options specified in params.
   * @param {!../model/client-config.ClientConfig|undefined} clientConfig
   * @param {!../api/entitlements.Entitlements} entitlements
   * @param {?./entitlements-manager.Article} article
   * @param {?string|undefined} dismissedPrompts
   * @param {!ShowAutoPromptParams} params
   * @return {!Promise}
   */
  async showAutoPrompt_(
    clientConfig,
    entitlements,
    article,
    dismissedPrompts,
    params
  ) {
    // Override autoPromptType if it is undefined.
    params.autoPromptType ??= this.getAutoPromptType_(
      article?.audienceActions?.actions
    );

    // Override isClosable if isAccessibleForFree is set in the page config.
    // Otherwise, for publications with a subscription revenue model the
    // prompt is blocking, while all others can be dismissed.
    const isClosable =
      params.isAccessibleForFree ?? !this.isSubscription_(params);

    if (this.isSubscription_(params)) {
      params.displayLargePromptFn = () => {
        this.configuredRuntime.showOffers({
          isClosable,
        });
      };
    } else if (this.isContribution_(params)) {
      params.displayLargePromptFn = () => {
        this.configuredRuntime.showContributionOptions({
          isClosable,
        });
      };
    }

    const shouldShowAutoPrompt = await this.shouldShowAutoPrompt_(
      clientConfig,
      entitlements,
      params.autoPromptType
    );

    const potentialAction = article
      ? await this.getAudienceActionPromptType_({
          article,
          autoPromptType: params.autoPromptType,
          dismissedPrompts,
          shouldShowAutoPrompt,
        })
      : undefined;

    const promptFn = potentialAction
      ? this.audienceActionPrompt_({
          action: potentialAction.type,
          configurationId: potentialAction.configurationId,
          autoPromptType: params.autoPromptType,
          isClosable,
        })
      : params.displayLargePromptFn;

    const shouldShowBlockingPrompt =
      this.shouldShowBlockingPrompt_(
        entitlements,
        /* hasPotentialAudienceAction */ !!potentialAction?.type
      ) && promptFn;
    if (!shouldShowAutoPrompt && !shouldShowBlockingPrompt) {
      return;
    }

    // Second Prompt Delay experiment
    const delaySecondPrompt = article
      ? await this.isExperimentEnabled_(
          article,
          ExperimentFlags.SECOND_PROMPT_DELAY
        )
      : false;
    if (this.isContribution_(params) && delaySecondPrompt) {
      const shouldSuppressAutoprompt =
        await this.secondPromptDelayExperimentSuppressesPrompt_(
          clientConfig?.autoPromptConfig?.clientDisplayTrigger
            ?.numImpressionsBetweenPrompts
        );
      if (shouldSuppressAutoprompt) {
        this.interventionDisplayed_ = null;
        return;
      }
    }

    const displayDelayMs =
      (clientConfig?.autoPromptConfig?.clientDisplayTrigger
        ?.displayDelaySeconds || 0) * SECOND_IN_MILLIS;

    const interventionDisplayedIsAutoPromptType =
      this.interventionDisplayed_ === null ||
      // Only need to check contributions because Subsciptions interventions
      // will not be saved.
      this.isContribution_({autoPromptType: this.interventionDisplayed_.type});
    if (shouldShowAutoPrompt && interventionDisplayedIsAutoPromptType) {
      this.deps_.win().setTimeout(() => {
        this.wasAutoPromptDisplayed_ = true;
        this.showPrompt_(
          this.getPromptTypeToDisplay_(params.autoPromptType),
          promptFn
        );
      }, displayDelayMs);
    } else {
      const isBlockingPromptWithDelay = this.isActionPromptWithDelay_(
        potentialAction?.type
      );
      this.deps_
        .win()
        .setTimeout(
          promptFn ? promptFn : null,
          isBlockingPromptWithDelay ? displayDelayMs : 0
        );
    }
  }

  /**
   * @param {!ShowAutoPromptParams} params
   * @return {!boolean}
   */
  isSubscription_(params) {
    return (
      params.autoPromptType === AutoPromptType.SUBSCRIPTION ||
      params.autoPromptType === AutoPromptType.SUBSCRIPTION_LARGE
    );
  }

  /**
   * @param {!ShowAutoPromptParams} params
   * @return {!boolean}
   */
  isContribution_(params) {
    return (
      params.autoPromptType === AutoPromptType.CONTRIBUTION ||
      params.autoPromptType === AutoPromptType.CONTRIBUTION_LARGE
    );
  }

  /**
   * Determines whether a mini prompt for contributions or subscriptions should
   * be shown.
   * @param {!../model/client-config.ClientConfig|undefined} clientConfig
   * @param {!../api/entitlements.Entitlements} entitlements
   * @param {!AutoPromptType|undefined} autoPromptType
   * @returns {!Promise<boolean>}
   */
  async shouldShowAutoPrompt_(clientConfig, entitlements, autoPromptType) {
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
    if (this.isSubscription_({autoPromptType})) {
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
    if (autoPromptConfig.impressionConfig.maxImpressions === undefined) {
      return Promise.resolve(true);
    }

    // See if we should display the auto prompt based on the config and logged
    // events.
    const [impressions, dismissals] = await Promise.all([
      this.getImpressions_(),
      this.getDismissals_(),
    ]);

    const lastImpression = impressions[impressions.length - 1];
    const lastDismissal = dismissals[dismissals.length - 1];

    // If the user has reached the maxDismissalsPerWeek, and
    // maxDismissalsResultingHideSeconds has not yet passed, don't show the
    // prompt.
    if (
      autoPromptConfig.explicitDismissalConfig.maxDismissalsPerWeek &&
      dismissals.length >=
        autoPromptConfig.explicitDismissalConfig.maxDismissalsPerWeek &&
      Date.now() - lastDismissal <
        (autoPromptConfig.explicitDismissalConfig
          .maxDismissalsResultingHideSeconds || 0) *
          SECOND_IN_MILLIS
    ) {
      return false;
    }

    // If the user has previously dismissed the prompt, and backOffSeconds has
    // not yet passed, don't show the prompt.
    if (
      autoPromptConfig.explicitDismissalConfig.backOffSeconds &&
      dismissals.length > 0 &&
      Date.now() - lastDismissal <
        autoPromptConfig.explicitDismissalConfig.backOffSeconds *
          SECOND_IN_MILLIS
    ) {
      return false;
    }

    // If the user has reached the maxImpressions, and
    // maxImpressionsResultingHideSeconds has not yet passed, don't show the
    // prompt.
    if (
      autoPromptConfig.impressionConfig.maxImpressions &&
      impressions.length >= autoPromptConfig.impressionConfig.maxImpressions &&
      Date.now() - lastImpression <
        (autoPromptConfig.impressionConfig.maxImpressionsResultingHideSeconds ||
          0) *
          SECOND_IN_MILLIS
    ) {
      return false;
    }

    // If the user has seen the prompt, and backOffSeconds has
    // not yet passed, don't show the prompt. This is to prevent the prompt
    // from showing in consecutive visits.
    if (
      autoPromptConfig.impressionConfig.backOffSeconds &&
      impressions.length > 0 &&
      Date.now() - lastImpression <
        autoPromptConfig.impressionConfig.backOffSeconds * SECOND_IN_MILLIS
    ) {
      return false;
    }

    return true;
  }

  /**
   * Determines what Audience Action prompt type should be shown.
   *
   * Show the first AutoPromptType passed in from Audience Actions.
   * @param {./entitlements-manager.Intervention[]|undefined} actions
   * @return {!AutoPromptType|undefined}
   */
  getAutoPromptType_(actions = []) {
    const potentialAction = actions.find(
      (action) =>
        action.type === TYPE_CONTRIBUTION || action.type === TYPE_SUBSCRIPTION
    );

    // No audience actions matching contribution or subscription.
    if (!potentialAction) {
      return undefined;
    }

    return potentialAction.type === TYPE_CONTRIBUTION
      ? AutoPromptType.CONTRIBUTION_LARGE
      : AutoPromptType.SUBSCRIPTION_LARGE;
  }

  /**
   * Determines what Audience Action prompt should be shown.
   *
   * In the case of Subscription models, we always show the first available prompt.
   *
   * In the case of Contribution models, we only show non-previously dismissed actions
   * after the initial Contribution prompt. We also always default to showing the Contribution
   * prompt if the reader is currently inside of the frequency window, indicated by shouldShowAutoPrompt.
   *
   * This has the side effect of setting this.interventionDisplayed_ to an audience action that should
   * be displayed. If this field is not set, there is no audience action to show, and the triggering
   * flow should fall back to the AutoPrompt, if one is available. This is ignored for Subscription
   * models as recording the displayed intervention is only used for recording prompt dismissals,
   * which only applies to Contribution and Non-Monetary models.
   * @param {{
   *   article: (!./entitlements-manager.Article),
   *   autoPromptType: (AutoPromptType|undefined),
   *   dismissedPrompts: (?string|undefined),
   *   shouldShowAutoPrompt: (boolean|undefined),
   * }} params
   * @return {!Promise<./entitlements-manager.Intervention|undefined>}
   */
  async getAudienceActionPromptType_({
    article,
    autoPromptType,
    dismissedPrompts,
    shouldShowAutoPrompt,
  }) {
    const audienceActions = article.audienceActions?.actions || [];

    // Count completed surveys.
    const [surveyCompletionTimestamps, surveyDataTransferFailureTimestamps] =
      await Promise.all([
        this.storage_.getEvent(
          COMPLETED_ACTION_TO_STORAGE_KEY_MAP.get(
            AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER
          )
        ),
        this.storage_.getEvent(StorageKeys.SURVEY_DATA_TRANSFER_FAILED),
      ]);

    const hasCompletedSurveys = surveyCompletionTimestamps.length >= 1;
    const hasRecentSurveyDataTransferFailure =
      surveyDataTransferFailureTimestamps.length >= 1;
    const isSurveyEligible =
      !hasCompletedSurveys && !hasRecentSurveyDataTransferFailure;

    let potentialActions = audienceActions.filter((action) =>
      this.checkActionEligibility_(action.type, isSurveyEligible)
    );

    // No audience actions means use the default prompt.
    if (potentialActions.length === 0) {
      return undefined;
    }

    // Default to the first recommended action.
    let actionToUse = potentialActions[0];

    // For subscriptions, skip triggering checks and use the first potential action
    if (this.isSubscription_({autoPromptType})) {
      return actionToUse;
    }

    // Suppress previously dismissed prompts.
    let previouslyShownPrompts = [];
    if (dismissedPrompts) {
      previouslyShownPrompts = dismissedPrompts.split(',');
      potentialActions = potentialActions.filter(
        (action) => !previouslyShownPrompts.includes(action.type)
      );
    }

    // Survey take highest priority if this flag is enabled.
    const prioritizeSurvey = await this.isExperimentEnabled_(
      article,
      ExperimentFlags.SURVEY_TRIGGERING_PRIORITY
    );
    if (
      prioritizeSurvey &&
      potentialActions
        .map((action) => action.type)
        .includes(TYPE_REWARDED_SURVEY)
    ) {
      const surveyAction = potentialActions.find(
        ({type}) => type === TYPE_REWARDED_SURVEY
      );
      if (surveyAction) {
        this.interventionDisplayed_ = surveyAction;
        return surveyAction;
      }
    }

    if (this.isContribution_({autoPromptType})) {
      const contributionIndex = potentialActions.findIndex(
        (action) => action.type === TYPE_CONTRIBUTION
      );

      // If there is an audience action with explicit higher priority than the contribution
      // action, show the first audience action.
      if (contributionIndex > 0) {
        actionToUse = potentialActions[0];
        this.interventionDisplayed_ = actionToUse;
        return actionToUse;
      }

      // If the first potential action is contribution, or the contribution
      // action was not passed through audience actions, and it has never been
      // dismissed before, we will show contribution prompt and record the
      // contribution dismissal.
      if (
        !(
          previouslyShownPrompts.includes(AutoPromptType.CONTRIBUTION) ||
          previouslyShownPrompts.includes(AutoPromptType.CONTRIBUTION_LARGE)
        )
      ) {
        // WARNING: Refers explicity to the Contribution AutoPromptType,
        // which CANNOT be a potential audience action. This is not to be
        // confused with the AudienceActionType TYPE_CONTRIBUTION, which
        // is part of the pre-monetization effort.
        this.interventionDisplayed_ = {type: AutoPromptType.CONTRIBUTION};
        return undefined;
      }

      // If frequency indicates that we should show the Contribution prompt again
      // regardless of previous dismissals, we don't want to record the Contribution dismissal
      if (shouldShowAutoPrompt) {
        return undefined;
      }

      potentialActions = potentialActions.filter(
        (action) => action.type !== TYPE_CONTRIBUTION
      );
    }

    // If all actions have been dismissed, we don't want to record the Contribution dismissal
    if (potentialActions.length === 0) {
      return undefined;
    }

    // Otherwise, set to the next recommended action. If the last dismissal was the
    // Contribution prompt, this will resolve to the first recommended action.
    actionToUse = potentialActions[0];
    this.interventionDisplayed_ = actionToUse;
    return actionToUse;
  }

  /**
   * @param {{
   *  action: (string|undefined),
   *  configurationId: (string|undefined),
   *  autoPromptType: (AutoPromptType|undefined)
   *  isClosable: (boolean|undefined)
   * }} params
   * @return {!function()}
   */
  audienceActionPrompt_({action, configurationId, autoPromptType, isClosable}) {
    return () => {
      const params = {
        action,
        configurationId,
        autoPromptType,
        onCancel: () => this.storeLastDismissal_(),
        isClosable,
      };
      const lastAudienceActionFlow = new AudienceActionFlow(this.deps_, params);
      this.setLastAudienceActionFlow(lastAudienceActionFlow);
      lastAudienceActionFlow.start();
    };
  }

  /** @param {!AudienceActionFlow} flow */
  setLastAudienceActionFlow(flow) {
    this.lastAudienceActionFlow_ = flow;
  }

  /** @return {?AudienceActionFlow} */
  getLastAudienceActionFlow() {
    return this.lastAudienceActionFlow_;
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
   * Returns which type of prompt to display based on the type specified,
   * the viewport width, and whether the disableDesktopMiniprompt experiment
   * is enabled.
   *
   * If the disableDesktopMiniprompt experiment is enabled and the desktop is
   * wider than 480px then the large prompt type will be substituted for the mini
   * prompt. The original promptType will be returned as-is in all other cases.
   * @param {AutoPromptType|undefined} promptType
   * @returns
   */
  getPromptTypeToDisplay_(promptType) {
    const disableDesktopMiniprompt = isExperimentOn(
      this.doc_.getWin(),
      ExperimentFlags.DISABLE_DESKTOP_MINIPROMPT
    );
    const isWideDesktop = this.doc_.getWin()./* OK */ innerWidth > 480;

    if (disableDesktopMiniprompt && isWideDesktop) {
      if (promptType === AutoPromptType.SUBSCRIPTION) {
        this.logDisableMinipromptEvent_(promptType);
        return AutoPromptType.SUBSCRIPTION_LARGE;
      }
      if (promptType === AutoPromptType.CONTRIBUTION) {
        this.logDisableMinipromptEvent_(promptType);
        return AutoPromptType.CONTRIBUTION_LARGE;
      }
    }

    return promptType;
  }

  /**
   * Logs the disable miniprompt event.
   * @param {AutoPromptType|undefined} overriddenPromptType
   */
  logDisableMinipromptEvent_(overriddenPromptType) {
    this.eventManager_.logEvent({
      eventType: AnalyticsEvent.EVENT_DISABLE_MINIPROMPT_DESKTOP,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: false,
      additionalParameters: {
        publicationid: this.pageConfig_.getPublicationId(),
        promptType: overriddenPromptType,
      },
    });
  }

  /**
   * Determines whether a larger, blocking prompt should be shown.
   * @param {!../api/entitlements.Entitlements} entitlements
   * @param {!boolean} hasPotentialAudienceAction
   * @returns {boolean}
   */
  shouldShowBlockingPrompt_(entitlements, hasPotentialAudienceAction) {
    return (
      (this.pageConfig_.isLocked() || hasPotentialAudienceAction) &&
      !entitlements.enablesThis()
    );
  }

  /**
   * Determines whether the given prompt type is an action prompt type with display delay.
   * @param {string|undefined} potentialActionPromptType
   * @returns {boolean}
   */
  isActionPromptWithDelay_(potentialActionPromptType) {
    return (
      !this.pageConfig_.isLocked() &&
      potentialActionPromptType === TYPE_REWARDED_SURVEY
    );
  }

  /**
   * Listens for relevant prompt impression events, dismissal events, and completed
   * action events, and logs them to local storage for use in determining whether
   * to display the prompt in the future.
   * @param {../api/client-event-manager-api.ClientEvent} event
   * @return {!Promise}
   */
  handleClientEvent_(event) {
    // Impressions and dimissals of forced (for paygated) or manually triggered
    // prompts do not count toward the frequency caps.
    if (
      !this.wasAutoPromptDisplayed_ ||
      this.pageConfig_.isLocked() ||
      !event.eventType
    ) {
      return Promise.resolve();
    }

    // Prompt impression should be stored if no previous one has been stored.
    // This is to prevent the case that user clicks the mini prompt, and both
    // impressions of the mini and large prompts would be counted towards the
    // cap.
    if (
      !this.hasStoredImpression &&
      impressionEvents.includes(event.eventType)
    ) {
      this.hasStoredImpression = true;
      return this.storage_.storeEvent(StorageKeys.IMPRESSIONS);
    }

    if (dismissEvents.includes(event.eventType)) {
      return Promise.all([
        this.storage_.storeEvent(StorageKeys.DISMISSALS),
        // If we need to keep track of the prompt that was dismissed, make sure to
        // record it.
        this.storeLastDismissal_(),
      ]);
    }

    if (COMPLETED_ACTION_TO_STORAGE_KEY_MAP.has(event.eventType)) {
      return this.storage_.storeEvent(
        COMPLETED_ACTION_TO_STORAGE_KEY_MAP.get(event.eventType)
      );
    }

    return Promise.resolve();
  }

  /**
   * Adds the current prompt displayed to the array of all dismissed prompts.
   * @returns {!Promise}
   */
  async storeLastDismissal_() {
    if (!this.interventionDisplayed_) {
      return;
    }

    const value = await this.storage_.get(
      StorageKeys.DISMISSED_PROMPTS,
      /* useLocalStorage */ true
    );
    const intervention = /** @type {./entitlements-manager/Intervention} */ (
      this.interventionDisplayed_
    );
    this.storage_.set(
      StorageKeys.DISMISSED_PROMPTS,
      value ? value + ',' + intervention.type : intervention.type,
      /* useLocalStorage */ true
    );
  }

  /**
   * Retrieves the locally stored impressions of the auto prompt, within a week
   * of the current time.
   * @return {!Promise<!Array<number>>}
   */
  getImpressions_() {
    return this.storage_.getEvent(StorageKeys.IMPRESSIONS);
  }

  /**
   * Retrieves the locally stored dismissals of the auto prompt, within a week
   * of the current time.
   * @return {!Promise<!Array<number>>}
   */
  getDismissals_() {
    return this.storage_.getEvent(StorageKeys.DISMISSALS);
  }

  /**
   * Checks AudienceAction eligbility, used to filter potential actions.
   * @param {string} actionType
   * @param {boolean} isSurveyEligible
   * @return {boolean}
   */
  checkActionEligibility_(actionType, isSurveyEligible) {
    if (actionType === TYPE_REWARDED_SURVEY) {
      const isAnalyticsEligible =
        GoogleAnalyticsEventListener.isGaEligible(this.deps_) ||
        GoogleAnalyticsEventListener.isGtagEligible(this.deps_) ||
        GoogleAnalyticsEventListener.isGtmEligible(this.deps_);
      return isSurveyEligible && isAnalyticsEligible;
    }
    return true;
  }

  /**
   * Checks if the triggering of the second prompt should be suppressed due the
   * configured number of impressions to allow after the first prompt within
   * autoPromptConfig. Tracks impressions by storing timestamps for the first
   * prompt triggered and for each impression after. Returns whether to
   * suppress the next prompt. For example, for default number of impressions
   * X = 2 (b/267650049), then:
   * Timestamps   Show Autoprompt     Store Timestamp
   * []           YES (1st prompt)    YES
   * [t1]         NO  (Impression 1)  YES
   * [t1, t2]     NO  (Impression 2)  YES
   * [t1, t2, t3] YES (2nd prompt)    NO
   * @param {number|undefined} numImpressionsBetweenPrompts
   * @return {!Promise<boolean>}
   */
  async secondPromptDelayExperimentSuppressesPrompt_(
    numImpressionsBetweenPrompts = 2 // (b/267650049) default 2 impressions
  ) {
    const secondPromptDelayCounter = await this.storage_.getEvent(
      StorageKeys.SECOND_PROMPT_DELAY_COUNTER
    );
    const shouldSuppressPrompt =
      secondPromptDelayCounter.length > 0 &&
      secondPromptDelayCounter.length <= numImpressionsBetweenPrompts;
    const shouldStoreTimestamp =
      secondPromptDelayCounter.length <= numImpressionsBetweenPrompts;

    if (shouldStoreTimestamp) {
      this.storage_.storeEvent(StorageKeys.SECOND_PROMPT_DELAY_COUNTER);
    }
    return Promise.resolve(shouldSuppressPrompt);
  }

  /**
   * Checks if provided ExperimentFlag is returned in article endpoint.
   * @param {!./entitlements-manager.Article} article
   * @param {string} experimentFlag
   * @return {!Promise<boolean>}
   */
  async isExperimentEnabled_(article, experimentFlag) {
    const articleExpFlags =
      await this.entitlementsManager_.parseArticleExperimentConfigFlags(
        article
      );
    return articleExpFlags.includes(experimentFlag);
  }
}
