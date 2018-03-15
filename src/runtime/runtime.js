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

import {ActivityPorts} from 'web-activities/activity-ports';
import {CSS as SWG_DIALOG} from '../../build/css/components/dialog.css';
import {Callbacks} from './callbacks';
import {DepsDef} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {EntitlementsManager} from './entitlements-manager';
import {Fetcher, XhrFetcher} from './fetcher';
import {
  LinkCompleteFlow,
  LinkbackFlow,
} from './link-accounts-flow';
import {OffersApi} from './offers-api';
import {
  OffersFlow,
  SubscribeOptionFlow,
  AbbrvOfferFlow,
} from './offers-flow';
import {PageConfig} from '../model/page-config';
import {
  PageConfigResolver,
  getControlFlag,
} from '../model/page-config-resolver';
import {
  PayStartFlow,
  PayCompleteFlow,
} from './pay-flow';
import {Storage} from './storage';
import {Subscriptions} from '../api/subscriptions';
import {injectStyleSheet} from '../utils/dom';
import {isArray} from '../utils/types';
import {whenDocumentReady} from '../utils/document-ready';

const RUNTIME_PROP = 'SWG';
const RUNTIME_LEGACY_PROP = 'SUBSCRIPTIONS';  // MIGRATE


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
 * @param {!Window} win
 */
export function installRuntime(win) {
  if (win[RUNTIME_PROP] && !isArray(win[RUNTIME_PROP])) {
    return;
  }

  injectStyleSheet(win.document, SWG_DIALOG);

  const runtime = new Runtime(win);

  const waitingArray = [].concat(win[RUNTIME_PROP], win[RUNTIME_LEGACY_PROP]);

  // Public runtime.
  const publicRuntime = createPublicRuntime(runtime);

  const dependencyInstaller = {};

  /**
   * @param {function(!Subscriptions)} callback
   */
  function pushDependency(callback) {
    if (!callback) {
      return;
    }
    runtime.whenReady().then(() => {
      callback(publicRuntime);
    });
  }
  Object.defineProperty(dependencyInstaller, 'push', {
    get: () => pushDependency,
    configurable: false,
  });
  win[RUNTIME_PROP] = dependencyInstaller;
  win[RUNTIME_LEGACY_PROP] = dependencyInstaller;
  if (waitingArray) {
    waitingArray.forEach(pushDependency);
  }
  runtimeInstance_ = runtime;
  runtime.startSubscriptionsFlowIfNeeded();
}


/**
 * @implements {Subscriptions}
 */
