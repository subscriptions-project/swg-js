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

import {AutoPromptManager} from './auto-prompt-manager';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ButtonApi} from './button-api';
import {ConfiguredRuntime} from './runtime';
import {PageConfigResolver} from '../model/page-config-resolver';
import {PageConfigWriter} from '../model/page-config-writer';
import {XhrFetcher} from './fetcher';
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
  /** @type {!../api/basic-subscriptions.BasicSubscriptions} */
  const publicBasicRuntime = createPublicBasicRuntime(basicRuntime);

  /**
   * Executes a callback when the runtime is ready.
   * @param {function(!../api/basic-subscriptions.BasicSubscriptions)} callback
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

  // Automatically set up buttons already on the page.
  basicRuntime.setupButtons();
}

/**
 * @implements {../api/basic-subscriptions.BasicSubscriptions}
 */
export class BasicRuntime {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!../model/doc.Doc} */
    this.doc_ = resolveDoc(win);

    /** @private @const {!Promise} */
    this.ready_ = Promise.resolve();

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = {};

    /** @private {../api/basic-subscriptions.ClientOptions|undefined} */
    this.clientOptions_ = undefined;

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
              this.config_,
              this.clientOptions_
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
  init(params) {
    this.pageConfigWriter_ = new PageConfigWriter(this.doc_);
    this.pageConfigWriter_
      .writeConfigWhenReady({
        type: params.type,
        isAccessibleForFree: params.isAccessibleForFree,
        isPartOfType: params.isPartOfType,
        isPartOfProductId: params.isPartOfProductId,
      })
      .then(() => {
        this.pageConfigWriter_ = null;
        this.configured_(true);
      });

    this.clientOptions_ = params.clientOptions;
    this.setupAndShowAutoPrompt({
      autoPromptType: params.autoPromptType,
      alwaysShow: false,
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
  setupAndShowAutoPrompt(options) {
    return this.configured_(false).then((runtime) =>
      runtime.setupAndShowAutoPrompt(options)
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
    return this.configured_(false).then((runtime) => runtime.setupButtons());
  }
}

/**
 * @implements  {../api/basic-subscriptions.BasicSubscriptions}
 * @implements {./deps.DepsDef}
 */
// eslint-disable-next-line no-unused-vars
export class ConfiguredBasicRuntime {
  /**
   * @param {!Window|!Document|!../model/doc.Doc} winOrDoc
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {{
   *     fetcher: (!./fetcher.Fetcher|undefined),
   *     configPromise: (!Promise|undefined),
   *   }=} integr
   * @param {!../api/subscriptions.Config=} config
   * @param {!../api/basic-subscriptions.ClientOptions=} clientOptions
   */
  constructor(winOrDoc, pageConfig, integr, config, clientOptions) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = resolveDoc(winOrDoc);

    /** @private @const {!Window} */
    this.win_ = this.doc_.getWin();

    integr = integr || {};
    integr.configPromise = integr.configPromise || Promise.resolve();
    integr.fetcher = integr.fetcher || new XhrFetcher(this.win_);

    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = integr.fetcher;

    /** @private @const {!ConfiguredRuntime} */
    this.configuredClassicRuntime_ = new ConfiguredRuntime(
      winOrDoc,
      pageConfig,
      integr,
      config,
      clientOptions
    );
    // Fetches entitlements.
    this.configuredClassicRuntime_.start();

    // Fetch the client config.
    this.configuredClassicRuntime_.clientConfigManager().fetchClientConfig();

    /** @private @const {!AutoPromptManager} */
    this.autoPromptManager_ = new AutoPromptManager(this);

    /** @private @const {!ButtonApi} */
    this.buttonApi_ = new ButtonApi(
      this.doc_,
      Promise.resolve(this.configuredClassicRuntime_)
    );
    this.buttonApi_.init(); // Injects swg-button stylesheet.
  }

  /** Getter for the ConfiguredRuntime, exposed for testing. */
  configuredClassicRuntime() {
    return this.configuredClassicRuntime_;
  }

  /** @override */
  doc() {
    return this.doc_;
  }

  /** @override */
  win() {
    return this.win_;
  }

  /** @override */
  config() {
    return this.configuredClassicRuntime_.config();
  }

  /** @override */
  pageConfig() {
    return this.configuredClassicRuntime_.pageConfig();
  }

  /** @override */
  activities() {
    return this.configuredClassicRuntime_.activities();
  }

  /** @override */
  payClient() {
    return this.configuredClassicRuntime_.payClient();
  }

  /** @override */
  dialogManager() {
    return this.configuredClassicRuntime_.dialogManager();
  }

  /** @override */
  entitlementsManager() {
    return this.configuredClassicRuntime_.entitlementsManager();
  }

  /** @override */
  callbacks() {
    return this.configuredClassicRuntime_.callbacks();
  }

  /** @override */
  storage() {
    return this.configuredClassicRuntime_.storage();
  }

  /** @override */
  analytics() {
    return this.configuredClassicRuntime_.analytics();
  }

  /** @override */
  jserror() {
    return this.configuredClassicRuntime_.jserror();
  }

  /** @override */
  eventManager() {
    return this.configuredClassicRuntime_.eventManager();
  }

  /** @override */
  clientConfigManager() {
    return this.configuredClassicRuntime_.clientConfigManager();
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
  setupAndShowAutoPrompt(options) {
    if (options.autoPromptType === AutoPromptType.SUBSCRIPTION) {
      options.displayForLockedContentFn = () => {
        this.configuredClassicRuntime_.showOffers({
          isClosable: !this.pageConfig().isLocked(),
        });
      };
    } else if (options.autoPromptType === AutoPromptType.CONTRIBUTION) {
      options.displayForLockedContentFn = () => {
        this.configuredClassicRuntime_.showContributionOptions({
          isClosable: !this.pageConfig().isLocked(),
        });
      };
    }
    return this.autoPromptManager_.showAutoPrompt(options);
  }

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
      {
        theme: this.clientConfigManager().getTheme(),
        lang: this.clientConfigManager().getLanguage(),
      },
      {
        [BUTTON_ATTRIBUTE_VALUE_SUBSCRIPTION]: () => {
          this.configuredClassicRuntime_.showOffers({
            isClosable: !this.pageConfig().isLocked(),
          });
        },
        [BUTTON_ATTRIBUTE_VALUE_CONTRIBUTION]: () => {
          this.configuredClassicRuntime_.showContributionOptions({
            isClosable: !this.pageConfig().isLocked(),
          });
        },
      }
    );
  }
}

/**
 * Creates and returns the public facing BasicSubscription object.
 * @param {!BasicRuntime} basicRuntime
 * @return {!../api/basic-subscriptions.BasicSubscriptions}
 */
function createPublicBasicRuntime(basicRuntime) {
  return /** @type {!../api/basic-subscriptions.BasicSubscriptions} */ ({
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
