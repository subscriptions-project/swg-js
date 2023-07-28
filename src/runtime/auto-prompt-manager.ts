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
import {AutoPromptConfig} from '../model/auto-prompt-config';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEvent} from '../api/client-event-manager-api';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {Entitlements} from '../api/entitlements';
import {ExperimentFlags} from './experiment-flags';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {MiniPromptApi} from './mini-prompt-api';
import {OffersRequest} from '../api/subscriptions';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {UiPredicates} from '../model/client-config';
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
  isClosable?: boolean;
}

/**
 * Manages the display of subscription/contribution prompts automatically
 * displayed to the user.
 */
export class AutoPromptManager {
  private monetizationPromptWasDisplayedAsSoftPaywall_ = false;
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

    this.miniPromptAPI_ = new MiniPromptApi(deps_);
    this.miniPromptAPI_.init();

    this.eventManager_ = deps_.eventManager();
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
    if (params.autoPromptType === AutoPromptType.NONE) {
      return;
    }

    // Manual override of display rules, mainly for demo purposes. Requires
    // contribution or subscription to be set as autoPromptType in snippet.
    if (params.alwaysShow) {
      this.showPrompt_(
        this.getPromptTypeToDisplay_(params.autoPromptType),
        this.getMonetizationPromptFn_(
          params.autoPromptType,
          params.isClosable ?? !this.isSubscription_(params.autoPromptType)
        )
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
    if (!article) {
      // TODO: handle empty article response.
      return;
    }

    const hasValidEntitlements = entitlements.enablesThis();
    if (hasValidEntitlements) {
      return;
    }

    const autoPromptType = this.getAutoPromptType_(
      article?.audienceActions?.actions,
      params.autoPromptType
    )!;

    // Default isClosable to what is set in the page config.
    // Otherwise, the prompt is blocking for publications with a
    // subscription revenue model, while all others can be dismissed.
    const isClosable =
      params.isClosable ?? !this.isSubscription_(autoPromptType);

    const canDisplayMonetizationPromptFromUiPredicates =
      this.canDisplayMonetizationPromptFromUiPredicates_(
        clientConfig.uiPredicates
      );

    const shouldShowMonetizationPromptAsSoftPaywall =
      canDisplayMonetizationPromptFromUiPredicates &&
      (await this.shouldShowMonetizationPromptAsSoftPaywall(
        autoPromptType,
        clientConfig.autoPromptConfig
      ));

    const potentialAction = await this.getAction_({
      article,
      autoPromptType,
      dismissedPrompts,
      canDisplayMonetizationPrompt:
        canDisplayMonetizationPromptFromUiPredicates,
      shouldShowMonetizationPromptAsSoftPaywall,
    });

    const promptFn = this.isMonetizationAction_(potentialAction?.type)
      ? this.getMonetizationPromptFn_(autoPromptType, isClosable)
      : potentialAction
      ? this.audienceActionPrompt_({
          action: potentialAction.type,
          configurationId: potentialAction.configurationId,
          autoPromptType,
          isClosable,
        })
      : undefined;

    const shouldShowBlockingPrompt =
      this.shouldShowBlockingPrompt_(
        /* hasPotentialAudienceAction */ potentialAction
      ) && !!promptFn;
    if (
      !shouldShowMonetizationPromptAsSoftPaywall &&
      !shouldShowBlockingPrompt
    ) {
      return;
    }

    const displayDelayMs =
      (clientConfig?.autoPromptConfig?.clientDisplayTrigger
        ?.displayDelaySeconds || 0) * SECOND_IN_MILLIS;

    if (
      shouldShowMonetizationPromptAsSoftPaywall &&
      this.isMonetizationAction_(potentialAction?.type)
    ) {
      this.deps_.win().setTimeout(() => {
        this.monetizationPromptWasDisplayedAsSoftPaywall_ = true;
        this.showPrompt_(
          this.getPromptTypeToDisplay_(autoPromptType),
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

  private isSubscription_(autoPromptType: AutoPromptType | undefined): boolean {
    return (
      autoPromptType === AutoPromptType.SUBSCRIPTION ||
      autoPromptType === AutoPromptType.SUBSCRIPTION_LARGE
    );
  }

  private isContribution_(autoPromptType: AutoPromptType | undefined): boolean {
    return (
      autoPromptType === AutoPromptType.CONTRIBUTION ||
      autoPromptType === AutoPromptType.CONTRIBUTION_LARGE
    );
  }

  private isMonetizationAction_(actionType: string | undefined): boolean {
    return actionType === TYPE_SUBSCRIPTION || actionType === TYPE_CONTRIBUTION;
  }

  /**
   * Returns a function to show the appropriate monetization prompt,
   * or undefined if the type of prompt cannot be determined.
   */
  private getMonetizationPromptFn_(
    autoPromptType: AutoPromptType | undefined,
    isClosable: boolean
  ): (() => void) | undefined {
    const options: OffersRequest = {isClosable};
    if (this.isSubscription_(autoPromptType)) {
      return () => {
        this.configuredRuntime_.showOffers(options);
      };
    } else if (this.isContribution_(autoPromptType)) {
      return () => {
        this.configuredRuntime_.showContributionOptions(options);
      };
    }
    return undefined;
  }

  /**
   * Determines whether a mini prompt for contributions or subscriptions can
   * be shown based on the UI Predicates.
   */
  private canDisplayMonetizationPromptFromUiPredicates_(
    uiPredicates?: UiPredicates
  ): boolean {
    // If false publication predicate was returned in the response, don't show
    // the prompt.
    if (uiPredicates && !uiPredicates.canDisplayAutoPrompt) {
      return false;
    }
    return true;
  }

  /**
   * Determines whether a monetization prompt should be shown as a soft
   * paywall, meaning with the explicit intent to soft-restrict access to the
   * page. Does not prevent a monetization prompt from displaying as an
   * eligible audience action (subscriptions as the last potential action).
   */
  async shouldShowMonetizationPromptAsSoftPaywall(
    autoPromptType?: AutoPromptType,
    autoPromptConfig?: AutoPromptConfig
  ): Promise<boolean> {
    // If the auto prompt type is not supported, don't show the prompt.
    // AutoPromptType can be set undefined for premonetization publications;
    // in this case, do not show a soft paywall.
    if (
      autoPromptType === undefined ||
      autoPromptType === AutoPromptType.NONE
    ) {
      return Promise.resolve(false);
    }

    // For paygated content, a soft paywall should not restrict access.
    if (this.pageConfig_.isLocked()) {
      return Promise.resolve(false);
    }

    // Do not frequency cap subscription prompts as soft paywall.
    if (this.isSubscription_(autoPromptType)) {
      return Promise.resolve(true);
    }

    // For other contributions, if no auto prompt config was returned, do not
    // show a soft paywall.
    if (autoPromptConfig === undefined) {
      return Promise.resolve(false);
    }

    // Fetched config returned no maximum cap.
    if (autoPromptConfig.impressionConfig.maxImpressions === undefined) {
      return Promise.resolve(true);
    }

    const [impressions, dismissals] = await Promise.all([
      this.getImpressions_(),
      this.getDismissals_(),
    ]);
    const lastImpression = impressions[impressions.length - 1];
    const lastDismissal = dismissals[dismissals.length - 1];

    // If the user has reached the maxDismissalsPerWeek, and
    // maxDismissalsResultingHideSeconds has not yet passed, do not show a
    // soft paywall.
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
    // not yet passed, do not show a soft paywall.
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
    // maxImpressionsResultingHideSeconds has not yet passed, do not show a
    // soft paywall.
    const userReachedMaxImpressions =
      impressions.length >= autoPromptConfig.impressionConfig.maxImpressions;
    const timeSinceLastImpression = Date.now() - lastImpression;
    const timeToWaitAfterMaxImpressionsInSeconds =
      autoPromptConfig.impressionConfig.maxImpressionsResultingHideSeconds || 0;
    const timeToWaitAfterMaxImpressions =
      timeToWaitAfterMaxImpressionsInSeconds * SECOND_IN_MILLIS;
    const waitingAfterMaxImpressions =
      timeSinceLastImpression < timeToWaitAfterMaxImpressions;
    if (userReachedMaxImpressions && waitingAfterMaxImpressions) {
      return false;
    }

    // If the user has seen the prompt, and backOffSeconds has not yet passed,
    // do not show a soft paywall. This is to prevent the prompt from showing
    // in consecutive visits.
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
   * Determines what Monetization prompt type should be shown.
   * Shows the first AutoPromptType passed in from Article Actions.
   */
  private getAutoPromptType_(
    actions: Intervention[] = [],
    autoPromptType: AutoPromptType | undefined
  ): AutoPromptType | undefined {
    const potentialAction = actions.find(
      (action) =>
        action.type === TYPE_CONTRIBUTION || action.type === TYPE_SUBSCRIPTION
    );

    // No article actions match contribution or subscription.
    if (!potentialAction) {
      return undefined;
    }

    return potentialAction.type === TYPE_CONTRIBUTION
      ? // Allow autoPromptType to enable miniprompt.
        autoPromptType === AutoPromptType.CONTRIBUTION
        ? AutoPromptType.CONTRIBUTION
        : AutoPromptType.CONTRIBUTION_LARGE
      : autoPromptType === AutoPromptType.SUBSCRIPTION
      ? AutoPromptType.SUBSCRIPTION
      : AutoPromptType.SUBSCRIPTION_LARGE;
  }

  /**
   * Determines what action should be used to determine what prompt to show.
   *
   * In the case of Subscription models, always show the first eligible prompt.
   *
   * In the case of Contribution models, only show non-previously dismissed
   * actions after the initial Contribution prompt. Always default to showing
   * the Contribution prompt if permitted by the frequency cap, indicated by
   * shouldShowMonetizationPromptAsSoftPaywall.
   *
   * Has the side effect of setting this.interventionDisplayed_ to an action
   * that should be displayed.
   */
  private async getAction_({
    article,
    autoPromptType,
    dismissedPrompts,
    canDisplayMonetizationPrompt,
    shouldShowMonetizationPromptAsSoftPaywall,
  }: {
    article: Article;
    autoPromptType?: AutoPromptType;
    dismissedPrompts?: string | null;
    canDisplayMonetizationPrompt: boolean;
    shouldShowMonetizationPromptAsSoftPaywall?: boolean;
  }): Promise<Intervention | void> {
    const audienceActions = article.audienceActions?.actions || [];
    if (shouldShowMonetizationPromptAsSoftPaywall) {
      const action = (this.interventionDisplayed_ = audienceActions.filter(
        (action) => this.isMonetizationAction_(action.type)
      )[0]);
      this.interventionDisplayed_ = action;
      return action;
    }

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
      this.checkActionEligibility_(
        action.type,
        canDisplayMonetizationPrompt,
        isSurveyEligible
      )
    );

    if (!this.isSubscription_(autoPromptType) && !this.pageConfig_.isLocked()) {
      // Filter out contribution prompt if page is not paywalled.
      potentialActions = potentialActions.filter(
        (action) => action.type !== TYPE_CONTRIBUTION
      );

      // Suppress previously dismissed prompts.
      let previouslyShownPrompts: string[] = [];
      if (dismissedPrompts) {
        previouslyShownPrompts = dismissedPrompts.split(',');
        potentialActions = potentialActions.filter(
          (action) => !previouslyShownPrompts.includes(action.type)
        );
      }
    }

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
  private shouldShowBlockingPrompt_(action: Intervention | void): boolean {
    const isAudienceAction =
      !!action && !this.isMonetizationAction_(action?.type);
    return this.pageConfig_.isLocked() || isAudienceAction;
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
    if (!event.eventType) {
      return;
    }

    if (COMPLETED_ACTION_TO_STORAGE_KEY_MAP.has(event.eventType)) {
      return this.storage_.storeEvent(
        COMPLETED_ACTION_TO_STORAGE_KEY_MAP.get(event.eventType)!
      );
    }

    // Impressions and dimissals of forced (for paygated) or manually triggered
    // prompts do not count toward the frequency caps.
    if (
      !this.monetizationPromptWasDisplayedAsSoftPaywall_ ||
      this.pageConfig_.isLocked()
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
    this.storage_.set(
      StorageKeys.DISMISSED_PROMPTS,
      value
        ? value + ',' + this.interventionDisplayed_.type
        : this.interventionDisplayed_.type,
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
    canDisplayMonetizationPrompt: boolean,
    isSurveyEligible: boolean
  ): boolean {
    if (actionType === TYPE_SUBSCRIPTION || actionType === TYPE_CONTRIBUTION) {
      return canDisplayMonetizationPrompt;
    } else if (actionType === TYPE_REWARDED_SURVEY) {
      const isAnalyticsEligible =
        GoogleAnalyticsEventListener.isGaEligible(this.deps_) ||
        GoogleAnalyticsEventListener.isGtagEligible(this.deps_) ||
        GoogleAnalyticsEventListener.isGtmEligible(this.deps_);
      return isSurveyEligible && isAnalyticsEligible;
    }
    return true;
  }
}
