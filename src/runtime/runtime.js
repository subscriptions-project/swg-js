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


import {assert, log} from '../utils/log';
import {AuthorizationFlow} from './authorization-flow';
import {buildSubscriptionsUi} from '../experimental/subscriptions-flow';
import {isArray} from '../utils/types';
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
  runtime.startSubscriptionsFlowIfNeeded();
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

    /** @private @const {!SubscriptionMarkup} */
    this.markup_ = new SubscriptionMarkup(this.win);

    /** @private @const {!AuthorizationFlow} */
    this.auth_ = new AuthorizationFlow(this.win, this.markup_);

    /** @private {?Promise} */
    this.subscriptionsFlow_ = null;
  }

  /**
   * @return {!Promise}
   */
  whenReady() {
    return this.ready_;
  }

  /**
   * Starts subscription flow.
   * @return {Promise} [description]
   */
  start() {
    assert(!this.subscriptionsFlow_,
        'Subscription flow can only be started once.');
    log('Starting subscription flow');
    this.subscriptionsFlow_ = this.auth_.start()
        .then(response =>
        buildSubscriptionsUi(this.win, this.markup_, response));
    return this.subscriptionsFlow_;
  }

  /**
   * Starts the subscription flow if it hasn't been started and the page is
   * configured to start it automatically.
   *
   * @return {?Promise}
   */
  startSubscriptionsFlowIfNeeded() {
    const control = this.markup_.getAccessControl();
    if (control == 'manual') {
      log('Skipping automatic start because access-control is set to "manual"');
      return null;
    }
    return this.start();
  }
}

/**
 * @param {!Runtime} runtime
 * @return {!PublicRuntimeDef}
 */
function createPublicRuntime(runtime) {
  return /** @type {!PublicRuntimeDef} */ ({
    start: runtime.start.bind(runtime),
  });
}
