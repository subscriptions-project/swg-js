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
import {ButtonApi} from './button-api';
import {CSS as SWG_DIALOG} from '../../build/css/components/dialog.css';
import {Callbacks} from './callbacks';
import {DeferredAccountFlow} from './deferred-account-flow';
import {DepsDef} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {Doc, resolveDoc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {Fetcher, XhrFetcher} from './fetcher';
import {
  LinkCompleteFlow,
  LinkbackFlow,
  LinkSaveFlow,
} from './link-accounts-flow';
import {
  LoginPromptApi,
} from './login-prompt-api';
import {LoginNotificationApi} from './login-notification-api';
import {
  WaitForSubscriptionLookupApi,
} from './wait-for-subscription-lookup-api';
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
import {Preconnect} from '../utils/preconnect';
import {Storage} from './storage';
import {
  Subscriptions,
  WindowOpenMode,
  defaultConfig,
} from '../api/subscriptions';
import {injectStyleSheet} from '../utils/dom';
import {isArray} from '../utils/types';

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

    /** @private @const {!Doc} */
    this.doc_ = resolveDoc(win);

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

    /** @private @const {!ButtonApi} */
    this.buttonApi_ = new ButtonApi(this.doc_);
    this.buttonApi_.init();  // Injects swg-button stylesheet.
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
        this.pageConfigResolver_ = new PageConfigResolver(this.doc_);
        configPromise = this.pageConfigResolver_.resolveConfig()
            .then(config => {
              this.pageConfigResolver_ = null;
              return config;
            });
      }
      configPromise.then(config => {
        this.configuredResolver_(new ConfiguredRuntime(this.doc_, config));
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
    const control = getControlFlag(this.win_.document);
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
  configure(config) {
    return this.configured_(false)
        .then(runtime => runtime.configure(config));
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
  waitForSubscriptionLookup(accountPromise) {
    return this.configured_(true)
        .then(runtime => runtime.waitForSubscriptionLookup(
            accountPromise));
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
  completeDeferredAccountCreation(opt_options) {
    return this.configured_(true)
        .then(runtime => runtime.completeDeferredAccountCreation(opt_options));
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

  /** @override */
  setOnFlowStarted(callback) {
    return this.configured_(false)
        .then(runtime => runtime.setOnFlowStarted(callback));
  }

  /** @override */
  setOnFlowCanceled(callback) {
    return this.configured_(false)
        .then(runtime => runtime.setOnFlowCanceled(callback));
  }

  /** @override */
  saveSubscription(saveSubscriptionRequestCallback) {
    return this.configured_(true)
        .then(runtime => {
          return runtime.saveSubscription(saveSubscriptionRequestCallback);
        });
  }

  /** @override */
  showLoginPrompt() {
    return this.configured_(true).then(runtime => {
      return runtime.showLoginPrompt();
    });
  }

  /** @override */
  showLoginNotification() {
    return this.configured_(true).then(runtime => {
      return runtime.showLoginNotification();
    });
  }

  /** @override */
  createButton(optionsOrCallback, opt_callback) {
    return this.buttonApi_.create(optionsOrCallback, opt_callback);
  }

  /** @override */
  attachButton(button, optionsOrCallback, opt_callback) {
    return this.buttonApi_.attach(button, optionsOrCallback, opt_callback);
  }
}


/**
 * @implements {DepsDef}
 * @implements {Subscriptions}
 */
export class ConfiguredRuntime {

  /**
   * @param {!Window|!Document|!Doc} winOrDoc
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {{
   *     fetcher: (!Fetcher|undefined),
   *   }=} opt_integr
   */
  constructor(winOrDoc, pageConfig, opt_integr) {
    /** @private @const {!Doc} */
    this.doc_ = resolveDoc(winOrDoc);

    /** @private @const {!Window} */
    this.win_ = this.doc_.getWin();

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = defaultConfig();

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = pageConfig;

    /** @private @const {!Promise} */
    this.documentParsed_ = this.doc_.whenReady();

    /** @private @const {!Fetcher} */
    this.fetcher_ = opt_integr && opt_integr.fetcher ||
        new XhrFetcher(this.win_);

    /** @private @const {!Storage} */
    this.storage_ = new Storage(this.win_);

    /** @private @const {!DialogManager} */
    this.dialogManager_ = new DialogManager(this.doc_);

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = new ActivityPorts(this.win_);

    /** @private @const {!Callbacks} */
    this.callbacks_ = new Callbacks();

    /** @private @const {!EntitlementsManager} */
    this.entitlementsManager_ = new EntitlementsManager(
        this.win_, this.pageConfig_, this.fetcher_, this);

    /** @private @const {!OffersApi} */
    this.offersApi_ = new OffersApi(this.pageConfig_, this.fetcher_);

    /** @private @const {!ButtonApi} */
    this.buttonApi_ = new ButtonApi(this.doc_);

    const preconnect = new Preconnect(this.win_.document);

    LinkCompleteFlow.configurePending(this);
    PayCompleteFlow.configurePending(this);
    PayStartFlow.preconnect(preconnect);

    injectStyleSheet(this.win_.document, SWG_DIALOG);
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
  pageConfig() {
    return this.pageConfig_;
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
  configure(config) {
    // Validate first.
    let error = null;
    for (const k in config) {
      const v = config[k];
      if (k == 'windowOpenMode') {
        if (v != WindowOpenMode.AUTO &&
            v != WindowOpenMode.REDIRECT) {
          error = 'Unknown windowOpenMode: ' + v;
        }
      } else {
        error = 'Unknown config property: ' + k;
      }
    }
    if (error) {
      throw new Error(error);
    }
    // Assign.
    Object.assign(this.config_, config);
  }

  /** @override */
  config() {
    return this.config_;
  }

  /** @override */
  reset() {
    this.entitlementsManager_.reset();
    this.dialogManager_.completeAll();
  }

  /** @override */
  start() {
    // No need to run entitlements without a product or for an unlocked page.
    if (!this.pageConfig_.getProductId() || !this.pageConfig_.isLocked()) {
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
  waitForSubscriptionLookup(accountPromise) {
    return this.documentParsed_.then(() => {
      const wait = new WaitForSubscriptionLookupApi(this, accountPromise);
      return wait.start();
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
  saveSubscription(saveSubscriptionRequestCallback) {
    return this.documentParsed_.then(() => {
      return new LinkSaveFlow(this, saveSubscriptionRequestCallback).start();
    });
  }

  /** @override */
  showLoginPrompt() {
    return this.documentParsed_.then(() => {
      return new LoginPromptApi(this).start();
    });
  }

  /** @override */
  showLoginNotification() {
    return this.documentParsed_.then(() => {
      return new LoginNotificationApi(this).start();
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

  /** @override */
  completeDeferredAccountCreation(opt_options) {
    return this.documentParsed_.then(() => {
      return new DeferredAccountFlow(this, opt_options || null).start();
    });
  }

  /** @override */
  setOnFlowStarted(callback) {
    this.callbacks_.setOnFlowStarted(callback);
  }

  /** @override */
  setOnFlowCanceled(callback) {
    this.callbacks_.setOnFlowCanceled(callback);
  }

  /** @override */
  createButton(optionsOrCallback, opt_callback) {
    // This is a minor duplication to allow this code to be sync.
    return this.buttonApi_.create(optionsOrCallback, opt_callback);
  }

  /** @override */
  attachButton(button, optionsOrCallback, opt_callback) {
    // This is a minor duplication to allow this code to be sync.
    this.buttonApi_.attach(button, optionsOrCallback, opt_callback);
  }
}

/**
 * @param {!Runtime} runtime
 * @return {!Subscriptions}
 */
function createPublicRuntime(runtime) {
  return /** @type {!Subscriptions} */ ({
    init: runtime.init.bind(runtime),
    configure: runtime.configure.bind(runtime),
    start: runtime.start.bind(runtime),
    reset: runtime.reset.bind(runtime),
    getEntitlements: runtime.getEntitlements.bind(runtime),
    linkAccount: runtime.linkAccount.bind(runtime),
    showLoginPrompt: runtime.showLoginPrompt.bind(runtime),
    showLoginNotification: runtime.showLoginNotification.bind(runtime),
    getOffers: runtime.getOffers.bind(runtime),
    showOffers: runtime.showOffers.bind(runtime),
    showAbbrvOffer: runtime.showAbbrvOffer.bind(runtime),
    showSubscribeOption: runtime.showSubscribeOption.bind(runtime),
    waitForSubscriptionLookup:
        runtime.waitForSubscriptionLookup.bind(runtime),
    subscribe: runtime.subscribe.bind(runtime),
    completeDeferredAccountCreation:
        runtime.completeDeferredAccountCreation.bind(runtime),
    setOnEntitlementsResponse: runtime.setOnEntitlementsResponse.bind(runtime),
    setOnLoginRequest: runtime.setOnLoginRequest.bind(runtime),
    setOnLinkComplete: runtime.setOnLinkComplete.bind(runtime),
    setOnNativeSubscribeRequest:
        runtime.setOnNativeSubscribeRequest.bind(runtime),
    setOnSubscribeResponse: runtime.setOnSubscribeResponse.bind(runtime),
    setOnFlowStarted: runtime.setOnFlowStarted.bind(runtime),
    setOnFlowCanceled: runtime.setOnFlowCanceled.bind(runtime),
    saveSubscription: runtime.saveSubscription.bind(runtime),
    createButton: runtime.createButton.bind(runtime),
    attachButton: runtime.attachButton.bind(runtime),
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

/** @package Visible for testing only. */
export function getDocClassForTesting() {
  return Doc;
}
