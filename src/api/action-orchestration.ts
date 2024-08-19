/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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

export interface ActionOrchestration {
  interventionFunnel: InterventionFunnel;
}

interface InterventionFunnel {
  id: string;
  globalFrequencyCap: {};
  prompts: Array<{
    configId: string;
    type: FrequencyCapConfig;
    promptFrequencyCap: {};
    closability: Closability;
    repeatability: {
      type: RepeatabilityType;
      count: number;
    };
  }>;
}

enum Closability {
  UNSPECIFIED = 'UNSPECIFIED',
  DISMISSIBLE = 'DISMISSIBLE',
  BLOCKING = 'BLOCKING',
}

enum RepeatabilityType {
  UNSPECIFIED = 'UNSPECIFIED',
  FINITE = 'FINITE',
  INFINITE = 'INFINITE',
}

interface FrequencyCapConfig {
  duration: Duration;
}

interface Duration {
  unit: DurationUnit;
  count: number;
}

enum DurationUnit {
  UNSPECIFIED_UNIT = 'UNSPECIFIED_UNIT',
  SECOND = 'SECOND',
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}
