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


import {Auth} from '../experimental/auth';
import {buildSubscriptionsUi} from '../experimental/subscriptions-ui-flow';
import {isArray} from '../utils/types';
import {launchPaymentsFlow} from '../experimental/payments-flow';
import {log} from '../utils/log';
import {SubscriptionMarkup} from './subscription-markup';

const RUNTIME_PROP = 'SUBSCRIPTIONS';

/** @private {Runtime} */
let runtimeInstance_;

/**
 * Returns runtime for testing if available. Throws if the runtime is not
 * initialized yet.
 * @visibleForTesting
 * @return {!Runtime}
 */
export function getRuntime() {
  if (!runtimeInstance_) {
    throw new Error('not initialized yet');
  }
  return runtimeInstance_;
}

/**
 * @interface
 */
class PublicRuntimeDef {
}


/**
 * @param {!Window} win
 */
export function installRuntime(win) {
  if (win[RUNTIME_PROP] && !isArray(win[RUNTIME_PROP])) {
    return;
  }

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
  runtimeInstance_ = runtime;
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

    this.markup_ = new SubscriptionMarkup(this.win);

    this.auth_ = new Auth(this.win, this.markup_);
  }

  /**
   * @return {!Promise}
   */
  whenReady() {
    return this.ready_;
  }

  /**
   * Starts the Subscriptions flow.
   * @param {!Window} win The window object.
   */
  startSubscriptionsUi(win) {
    buildSubscriptionsUi(win);
  }

  /**
   * @param {string} blob
   */
  startPaymentsFlow(blob) {
    // See go/subs-pay-blob.
    launchPaymentsFlow(blob);
  }

  /**
   * Starts subscription flow.
   */
  start() {
    log('Starting subscriptions processing');
    this.auth_.start().then(blob => {
      if (blob) {
        launchPaymentsFlow(blob);
      }
    });

  }
}

/**
 * @param {!Runtime} runtime
 * @return {!PublicRuntimeDef}
 */
function createPublicRuntime(runtime) {
  return /** @type {!PublicRuntimeDef} */ ({
    startSubscriptionsUi: runtime.startSubscriptionsUi.bind(runtime),
    startPaymentsFlow: runtime.startPaymentsFlow.bind(runtime),
    start: runtime.start.bind(runtime),
  });
}
