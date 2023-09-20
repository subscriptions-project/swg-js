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
import {ArticleExperimentFlags, ExperimentFlags} from './experiment-flags';
import {
  AudienceActionFlow,
  AudienceActionIframeFlow,
} from './audience-action-flow';
import {AudienceActionLocalFlow} from './audience-action-local-flow';
import {
  AutoPromptConfig,
  FrequencyCapConfig,
} from '../model/auto-prompt-config';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEvent} from '../api/client-event-manager-api';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {Entitlements} from '../api/entitlements';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {ImpressionStorageKeys, StorageKeys} from '../utils/constants';
import {MiniPromptApi} from './mini-prompt-api';
import {OffersRequest} from '../api/subscriptions';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {assert} from '../utils/log';
import {isExperimentOn} from './experiments';

const TYPE_CONTRIBUTION = 'TYPE_CONTRIBUTION';
const TYPE_SUBSCRIPTION = 'TYPE_SUBSCRIPTION';
const TYPE_NEWSLETTER_SIGNUP = 'TYPE_NEWSLETTER_SIGNUP';
const TYPE_REGISTRATION_WALL = 'TYPE_REGISTRATION_WALL';
const TYPE_REWARDED_SURVEY = 'TYPE_REWARDED_SURVEY';
const TYPE_REWARDED_ADS = 'TYPE_REWARDED_AD';
const SECOND_IN_MILLIS = 1000;

