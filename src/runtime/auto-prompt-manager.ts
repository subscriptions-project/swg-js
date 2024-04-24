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
import {
  AudienceActionFlow,
  AudienceActionIframeFlow,
} from './audience-action-flow';
import {AudienceActionLocalFlow} from './audience-action-local-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEvent} from '../api/client-event-manager-api';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {Duration, FrequencyCapConfig} from '../model/auto-prompt-config';
import {Entitlements} from '../api/entitlements';
import {ExperimentFlags} from './experiment-flags';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {MiniPromptApi} from './mini-prompt-api';
import {OffersRequest} from '../api/subscriptions';
import {PageConfig} from '../model/page-config';
import {Storage, pruneTimestamps} from './storage';
import {StorageKeys} from '../utils/constants';
import {assert} from '../utils/log';
import {isExperimentOn} from './experiments';

const TYPE_CONTRIBUTION = 'TYPE_CONTRIBUTION';
const TYPE_SUBSCRIPTION = 'TYPE_SUBSCRIPTION';
const TYPE_NEWSLETTER_SIGNUP = 'TYPE_NEWSLETTER_SIGNUP';
const TYPE_REGISTRATION_WALL = 'TYPE_REGISTRATION_WALL';
const TYPE_REWARDED_SURVEY = 'TYPE_REWARDED_SURVEY';
const TYPE_REWARDED_AD = 'TYPE_REWARDED_AD';
const SECOND_IN_MILLIS = 1000;
const TWO_WEEKS_IN_MILLIS = 2 * 604800000;

const monetizationImpressionEvents = [
  AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT,
  AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT,
  AnalyticsEvent.IMPRESSION_OFFERS,
  AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
];

const DISMISSAL_EVENTS_TO_ACTION_MAP = new Map([
  [AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE, TYPE_CONTRIBUTION],
  [AnalyticsEvent.ACTION_CONTRIBUTION_OFFERS_CLOSED, TYPE_CONTRIBUTION],
  [AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_CLOSE, TYPE_NEWSLETTER_SIGNUP],
  [AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE, TYPE_NEWSLETTER_SIGNUP],
  [AnalyticsEvent.ACTION_REGWALL_OPT_IN_CLOSE, TYPE_REGISTRATION_WALL],
  [AnalyticsEvent.ACTION_SURVEY_CLOSED, TYPE_REWARDED_SURVEY],
  [AnalyticsEvent.ACTION_REWARDED_AD_CLOSE, TYPE_REWARDED_AD],
  [AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE, TYPE_SUBSCRIPTION],
  [AnalyticsEvent.ACTION_SUBSCRIPTION_OFFERS_CLOSED, TYPE_SUBSCRIPTION],
]);

const COMPLETION_EVENTS_TO_ACTION_MAP = new Map([
  [AnalyticsEvent.EVENT_CONTRIBUTION_PAYMENT_COMPLETE, TYPE_CONTRIBUTION],
  [
    AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_BUTTON_CLICK,
    TYPE_NEWSLETTER_SIGNUP,
  ],
  [AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT, TYPE_NEWSLETTER_SIGNUP],
  [AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK, TYPE_REGISTRATION_WALL],
  [AnalyticsEvent.ACTION_SURVEY_SUBMIT_CLICK, TYPE_REWARDED_SURVEY],
  [AnalyticsEvent.ACTION_REWARDED_AD_VIEW, TYPE_REWARDED_AD],
  [AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE, TYPE_SUBSCRIPTION],
]);

const IMPRESSION_EVENTS_TO_ACTION_MAP = new Map([
  [AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT, TYPE_CONTRIBUTION],
  [AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS, TYPE_CONTRIBUTION],
  [AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN, TYPE_NEWSLETTER_SIGNUP],
  [AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN, TYPE_NEWSLETTER_SIGNUP],
  [AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN, TYPE_REGISTRATION_WALL],
  [AnalyticsEvent.IMPRESSION_SURVEY, TYPE_REWARDED_SURVEY],
  [AnalyticsEvent.IMPRESSION_REWARDED_AD, TYPE_REWARDED_AD],
  [AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT, TYPE_SUBSCRIPTION],
  [AnalyticsEvent.IMPRESSION_OFFERS, TYPE_SUBSCRIPTION],
]);

const GENERIC_COMPLETION_EVENTS = [AnalyticsEvent.EVENT_PAYMENT_FAILED];

