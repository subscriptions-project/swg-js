import {AnalyticsEvent} from '../proto/api_messages';
import {ClientEventManager} from '../runtime/client-event-manager';
import {
  Closability,
  InterventionFunnel,
  InterventionOrchestration,
} from '../api/action-orchestration';
import {Duration, FrequencyCapConfig} from '../model/auto-prompt-config';

const SECOND_IN_MILLIS = 1000;

export interface ActionsTimestamps {
  [key: string]: ActionTimestamps;
}

export interface ActionTimestamps {
  impressions: number[];
  dismissals: number[];
  completions: number[];
}

/**
 * Returns the next InterventionOrchestration after being processed by Frequency Capping
 */
export function getFrequencyCappedOrchestration(
  eventManager: ClientEventManager,
  interventionOrchestration: InterventionOrchestration[],
  actionsTimestamps: ActionsTimestamps,
  interventionFunnel: InterventionFunnel,
  frequencyCapConfig?: FrequencyCapConfig
): InterventionOrchestration | undefined {
  // Check Default FrequencyCapConfig is valid.
  if (!isValidFrequencyCap(frequencyCapConfig)) {
    eventManager.logSwgEvent(
      AnalyticsEvent.EVENT_FREQUENCY_CAP_CONFIG_NOT_FOUND_ERROR
    );
    return interventionOrchestration[0];
  }
  // Only other supported ContentType is OPEN.
  let nextOrchestration: InterventionOrchestration | undefined;

  // b/325512849: Evaluate prompt frequency cap before global frequency cap.
  // This disambiguates the scenarios where a reader meets the cap when the
  // reader is only eligible for 1 prompt vs. when the publisher only has 1
  // prompt configured.
  for (const orchestration of interventionOrchestration) {
    const promptFrequencyCapDuration = getPromptFrequencyCapDuration(
      eventManager,
      frequencyCapConfig!,
      orchestration
    );
    if (isValidFrequencyCapDuration(promptFrequencyCapDuration)) {
      const timestamps = getTimestampsForPromptFrequency(
        actionsTimestamps,
        orchestration
      );
      if (isFrequencyCapped(promptFrequencyCapDuration!, timestamps)) {
        eventManager.logSwgEvent(AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET);
        continue;
      }
    }
    nextOrchestration = orchestration;
    break;
  }

  if (!nextOrchestration) {
    return;
  }

  const globalFrequencyCapDuration = getGlobalFrequencyCapDuration(
    frequencyCapConfig!,
    interventionFunnel
  );

  if (isValidFrequencyCapDuration(globalFrequencyCapDuration)) {
    const globalTimestamps = Array.prototype.concat.apply(
      [],
      Object.entries(actionsTimestamps!)
        .map(([key, timestamps]) =>
          key === nextOrchestration!.configId
            ? timestamps.completions
            : key === nextOrchestration!.type
              ? timestamps.completions
              : timestamps.impressions
        )
    );
    if (isFrequencyCapped(globalFrequencyCapDuration!, globalTimestamps)) {
      eventManager.logSwgEvent(AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET);
      return;
    }
  }
  return nextOrchestration;
}

function isValidFrequencyCap(frequencyCapConfig?: FrequencyCapConfig): boolean {
  return (
    isValidFrequencyCapDuration(
      frequencyCapConfig?.globalFrequencyCap?.frequencyCapDuration
    ) ||
    isValidFrequencyCapDuration(
      frequencyCapConfig?.anyPromptFrequencyCap?.frequencyCapDuration
    )
  );
}

function isValidFrequencyCapDuration(duration?: Duration) {
  return !!duration?.seconds || !!duration?.nanos;
}

function getPromptFrequencyCapDuration(
  eventManager: ClientEventManager,
  frequencyCapConfig: FrequencyCapConfig,
  interventionOrchestration: InterventionOrchestration
): Duration | undefined {
  const duration = interventionOrchestration.promptFrequencyCap?.duration;
  if (!duration) {
    eventManager.logSwgEvent(
      AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CONFIG_NOT_FOUND
    );
    return frequencyCapConfig.anyPromptFrequencyCap?.frequencyCapDuration;
  }
  return duration;
}

/**
 * Computes if the frequency cap is met from the timestamps of previous
 * provided by using the maximum/most recent timestamp.
 *
 * Visible for testing
 */
export function isFrequencyCapped(
  frequencyCapDuration: Duration,
  timestamps: number[]
): boolean {
  if (timestamps.length === 0) {
    return false;
  }

  const lastImpression = Math.max(...timestamps);
  const durationInMs =
    (frequencyCapDuration.seconds || 0) * SECOND_IN_MILLIS +
    nanoToMiliseconds(frequencyCapDuration.nanos || 0);
  return Date.now() - lastImpression < durationInMs;
}

function nanoToMiliseconds(nanos: number): number {
  return Math.floor(nanos / Math.pow(10, 6));
}

/** Visible for testing */
export function getTimestampsForPromptFrequency(
  timestamps: ActionsTimestamps,
  orchestration: InterventionOrchestration
) {
  const actionTimestamps = orchestration.configId
    ? timestamps[orchestration.configId]
    : timestamps[orchestration.type];
  return orchestration.closability === Closability.BLOCKING
    ? actionTimestamps?.completions || []
    : [
        ...(actionTimestamps?.dismissals || []),
        ...(actionTimestamps?.completions || []),
      ];
}

function getGlobalFrequencyCapDuration(
  frequencyCapConfig: FrequencyCapConfig,
  interventionFunnel: InterventionFunnel
): Duration | undefined {
  const duration = interventionFunnel.globalFrequencyCap?.duration;
  return duration
    ? duration
    : frequencyCapConfig.globalFrequencyCap!.frequencyCapDuration;
}
