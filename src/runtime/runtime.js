/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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
import {DepsDef} from '../model/deps';
import {DialogManager} from '../components/dialog-manager';
import {EntitlementsManager} from './entitlements-manager';
import {Fetcher, XhrFetcher} from './fetcher';
import {
  LinkStartFlow,
  LinkCompleteFlow,
} from './link-accounts-flow';
import {OffersFlow} from './offers-flow';
import {PageConfig} from '../model/page-config';
import {
  PageConfigResolver,
  getControlFlag,
} from '../model/page-config-resolver';
import {
  PayStartFlow,
  PayCompleteFlow,
} from './pay-flow';
import {Subscriptions} from '../api/subscriptions';
import {Toast} from '../ui/toast';
import {injectStyleSheet} from '../utils/dom';
import {isArray} from '../utils/types';
import {whenDocumentReady} from '../utils/document-ready';

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
 * @param {!Window} win
 */
export function installRuntime(win) {
  if (win[RUNTIME_PROP] && !isArray(win[RUNTIME_PROP])) {
    return;
  }

  injectStyleSheet(win.document, SWG_DIALOG);

  const runtime = new Runtime(win);

  const waitingArray = win[RUNTIME_PROP];

  // Public runtime.
  const publicRuntime = createPublicRuntime(runtime);

  const dependencyInstaller = {};

  /**
   * @param {function(!Subscriptions)} callback
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
    this.productOrPublisherId_ = null;

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
      if (this.productOrPublisherId_) {
        configPromise = Promise.resolve(new PageConfig(
            this.productOrPublisherId_,
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
  init(productOrPublisherId) {
    if (this.committed_) {
      throw new Error('already configured');
    }
    this.productOrPublisherId_ = productOrPublisherId;
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
  showOffers() {
    return this.configured_(true)
        .then(runtime => runtime.showOffers());
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

    /** @private @const {!EntitlementsManager} */
    this.entitlementsManager_ =
        new EntitlementsManager(this.win_, this.config_, this.fetcher_);

    /** @private @const {!DialogManager} */
    this.dialogManager_ = new DialogManager(win);

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = new ActivityPorts(win);

    /** @private @const {!Callbacks} */
    this.callbacks_ = new Callbacks();

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
  callbacks() {
    return this.callbacks_;
  }

  /** @override */
  init() {
    // Implemented by the `Runtime` class.
  }

  /** @override */
  start() {
    // No need to run entitlements without a product or for an unlocked page.
    if (!this.config_.getProductId() || !this.config_.isLocked()) {
      return Promise.resolve();
    }
    // TODO(dvoytenko): is there a point in running entitlements at all before
    // subscription response is discovered?
    // TODO(dvoytenko): what's the right action when pay flow was canceled?
    const promise = this.entitlementsManager_.getEntitlements();
    return promise.catch(() => null).then(entitlements => {
      if (this.callbacks_.hasSubscribeResponsePending()) {
        return;
      }
      this.callbacks_.triggerEntitlementsResponse(promise);
      if (!entitlements) {
        return;
      }
      const entitlement = entitlements.getEntitlementForThis();
      if (entitlement) {
        const toast = new Toast(this.win_, {
          text:
              (entitlement.source || 'google') == 'google' ?
              'Access via Google Subscriptions' :
              // TODO(dvoytenko): display name instead.
              'Access via [' + entitlement.source + ']',
          action: {
            label: 'View',
            handler: function() {
              // TODO(dparikh): Implementation.
            },
          },
        });
        toast.open();
      }
    });
  }

  /** @override */
  reset() {
    this.entitlementsManager_.reset();
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
  showOffers() {
    return this.documentParsed_.then(() => {
      const flow = new OffersFlow(this);
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
      return new LinkStartFlow(this).start();
    });
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
    showOffers: runtime.showOffers.bind(runtime),
    subscribe: runtime.subscribe.bind(runtime),
    setOnEntitlementsResponse: runtime.setOnEntitlementsResponse.bind(runtime),
    setOnLoginRequest: runtime.setOnLoginRequest.bind(runtime),
    setOnLinkComplete: runtime.setOnLinkComplete.bind(runtime),
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
