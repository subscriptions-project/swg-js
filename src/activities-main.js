/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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
 * @fileoverview
 * The entry point for __PROJECT__ Activites (activities.js).
 */

import './polyfills';
import {Activities} from './activities/activities';

const PROP = 'ACTIVITIES';

const activities = new Activities(self);

const waitingArray = self[PROP];

const publicObj = {
  'openIframe': activities.openIframe.bind(activities),
  'connectHost': activities.connectHost.bind(activities),
};

const dependencyInstaller = {};

/**
 * @param {function(!Object)} callback
 */
function pushDependency(callback) {
  Promise.resolve().then(() => {
    callback(publicObj);
  });
}
Object.defineProperty(dependencyInstaller, 'push', {
  get: () => pushDependency,
  configurable: false,
});
self[PROP] = dependencyInstaller;
if (waitingArray) {
  waitingArray.forEach(pushDependency);
}

console.info('Activities: $internalRuntimeVersion$');
