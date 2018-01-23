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
import {CSS as SWG_POPUP} from '../../build/css/experimental/swg-popup.css';
import {EntitlementsManager} from '../entitlements/entitlements-manager';
import {LinkAccountsFlow} from './link-accounts-flow';
import {NotificationView} from '../experimental/notification-view';
import {OffersFlow} from './offers-flow';
import {PageConfigResolver} from '../model/page-config-resolver';
import {SubscriptionMarkup} from './subscription-markup';
import {injectStyleSheet} from '../utils/dom';
import {isArray} from '../utils/types';
import {log} from '../utils/log';
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
 * @interface
 */
class PublicRuntimeDef {}


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

  /**
   * @return {!Promise<?../entitlements/entitlements.Entitlements>}
   */
  getEntitlements() {
    this.pageConfigResolver_.check();
    return this.configured()
        .then(runtime => runtime.getEntitlements());
  }

  /**
   * Starts the Offers flow.
   */
  showOffers() {
    return this.configured()
        .then(runtime => runtime.showOffers());
  }
}


/**
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

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = new ActivityPorts(win);
  }

  /**
   * @return {!../model/page-config.PageConfig}
   */
  getConfig() {
    return this.config_;
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
      log('Skipping automatic start because access-control is set to "manual"');
      return null;
    }
    return this.start();
  }

  /**
   * @return {!Promise<?../entitlements/entitlements.Entitlements>}
   */
  getEntitlements() {
    return this.entitlementsManager_.getEntitlements().then(entitlements => {
      // TODO(dvoytenko): remove notification view from here into the auth loop.
      if (entitlements.enablesThis()) {
        const notificationView = new NotificationView(this.win_);
        notificationView.start();
      }
      return entitlements;
    });
  }

  /**
   * Starts the Offers flow.
   * @return {!Promise}
   */
  showOffers() {
    return this.documentParsed_.then(() => {
      const flow = new OffersFlow(this.win_, this.config_, this.activityPorts_);
      return flow.start();
    });
  }

  /**
   * Starts the Account linking flow.
   * TODO(dparikh): For testing purpose only.
   */
  linkAccount() {
    return this.documentParsed_.then(() => {
      const flow = new new LinkAccountsFlow(
          this.win_, this.config_, this.activityPorts_);
      return flow.start();
    });
  }
}


/**
 * @param {!Runtime} runtime
 * @return {!PublicRuntimeDef}
 */
function createPublicRuntime(runtime) {
  return /** @type {!PublicRuntimeDef} */ ({
    start: runtime.start.bind(runtime),
    getEntitlements: runtime.getEntitlements.bind(runtime),
    showOffers: runtime.showOffers.bind(runtime),
    linkAccount: runtime.linkAccount.bind(runtime),
  });
}
