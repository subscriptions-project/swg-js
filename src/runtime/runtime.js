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

import {AbbrvOfferFlow, OffersFlow, SubscribeOptionFlow} from './offers-flow';
import {ActivityPorts} from '../components/activities';
import {
  AnalyticsEvent,
  EventOriginator,
  EventParams,
} from '../proto/api_messages';
import {AnalyticsMode} from '../api/subscriptions';
import {AnalyticsService} from './analytics-service';
import {ButtonApi} from './button-api';
import {Callbacks} from './callbacks';
import {ClientEventManager} from './client-event-manager';
import {ContributionsFlow} from './contributions-flow';
import {DeferredAccountFlow} from './deferred-account-flow';
import {DepsDef} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {Doc, resolveDoc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {ExperimentFlags} from './experiment-flags';
import {Fetcher, XhrFetcher} from './fetcher';
import {JsError} from './jserror';
import {
  LinkCompleteFlow,
  LinkSaveFlow,
  LinkbackFlow,
} from './link-accounts-flow';
import {Logger} from './logger';
import {LoginNotificationApi} from './login-notification-api';
import {LoginPromptApi} from './login-prompt-api';
import {MeterRegwallApi} from './meter-regwall-api';
import {OffersApi} from './offers-api';
import {PageConfig} from '../model/page-config';
import {
  PageConfigResolver,
  getControlFlag,
} from '../model/page-config-resolver';
import {PayClient} from './pay-client';
import {PayCompleteFlow, PayStartFlow} from './pay-flow';
import {Preconnect} from '../utils/preconnect';
import {
  ProductType,
  Subscriptions,
  WindowOpenMode,
  defaultConfig,
} from '../api/subscriptions';
import {Propensity} from './propensity';
import {CSS as SWG_DIALOG} from '../../build/css/components/dialog.css';
import {Storage} from './storage';
import {WaitForSubscriptionLookupApi} from './wait-for-subscription-lookup-api';
import {assert} from '../utils/log';
import {debugLog} from '../utils/log';
import {injectStyleSheet, isLegacyEdgeBrowser} from '../utils/dom';
import {isBoolean} from '../utils/types';
import {isExperimentOn} from './experiments';
import {isSecure, wasReferredByGoogle} from '../utils/url';
import {parseUrl} from '../utils/url';
import {publisherEntitlementEventToAnalyticsEvents} from './event-type-mapping';
import {setExperiment} from './experiments';
import {urlContainsFreshGaaParams} from '../utils/gaa';

const RUNTIME_PROP = 'SWG';
const RUNTIME_LEGACY_PROP = 'SUBSCRIPTIONS'; // MIGRATE

/**
 * Reference to the runtime, for testing.
 * @private {!Runtime}
 */
let runtimeInstance_;

/**
 * Returns runtime for testing if available. Throws if the runtime is not
 * initialized yet.
 * @visibleForTesting
 * @return {!Runtime}
 */
export function getRuntime() {
  assert(runtimeInstance_, 'not initialized yet');
  return runtimeInstance_;
}

/**
 * Installs SwG runtime.
 * @param {!Window} win
 */
export function installRuntime(win) {
  // Only install the SwG runtime once.
  if (win[RUNTIME_PROP] && !Array.isArray(win[RUNTIME_PROP])) {
    return;
  }

  // Create a SwG runtime.
  const runtime = new Runtime(win);

  // Create a public version of the SwG runtime.
  const publicRuntime = createPublicRuntime(runtime);

  /**
   * Executes a callback when SwG runtime is ready.
   * @param {function(!Subscriptions)} callback
   */
  function callWhenRuntimeIsReady(callback) {
    if (!callback) {
      return;
    }

    runtime.whenReady().then(() => {
      callback(publicRuntime);
    });
  }

  // Queue up any callbacks the publication might have provided.
  const waitingCallbacks = [].concat(
    win[RUNTIME_PROP],
    win[RUNTIME_LEGACY_PROP]
  );
  waitingCallbacks.forEach(callWhenRuntimeIsReady);

  // If any more callbacks are `push`ed to the global SwG variables,
  // they'll be queued up to receive the SwG runtime when it's ready.
  win[RUNTIME_PROP] = win[RUNTIME_LEGACY_PROP] = {
    push: callWhenRuntimeIsReady,
  };

  // Set variable for testing.
  runtimeInstance_ = runtime;

  // Kick off subscriptions flow.
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

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = {};

    /** @private {boolean} */
    this.committed_ = false;

    /** @private {?function((!ConfiguredRuntime|!Promise))} */
    this.configuredResolver_ = null;

    /** @private @const {!Promise<!ConfiguredRuntime>} */
    this.configuredPromise_ = new Promise((resolve) => {
      this.configuredResolver_ = resolve;
    });

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
   * @return {!Promise<!ConfiguredRuntime>}
   * @private
   */
  configured_(commit) {
    if (!this.committed_ && commit) {
      this.committed_ = true;
      /** @type {!Promise<!PageConfig>} */
      let pageConfigPromise;
      if (this.productOrPublicationId_) {
        pageConfigPromise = Promise.resolve(
          new PageConfig(this.productOrPublicationId_, /* locked */ false)
        );
      } else {
        this.pageConfigResolver_ = new PageConfigResolver(this.doc_);
        pageConfigPromise = this.pageConfigResolver_
          .resolveConfig()
          .then((config) => {
            this.pageConfigResolver_ = null;
            return config;
          });
      }
      pageConfigPromise.then(
        (pageConfig) => {
          this.configuredResolver_(
            new ConfiguredRuntime(
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

  /**
   * Starts the subscription flow if it hasn't been started and the page is
   * configured to start it automatically.
   *
   * @return {?Promise}
   * @package
   */
  startSubscriptionsFlowIfNeeded() {
    const control = getControlFlag(this.win_.document);
    debugLog(control, 'mode');
    if (control == 'manual') {
      // "Skipping automatic start because control flag is set to "manual".
      return null;
    }
    return this.start();
  }

  /** @override */
  init(productOrPublicationId) {
    assert(!this.committed_, 'already configured');
    this.productOrPublicationId_ = productOrPublicationId;

    // Process the page's config.
    this.configured_(true);
  }

  /** @override */
  configure(config) {
    // Accumulate config for startup.
    Object.assign(this.config_, config);
    return this.configured_(false).then((runtime) => runtime.configure(config));
  }

  /** @override */
  start() {
    return this.configured_(true).then((runtime) => runtime.start());
  }

  /** @override */
  reset() {
    return this.configured_(true).then((runtime) => runtime.reset());
  }

  /** @override */
  clear() {
    return this.configured_(true).then((runtime) => runtime.clear());
  }

  /** @override */
  getEntitlements(params) {
    return this.configured_(true).then((runtime) =>
      runtime.getEntitlements(params)
    );
  }

  /** @override */
  setOnEntitlementsResponse(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnEntitlementsResponse(callback)
    );
  }

  /** @override */
  getOffers(options) {
    return this.configured_(true).then((runtime) => runtime.getOffers(options));
  }

  /** @override */
  showOffers(options) {
    return this.configured_(true).then((runtime) =>
      runtime.showOffers(options)
    );
  }

  /** @override */
  showUpdateOffers(options) {
    return this.configured_(true).then((runtime) =>
      runtime.showUpdateOffers(options)
    );
  }

  /** @override */
  showSubscribeOption(options) {
    return this.configured_(true).then((runtime) =>
      runtime.showSubscribeOption(options)
    );
  }

  /** @override */
  showAbbrvOffer(options) {
    return this.configured_(true).then((runtime) =>
      runtime.showAbbrvOffer(options)
    );
  }

  /** @override */
  showContributionOptions(options) {
    return this.configured_(true).then((runtime) =>
      runtime.showContributionOptions(options)
    );
  }

  /** @override */
  waitForSubscriptionLookup(accountPromise) {
    return this.configured_(true).then((runtime) =>
      runtime.waitForSubscriptionLookup(accountPromise)
    );
  }

  /** @override */
  showMeterRegwall(params) {
    return this.configured_(true).then((runtime) =>
      runtime.showMeterRegwall(params)
    );
  }

  /** @override */
  setOnNativeSubscribeRequest(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnNativeSubscribeRequest(callback)
    );
  }

  /** @override */
  setOnSubscribeResponse(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnSubscribeResponse(callback)
    );
  }

  /** @override */
  subscribe(sku) {
    return this.configured_(true).then((runtime) => runtime.subscribe(sku));
  }

  /** @override */
  updateSubscription(subscriptionRequest) {
    return this.configured_(true).then((runtime) =>
      runtime.updateSubscription(subscriptionRequest)
    );
  }

  /** @override */
  setOnContributionResponse(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnContributionResponse(callback)
    );
  }

  /** @override */
  setOnPaymentResponse(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnPaymentResponse(callback)
    );
  }

  /** @override */
  contribute(skuOrSubscriptionRequest) {
    return this.configured_(true).then((runtime) =>
      runtime.contribute(skuOrSubscriptionRequest)
    );
  }

  /** @override */
  completeDeferredAccountCreation(options) {
    return this.configured_(true).then((runtime) =>
      runtime.completeDeferredAccountCreation(options)
    );
  }

  /** @override */
  setOnLoginRequest(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnLoginRequest(callback)
    );
  }

  /** @override */
  triggerLoginRequest(request) {
    return this.configured_(false).then((runtime) =>
      runtime.triggerLoginRequest(request)
    );
  }

  /** @override */
  setOnLinkComplete(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnLinkComplete(callback)
    );
  }

  /** @override */
  linkAccount(params = {}) {
    return this.configured_(true).then((runtime) =>
      runtime.linkAccount(params)
    );
  }

  /** @override */
  setOnFlowStarted(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnFlowStarted(callback)
    );
  }

  /** @override */
  setOnFlowCanceled(callback) {
    return this.configured_(false).then((runtime) =>
      runtime.setOnFlowCanceled(callback)
    );
  }

  /** @override */
  saveSubscription(saveSubscriptionRequestCallback) {
    return this.configured_(true).then((runtime) => {
      return runtime.saveSubscription(saveSubscriptionRequestCallback);
    });
  }

  /** @override */
  showLoginPrompt() {
    return this.configured_(true).then((runtime) => {
      return runtime.showLoginPrompt();
    });
  }

  /** @override */
  showLoginNotification() {
    return this.configured_(true).then((runtime) => {
      return runtime.showLoginNotification();
    });
  }

  /** @override */
  createButton(optionsOrCallback, callback) {
    return this.buttonApi_.create(optionsOrCallback, callback);
  }

  /** @override */
  attachSmartButton(button, optionsOrCallback, callback) {
    return this.configured_(true).then((runtime) =>
      runtime.attachSmartButton(button, optionsOrCallback, callback)
    );
  }

  /** @override */
  attachButton(button, optionsOrCallback, callback) {
    return this.buttonApi_.attach(button, optionsOrCallback, callback);
  }

  /** @override */
  getPropensityModule() {
    return this.configured_(true).then((runtime) => {
      return runtime.getPropensityModule();
    });
  }

  /** @override */
  getLogger() {
    return this.configured_(true).then((runtime) => runtime.getLogger());
  }

  /** @override */
  getEventManager() {
    return this.configured_(true).then((runtime) => runtime.getEventManager());
  }

  /** @override */
  setShowcaseEntitlement(entitlement) {
    return this.configured_(true).then((runtime) =>
      runtime.setShowcaseEntitlement(entitlement)
    );
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

    /** @private @const {!Window} */
    this.win_ = this.doc_.getWin();

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = defaultConfig();

    if (isLegacyEdgeBrowser(this.win_)) {
      // TODO(dvoytenko, b/120607343): Find a way to remove this restriction
      // or move it to Web Activities.
      this.config_.windowOpenMode = WindowOpenMode.REDIRECT;
    }
    if (config) {
      this.configure_(config);
    }

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = pageConfig;

    /** @private @const {!Promise} */
    this.documentParsed_ = this.doc_.whenReady();

    /** @private @const {!JsError} */
    this.jserror_ = new JsError(this.doc_);

    /** @private @const {!Fetcher} */
    this.fetcher_ = integr.fetcher || new XhrFetcher(this.win_);

    /** @private @const {!Storage} */
    this.storage_ = new Storage(this.win_);

    /** @private @const {!DialogManager} */
    this.dialogManager_ = new DialogManager(this.doc_);

    /** @private @const {!Callbacks} */
    this.callbacks_ = new Callbacks();

    // WARNING: DepsDef ('this') is being progressively defined below.
    // Constructors will crash if they rely on something that doesn't exist yet.
    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = new ActivityPorts(this);

    /** @private @const {!AnalyticsService} */
    this.analyticsService_ = new AnalyticsService(this, this.fetcher_);
    this.analyticsService_.start();

    /** @private @const {!PayClient} */
    this.payClient_ = new PayClient(this);

    /** @private @const {!Logger} */
    this.logger_ = new Logger(this);

    /** @private @const {!EntitlementsManager} */
    this.entitlementsManager_ = new EntitlementsManager(
      this.win_,
      this.pageConfig_,
      this.fetcher_,
      this // See note about 'this' above
    );

    /** @private @const {!Propensity} */
    this.propensityModule_ = new Propensity(
      this.win_,
      this, // See note about 'this' above
      this.fetcher_
    );

    // ALL CLEAR: DepsDef definition now complete.
    this.eventManager_.logSwgEvent(AnalyticsEvent.IMPRESSION_PAGE_LOAD, false);

    /** @private @const {!OffersApi} */
    this.offersApi_ = new OffersApi(this.pageConfig_, this.fetcher_);

    /** @private @const {!ButtonApi} */
    this.buttonApi_ = new ButtonApi(this.doc_, Promise.resolve(this));

    const preconnect = new Preconnect(this.win_.document);

    preconnect.prefetch('$assets$/loader.svg');
    preconnect.preconnect('https://www.gstatic.com/');
    preconnect.preconnect('https://fonts.googleapis.com/');
    preconnect.preconnect('https://www.google.com/');
    LinkCompleteFlow.configurePending(this);
    PayCompleteFlow.configurePending(this);

    injectStyleSheet(this.doc_, SWG_DIALOG);

    // Report redirect errors if any.
    this.activityPorts_.onRedirectError((error) => {
      this.analyticsService_.addLabels(['redirect']);
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_PAYMENT_FAILED,
        false
      );
      this.jserror_.error('Redirect error', error);
    });
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
  jserror() {
    return this.jserror_;
  }

  /** @override */
  activities() {
    return this.activityPorts_;
  }

  /** @override */
  payClient() {
    return this.payClient_;
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
  analytics() {
    return this.analyticsService_;
  }

  /** @override */
  init() {
    // Implemented by the `Runtime` class.
  }

  /** @override */
  configure(config) {
    // Indirected for constructor testing.
    this.configure_(config);
  }

  /**
   * @param {!../api/subscriptions.Config} config
   * @private
   */
  configure_(config) {
    // Validate first.
    let error = '';
    for (const k in config) {
      const v = config[k];
      switch (k) {
        case 'windowOpenMode':
          if (v != WindowOpenMode.AUTO && v != WindowOpenMode.REDIRECT) {
            error = 'Unknown windowOpenMode: ' + v;
          }
          break;
        case 'experiments':
          v.forEach((experiment) => setExperiment(this.win_, experiment, true));
          if (this.analytics()) {
            // If analytics service isn't set up yet, then it will get the
            // experiments later.
            this.analytics().addLabels(v);
          }
          break;
        case 'analyticsMode':
          if (v != AnalyticsMode.DEFAULT && v != AnalyticsMode.IMPRESSIONS) {
            error = 'Unknown analytics mode: ' + v;
          }
          break;
        case 'enableSwgAnalytics':
          if (!isBoolean(v)) {
            error = 'Unknown enableSwgAnalytics value: ' + v;
          }
          break;
        case 'enablePropensity':
          if (!isBoolean(v)) {
            error = 'Unknown enablePropensity value: ' + v;
          }
          break;
        default:
          error = 'Unknown config property: ' + k;
      }
    }
    // Throw error string if it's not null
    assert(!error, error || undefined);
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
  clear() {
    this.entitlementsManager_.clear();
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
  getEntitlements(params) {
    return this.entitlementsManager_
      .getEntitlements(params)
      .then((entitlements) => {
        // Auto update internal things tracking the user's current SKU.
        if (entitlements) {
          try {
            const skus = entitlements.entitlements.map(
              (entitlement) =>
                entitlement.getSku() || 'unknown subscriptionToken'
            );
            if (skus.length > 0) {
              this.analyticsService_.setSku(skus.join(','));
            }
          } catch (ex) {}
        }
        return entitlements.clone();
      });
  }

  /** @override */
  setOnEntitlementsResponse(callback) {
    this.callbacks_.setOnEntitlementsResponse(callback);
  }

  /** @override */
  getOffers(options) {
    return this.offersApi_.getOffers(options && options.productId);
  }

  /** @override */
  showOffers(options) {
    return this.documentParsed_.then(() => {
      const errorMessage =
        'The showOffers() method cannot be used to update a subscription. ' +
        'Use the showUpdateOffers() method instead.';
      assert(options ? !options['oldSku'] : true, errorMessage);
      const flow = new OffersFlow(this, options);
      return flow.start();
    });
  }

  /** @override */
  showUpdateOffers(options) {
    assert(
      isExperimentOn(this.win_, ExperimentFlags.REPLACE_SUBSCRIPTION),
      'Not yet launched!'
    );
    return this.documentParsed_.then(() => {
      const errorMessage =
        'The showUpdateOffers() method cannot be used for new subscribers. ' +
        'Use the showOffers() method instead.';
      assert(options ? !!options['oldSku'] : false, errorMessage);
      const flow = new OffersFlow(this, options);
      return flow.start();
    });
  }

  /** @override */
  showSubscribeOption(options) {
    return this.documentParsed_.then(() => {
      const flow = new SubscribeOptionFlow(this, options);
      return flow.start();
    });
  }

  /** @override */
  showAbbrvOffer(options) {
    return this.documentParsed_.then(() => {
      const flow = new AbbrvOfferFlow(this, options);
      return flow.start();
    });
  }

  /** @override */
  showContributionOptions(options) {
    return this.documentParsed_.then(() => {
      const flow = new ContributionsFlow(this, options);
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
  showMeterRegwall(meterRegwallArgs) {
    return this.documentParsed_.then(() => {
      const wait = new MeterRegwallApi(this, meterRegwallArgs);
      return wait.start();
    });
  }

  /** @override */
  setOnLoginRequest(callback) {
    this.callbacks_.setOnLoginRequest(callback);
  }

  /** @override */
  triggerLoginRequest(request) {
    this.callbacks_.triggerLoginRequest(request);
  }

  /** @override */
  setOnLinkComplete(callback) {
    this.callbacks_.setOnLinkComplete(callback);
  }

  /** @override */
  linkAccount(params = {}) {
    return this.documentParsed_.then(() => {
      return new LinkbackFlow(this).start(params);
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
  setOnPaymentResponse(callback) {
    this.callbacks_.setOnPaymentResponse(callback);
  }

  /** @override */
  subscribe(sku) {
    const errorMessage =
      'The subscribe() method can only take a sku as its parameter; ' +
      'for subscription updates please use the updateSubscription() method';
    assert(typeof sku === 'string', errorMessage);
    return this.documentParsed_.then(() => {
      return new PayStartFlow(this, {'skuId': sku}).start();
    });
  }

  /** @override */
  updateSubscription(subscriptionRequest) {
    assert(
      isExperimentOn(this.win_, ExperimentFlags.REPLACE_SUBSCRIPTION),
      'Not yet launched!'
    );
    const errorMessage =
      'The updateSubscription() method should be used for subscription ' +
      'updates; for new subscriptions please use the subscribe() method';
    assert(
      subscriptionRequest ? subscriptionRequest['oldSku'] : false,
      errorMessage
    );
    return this.documentParsed_.then(() => {
      return new PayStartFlow(this, subscriptionRequest).start();
    });
  }

  /** @override */
  setOnContributionResponse(callback) {
    this.callbacks_.setOnContributionResponse(callback);
  }

  /** @override */
  contribute(skuOrSubscriptionRequest) {
    /** @type {!../api/subscriptions.SubscriptionRequest} */
    const request =
      typeof skuOrSubscriptionRequest == 'string'
        ? {'skuId': skuOrSubscriptionRequest}
        : skuOrSubscriptionRequest;
    return this.documentParsed_.then(() => {
      return new PayStartFlow(
        this,
        request,
        ProductType.UI_CONTRIBUTION
      ).start();
    });
  }

  /** @override */
  completeDeferredAccountCreation(options) {
    return this.documentParsed_.then(() => {
      return new DeferredAccountFlow(this, options || null).start();
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
  createButton(optionsOrCallback, callback) {
    // This is a minor duplication to allow this code to be sync.
    return this.buttonApi_.create(optionsOrCallback, callback);
  }

  /** @override */
  attachButton(button, optionsOrCallback, callback) {
    // This is a minor duplication to allow this code to be sync.
    this.buttonApi_.attach(button, optionsOrCallback, callback);
  }

  /** @override */
  attachSmartButton(button, optionsOrCallback, callback) {
    assert(
      isExperimentOn(this.win_, ExperimentFlags.SMARTBOX),
      'Not yet launched!'
    );
    this.buttonApi_.attachSmartButton(
      this,
      button,
      optionsOrCallback,
      callback
    );
  }

  /** @override */
  getPropensityModule() {
    return Promise.resolve(this.propensityModule_);
  }

  /**
   * This one exists as an internal helper so SwG logging doesn't require a promise.
   * @return {!ClientEventManager}
   */
  eventManager() {
    return this.eventManager_;
  }

  /**
   * This one exists as a public API so publishers can subscribe to SwG events.
   * @override */
  getEventManager() {
    return Promise.resolve(this.eventManager_);
  }

  /** @override */
  getLogger() {
    return Promise.resolve(this.logger_);
  }

  /** @override */
  setShowcaseEntitlement(entitlement) {
    if (
      !entitlement ||
      !isSecure(this.win_.location) ||
      !wasReferredByGoogle(parseUrl(this.doc_.doc_.referrer)) ||
      !urlContainsFreshGaaParams()
    ) {
      return;
    }

    const events =
      publisherEntitlementEventToAnalyticsEvents(entitlement.entitlement) || [];
    const params = new EventParams();
    params.setIsUserRegistered(entitlement.isUserRegistered);

    for (let k = 0; k < events.length; k++) {
      this.eventManager().logEvent({
        eventType: events[k],
        eventOriginator: EventOriginator.SHOWCASE_CLIENT,
        isFromUserAction: null,
        additionalParameters: params,
      });
    }
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
    clear: runtime.clear.bind(runtime),
    getEntitlements: runtime.getEntitlements.bind(runtime),
    linkAccount: runtime.linkAccount.bind(runtime),
    showLoginPrompt: runtime.showLoginPrompt.bind(runtime),
    showLoginNotification: runtime.showLoginNotification.bind(runtime),
    getOffers: runtime.getOffers.bind(runtime),
    showOffers: runtime.showOffers.bind(runtime),
    showUpdateOffers: runtime.showUpdateOffers.bind(runtime),
    showAbbrvOffer: runtime.showAbbrvOffer.bind(runtime),
    showMeterRegwall: runtime.showMeterRegwall.bind(runtime),
    showSubscribeOption: runtime.showSubscribeOption.bind(runtime),
    showContributionOptions: runtime.showContributionOptions.bind(runtime),
    waitForSubscriptionLookup: runtime.waitForSubscriptionLookup.bind(runtime),
    subscribe: runtime.subscribe.bind(runtime),
    updateSubscription: runtime.updateSubscription.bind(runtime),
    contribute: runtime.contribute.bind(runtime),
    completeDeferredAccountCreation: runtime.completeDeferredAccountCreation.bind(
      runtime
    ),
    setOnEntitlementsResponse: runtime.setOnEntitlementsResponse.bind(runtime),
    setOnLoginRequest: runtime.setOnLoginRequest.bind(runtime),
    triggerLoginRequest: runtime.triggerLoginRequest.bind(runtime),
    setOnLinkComplete: runtime.setOnLinkComplete.bind(runtime),
    setOnNativeSubscribeRequest: runtime.setOnNativeSubscribeRequest.bind(
      runtime
    ),
    setOnPaymentResponse: runtime.setOnPaymentResponse.bind(runtime),
    setOnSubscribeResponse: runtime.setOnSubscribeResponse.bind(runtime),
    setOnContributionResponse: runtime.setOnContributionResponse.bind(runtime),
    setOnFlowStarted: runtime.setOnFlowStarted.bind(runtime),
    setOnFlowCanceled: runtime.setOnFlowCanceled.bind(runtime),
    saveSubscription: runtime.saveSubscription.bind(runtime),
    createButton: runtime.createButton.bind(runtime),
    attachButton: runtime.attachButton.bind(runtime),
    attachSmartButton: runtime.attachSmartButton.bind(runtime),
    getPropensityModule: runtime.getPropensityModule.bind(runtime),
    getLogger: runtime.getLogger.bind(runtime),
    getEventManager: runtime.getEventManager.bind(runtime),
    setShowcaseEntitlement: runtime.setShowcaseEntitlement.bind(runtime),
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
