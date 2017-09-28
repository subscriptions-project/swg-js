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

import {buildOffersContainer} from '../experimental/offers-flow';
import {launchPaymentsFlow} from '../experimental/payments-flow';

const RUNTIME_PROP = 'SUBSCRIPTIONS';


/**
 * @interface
 */
class PublicRuntimeDef {
}


/**
 * @param {!Window} win
 * @return {!Runtime}
 */
export function installRuntime(win) {
  const runtime = new Runtime(win);

  const waitingArray = win[RUNTIME_PROP];

  // Public runtime.
  const publicRuntime = createPublicRuntime(runtime);

  const dependencyInstaller = {};

  /**
   * @param {function(!PublicRuntimeDef)} callback
   */
  function pushDependency(callback) {
    runtime.whenReady().then(() => {
      callback(publicRuntime);
    });
  }
  Object.defineProperty(dependencyInstaller, 'push', {
    get: () => pushDependency,
    configurable: false,
  });
  win[RUNTIME_PROP] = dependencyInstaller;
  if (waitingArray) {
    waitingArray.forEach(pushDependency);
  }

  return runtime;
}


export class Runtime {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @const */
    this.win = win;

    /** @private @const {!Promise} */
    this.ready_ = Promise.resolve();
  }

  /**
   * @return {!Promise}
   */
  whenReady() {
    return this.ready_;
  }

  /**
   * Starts the offers flow.
   */
  startOffersContainer() {
    buildOffersContainer();
  }

  /**
   * @param {string} blob
   */
  startPaymentsFlow(blob) {
    // See go/subs-pay-blob.
    launchPaymentsFlow(blob);
  }
}


/**
 * @param {!Runtime} runtime
 * @return {!PublicRuntimeDef}
 */
function createPublicRuntime(runtime) {
  return /** @type {!PublicRuntimeDef} */ ({
    startOffersContainer: runtime.startOffersContainer.bind(runtime),
    startPaymentsFlow: runtime.startPaymentsFlow.bind(runtime),
  });
}
