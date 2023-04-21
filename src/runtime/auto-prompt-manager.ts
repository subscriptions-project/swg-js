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
import {
  Article,
  EntitlementsManager,
  Intervention,
} from './entitlements-manager';
import {AudienceActionFlow, AudienceActionParams} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEvent} from '../api/client-event-manager-api';
import {ClientEventManager} from './client-event-manager';
// @ts-ignore: (b/276949133) Migrate to TypeScript.
import {ConfiguredRuntime} from './runtime';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {Entitlements} from '../api/entitlements';
import {ExperimentFlags} from './experiment-flags';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {MiniPromptApi} from './mini-prompt-api';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {assert} from '../utils/log';
import {isExperimentOn} from './experiments';

const TYPE_CONTRIBUTION = 'TYPE_CONTRIBUTION';
const TYPE_SUBSCRIPTION = 'TYPE_SUBSCRIPTION';
const TYPE_REWARDED_SURVEY = 'TYPE_REWARDED_SURVEY';
const SECOND_IN_MILLIS = 1000;

const impressionEvents = [
  AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
  AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT,
  AnalyticsEvent.IMPRESSION_OFFERS,
  AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
];
const dismissEvents = [
  AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE,
  AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE,
  AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED,
  AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED,
];

const COMPLETED_ACTION_TO_STORAGE_KEY_MAP = new Map([
  [AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER, StorageKeys.SURVEY_COMPLETED],
]);

export interface ShowAutoPromptParams {
  autoPromptType?: AutoPromptType;
  alwaysShow?: boolean;
  displayLargePromptFn?: () => void;
  isAccessibleForFree?: boolean;
}

/**
 * Manages the display of subscription/contribution prompts automatically
 * displayed to the user.
 */
export class AutoPromptManager {
  private wasAutoPromptDisplayed_ = false;
  private hasStoredImpression_ = false;
  private lastAudienceActionFlow_: AudienceActionFlow | null = null;
  private interventionDisplayed_: Intervention | null = null;

  private readonly doc_: Doc;
  private readonly pageConfig_: PageConfig;
  private readonly entitlementsManager_: EntitlementsManager;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly storage_: Storage;
  private readonly miniPromptAPI_: MiniPromptApi;
  private readonly eventManager_: ClientEventManager;

  constructor(
    private readonly deps_: Deps,
    private readonly configuredRuntime_: ConfiguredRuntime
  ) {
    this.doc_ = deps_.doc();

    this.pageConfig_ = deps_.pageConfig();

    this.entitlementsManager_ = deps_.entitlementsManager();

    this.clientConfigManager_ = deps_.clientConfigManager();
    assert(
      this.clientConfigManager_,
      'AutoPromptManager requires an instance of ClientConfigManager.'
    );

    this.storage_ = deps_.storage();

    deps_
      .eventManager()
      .registerEventListener(this.handleClientEvent_.bind(this));

    this.miniPromptAPI_ = this.getMiniPromptApi(deps_);
    this.miniPromptAPI_.init();

    this.eventManager_ = deps_.eventManager();
  }

