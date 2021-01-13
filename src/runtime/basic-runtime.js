/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

import {AutoPromptType} from '../api/basic-subscriptions';
import {ConfiguredRuntime} from './runtime';

const BASIC_RUNTIME_PROP = 'SWG_BASIC';

/**
 * Reference to the runtime, for testing.
 * @private {!BasicRuntime}
 */
let basicRuntimeInstance_;

/**
 * Returns runtime for testing if available. Throws if the runtime is not
 * initialized yet.
 * @visibleForTesting
 * @return {!BasicRuntime}
 */
export function getBasicRuntime() {
  assert(basicRuntimeInstance_, 'not initialized yet');
  return basicRuntimeInstance_;
}

/**
 * Installs runtime for SwG Basic.
 * @param {!Window} win
 */
export function installBasicRuntime(win) {
  // Only install the SwG Basic runtime once.
  if (win[BASIC_RUNTIME_PROP] && !Array.isArray(win[BASIC_RUNTIME_PROP])) {
    return;
  }

  // Create the runtime.
  const basicRuntime = new BasicRuntime(win);

  // Create the public version of the SwG Basic runtime.
  const publicBasicRuntime = createPublicBasicRuntime(basicRuntime);

  /**
   * Executes a callback when the runtime is ready.
   * @param {function(!BasicSubscriptions)} callback
   */
  function callWhenRuntimeIsReady(callback) {
    if (!callback) {
      return;
    }

    basicRuntime.whenReady().then(() => {
      callback(publicBasicRuntime);
    });
  }

  // Queue up any callbacks the publication might have provided.
  const waitingCallbacks = [].concat(win[BASIC_RUNTIME_PROP]);
  waitingCallbacks.forEach(callWhenRuntimeIsReady);

  // If any more callbacks are `push`ed to the global SwG Basic variables,
  // they'll be queued up to receive the SwG Basic runtime when it's ready.
  win[BASIC_RUNTIME_PROP] = {
    push: callWhenRuntimeIsReady,
  };

  // Set variable for testing.
  basicRuntimeInstance_ = basicRuntime;

  // Automatically set up buttons and auto prompt.
  basicRuntime.setupButtons();
  basicRuntime.setupAndShowAutoPrompt();
}

/**
 * @implements {BasicSubscriptions}
 */
export class BasicRuntime {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

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
   * @param {boolean} commit
   * @return {!Promise<!ConfiguredBasicRuntime>}
   * @private
   */
  configured_(commit) {
    if (!this.committed_ && commit) {
      // TODO(stellachui): Read the PageConfig from the markup and create the
      //   ConfiguredBasicRuntime object once that's done.
    }
    return Promise.resolve();
  }

  /** @override */
  /* eslint-disable no-unused-vars */
  init({
    type,
    isAccessibleForFree,
    isPartOfType,
    isPartOfProductId,
    autoPromptType = AutoPromptType.NONE,
  } = {}) {
    // TODO(stellachui): Generate the markup.
    this.configured_(true);
  }
  /* eslint-enable no-unused-vars */

  /** @override */
  setOnEntitlementsResponse(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnEntitlementsResponse(callback)
    );
  }

  /** @override */
  setOnPaymentResponse(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnPaymentResponse(callback)
    );
  }

  /** @override */
  setupAndShowAutoPrompt(alwaysShow = false) {
    return this.configured_(true).then((runtime) =>
      runtime.setupAndShowAutoPrompt(alwaysShow)
    );
  }

  /** @override */
  dismissSwgUI() {
    return this.configured_(false).then((runtime) => runtime.dismissSwgUI());
  }

  /**
   * Sets up all the buttons on the page with attribute
   * 'swg-standard-button:subscriptions' or 'swg-standard-button:contributions'.
   */
  setupButtons() {
    return this.configured_(true).then((runtime) => runtime.setupButtons());
  }
}

/**
 * @implements {BasicSubscriptions}
 */
// eslint-disable-next-line no-unused-vars
export class ConfiguredBasicRuntime {
  /**
   * @param {!Window|!Document|!Doc} winOrDoc
   * @param {!../model/page-config.PageConfig} pageConfig
   */
  constructor(winOrDoc, pageConfig) {
    this.configuredClassicRuntime_ = new ConfiguredRuntime(
      winOrDoc,
      pageConfig
    );
  }

  /** Getter for the ConfiguredRuntime, exposed for testing. */
  configuredClassicRuntime() {
    return this.configuredClassicRuntime_;
  }

  /** @override */
  init() {
    // Implemented by the 'BasicRuntime' class.
  }

  /** @override */
  setOnEntitlementsResponse(callback) {
    this.configuredClassicRuntime_.setOnEntitlementsResponse(callback);
  }

  /** @override */
  setOnPaymentResponse(callback) {
    this.configuredClassicRuntime_.setOnPaymentResponse(callback);
  }

  /** @override */
  /* eslint-disable no-unused-vars */
  setupAndShowAutoPrompt(alwaysShow = false) {
    // TODO(stellachui): Implement setup of the auto prompt.
  }
  /* eslint-enable no-unused-vars */

  /** @override */
  dismissSwgUI() {
    // TODO(stellachui): Implement dismissal of any displayed SwG UI.
  }

  /**
   * Sets up all the buttons on the page with attribute
   * 'swg-standard-button:subscriptions' or 'swg-standard-button:contributions'.
   */
  setupButtons() {
    // TODO(stellachui): Implement setup of the buttons.
  }
}

/**
 * Creates and returns the public facing BasicSubscription object.
 * @param {!BasicRuntime} basicRuntime
 * @return {!BasicSubscriptions}
 */
function createPublicBasicRuntime(basicRuntime) {
  return /** @type {!BasicSubscriptions} */ ({
    init: basicRuntime.init.bind(basicRuntime),
    setOnEntitlementsResponse: basicRuntime.setOnEntitlementsResponse(
      basicRuntime
    ),
    setOnPaymentResponse: basicRuntime.setOnPaymentResponse.bind(basicRuntime),
    setupAndShowAutoPrompt: basicRuntime.setupAndShowAutoPrompt.bind(
      basicRuntime
    ),
    dismissSwgUI: basicRuntime.dismissSwgUI.bind(basicRuntime),
  });
}