export class Runtime {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Promise} */
    this.ready_ = Promise.resolve();

    /** @private {?string} */
    this.productOrPublicationId_ = null;

    /** @private {boolean} */
    this.committed_ = false;

    /** @private {?function((!ConfiguredRuntime|!Promise))} */
    this.configuredResolver_ = null;

    /** @private @const {!Promise<!ConfiguredRuntime>} */
    this.configuredPromise_ = new Promise(resolve => {
      this.configuredResolver_ = resolve;
    });

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
   * @return {!Promise<!ConfiguredRuntime>}
   * @private
   */
  configured_(commit) {
    if (!this.committed_ && commit) {
      this.committed_ = true;
      /** @type {!Promise<!PageConfig>} */
      let configPromise;
      if (this.productOrPublicationId_) {
        configPromise = Promise.resolve(new PageConfig(
            this.productOrPublicationId_,
            /* locked */ false));
      } else {
        this.pageConfigResolver_ = new PageConfigResolver(this.win_);
        configPromise = this.pageConfigResolver_.resolveConfig()
            .then(config => {
              this.pageConfigResolver_ = null;
              return config;
            });
      }
      configPromise.then(config => {
        this.configuredResolver_(new ConfiguredRuntime(this.win_, config));
        this.configuredResolver_ = null;
      }, reason => {
        this.configuredResolver_(Promise.reject(reason));
        this.configuredResolver_ = null;
      });
    } else if (commit && this.pageConfigResolver_) {
      this.pageConfigResolver_.check();
    }
    return this.configuredPromise_;
  }

  /**
   * Starts the subscription flow if it hasn't been started and the page is
   * configured to start it automatically.
   *
   * @return {?Promise}
   * @package
   */
  startSubscriptionsFlowIfNeeded() {
    const control = getControlFlag(this.win_);
    if (control == 'manual') {
      // "Skipping automatic start because control flag is set to "manual".
      return null;
    }
    return this.start();
  }

  /** @override */
  init(productOrPublicationId) {
    if (this.committed_) {
      throw new Error('already configured');
    }
    this.productOrPublicationId_ = productOrPublicationId;
  }

  /** @override */
  start() {
    return this.configured_(true)
        .then(runtime => runtime.start());
  }

  /** @override */
  reset() {
    return this.configured_(true)
        .then(runtime => runtime.reset());
  }

  /** @override */
  getEntitlements() {
    return this.configured_(true)
        .then(runtime => runtime.getEntitlements());
  }

  /** @override */
  setOnEntitlementsResponse(callback) {
    return this.configured_(false)
        .then(runtime => runtime.setOnEntitlementsResponse(callback));
  }

  /** @override */
  getOffers(opt_options) {
    return this.configured_(true)
        .then(runtime => runtime.getOffers(opt_options));
  }

  /** @override */
  showOffers(opt_options) {
    return this.configured_(true)
        .then(runtime => runtime.showOffers(opt_options));
  }

  /** @override */
  showSubscribeOption(opt_options) {
    return this.configured_(true)
        .then(runtime => runtime.showSubscribeOption(opt_options));
  }

  /** @override */
  showAbbrvOffer(opt_options) {
    return this.configured_(true)
        .then(runtime => runtime.showAbbrvOffer(opt_options));
  }

  /** @override */
  setOnNativeSubscribeRequest(callback) {
    return this.configured_(false)
        .then(runtime => runtime.setOnNativeSubscribeRequest(callback));
  }

  /** @override */
  setOnSubscribeResponse(callback) {
    return this.configured_(false)
        .then(runtime => runtime.setOnSubscribeResponse(callback));
  }

  /** @override */
  subscribe(sku) {
    return this.configured_(true)
        .then(runtime => runtime.subscribe(sku));
  }

  /** @override */
  setOnLoginRequest(callback) {
    return this.configured_(false)
        .then(runtime => runtime.setOnLoginRequest(callback));
  }

  /** @override */
  setOnLinkComplete(callback) {
    return this.configured_(false)
        .then(runtime => runtime.setOnLinkComplete(callback));
  }

  /** @override */
  linkAccount() {
    return this.configured_(true)
        .then(runtime => runtime.linkAccount());
  }
}


/**
 * @implements {DepsDef}
 * @implements {Subscriptions}
 */
export class ConfiguredRuntime {

