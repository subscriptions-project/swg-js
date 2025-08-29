/**
 * Copyright 2025 The Subscribe with Google Authors. All Rights Reserved.
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
import {ClientEventManager} from '../runtime/client-event-manager';
import {
  getFrequencyCappedOrchestration,
  getTimestampsForPromptFrequency,
  isFrequencyCapped,
} from './frequency-capping-utils';

const CURRENT_TIME = 1615416442; // GMT: Wednesday, March 10, 2021 10:47:22 PM
const SECOND_IN_MS = Math.pow(10, 3);
const SECOND_IN_NANO = Math.pow(10, 9);
const CONTRIBUTION_ID = 'contribution_config_id';
const SURVEY_ID = 'survey_config_id';
const NEWSLETTER_ID = 'newsletter_config_id';

const globalFrequencyCapDurationSeconds = 100;
const contributionFrequencyCapDurationSeconds = 10800;
const surveyFrequencyCapDurationSeconds = 7200;
const newsletterFrequencyCapDurationSeconds = 3600;
const CONTRIBUTION_ACTION_TIMESTAMP = {
  impressions: [
    CURRENT_TIME - 2 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
  ],
  dismissals: [
    CURRENT_TIME - 3 * contributionFrequencyCapDurationSeconds * SECOND_IN_MS,
  ],
  completions: [],
};
const SURVEY_ACTION_TIMESTAMP = {
  impressions: [
    CURRENT_TIME - 2 * surveyFrequencyCapDurationSeconds * SECOND_IN_MS,
  ],
  dismissals: [
    CURRENT_TIME - 3 * surveyFrequencyCapDurationSeconds * SECOND_IN_MS,
  ],
  completions: [],
};
const ACTION_TIMESTAMPS = {
  [CONTRIBUTION_ID]: CONTRIBUTION_ACTION_TIMESTAMP,
  [SURVEY_ID]: SURVEY_ACTION_TIMESTAMP,
};
const SURVEY_ORCHESTRATION = {
  configId: SURVEY_ID,
  type: 'TYPE_REWARDED_SURVEY',
  promptFrequencyCap: {
    duration: {
      seconds: surveyFrequencyCapDurationSeconds,
    },
  },
  closability: 'DISMISSIBLE',
};
const CONTRIBUTION_ORCHESTRATION = {
  configId: CONTRIBUTION_ID,
  type: 'TYPE_CONTRIBUTION',
  promptFrequencyCap: {
    duration: {
      seconds: contributionFrequencyCapDurationSeconds,
    },
  },
  closability: 'DISMISSIBLE',
};
const NEWSLETTER_ORCHESTRATION = {
  configId: NEWSLETTER_ID,
  type: 'TYPE_NEWSLETTER_SIGNUP',
  promptFrequencyCap: {
    duration: {
      seconds: newsletterFrequencyCapDurationSeconds,
    },
  },
  closability: 'DISMISSIBLE',
};

const ORCHESTRATION = [CONTRIBUTION_ORCHESTRATION, SURVEY_ORCHESTRATION];

const INTERVENTION_FUNNEL = {
  interventions: [
    CONTRIBUTION_ORCHESTRATION,
    SURVEY_ORCHESTRATION,
    NEWSLETTER_ORCHESTRATION,
  ],
};

const VALID_FREQUENCY_CAP_CONFIG = {
  globalFrequencyCap: {
    frequencyCapDuration: {seconds: globalFrequencyCapDurationSeconds},
  },
};

describes.realWin('Frequency Capping utils', () => {
  let eventManager;
  let logEventSpy;

  beforeEach(() => {
    sandbox.useFakeTimers(CURRENT_TIME);
    eventManager = new ClientEventManager(Promise.resolve());
    logEventSpy = sandbox.spy(eventManager, 'logEvent');
  });

  describe('getFrequencyCappedOrchestration', () => {
    it('returns the first CTA and log an error if the FrequencyCapConfig is invalid', async () => {
      const result = getFrequencyCappedOrchestration(
        eventManager,
        ORCHESTRATION,
        ACTION_TIMESTAMPS,
        true,
        INTERVENTION_FUNNEL,
        {}
      );

      expect(result).to.equal(CONTRIBUTION_ORCHESTRATION);
      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_FREQUENCY_CAP_CONFIG_NOT_FOUND_ERROR,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
    });

    it('returns the first CTA and log an error if the global frequency cap is not met and prompt frequency is undefined', async () => {
      const contributionWithoutPromptFrequency = {
        ...CONTRIBUTION_ORCHESTRATION,
        promptFrequencyCap: {},
      };
      const orchestration = [
        contributionWithoutPromptFrequency,
        NEWSLETTER_ORCHESTRATION,
      ];

      const result = getFrequencyCappedOrchestration(
        eventManager,
        orchestration,
        ACTION_TIMESTAMPS,
        true,
        INTERVENTION_FUNNEL,
        VALID_FREQUENCY_CAP_CONFIG
      );

      expect(result).to.equal(contributionWithoutPromptFrequency);
      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CONFIG_NOT_FOUND,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
    });

    it('returns undefined and log cap met if the global frequency cap within interventionFunnel is met', async () => {
      const result = getFrequencyCappedOrchestration(
        eventManager,
        ORCHESTRATION,
        ACTION_TIMESTAMPS,
        true,
        {
          ...INTERVENTION_FUNNEL,
          globalFrequencyCap: {
            duration: {
              seconds: 10 * contributionFrequencyCapDurationSeconds,
            },
          },
        },
        VALID_FREQUENCY_CAP_CONFIG
      );

      expect(result).to.be.undefined;
      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_GLOBAL_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
    });

    it('returns the first CTA if both the global frequency cap and prompt frequency cap are not met', async () => {
      const result = getFrequencyCappedOrchestration(
        eventManager,
        ORCHESTRATION,
        ACTION_TIMESTAMPS,
        true,
        INTERVENTION_FUNNEL,
        VALID_FREQUENCY_CAP_CONFIG
      );

      expect(result).to.equal(CONTRIBUTION_ORCHESTRATION);
      expect(logEventSpy).not.to.be.called;
    });

    it('returns the second CTA if the prompt frequency cap is met for the first CTA', async () => {
      const actionTimestamps = {
        [CONTRIBUTION_ID]: {
          completions: [
            CURRENT_TIME - 2 * globalFrequencyCapDurationSeconds * SECOND_IN_MS,
          ],
        },
      };
      const result = getFrequencyCappedOrchestration(
        eventManager,
        ORCHESTRATION,
        actionTimestamps,
        true,
        INTERVENTION_FUNNEL,
        VALID_FREQUENCY_CAP_CONFIG
      );

      expect(result).to.equal(SURVEY_ORCHESTRATION);
      expect(logEventSpy).to.be.calledOnceWith({
        eventType: AnalyticsEvent.EVENT_PROMPT_FREQUENCY_CAP_MET,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction: false,
        additionalParameters: null,
        timestamp: sandbox.match.number,
        configurationId: null,
      });
    });
  });

  describe('getTimestampsForPromptFrequency', () => {
    it('returns dismissals and completions timestamps for DISMISSIBLE closability', async () => {
      const actionsTimestamps = {
        'TYPE_CONTRIBUTION': {
          'impressions': ['c_i1', 'c_i2', 'c_i3'],
          'dismissals': ['c_d1', 'c_d2', 'c_d3'],
          'completions': ['c_c1', 'c_c2', 'c_c3'],
        },
        'TYPE_REWARDED_SURVEY': {
          'impressions': ['s_i1', 's_i2', 's_i3'],
          'dismissals': ['s_d1', 's_d2', 's_d3'],
          'completions': ['s_c1', 's_c2', 's_c3'],
        },
      };
      const timestamps = getTimestampsForPromptFrequency(actionsTimestamps, {
        'type': 'TYPE_REWARDED_SURVEY',
        closability: 'DISMISSIBLE',
      });
      expect(timestamps.length).to.equal(6);
      expect(timestamps[0]).to.equal('s_d1');
      expect(timestamps[1]).to.equal('s_d2');
      expect(timestamps[2]).to.equal('s_d3');
      expect(timestamps[3]).to.equal('s_c1');
      expect(timestamps[4]).to.equal('s_c2');
      expect(timestamps[5]).to.equal('s_c3');
    });

    it('returns completions timestamps for BLOCKING closability', async () => {
      const actionsTimestamps = {
        'TYPE_CONTRIBUTION': {
          'impressions': ['c_i1', 'c_i2', 'c_i3'],
          'dismissals': ['c_d1', 'c_d2', 'c_d3'],
          'completions': ['c_c1', 'c_c2', 'c_c3'],
        },
        'TYPE_REWARDED_SURVEY': {
          'impressions': ['s_i1', 's_i2', 's_i3'],
          'dismissals': ['s_d1', 's_d2', 's_d3'],
          'completions': ['s_c1', 's_c2', 's_c3'],
        },
      };
      const timestamps = getTimestampsForPromptFrequency(actionsTimestamps, {
        'type': 'TYPE_REWARDED_SURVEY',
        closability: 'BLOCKING',
      });
      expect(timestamps.length).to.equal(3);
      expect(timestamps[0]).to.equal('s_c1');
      expect(timestamps[1]).to.equal('s_c2');
      expect(timestamps[2]).to.equal('s_c3');
    });

    it('returns dismissals and completions timestamps by configId for DISMISSIBLE closability', async () => {
      const actionsTimestamps = {
        'contribution_config_id': {
          'impressions': ['c_i1', 'c_i2', 'c_i3'],
          'dismissals': ['c_d1', 'c_d2', 'c_d3'],
          'completions': ['c_c1', 'c_c2', 'c_c3'],
        },
        'survey_config_id': {
          'impressions': ['s_i1', 's_i2', 's_i3'],
          'dismissals': ['s_d1', 's_d2', 's_d3'],
          'completions': ['s_c1', 's_c2', 's_c3'],
        },
      };
      const timestamps = getTimestampsForPromptFrequency(actionsTimestamps, {
        'type': 'survey_config_id',
        closability: 'DISMISSIBLE',
      });
      expect(timestamps.length).to.equal(6);
      expect(timestamps[0]).to.equal('s_d1');
      expect(timestamps[1]).to.equal('s_d2');
      expect(timestamps[2]).to.equal('s_d3');
      expect(timestamps[3]).to.equal('s_c1');
      expect(timestamps[4]).to.equal('s_c2');
      expect(timestamps[5]).to.equal('s_c3');
    });

    it('returns completions timestamps by configId for BLOCKING closability', async () => {
      const actionsTimestamps = {
        'contribution_config_id': {
          'impressions': ['c_i1', 'c_i2', 'c_i3'],
          'dismissals': ['c_d1', 'c_d2', 'c_d3'],
          'completions': ['c_c1', 'c_c2', 'c_c3'],
        },
        'survey_config_id': {
          'impressions': ['s_i1', 's_i2', 's_i3'],
          'dismissals': ['s_d1', 's_d2', 's_d3'],
          'completions': ['s_c1', 's_c2', 's_c3'],
        },
      };
      const timestamps = getTimestampsForPromptFrequency(actionsTimestamps, {
        'type': 'survey_config_id',
        closability: 'BLOCKING',
      });
      expect(timestamps.length).to.equal(3);
      expect(timestamps[0]).to.equal('s_c1');
      expect(timestamps[1]).to.equal('s_c2');
      expect(timestamps[2]).to.equal('s_c3');
    });
  });

  describe('isFrequencyCapped', () => {
    it('returns false for empty impressions', async () => {
      const duration = {seconds: 60, nanos: 0};

      const result = isFrequencyCapped(duration, []);

      expect(result).to.equal(false);
    });

    it('returns false for impressions that occurred outside of the cap duration', async () => {
      const duration = {seconds: 60, nanos: 0};
      const impressions = [CURRENT_TIME - 120 * SECOND_IN_MS];

      const result = isFrequencyCapped(duration, impressions);

      expect(result).to.equal(false);
    });

    it('returns true if the max impression occurred within of the cap duration', async () => {
      const duration = {seconds: 60, nanos: 0};
      const impressions = [
        CURRENT_TIME - 10 * SECOND_IN_MS,
        CURRENT_TIME - 120 * SECOND_IN_MS,
      ];

      const result = isFrequencyCapped(duration, impressions);

      expect(result).to.equal(true);
    });

    it('returns true for impressions that occurred within the cap duration', async () => {
      const duration = {seconds: 60, nanos: 0};
      const impressions = [CURRENT_TIME - 10 * SECOND_IN_MS];

      const result = isFrequencyCapped(duration, impressions);

      expect(result).to.equal(true);
    });

    it('returns true if the max impression occurred within the cap duration, including nanos', async () => {
      const duration = {seconds: 60, nanos: 60 * SECOND_IN_NANO};
      const impressions = [CURRENT_TIME - 90 * SECOND_IN_MS];

      const result = isFrequencyCapped(duration, impressions);

      expect(result).to.equal(true);
    });

    it('returns false if the max impression occurred within the cap duration, including negative nanos', async () => {
      const duration = {seconds: 120, nanos: -60 * SECOND_IN_NANO};
      const impressions = [CURRENT_TIME - 90 * SECOND_IN_MS];

      const result = isFrequencyCapped(duration, impressions);

      expect(result).to.equal(false);
    });
  });
});
