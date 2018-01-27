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


import {ActivityPorts} from 'web-activities/activity-ports';
import {CSS as SWG_DIALOG} from '../../build/css/components/dialog.css';
import {Callbacks} from './callbacks';
import {DepsDef} from '../model/deps';
import {DialogManager} from '../components/dialog-manager';
import {EntitlementsManager} from '../entitlements/entitlements-manager';
import {
  LinkStartFlow,
  LinkCompleteFlow,
} from './link-accounts-flow';
import {OffersFlow} from './offers-flow';
import {PageConfigResolver} from '../model/page-config-resolver';
import {
  PayStartFlow,
  PayCompleteFlow,
} from './pay-flow';
import {SubscriptionMarkup} from './subscription-markup';
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

    /** @private @const {!PageConfigResolver} */
    this.pageConfigResolver_ = new PageConfigResolver(this.win_);

    /** @private @const {!Promise<!ConfiguredRuntime>} */
    this.configured_ = this.pageConfigResolver_.resolveConfig()
        .then(config => {
          return new ConfiguredRuntime(this.win_, config);
        });
  }

  /**
   * @return {!Promise}
   */
  whenReady() {
    return this.ready_;
  }

  /**
   * @return {!Promise<!ConfiguredRuntime>}
   * @package
   */
  configured() {
    return this.configured_;
  }

  /**
   * Starts subscription flow.
   * @return {!Promise}
   */
  start() {
    return this.configured().then(runtime => runtime.start());
  }

  /**
   * Starts the subscription flow if it hasn't been started and the page is
   * configured to start it automatically.
   * @return {!Promise}
   */
  startSubscriptionsFlowIfNeeded() {
    return this.configured()
        .then(runtime => runtime.startSubscriptionsFlowIfNeeded());
  }

  /** @override */
  getEntitlements() {
    this.pageConfigResolver_.check();
    return this.configured()
        .then(runtime => runtime.getEntitlements());
  }

  /** @override */
  showOffers() {
    return this.configured()
        .then(runtime => runtime.showOffers());
  }

  /** @override */
  setOnSubscribeResponse(callback) {
    this.configured()
        .then(runtime => runtime.setOnSubscribeResponse(callback));
  }

  /** @override */
  subscribe(sku) {
    return this.configured()
        .then(runtime => runtime.subscribe(sku));
  }

  /** @override */
  setOnLinkComplete(callback) {
    this.configured()
        .then(runtime => runtime.setOnLinkComplete(callback));
  }

  /** @override */
  linkAccount() {
    this.configured()
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
   */
  constructor(win, config) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!../model/page-config.PageConfig} */
    this.config_ = config;

    /** @private {boolean} */
    this.started_ = false;

    /** @private @const {!Promise} */
    this.documentParsed_ = whenDocumentReady(this.win_.document);

    /** @private @const {!EntitlementsManager} */
    this.entitlementsManager_ =
        new EntitlementsManager(this.win_, this.config_);

    /** @private @const {!SubscriptionMarkup} */
    this.markup_ = new SubscriptionMarkup(this.win_);

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

  /**
   * @return {boolean}
   */
  hasStarted() {
    return this.started_;
  }

  /**
   * Starts subscription flow.
   */
  start() {
    this.started_ = true;
    this.getEntitlements();
  }

  /**
   * Starts the subscription flow if it hasn't been started and the page is
   * configured to start it automatically.
   *
   * @return {?Promise}
   */
  startSubscriptionsFlowIfNeeded() {
    const control = this.markup_.getAccessControl() || 'manual';
    if (control == 'manual') {
      // TODO(dvoytenko): make default with
      // "Skipping automatic start because access-control is set to "manual".
      return null;
    }
    return this.start();
  }

  /** @override */
  getEntitlements() {
    return this.entitlementsManager_.getEntitlements().then(entitlements => {
      if (entitlements.enablesThis()) {
        const toast = new Toast(this.win_, {
          text: 'Access via Google Subscriptions',
          action: {
            label: 'View',
            handler: function() {
              // TODO(dparikh): Implementation.
            },
          },
        });
        toast.open();
      }
      return entitlements;
    });
  }

  /** @override */
  showOffers() {
    return this.documentParsed_.then(() => {
      const flow = new OffersFlow(this);
      return flow.start();
    });
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
    start: runtime.start.bind(runtime),
    getEntitlements: runtime.getEntitlements.bind(runtime),
    linkAccount: runtime.linkAccount.bind(runtime),
    showOffers: runtime.showOffers.bind(runtime),
    subscribe: runtime.subscribe.bind(runtime),
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