const monetizationImpressionEvents = [
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

const INTERVENTION_TO_STORAGE_KEY_MAP = new Map([
  [
    AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
    ImpressionStorageKeys.CONTRIBUTION,
  ],
  [
    AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
    ImpressionStorageKeys.CONTRIBUTION,
  ],
  [
    AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN,
    ImpressionStorageKeys.NEWSLETTER_SIGNUP,
  ],
  [
    AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN,
    ImpressionStorageKeys.REGISTRATION_WALL,
  ],
  [AnalyticsEvent.IMPRESSION_SURVEY, ImpressionStorageKeys.REWARDED_SURVEY],
]);

const ACTION_TO_IMPRESSION_STORAGE_KEY_MAP = new Map([
  [TYPE_CONTRIBUTION, ImpressionStorageKeys.CONTRIBUTION],
  [TYPE_NEWSLETTER_SIGNUP, ImpressionStorageKeys.NEWSLETTER_SIGNUP],
  [TYPE_REGISTRATION_WALL, ImpressionStorageKeys.REGISTRATION_WALL],
  [TYPE_REWARDED_SURVEY, ImpressionStorageKeys.REWARDED_SURVEY],
  [TYPE_REWARDED_ADS, ImpressionStorageKeys.REWARDED_AD],
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
  private hasStoredMiniPromptImpression_ = false;
  private lastAudienceActionFlow_: AudienceActionFlow | null = null;
  private interventionDisplayed_: Intervention | null = null;
  private frequencyCappingLocalStorageEnabled_: boolean = false;
  private promptFrequencyCappingEnabled_: boolean = false;

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

    this.setArticleExperimentFlags_(article);

    this.showAutoPrompt_(
      clientConfig,
      entitlements,
      article,
      dismissedPrompts,
      params
    );
  }

  /**
   * Sets experiment flags from article experiment config.
   */
  private setArticleExperimentFlags_(article: Article | null): void {
    if (!article) {
      return;
    }

    this.frequencyCappingLocalStorageEnabled_ =
      this.isArticleExperimentEnabled_(
        article,
        ArticleExperimentFlags.FREQUENCY_CAPPING_LOCAL_STORAGE
      );

    this.promptFrequencyCappingEnabled_ = this.isArticleExperimentEnabled_(
      article,
      ArticleExperimentFlags.PROMPT_FREQUENCY_CAPPING_EXPERIMENT
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
      return;
    }

    const hasValidEntitlements = entitlements.enablesThis();
    if (hasValidEntitlements) {
      return;
    }

    // Article response is honored over code snippet in case of conflict, such
    // as when publisher changes revenue model but does not update snippet.
    const autoPromptType = this.getAutoPromptType_(
      article.audienceActions?.actions,
      params.autoPromptType
    )!;

    // Default isClosable to what is set in the page config.
    // Otherwise, the prompt is blocking for publications with a
    // subscription revenue model, while all others can be dismissed.
    const isClosable =
      params.isClosable ?? !this.isSubscription_(autoPromptType);

    const canDisplayMonetizationPrompt = this.canDisplayMonetizationPrompt(
      article?.audienceActions?.actions
    );

    const shouldShowMonetizationPromptAsSoftPaywall =
      canDisplayMonetizationPrompt &&
      (await this.shouldShowMonetizationPromptAsSoftPaywall(
        autoPromptType,
        clientConfig.autoPromptConfig
      ));

    let potentialAction: Intervention | void;

    // Frequency Capping Flow
    const isSubscriptionOpenaccess =
      this.isSubscription_(autoPromptType) && !this.pageConfig_.isLocked();
    const isFrequencyFlow =
      !!clientConfig.autoPromptConfig?.frequencyCapConfig ||
      isSubscriptionOpenaccess;
    if (this.promptFrequencyCappingEnabled_ && isFrequencyFlow) {
      potentialAction = await this.getPotentialAction_({
        article,
        frequencyCapConfig: clientConfig.autoPromptConfig?.frequencyCapConfig,
      });
    } else {
      potentialAction = await this.getAction_({
        article,
        autoPromptType,
        dismissedPrompts,
        canDisplayMonetizationPrompt,
        shouldShowMonetizationPromptAsSoftPaywall,
      });
    }

    const promptFn = this.isMonetizationAction_(potentialAction?.type)
      ? this.getMonetizationPromptFn_(autoPromptType, isClosable)
      : potentialAction
      ? this.audienceActionPrompt_({
          actionType: potentialAction.type,
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
        this.showPrompt_(autoPromptType, promptFn);
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
   * Determines whether moentization prompt can be shown based on audience actions
   * that passed eligibility check.
   */
  private canDisplayMonetizationPrompt(actions: Intervention[] = []): boolean {
    return (
      actions.filter(
        (action) =>
          action.type === TYPE_CONTRIBUTION || action.type === TYPE_SUBSCRIPTION
      ).length > 0
    );
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
   * Determines what Monetization prompt type should be shown. Determined by
   * the first AutoPromptType passed in from Article Actions. Only enables the
   * mini prompt if the autoPromptType mini prompt snippet is present.
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

    const snippetAction =
      potentialAction.type === TYPE_CONTRIBUTION
        ? // Allow autoPromptType to enable miniprompt.
          autoPromptType === AutoPromptType.CONTRIBUTION
          ? AutoPromptType.CONTRIBUTION
          : AutoPromptType.CONTRIBUTION_LARGE
        : autoPromptType === AutoPromptType.SUBSCRIPTION
        ? AutoPromptType.SUBSCRIPTION
        : AutoPromptType.SUBSCRIPTION_LARGE;

    return this.getPromptTypeToDisplay_(snippetAction);
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
      const action = audienceActions.filter((action) =>
        this.isMonetizationAction_(action.type)
      )[0];
      this.interventionDisplayed_ = action;
      return action;
    }

    const isSurveyEligible = await this.isSurveyEligible_(audienceActions);
    let potentialActions = audienceActions.filter((action) =>
      this.checkActionEligibility_(
        action.type,
        canDisplayMonetizationPrompt,
        isSurveyEligible
      )
    );

    if (!this.isSubscription_(autoPromptType) && !this.pageConfig_.isLocked()) {
      // If page is not paywalled, filter out contribution prompt as it meets
      // its frequency cap.
      potentialActions = potentialActions.filter(
        (action) => action.type !== TYPE_CONTRIBUTION
      );

      // Suppress previously dismissed prompts.
      if (dismissedPrompts) {
        const previouslyShownPrompts = dismissedPrompts.split(',');
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

  private async getPotentialAction_({
    article,
    frequencyCapConfig,
  }: {
    article: Article;
    frequencyCapConfig: FrequencyCapConfig | undefined;
  }): Promise<Intervention | void> {
    let actions = article.audienceActions?.actions;
    if (!actions) {
      return;
    }

    const isSurveyEligible = await this.isSurveyEligible_(actions);
    actions = actions.filter((action) =>
      this.checkActionEligibility_(
        action.type,
        // Monetization check does not apply for new frequency capping flow
        /** canDisplayMonetizationPrompt */ true,
        isSurveyEligible
      )
    );

    // FrequencyCapConfig may be undefined ONLY for subscription openacess
    // content. If so, display first valid action.
    if (!frequencyCapConfig) {
      return actions[0];
    }

    const globalFrequencyCapDuration =
      frequencyCapConfig.globalFrequencyCap?.frequencyCapDuration;
    if (globalFrequencyCapDuration) {
      const globalImpressions = await this.getAllImpressions_();
      if (
        this.isFrequencyCapped_(globalFrequencyCapDuration, globalImpressions)
      ) {
        return;
      }
    }

    for (const action of actions) {
      const frequencyCapDuration =
        frequencyCapConfig.anyPromptFrequencyCap?.frequencyCapDuration;
      if (frequencyCapDuration) {
        const impressions = await this.getActionImpressions_(action.type);
        if (this.isFrequencyCapped_(frequencyCapDuration, impressions)) {
          continue;
        }
      }
      return action;
    }
    return;
  }

  /**
   * Fetches timestamp impressions from local storage for all frequency capping
   * related prompts and aggregates them into one array. Timestamps are not
   * sorted.
   */
  private async getAllImpressions_(): Promise<number[]> {
    const impressions = [];

    for (const storageKey of new Set(
      INTERVENTION_TO_STORAGE_KEY_MAP.values()
    )) {
      const promptImpressions = await this.storage_.getEvent(storageKey);
      impressions.push(...promptImpressions);
    }

    return impressions;
  }

  /**
   * Fetches timestamp impressions from local storage for a given action type.
   */
  private async getActionImpressions_(actionType: string): Promise<number[]> {
    if (ACTION_TO_IMPRESSION_STORAGE_KEY_MAP.has(actionType)) {
      // error
      return [];
    }

    return this.storage_.getEvent(
      ACTION_TO_IMPRESSION_STORAGE_KEY_MAP.get(actionType)!
    );
  }

  /**
   * Computes if the frequency cap is met from the timestamps of previous
   * impressions by using the maximum/most recent timestsamp.
   */
  private isFrequencyCapped_(
    frequencyCapDuration: number,
    impressions: number[]
  ): boolean {
    if (!impressions) {
      return false;
    }

    const lastImpression = Math.max(...impressions);
    const timeSinceLastImpression = Date.now() - lastImpression;
    return timeSinceLastImpression < frequencyCapDuration;
  }

  private audienceActionPrompt_({
    actionType,
    configurationId,
    autoPromptType,
    isClosable,
  }: {
    actionType: string;
    configurationId?: string;
    autoPromptType?: AutoPromptType;
    isClosable?: boolean;
  }): () => void {
    return () => {
      const audienceActionFlow: AudienceActionFlow =
        actionType === TYPE_REWARDED_ADS
          ? new AudienceActionLocalFlow(this.deps_, {
              action: actionType,
              configurationId,
              autoPromptType,
              onCancel: this.storeLastDismissal_.bind(this),
              isClosable,
              monetizationFunction: this.getMonetizationPromptFn_(
                autoPromptType,
                !!isClosable
              ),
            })
          : new AudienceActionIframeFlow(this.deps_, {
              action: actionType,
              configurationId,
              autoPromptType,
              onCancel: () => this.storeLastDismissal_(),
              isClosable,
            });
      this.setLastAudienceActionFlow(audienceActionFlow);
      audienceActionFlow.start();
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

    // ** Frequency Capping Impressions **
    if (this.frequencyCappingLocalStorageEnabled_) {
      await this.handleFrequencyCappingLocalStorage_(event.eventType);
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
      monetizationImpressionEvents.includes(event.eventType)
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
   * Executes required local storage gets and sets for Frequency Capping flow.
   * Impressions of prompts for paygated content do not count toward frequency
   * cap. Maintains hasStoredMiniPromptImpression_ so as not to store multiple
   * impressions for mini/normal contribution prompt.
   */
  private async handleFrequencyCappingLocalStorage_(
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    // TODO(b/300963305): manually triggered prompts should also be excluded.
    if (
      !INTERVENTION_TO_STORAGE_KEY_MAP.has(analyticsEvent) ||
      this.pageConfig_.isLocked()
    ) {
      return;
    }

    if (monetizationImpressionEvents.includes(analyticsEvent)) {
      if (this.hasStoredMiniPromptImpression_) {
        return;
      }
      this.hasStoredMiniPromptImpression_ = true;
    }
    return this.storage_.storeEvent(
      INTERVENTION_TO_STORAGE_KEY_MAP.get(analyticsEvent)!
    );
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
   * Checks for survey eligibility, including if survey is present in article
   * actions, analytics is setup, and there are no survey completion or survey
   * error timestamps.
   */
  private async isSurveyEligible_(actions: Intervention[]): Promise<boolean> {
    if (!actions.filter((action) => action.type === TYPE_REWARDED_SURVEY)) {
      return false;
    }

    const isAnalyticsEligible =
      GoogleAnalyticsEventListener.isGaEligible(this.deps_) ||
      GoogleAnalyticsEventListener.isGtagEligible(this.deps_) ||
      GoogleAnalyticsEventListener.isGtmEligible(this.deps_);
    if (!isAnalyticsEligible) {
      return false;
    }

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
    return !hasCompletedSurveys && !hasRecentSurveyDataTransferFailure;
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
      return isSurveyEligible;
    } else if (actionType === TYPE_REWARDED_ADS) {
      // Because we have fetched the article endpoint googletag.cmd should already exist.
      const googletagExists = !!this.deps_.win().googletag?.cmd;
      return googletagExists;
    }
    return true;
  }

  /**
   * Checks if provided ExperimentFlag is enabled within article experiment
   * config.
   */
  private isArticleExperimentEnabled_(
    article: Article,
    experimentFlag: string
  ): boolean {
    const articleExpFlags =
      this.entitlementsManager_.parseArticleExperimentConfigFlags(article);
    return articleExpFlags.includes(experimentFlag);
  }
}
