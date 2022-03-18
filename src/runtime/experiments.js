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

import {ErrorUtils} from '../utils/errors';
import {parseQueryString} from '../utils/url';

/**
 * @fileoverview
 *
 * Client-side experiments in SwG.
 *
 * The experiments can be set in a few different ways:
 *  1. By gulp build rules using `--experiments=${experimentsString}` argument.
 *  2. By `#swg.experiments=${experimentsString}` parameter in the URL's
 *     fragment.
 *  3. By `swg.configure({experiments: [array]})` call.
 *
 * The `${experimentsString}` is defined as following:
 *  - experimentString = (experimentSpec,)*
 *  - experimentSpec = experimentId | experimentId '=' num100 ('c')?
 *
 * Some examples:
 *  - `A,B` - defines two experiments "A" and "B" that will be turned on.
 *  - `A:100,B:100` - the same: "A" and "B" will be turned on.
 *  - `A:0` - the experiment "A" will be disabled.
 *  - `A:1` - enable the experiment "A" in 1% of impressions.
 *  - `A:10c` - enable the experiment "A" in 10% of impressions with 10%
 *    control. In this case, 20% of the impressions will be split into two
 *    categories: experiment and control. Notice, a control can be requested
 *    only for the fraction under 20%.
 */

/**
 * @enum {string}
 */
const Selection = {
  EXPERIMENT: 'e',
  CONTROL: 'c',
};

/**
 * A comma-separated set of experiments.
 * @type {string}
 */
let experimentsString = '$experiments$';

/**
 * A parsed map of experiments.
 * @type {?Object<string, boolean>}
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
 * @param {!Window} win
 * @return {!Object<string, boolean>}
 */
function getExperiments(win) {
  if (!experimentMap) {
    experimentMap = {};
    let combinedExperimentString = experimentsString;
    try {
      const query = parseQueryString(win.location.hash);
      const experimentStringFromHash = query['swg.experiments'];
      if (experimentStringFromHash) {
        combinedExperimentString += ',' + experimentStringFromHash;
      }
    } catch (e) {
      // Ignore: experiment parsing cannot block runtime.
      ErrorUtils.throwAsync(e);
    }

    // Format:
    // - experimentString = (experimentSpec,)*
    for (let experimentString of combinedExperimentString.split(',')) {
      experimentString = experimentString.trim();
      if (!experimentString) {
        continue;
      }
      try {
        parseSetExperiment(win, experimentMap, experimentString);
      } catch (e) {
        // Ignore: experiment parsing cannot block runtime.
        ErrorUtils.throwAsync(e);
      }
    }
  }
  return experimentMap;
}

/**
 * @param {!Window} win
 * @param {?Object<string, boolean>} experimentMap
 * @param {string} spec
 */
function parseSetExperiment(win, experimentMap, spec) {
  // Format:
  // - experimentSpec = experimentId | experimentId '=' num100 ('c')?
  let experimentId;
  let fraction;
  let control = false;
  const eq = spec.indexOf(':');
  if (eq == -1) {
    experimentId = spec;
    fraction = 100;
    control = false;
  } else {
    experimentId = spec.substring(0, eq).trim();
    spec = spec.substring(eq + 1);
    if (spec.substring(spec.length - 1) == Selection.CONTROL) {
      control = true;
      spec = spec.substring(0, spec.length - 1);
    }
    fraction = parseInt(spec, 10);
  }
  if (isNaN(fraction)) {
    throw new Error('invalid fraction');
  }

  // Calculate "on"/"off".
  let on;
  if (fraction > 99) {
    // Explicitly "on".
    on = true;
  } else if (fraction < 1) {
    // Explicitly "off".
    on = false;
  } else if (win.sessionStorage) {
    // Fractional and possibly with the control.
    // Note that:
    // a. We can't do persistent experiments if storage is not available.
    // b. We can't run control on more than 20%.
    control = control && fraction <= 20;
    try {
      // Set fraction in the experiment to make it unlaunchable.
      const storageKey =
        'subscribe.google.com:e:' +
        experimentId +
        ':' +
        fraction +
        (control ? 'c' : '');
      let selection = parseSelection(win.sessionStorage.getItem(storageKey));
      if (!selection) {
        // Is experiment/control range?
        if (win.Math.random() * 100 <= fraction * (control ? 2 : 1)) {
          const inExperiment = control ? win.Math.random() <= 0.5 : true;
          selection = inExperiment ? Selection.EXPERIMENT : Selection.CONTROL;
          win.sessionStorage.setItem(storageKey, selection);
        }
      }
      on = !!selection;
      if (selection == Selection.CONTROL) {
        experimentId = 'c-' + experimentId;
      }
    } catch (e) {
      // Ignore: experiment parsing cannot block runtime.
      on = false;
      ErrorUtils.throwAsync(e);
    }
  } else {
    on = false;
  }

  experimentMap[experimentId] = on;
}

/**
 * @param {?string} s
 * @return {?Selection}
 */
function parseSelection(s) {
  // Do a simple if-then to inline the whole Selection enum.
  return s == Selection.EXPERIMENT
    ? Selection.EXPERIMENT
    : s == Selection.CONTROL
    ? Selection.CONTROL
    : null;
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

/**
 * @return {!Array<string>}
 */
export function getOnExperiments(win) {
  const experimentMap = getExperiments(win);
  const experiments = [];
  for (const experiment in experimentMap) {
    if (experimentMap[experiment]) {
      experiments.push(experiment);
    }
  }
  return experiments;
}