  /**
   * @param {!Window} win
   * @param {!../model/page-config.PageConfig} config
   * @param {{
   *     fetcher: (!Fetcher|undefined),
   *   }=} opt_integr
   */
  constructor(win, config, opt_integr) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!../model/page-config.PageConfig} */
    this.config_ = config;

    /** @private @const {!Promise} */
    this.documentParsed_ = whenDocumentReady(this.win_.document);

    /** @private @const {!Fetcher} */
    this.fetcher_ = opt_integr && opt_integr.fetcher || new XhrFetcher(win);

    /** @private @const {!Storage} */
    this.storage_ = new Storage(this.win_);

    /** @private @const {!DialogManager} */
    this.dialogManager_ = new DialogManager(win);

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = new ActivityPorts(win);

    /** @private @const {!Callbacks} */
    this.callbacks_ = new Callbacks();

    /** @private @const {!EntitlementsManager} */
    this.entitlementsManager_ =
        new EntitlementsManager(this.win_, this.config_, this.fetcher_, this);

    /** @private @const {!OffersApi} */
    this.offersApi_ = new OffersApi(this.config_, this.fetcher_);

    LinkCompleteFlow.configurePending(this);
    PayCompleteFlow.configurePending(this);
  }

  /** @override */
  win() {
    return this.win_;
  }

  /** @override */
  pageConfig() {
    return this.config_;
  }

  /** @override */
  activities() {
    return this.activityPorts_;
  }

  /** @override */
  dialogManager() {
    return this.dialogManager_;
  }

  /** @override */
  entitlementsManager() {
    return this.entitlementsManager_;
  }

  /** @override */
  callbacks() {
    return this.callbacks_;
  }

  /** @override */
  storage() {
    return this.storage_;
  }

  /** @override */
  init() {
    // Implemented by the `Runtime` class.
  }

  /** @override */
  reset() {
    this.entitlementsManager_.reset();
    this.dialogManager_.completeAll();
  }

  /** @override */
  start() {
    // No need to run entitlements without a product or for an unlocked page.
    if (!this.config_.getProductId() || !this.config_.isLocked()) {
      return Promise.resolve();
    }
    this.getEntitlements();
  }

  /** @override */
  getEntitlements() {
    return this.entitlementsManager_.getEntitlements()
        .then(entitlements => entitlements.clone());
  }

  /** @override */
  setOnEntitlementsResponse(callback) {
    this.callbacks_.setOnEntitlementsResponse(callback);
  }

  /** @override */
  getOffers(opt_options) {
    return this.offersApi_.getOffers(opt_options && opt_options.productId);
  }

  /** @override */
  showOffers(opt_options) {
    return this.documentParsed_.then(() => {
      const flow = new OffersFlow(this, opt_options);
      return flow.start();
    });
  }

  /** @override */
  showSubscribeOption(opt_options) {
    return this.documentParsed_.then(() => {
      const flow = new SubscribeOptionFlow(this, opt_options);
      return flow.start();
    });
  }

  /** @override */
  showAbbrvOffer(opt_options) {
    return this.documentParsed_.then(() => {
      const flow = new AbbrvOfferFlow(this, opt_options);
      return flow.start();
    });
  }

  /** @override */
  setOnLoginRequest(callback) {
    this.callbacks_.setOnLoginRequest(callback);
  }

  /** @override */
  setOnLinkComplete(callback) {
    this.callbacks_.setOnLinkComplete(callback);
  }

  /** @override */
  linkAccount() {
    return this.documentParsed_.then(() => {
      return new LinkbackFlow(this).start();
    });
  }

  /** @override */
  setOnNativeSubscribeRequest(callback) {
    this.callbacks_.setOnSubscribeRequest(callback);
  }

  /** @override */
  setOnSubscribeResponse(callback) {
    this.callbacks_.setOnSubscribeResponse(callback);
  }

  /** @override */
  subscribe(sku) {
    return this.documentParsed_.then(() => {
      return new PayStartFlow(this, sku).start();
    });
  }
}


/**
 * @param {!Runtime} runtime
 * @return {!Subscriptions}
 */
function createPublicRuntime(runtime) {
  return /** @type {!Subscriptions} */ ({
    init: runtime.init.bind(runtime),
    start: runtime.start.bind(runtime),
    reset: runtime.reset.bind(runtime),
    getEntitlements: runtime.getEntitlements.bind(runtime),
    linkAccount: runtime.linkAccount.bind(runtime),
    getOffers: runtime.getOffers.bind(runtime),
    showOffers: runtime.showOffers.bind(runtime),
    showAbbrvOffer: runtime.showAbbrvOffer.bind(runtime),
    showSubscribeOption: runtime.showSubscribeOption.bind(runtime),
    subscribe: runtime.subscribe.bind(runtime),
    setOnEntitlementsResponse: runtime.setOnEntitlementsResponse.bind(runtime),
    setOnLoginRequest: runtime.setOnLoginRequest.bind(runtime),
    setOnLinkComplete: runtime.setOnLinkComplete.bind(runtime),
    setOnNativeSubscribeRequest:
        runtime.setOnNativeSubscribeRequest.bind(runtime),
    setOnSubscribeResponse: runtime.setOnSubscribeResponse.bind(runtime),
  });
}


/**
 * @return {!Function}
 * @protected
 */
export function getSubscriptionsClassForTesting() {
  return Subscriptions;
}

/**
 * @return {!Function}
 * @protected
 */
export function getFetcherClassForTesting() {
  return Fetcher;
}