  /**
   * Returns an instance of MiniPromptApi. Can be overwridden by subclasses,
   * such as in order to instantiate a different implementation of
   * MiniPromptApi.
   */
  getMiniPromptApi(deps: Deps): MiniPromptApi {
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
   */
  async showAutoPrompt(params: ShowAutoPromptParams): Promise<void> {
    // Manual override of display rules, mainly for demo purposes.
    if (params.alwaysShow) {
      this.showPrompt_(
        this.getPromptTypeToDisplay_(params.autoPromptType),
        params.displayLargePromptFn
      );
      return;
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
   */
  private async showAutoPrompt_(
    clientConfig: ClientConfig,
    entitlements: Entitlements,
    article: Article | null,
    dismissedPrompts: string | undefined | null,
    params: ShowAutoPromptParams
  ): Promise<void> {
    // Override autoPromptType if it is undefined.
    params.autoPromptType ??= this.getAutoPromptType_(
      article?.audienceActions?.actions
    )!;

    // Override isClosable if isAccessibleForFree is set in the page config.
    // Otherwise, for publications with a subscription revenue model the
    // prompt is blocking, while all others can be dismissed.
    const isClosable =
      params.isAccessibleForFree ?? !this.isSubscription_(params);

    if (this.isSubscription_(params)) {
      params.displayLargePromptFn = () => {
        this.configuredRuntime_.showOffers({
          isClosable,
        });
      };
    } else if (this.isContribution_(params)) {
      params.displayLargePromptFn = () => {
        this.configuredRuntime_.showContributionOptions({
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
      ? this.isExperimentEnabled_(article, ExperimentFlags.SECOND_PROMPT_DELAY)
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

    if (shouldShowAutoPrompt && potentialAction === undefined) {
      this.deps_.win().setTimeout(() => {
        this.wasAutoPromptDisplayed_ = true;
        this.showPrompt_(
          this.getPromptTypeToDisplay_(params.autoPromptType),
          promptFn
        );
      }, displayDelayMs);
    } else if (promptFn) {
      const isBlockingPromptWithDelay = this.isActionPromptWithDelay_(
        potentialAction?.type
      );
      this.deps_
        .win()
        .setTimeout(promptFn, isBlockingPromptWithDelay ? displayDelayMs : 0);
    }
  }

  private isSubscription_(params: ShowAutoPromptParams): boolean {
    return (
      params.autoPromptType === AutoPromptType.SUBSCRIPTION ||
      params.autoPromptType === AutoPromptType.SUBSCRIPTION_LARGE
    );
  }

  private isContribution_(params: ShowAutoPromptParams): boolean {
    return (
      params.autoPromptType === AutoPromptType.CONTRIBUTION ||
      params.autoPromptType === AutoPromptType.CONTRIBUTION_LARGE
    );
  }

  /**
   * Determines whether a mini prompt for contributions or subscriptions should
   * be shown.
   */
  async shouldShowAutoPrompt_(
    clientConfig: ClientConfig,
    entitlements: Entitlements,
    autoPromptType?: AutoPromptType
  ): Promise<boolean> {
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
      dismissals.length >=
        autoPromptConfig.explicitDismissalConfig.maxDismissalsPerWeek! &&
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
    const userReachedMaxImpressions =
      impressions.length >= autoPromptConfig.impressionConfig.maxImpressions;
    const timeSinceLastImpression = Date.now() - lastImpression;
    const timeToWaitAfterMaxImpressionsInSeconds =
      autoPromptConfig.impressionConfig.maxImpressionsResultingHideSeconds || 0;
    const timeToWaitAfterMaxImpressions =
      timeToWaitAfterMaxImpressionsInSeconds * SECOND_IN_MILLIS;
    const userWaitedLongEnough =
      timeSinceLastImpression < timeToWaitAfterMaxImpressions;
    if (userReachedMaxImpressions && userWaitedLongEnough) {
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
   */
  private getAutoPromptType_(
    actions: Intervention[] = []
  ): AutoPromptType | void {
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
   * be displayed. If a subscription or contribution prompt is to be shown over an audience action, the
   * appropriate prompt type will be set.
   */
  private async getAudienceActionPromptType_({
    article,
    autoPromptType,
    dismissedPrompts,
    shouldShowAutoPrompt,
  }: {
    article: Article;
    autoPromptType?: AutoPromptType;
    dismissedPrompts?: string | null;
    shouldShowAutoPrompt?: boolean;
  }): Promise<Intervention | void> {
    const audienceActions = article.audienceActions?.actions || [];

    // Count completed surveys.
    const [surveyCompletionTimestamps, surveyDataTransferFailureTimestamps] =
      await Promise.all([
        this.storage_.getEvent(
          COMPLETED_ACTION_TO_STORAGE_KEY_MAP.get(
            AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER
          )!
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

    // No audience actions means use the default prompt, if it should be shown.
    if (potentialActions.length === 0) {
      if (shouldShowAutoPrompt) {
        this.interventionDisplayed_ = this.isSubscription_({autoPromptType})
          ? {type: TYPE_SUBSCRIPTION}
          : this.isContribution_({autoPromptType})
          ? {type: TYPE_CONTRIBUTION}
          : null;
      }
      return undefined;
    }

    // For subscriptions, skip triggering checks and use the first potential action
    if (this.isSubscription_({autoPromptType})) {
      if (shouldShowAutoPrompt) {
        this.interventionDisplayed_ = {type: TYPE_SUBSCRIPTION};
        return undefined;
      }
      const firstAction = potentialActions[0];
      this.interventionDisplayed_ = firstAction;
      return firstAction;
    }

    // Suppress previously dismissed prompts.
    let previouslyShownPrompts: string[] = [];
    if (dismissedPrompts) {
      previouslyShownPrompts = dismissedPrompts.split(',');
      potentialActions = potentialActions.filter(
        (action) => !previouslyShownPrompts.includes(action.type)
      );
    }

    // Survey take highest priority if this flag is enabled.
    const prioritizeSurvey = this.isExperimentEnabled_(
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

    const contributionIndex = potentialActions.findIndex(
      (action) => action.type === TYPE_CONTRIBUTION
    );
    // If autoprompt should be shown, and the contribution action is either the first action or
    // not passed through audience actions, honor it and display the contribution prompt.
    if (shouldShowAutoPrompt && contributionIndex < 1) {
      this.interventionDisplayed_ = {type: TYPE_CONTRIBUTION};
      return undefined;
    }

    // Filter out contribution actions as they were already processed.
    potentialActions = potentialActions.filter(
      (action) => action.type !== TYPE_CONTRIBUTION
    );

    // Otherwise, return the next recommended action, if one is available.
    if (potentialActions.length === 0) {
      return undefined;
    }
    const actionToUse = potentialActions[0];
    this.interventionDisplayed_ = actionToUse;
    return actionToUse;
  }

  private audienceActionPrompt_({
    action,
    configurationId,
    autoPromptType,
    isClosable,
  }: {
    action: string;
    configurationId?: string;
    autoPromptType?: AutoPromptType;
    isClosable?: boolean;
  }): () => void {
    return () => {
      const params: AudienceActionParams = {
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

  setLastAudienceActionFlow(flow: AudienceActionFlow): void {
    this.lastAudienceActionFlow_ = flow;
  }

  getLastAudienceActionFlow(): AudienceActionFlow | null {
    return this.lastAudienceActionFlow_;
  }

  /**
   * Shows the prompt based on the type specified.
   */
  private showPrompt_(
    autoPromptType?: AutoPromptType,
    displayLargePromptFn?: () => void
  ): void {
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
   */
  private getPromptTypeToDisplay_(
    promptType?: AutoPromptType
  ): AutoPromptType | undefined {
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
   */
  private logDisableMinipromptEvent_(
    overriddenPromptType?: AutoPromptType
  ): void {
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
   */
  private shouldShowBlockingPrompt_(
    entitlements: Entitlements,
    hasPotentialAudienceAction: boolean
  ): boolean {
    return (
      (this.pageConfig_.isLocked() || hasPotentialAudienceAction) &&
      !entitlements.enablesThis()
    );
  }

  /**
   * Determines whether the given prompt type is an action prompt type with display delay.
   */
  private isActionPromptWithDelay_(
    potentialActionPromptType?: string
  ): boolean {
    return (
      !this.pageConfig_.isLocked() &&
      potentialActionPromptType === TYPE_REWARDED_SURVEY
    );
  }

  /**
   * Listens for relevant prompt impression events, dismissal events, and completed
   * action events, and logs them to local storage for use in determining whether
   * to display the prompt in the future.
   */
  private async handleClientEvent_(event: ClientEvent): Promise<void> {
    // Impressions and dimissals of forced (for paygated) or manually triggered
    // prompts do not count toward the frequency caps.
    if (
      !this.wasAutoPromptDisplayed_ ||
      this.pageConfig_.isLocked() ||
      !event.eventType
    ) {
      return;
    }

    // Prompt impression should be stored if no previous one has been stored.
    // This is to prevent the case that user clicks the mini prompt, and both
    // impressions of the mini and large prompts would be counted towards the
    // cap.
    if (
      !this.hasStoredImpression_ &&
      impressionEvents.includes(event.eventType)
    ) {
      this.hasStoredImpression_ = true;
      return this.storage_.storeEvent(StorageKeys.IMPRESSIONS);
    }

    if (dismissEvents.includes(event.eventType)) {
      await Promise.all([
        this.storage_.storeEvent(StorageKeys.DISMISSALS),
        // If we need to keep track of the prompt that was dismissed, make sure to
        // record it.
        this.storeLastDismissal_(),
      ]);
      return;
    }

    if (COMPLETED_ACTION_TO_STORAGE_KEY_MAP.has(event.eventType)) {
      return this.storage_.storeEvent(
        COMPLETED_ACTION_TO_STORAGE_KEY_MAP.get(event.eventType)!
      );
    }
  }

  /**
   * Adds the current prompt displayed to the array of all dismissed prompts.
   */
  private async storeLastDismissal_(): Promise<void> {
    if (!this.interventionDisplayed_) {
      return;
    }

    const value = await this.storage_.get(
      StorageKeys.DISMISSED_PROMPTS,
      /* useLocalStorage */ true
    );
    const intervention =
      /** @type {./entitlements-manager/Intervention} */ this
        .interventionDisplayed_;
    this.storage_.set(
      StorageKeys.DISMISSED_PROMPTS,
      value ? value + ',' + intervention.type : intervention.type,
      /* useLocalStorage */ true
    );
  }

  /**
   * Retrieves the locally stored impressions of the auto prompt, within a week
   * of the current time.
   */
  private getImpressions_(): Promise<number[]> {
    return this.storage_.getEvent(StorageKeys.IMPRESSIONS);
  }

  /**
   * Retrieves the locally stored dismissals of the auto prompt, within a week
   * of the current time.
   */
  private getDismissals_(): Promise<number[]> {
    return this.storage_.getEvent(StorageKeys.DISMISSALS);
  }

  /**
   * Checks AudienceAction eligbility, used to filter potential actions.
   */
  private checkActionEligibility_(
    actionType: string,
    isSurveyEligible: boolean
  ): boolean {
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
   */
  private async secondPromptDelayExperimentSuppressesPrompt_(
    numImpressionsBetweenPrompts = 2 // (b/267650049) default 2 impressions
  ): Promise<boolean> {
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
   */
  private isExperimentEnabled_(
    article: Article,
    experimentFlag: string
  ): boolean {
    const articleExpFlags =
      this.entitlementsManager_.parseArticleExperimentConfigFlags(article);
    return articleExpFlags.includes(experimentFlag);
  }
}
