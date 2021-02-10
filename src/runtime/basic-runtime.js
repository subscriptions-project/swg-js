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
import {ButtonApi} from './button-api';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {PageConfigResolver} from '../model/page-config-resolver';
import {PageConfigWriter} from '../model/page-config-writer';
import {resolveDoc} from '../model/doc';

const BASIC_RUNTIME_PROP = 'SWG_BASIC';
const BUTTON_ATTRIUBUTE = 'swg-standard-button';
const BUTTON_ATTRIBUTE_VALUE_SUBSCRIPTION = 'subscription';
const BUTTON_ATTRIBUTE_VALUE_CONTRIBUTION = 'contribution';

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

    /** @private @const {!Doc} */
    this.doc_ = resolveDoc(win);

    /** @private @const {!Promise} */
    this.ready_ = Promise.resolve();

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = {};

    /** @private {boolean} */
    this.committed_ = false;

    /** @private {?function((!ConfiguredBasicRuntime|!Promise))} */
    this.configuredResolver_ = null;

    /** @private @const {!Promise<!ConfiguredBasicRuntime>} */
    this.configuredPromise_ = new Promise((resolve) => {
      this.configuredResolver_ = resolve;
    });

    /** @private {?PageConfigWriter} */
    this.pageConfigWriter_ = null;

    /** @private {?PageConfigResolver} */
    this.pageConfigResolver_ = null;

    /** @private @const {!ButtonApi} */
    this.buttonApi_ = new ButtonApi(this.doc_, this.configuredPromise_);
    this.buttonApi_.init(); // Injects swg-button stylesheet.
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
    if (!this.committed_ && commit && !this.pageConfigWriter_) {
      this.committed_ = true;

      this.pageConfigResolver_ = new PageConfigResolver(this.doc_);
      this.pageConfigResolver_.resolveConfig().then(
        (pageConfig) => {
          this.pageConfigResolver_ = null;
          this.configuredResolver_(
            new ConfiguredBasicRuntime(
              this.doc_,
              pageConfig,
              /* integr */ {configPromise: this.configuredPromise_},
              this.config_
            )
          );
          this.configuredResolver_ = null;
        },
        (reason) => {
          this.configuredResolver_(Promise.reject(reason));
          this.configuredResolver_ = null;
        }
      );
    } else if (commit && this.pageConfigResolver_) {
      this.pageConfigResolver_.check();
    }
    return this.configuredPromise_;
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
    this.pageConfigWriter_ = new PageConfigWriter(this.doc_);
    this.pageConfigWriter_
      .writeConfigWhenReady({
        type,
        isAccessibleForFree,
        isPartOfType,
        isPartOfProductId,
      })
      .then(() => {
        this.pageConfigWriter_ = null;
        this.configured_(true);
      });
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
   * 'swg-standard-button:subscription' or 'swg-standard-button:contribution'.
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
   * @param {{
   *     fetcher: (!Fetcher|undefined),
   *     configPromise: (!Promise|undefined),
   *   }=} integr
   * @param {!../api/subscriptions.Config=} config
   */
  constructor(winOrDoc, pageConfig, integr, config) {
    integr = integr || {};
    integr.configPromise = integr.configPromise || Promise.resolve();

    /** @private @const {!ClientEventManager} */
    this.eventManager_ = new ClientEventManager(integr.configPromise);

    /** @private @const {!Doc} */
    this.doc_ = resolveDoc(winOrDoc);

    this.configuredClassicRuntime_ = new ConfiguredRuntime(
      winOrDoc,
      pageConfig,
      integr,
      config
    );

    /** @private @const {!ButtonApi} */
    this.buttonApi_ = new ButtonApi(this.doc_, Promise.resolve(this));
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
   * 'swg-standard-button:subscription' or 'swg-standard-button:contribution'.
   */
  setupButtons() {
    this.buttonApi_.attachButtonsWithAttribute(
      BUTTON_ATTRIUBUTE,
      [
        BUTTON_ATTRIBUTE_VALUE_SUBSCRIPTION,
        BUTTON_ATTRIBUTE_VALUE_CONTRIBUTION,
      ],
      /* options */ null, // TODO(stellachui): Specify language in options.
      {
        [BUTTON_ATTRIBUTE_VALUE_SUBSCRIPTION]: () => {
          this.configuredClassicRuntime_.showOffers();
        },
        [BUTTON_ATTRIBUTE_VALUE_CONTRIBUTION]: () => {
          this.configuredClassicRuntime_.showContributionOptions();
        },
      }
    );
  }

  /**
   * This one exists as an internal helper so SwG logging doesn't require a promise.
   * @return {!ClientEventManager}
   */
  eventManager() {
    return this.eventManager_;
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
    setOnEntitlementsResponse: basicRuntime.setOnEntitlementsResponse.bind(
      basicRuntime
    ),
    setOnPaymentResponse: basicRuntime.setOnPaymentResponse.bind(basicRuntime),
    setupAndShowAutoPrompt: basicRuntime.setupAndShowAutoPrompt.bind(
      basicRuntime
    ),
    dismissSwgUI: basicRuntime.dismissSwgUI.bind(basicRuntime),
  });
}
