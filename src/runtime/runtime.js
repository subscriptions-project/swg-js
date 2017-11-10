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
import {CSS as SWG_POPUP} from '../../build/css/experimental/swg-popup.css';
import {injectStyleSheet} from '../utils/dom';
import {isArray} from '../utils/types';
import {NotificationView} from '../experimental/notification-view';
import {SubscriptionMarkup} from './subscription-markup';
import {SubscriptionState} from './subscription-state';
import {SubscriptionsFlow} from '../experimental/subscriptions-flow';

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
class PublicRuntimeDef {}


/** @typedef {{id: !string, response: !SubscriptionResponse}} */
export let SubscriptionPlatformEntry;


/**
 * @typedef {function(Array<!SubscriptionPlatformEntry>):!SubscriptionResponse}
 */
export let SubscriptionPlatformSelector;


/**
 * @param {!Window} win
 */
export function installRuntime(win) {
  if (win[RUNTIME_PROP] && !isArray(win[RUNTIME_PROP])) {
    return;
  }

  injectStyleSheet(win.document, `${SWG_POPUP}`);

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

    /** @private @const {SubscriptionState} */
    this.subscriptionState_ = new SubscriptionState(this.win);

    /** @private @const {!AuthorizationFlow} */
    this.auth_ =
        new AuthorizationFlow(this.win, this.markup_, this.subscriptionState_);

    /** @private {NotificationView} */
    this.notificationView_ = null;

    /** @private {SubscriptionsFlow} */
    this.subscriptionsFlow_ = null;

    /** @private {?Promise} */
    this.subscriptionPromise_ = null;

    /** @private {?SubscriptionPlatformSelector} */
    this.platformSelector_ = null;
  }

  /**
   * @return {!Promise}
   */
  whenReady() {
    return this.ready_;
  }

  /**
   * Starts subscription flow.
   * @return {!Promise}
   */
  start() {
    assert(
        !this.subscriptionPromise_,
        'Subscription flow can only be started once.');
    log('Starting subscription flow');

    this.notificationView_ = this.notificationView_ ||
        new NotificationView(this.win, this.subscriptionState_);
    this.subscriptionsFlow_ = this.subscriptionsFlow_ ||
        new SubscriptionsFlow(this.win, this.markup_, this.subscriptionState_);

    return this.subscriptionPromise_ = this.subscriptionLoop_();
  }


  /**
   * Loop to execute auth flow and subscription flow as long as needed.
   * @return {!Promise}
   */
  subscriptionLoop_() {
    if (this.subscriptionState_.shouldRetry) {
      this.subscriptionState_.shouldRetry = false;
      return this.auth_.start(this.platformSelector_)
          .then(() => {
            return this.subscriptionState_.isSubscriber()
                ? this.notificationView_.start()
                : this.subscriptionsFlow_.start();
          })
          .then(this.subscriptionLoop_.bind(this));
    } else {
      return Promise.resolve();  // null task - base case of recursion
    }
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

  /**
   * @param {!SubscriptionPlatformSelector} platformSelector
   */
  setSubscriptionPlatformSelector(platformSelector) {
    assert(typeof platformSelector == 'function');
    this.platformSelector_ = platformSelector;
  }
}

/**
 * @param {!Runtime} runtime
 * @return {!PublicRuntimeDef}
 */
function createPublicRuntime(runtime) {
  return /** @type {!PublicRuntimeDef} */ ({
    start: runtime.start.bind(runtime),
    setSubscriptionPlatformSelector:
        runtime.setSubscriptionPlatformSelector.bind(runtime),
  });
}
