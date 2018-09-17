/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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


/**
 * A comma-separated set of experiments.
 * @type {string}
 */
let experimentsString = '$experiments$';

/**
 * A parsed map of experiments.
 * @type {!Object<string, boolean>}
 */
let experimentMap = null;


/**
 * @param {string} s
 * @package Visible for testing only.
 */
export function setExperimentsStringForTesting(s) {
  experimentsString = s;
  experimentMap = null;
}


/**
 * Ensures that the experiments have been initialized and returns them.
 * @param {!Window} unusedWin
 * @return {!Object<string, boolean>}
 */
function getExperiments(unusedWin) {
  // TODO(dvoytenko): implement persistent experiments.
  if (!experimentMap) {
    experimentMap = [];
    experimentsString.split(',').forEach(s => {
      if (s) {
        experimentMap[s] = true;
      }
    });
  }
  return experimentMap;
}


/**
 * Whether the specified experiment is on or off.
 * @param {!Window} win
 * @param {string} experimentId
 * @return {boolean}
 */
export function isExperimentOn(win, experimentId) {
  return getExperiments(win)[experimentId] || false;
}


/**
 * Toggles the experiment on or off. Returns the actual value of the experiment
 * after toggling is done.
 * @param {!Window} win
 * @param {string} experimentId
 * @param {boolean} on
 */
export function setExperiment(win, experimentId, on) {
  getExperiments(win)[experimentId] = on;
}