const ACTON_CTA_BUTTON_CLICK = [
  AnalyticsEvent.ACTION_SWG_BUTTON_SHOW_OFFERS_CLICK,
  AnalyticsEvent.ACTION_SWG_BUTTON_SHOW_CONTRIBUTIONS_CLICK,
];

export interface ShowAutoPromptParams {
  autoPromptType?: AutoPromptType;
  alwaysShow?: boolean;
  isClosable?: boolean;
}

interface ActionsTimestamps {
  [key: string]: ActionTimestamps;
}

interface ActionTimestamps {
  impressions: number[];
  dismissals: number[];
  completions: number[];
}

/**
 * Manages the display of subscription/contribution prompts automatically
 * displayed to the user.
 */
export class AutoPromptManager {
  private hasStoredMiniPromptImpression_ = false;
  private promptIsFromCtaButton_ = false;
  private lastAudienceActionFlow_: AudienceActionFlow | null = null;
  private isClosable_: boolean | undefined;
  private autoPromptType_: AutoPromptType | undefined;

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
        this.getLargeMonetizationPromptFn_(
          params.autoPromptType,
          params.isClosable ?? !this.isSubscription_(params.autoPromptType)
        )
      );
      return;
    }

    // Fetch entitlements and the client config from the server, so that we have
    // the information we need to determine whether and which prompt should be
    // displayed.
    const [clientConfig, entitlements, article] = await Promise.all([
      this.clientConfigManager_.getClientConfig(),
      this.entitlementsManager_.getEntitlements(),
      this.entitlementsManager_.getArticle(),
    ]);

    this.setArticleExperimentFlags_(article);

    this.showAutoPrompt_(clientConfig, entitlements, article, params);
  }

  /**
   * Sets experiment flags from article experiment config.
   */
  private setArticleExperimentFlags_(article: Article | null): void {
    if (!article) {
      return;
    }
    // Set experiment flags here.
  }

  /**
   * Displays the appropriate auto prompt, depending on the fetched prompt
   * configuration, entitlement state, and options specified in params.
   */
  private async showAutoPrompt_(
    clientConfig: ClientConfig,
    entitlements: Entitlements,
    article: Article | null,
    params: ShowAutoPromptParams
  ): Promise<void> {
    if (!article) {
      return;
    }

    if (!clientConfig.uiPredicates?.canDisplayAutoPrompt) {
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
    this.autoPromptType_ = autoPromptType;

    // Default isClosable to what is set in the page config.
    // Otherwise, the prompt is blocking for publications with a
    // subscription revenue model, while all others can be dismissed.
    const isClosable =
      params.isClosable ?? !this.isSubscription_(autoPromptType);
    // TODO(b/303489420): cleanup passing of autoPromptManager params.
    this.isClosable_ = isClosable;

    // ** New Triggering Flow - Prompt Frequency Cap Experiment **
    // Guarded by experiment flag and presence of FrequencyCapConfig. Frequency
    // cap flow utilizes config and impressions to determine next action.
    // Metered flow strictly follows prompt order, with subscription last.
    // Display delay is applied to all dismissible prompts.
    const frequencyCapConfig =
      clientConfig.autoPromptConfig?.frequencyCapConfig;
    const potentialAction = await this.getPotentialAction_({
      article,
      frequencyCapConfig,
    });

    const promptFn = this.isMonetizationAction_(potentialAction?.type)
      ? this.getMonetizationPromptFn_(
          autoPromptType,
          this.getLargeMonetizationPromptFn_(autoPromptType, isClosable)
        )
      : potentialAction
      ? this.getAudienceActionPromptFn_({
          actionType: potentialAction.type,
          configurationId: potentialAction.configurationId,
          autoPromptType,
          isClosable,
        })
      : undefined;

    if (!promptFn) {
      return;
    }

    this.promptIsFromCtaButton_ = false;
    // Add display delay to dismissible prompts.
    const displayDelayMs = isClosable
      ? (clientConfig?.autoPromptConfig?.clientDisplayTrigger
          ?.displayDelaySeconds || 0) * SECOND_IN_MILLIS
      : 0;
    this.deps_.win().setTimeout(promptFn, displayDelayMs);
    return;
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

  private async getPotentialAction_({
    article,
    frequencyCapConfig,
  }: {
    article: Article;
    frequencyCapConfig: FrequencyCapConfig | undefined;
  }): Promise<Intervention | void> {
    let actions = article.audienceActions?.actions;
    if (!actions || actions.length === 0) {
      return;
    }

    const actionsTimestamps = await this.getTimestamps();
    actions = actions.filter((action) =>
      this.checkActionEligibility_(action.type, actionsTimestamps!)
    );

    if (actions.length === 0) {
      return;
    }

    if (!this.isClosable_) {
      return actions[0];
    }

    // If prompt is dismissible, frequencyCapConfig should be valid.
    if (!this.isValidFrequencyCap_(frequencyCapConfig)) {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_FREQUENCY_CAP_CONFIG_NOT_FOUND_ERROR
      );
      return actions[0];
    }

    // b/325512849: Evaluate prompt frequency cap before global frequency cap.
    // This disambiguates the scenarios where a reader meets the cap when the
    // reader is only eligible for 1 prompt vs. when the publisher only has 1
    // prompt configured.
    let potentialAction: Intervention | undefined = undefined;
    for (const action of actions) {
      let frequencyCapDuration = frequencyCapConfig?.promptFrequencyCaps?.find(
        (frequencyCap) => frequencyCap.audienceActionType === action.type
      )?.frequencyCapDuration;
      if (!frequencyCapDuration) {
        this.eventManager_.logSwgEvent(
          AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CONFIG_NOT_FOUND
        );
        frequencyCapDuration =
          frequencyCapConfig?.anyPromptFrequencyCap?.frequencyCapDuration;
      }
      if (this.isValidFrequencyCapDuration_(frequencyCapDuration)) {
        const actionTimestamps = actionsTimestamps![action.type];
        const timestamps = [
          ...(actionTimestamps?.dismissals || []),
          ...(actionTimestamps?.completions || []),
        ];
        if (this.isFrequencyCapped_(frequencyCapDuration!, timestamps)) {
          this.eventManager_.logSwgEvent(
            AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET
          );
          continue;
        }
      }
      potentialAction = action;
      break;
    }

    if (!potentialAction) {
      return;
    }

    const globalFrequencyCapDuration =
      frequencyCapConfig?.globalFrequencyCap?.frequencyCapDuration;
    if (this.isValidFrequencyCapDuration_(globalFrequencyCapDuration)) {
      const globalTimestamps = Array.prototype.concat.apply(
        [],
        Object.entries(actionsTimestamps!)
          .filter(([action, _]) => action !== potentialAction!.type)
          .map(([_, timestamps]) => timestamps.impressions)
      );
      if (
        this.isFrequencyCapped_(globalFrequencyCapDuration!, globalTimestamps)
      ) {
        this.eventManager_.logSwgEvent(
          AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET
        );
        return;
      }
    }
    return potentialAction;
  }

  /**
   * Returns a function that will call the mini prompt api with an eligible
   * autoprompt type.
   */
  private getMonetizationPromptFn_(
    autoPromptType: AutoPromptType,
    largeMonetizationPromptFn: (() => void) | undefined
  ): () => void {
    return () => {
      if (!largeMonetizationPromptFn) {
        return;
      }

      if (
        autoPromptType === AutoPromptType.SUBSCRIPTION ||
        autoPromptType === AutoPromptType.CONTRIBUTION
      ) {
        this.miniPromptAPI_.create({
          autoPromptType,
          clickCallback: largeMonetizationPromptFn,
        });
      } else if (
        autoPromptType === AutoPromptType.SUBSCRIPTION_LARGE ||
        autoPromptType === AutoPromptType.CONTRIBUTION_LARGE
      ) {
        largeMonetizationPromptFn();
      }
    };
  }

  /**
   * Returns a function to show the appropriate monetization prompt,
   * or undefined if the type of prompt cannot be determined.
   */
  private getLargeMonetizationPromptFn_(
    autoPromptType: AutoPromptType | undefined,
    isClosable: boolean,
    shouldAnimateFade: boolean = true
  ): (() => void) | undefined {
    const options: OffersRequest = {isClosable, shouldAnimateFade};
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

  private getAudienceActionPromptFn_({
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
        actionType === TYPE_REWARDED_AD
          ? new AudienceActionLocalFlow(this.deps_, {
              action: actionType,
              configurationId,
              autoPromptType,
              isClosable,
              monetizationFunction: this.getLargeMonetizationPromptFn_(
                autoPromptType,
                !!isClosable,
                /* shouldAnimateFade */ false
              ),
            })
          : new AudienceActionIframeFlow(this.deps_, {
              action: actionType,
              configurationId,
              autoPromptType,
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
   * Listens for relevant prompt impression events, dismissal events, and completed
   * action events, and logs them to local storage for use in determining whether
   * to display the prompt in the future.
   */
  private async handleClientEvent_(event: ClientEvent): Promise<void> {
    if (!event.eventType) {
      return;
    }

    // ** Frequency Capping Events **
    if (ACTON_CTA_BUTTON_CLICK.find((e) => e === event.eventType)) {
      this.promptIsFromCtaButton_ = true;
    }
    await this.handleFrequencyCappingLocalStorage_(event.eventType);
  }

  /**
   * Executes required local storage gets and sets for Frequency Capping flow.
   * Events of prompts for paygated content do not count toward frequency cap.
   * Maintains hasStoredMiniPromptImpression_ so as not to store multiple
   * impression timestamps for mini/normal contribution prompt.
   */
  private async handleFrequencyCappingLocalStorage_(
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    if (!this.isClosable_) {
      return;
    }

    if (
      !(
        IMPRESSION_EVENTS_TO_ACTION_MAP.has(analyticsEvent) ||
        DISMISSAL_EVENTS_TO_ACTION_MAP.has(analyticsEvent) ||
        COMPLETION_EVENTS_TO_ACTION_MAP.has(analyticsEvent) ||
        GENERIC_COMPLETION_EVENTS.find((e) => e === analyticsEvent)
      )
    ) {
      return;
    }

    if (
      !this.promptIsFromCtaButton_ &&
      monetizationImpressionEvents.includes(analyticsEvent)
    ) {
      if (this.hasStoredMiniPromptImpression_) {
        return;
      }
      this.hasStoredMiniPromptImpression_ = true;
    }

    this.storeEvent(analyticsEvent);
  }

  /**
   * Fetches frequency capping timestamps from local storage for prompts.
   * Timestamps are not necessarily sorted.
   */
  async getTimestamps(): Promise<ActionsTimestamps> {
    const stringified = await this.storage_.get(
      StorageKeys.TIMESTAMPS,
      /* useLocalStorage */ true
    );
    if (!stringified) {
      return {};
    }

    const timestamps: ActionsTimestamps = JSON.parse(stringified);
    if (!this.isValidActionsTimestamps_(timestamps)) {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_LOCAL_STORAGE_TIMESTAMPS_PARSING_ERROR
      );
      return {};
    }
    return Object.entries(timestamps).reduce(
      (acc: ActionsTimestamps, [key, value]: [string, ActionTimestamps]) => {
        return {
          ...acc,
          [key]: {
            impressions: pruneTimestamps(
              value.impressions,
              TWO_WEEKS_IN_MILLIS
            ),
            dismissals: pruneTimestamps(value.dismissals, TWO_WEEKS_IN_MILLIS),
            completions: pruneTimestamps(
              value.completions,
              TWO_WEEKS_IN_MILLIS
            ),
          },
        };
      },
      {}
    );
  }

  isValidActionsTimestamps_(timestamps: ActionsTimestamps) {
    return (
      timestamps instanceof Object &&
      !(timestamps instanceof Array) &&
      Object.values(
        Object.values(timestamps).map(
          (t) =>
            Object.keys(t).length === 3 &&
            t.impressions.every((n) => !isNaN(n)) &&
            t.dismissals.every((n) => !isNaN(n)) &&
            t.completions.every((n) => !isNaN(n))
        )
      ).every(Boolean)
    );
  }

  async setTimestamps(timestamps: ActionsTimestamps) {
    const json = JSON.stringify(timestamps);
    this.storage_.set(StorageKeys.TIMESTAMPS, json, /* useLocalStorage */ true);
  }

  async storeImpression(action: string): Promise<void> {
    const timestamps = await this.getTimestamps();
    const actionTimestamps = timestamps[action] || {
      impressions: [],
      dismissals: [],
      completions: [],
    };
    actionTimestamps.impressions.push(Date.now());
    timestamps[action] = actionTimestamps;
    this.setTimestamps(timestamps);
  }

  async storeDismissal(action: string): Promise<void> {
    const timestamps = await this.getTimestamps();
    const actionTimestamps = timestamps[action] || {
      impressions: [],
      dismissals: [],
      completions: [],
    };
    actionTimestamps.dismissals.push(Date.now());
    timestamps[action] = actionTimestamps;
    this.setTimestamps(timestamps);
  }

  async storeCompletion(action: string): Promise<void> {
    const timestamps = await this.getTimestamps();
    const actionTimestamps = timestamps[action] || {
      impressions: [],
      dismissals: [],
      completions: [],
    };
    actionTimestamps.completions.push(Date.now());
    timestamps[action] = actionTimestamps;
    this.setTimestamps(timestamps);
  }

  async storeEvent(event: AnalyticsEvent): Promise<void> {
    let action;
    if (IMPRESSION_EVENTS_TO_ACTION_MAP.has(event)) {
      // b/333536312: Only store impression if prompt was not triggered via cta
      // click.
      if (!this.promptIsFromCtaButton_) {
        action = IMPRESSION_EVENTS_TO_ACTION_MAP.get(event);
        this.storeImpression(action!);
      }
    } else if (DISMISSAL_EVENTS_TO_ACTION_MAP.has(event)) {
      action = DISMISSAL_EVENTS_TO_ACTION_MAP.get(event);
      this.storeDismissal(action!);
    } else if (COMPLETION_EVENTS_TO_ACTION_MAP.has(event)) {
      action = COMPLETION_EVENTS_TO_ACTION_MAP.get(event);
      this.storeCompletion(action!);
    } else if (GENERIC_COMPLETION_EVENTS.includes(event)) {
      if (this.isContribution_(this.autoPromptType_)) {
        this.storeCompletion(TYPE_CONTRIBUTION);
      }
      if (this.isSubscription_(this.autoPromptType_)) {
        this.storeCompletion(TYPE_SUBSCRIPTION);
      }
      // TODO(justinchou@) handle failure modes for event EVENT_PAYMENT_FAILED
    }
  }

  /**
   * Computes if the frequency cap is met from the timestamps of previous
   * provided by using the maximum/most recent timestamp.
   */
  private isFrequencyCapped_(
    frequencyCapDuration: Duration,
    timestamps: number[]
  ): boolean {
    if (timestamps.length === 0) {
      return false;
    }

    const lastImpression = Math.max(...timestamps);
    const durationInMs =
      (frequencyCapDuration.seconds || 0) * SECOND_IN_MILLIS +
      this.nanoToMiliseconds_(frequencyCapDuration.nano || 0);
    return Date.now() - lastImpression < durationInMs;
  }

  private nanoToMiliseconds_(nano: number): number {
    return Math.floor(nano / Math.pow(10, 6));
  }

  /**
   * Checks AudienceAction eligbility, used to filter potential actions.
   */
  private checkActionEligibility_(
    actionType: string,
    timestamps: ActionsTimestamps
  ): boolean {
    if (actionType === TYPE_REWARDED_SURVEY) {
      const isAnalyticsEligible =
        GoogleAnalyticsEventListener.isGaEligible(this.deps_) ||
        GoogleAnalyticsEventListener.isGtagEligible(this.deps_) ||
        GoogleAnalyticsEventListener.isGtmEligible(this.deps_);
      if (!isAnalyticsEligible) {
        return false;
      }
      // Do not show survey if there is a previous completion record.
      // Client side eligibility is required to handle identity transitions
      // after sign-in flow. TODO(b/332759781): update survey completion check
      // to persist even after 2 weeks.
      return !(timestamps[TYPE_REWARDED_SURVEY]?.completions || []).length;
    }
    return true;
  }

  private isValidFrequencyCap_(
    frequencyCapConfig: FrequencyCapConfig | undefined
  ) {
    return (
      this.isValidFrequencyCapDuration_(
        frequencyCapConfig?.globalFrequencyCap?.frequencyCapDuration
      ) ||
      frequencyCapConfig?.promptFrequencyCaps
        ?.map((frequencyCap) => frequencyCap.frequencyCapDuration)
        .some(this.isValidFrequencyCapDuration_) ||
      this.isValidFrequencyCapDuration_(
        frequencyCapConfig?.anyPromptFrequencyCap?.frequencyCapDuration
      )
    );
  }

  private isValidFrequencyCapDuration_(duration: Duration | undefined) {
    return !!duration?.seconds || !!duration?.nano;
  }
}
