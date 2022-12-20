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
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {ContributionsFlow} from './contributions-flow';
import {DeferredAccountFlow} from './deferred-account-flow';
import {DepsDef} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {Doc as DocInterface, resolveDoc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {ExperimentFlags} from './experiment-flags';
import {Fetcher as FetcherInterface, XhrFetcher} from './fetcher';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {JsError} from './jserror';
import {
  LinkCompleteFlow,
  LinkSaveFlow,
  LinkbackFlow,
} from './link-accounts-flow';
import {Logger} from './logger';
import {LoginNotificationApi} from './login-notification-api';
import {LoginPromptApi} from './login-prompt-api';
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
  Subscriptions as SubscriptionsInterface,
  WindowOpenMode,
  defaultConfig,
} from '../api/subscriptions';
import {Propensity} from './propensity';
import {DIALOG_CSS as SWG_DIALOG} from '../ui/ui-css';
import {Storage} from './storage';
import {SubscriptionLinkingFlow} from './subscription-linking-flow';
import {WaitForSubscriptionLookupApi} from './wait-for-subscription-lookup-api';
import {assert} from '../utils/log';
import {
  convertPotentialTimestampToMilliseconds,
  toTimestamp,
} from '../utils/date-utils';
import {debugLog} from '../utils/log';
import {injectStyleSheet} from '../utils/dom';
import {isBoolean} from '../utils/types';
import {isExperimentOn} from './experiments';
import {isSecure} from '../utils/url';
import {queryStringHasFreshGaaParams} from './extended-access';
import {setExperiment} from './experiments';
import {showcaseEventToAnalyticsEvents} from './event-type-mapping';
import {warn} from '../utils/log';

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
   * @param {function(!SubscriptionsInterface)} callback
   */
  async function callWhenRuntimeIsReady(callback) {
    if (!callback) {
      return;
    }

    await runtime.whenReady();

    callback(publicRuntime);
  }

  // Queue up any callbacks the publication might have provided.
  const waitingCallbacks = [].concat(
    win[RUNTIME_PROP],
    win[RUNTIME_LEGACY_PROP]
  );
  for (const waitingCallback of waitingCallbacks) {
    callWhenRuntimeIsReady(waitingCallback);
  }

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
 * @implements {SubscriptionsInterface}
 */
export class Runtime {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!DocInterface} */
    this.doc_ = resolveDoc(win);

    /** @private @const {!Promise} */
    this.ready_ = Promise.resolve();

    /** @private {?string} */
    this.productOrPublicationId_ = null;

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = {};

    /** @private {boolean} */
    this.startedConfiguringRuntime_ = false;

    /** @private {?function((!ConfiguredRuntime|!Promise))} */
    this.configuredRuntimeResolver_ = null;

    /** @private @const {!Promise<!ConfiguredRuntime>} */
    this.configuredRuntimePromise_ = new Promise((resolve) => {
      this.configuredRuntimeResolver_ = resolve;
    });

    /** @private {?PageConfigResolver} */
    this.pageConfigResolver_ = null;

    /** @private @const {!ButtonApi} */
    this.buttonApi_ = new ButtonApi(this.doc_, this.configuredRuntimePromise_);
    this.buttonApi_.init(); // Injects swg-button stylesheet.
  }

  /**
   * @return {!Promise}
   */
  whenReady() {
    return this.ready_;
  }

  /**
   * @param {boolean} startConfiguringRuntime
   * @return {!Promise<!ConfiguredRuntime>}
   * @private
   */
  async configured_(startConfiguringRuntime) {
    if (!startConfiguringRuntime) {
      // Configuration isn't necessary yet, so lets wait.
      return this.configuredRuntimePromise_;
    }

    if (this.startedConfiguringRuntime_) {
      // Runtime configuration has already started.
      if (this.pageConfigResolver_) {
        // Page config resolution has already started, but hasn't completed.
        // Kick off additional checks for the page config.
        this.pageConfigResolver_.check();
      }
      return this.configuredRuntimePromise_;
    }

    // Configure runtime.
    this.startedConfiguringRuntime_ = true;
    const pageConfig = await this.determinePageConfig_();
    const configuredRuntime = new ConfiguredRuntime(
      this.doc_,
      pageConfig,
      /* integr */ {configPromise: this.configuredRuntimePromise_},
      this.config_
    );
    this.configuredRuntimeResolver_(configuredRuntime);

    return configuredRuntime;
  }

  /**
   * Creates or resolves the page config.
   * @return {!Promise<!PageConfig>}
   */
  async determinePageConfig_() {
    if (this.productOrPublicationId_) {
      // Create page config.
      return new PageConfig(this.productOrPublicationId_, /* locked */ false);
    }

    // Resolve page config.
    this.pageConfigResolver_ = new PageConfigResolver(this.doc_);
    try {
      const pageConfig = await this.pageConfigResolver_.resolveConfig();
      this.pageConfigResolver_ = null;
      return pageConfig;
    } catch (reason) {
      this.pageConfigResolver_ = null;
      throw reason;
    }
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
    assert(!this.startedConfiguringRuntime_, 'already configured');
    this.productOrPublicationId_ = productOrPublicationId;

    // Process the page's config. Then start logging events in the
    // analytics service.
    this.configured_(true).then((configuredRuntime) => {
      configuredRuntime.analytics().setReadyForLogging();
      configuredRuntime.analytics().start();
    });
  }

  /** @override */
  async configure(config) {
    // Accumulate config for startup.
    Object.assign(this.config_, config);
    const runtime = await this.configured_(false);
    return runtime.configure(config);
  }

  /** @override */
  async start() {
    const runtime = await this.configured_(true);
    return runtime.start();
  }

  /** @override */
  async reset() {
    const runtime = await this.configured_(true);
    return runtime.reset();
  }

  /** @override */
  async clear() {
    const runtime = await this.configured_(true);
    return runtime.clear();
  }

  /** @override */
  async getEntitlements(params) {
    const runtime = await this.configured_(true);
    return runtime.getEntitlements(params);
  }

  /** @override */
  async setOnEntitlementsResponse(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnEntitlementsResponse(callback);
  }

  /** @override */
  async getOffers(options) {
    const runtime = await this.configured_(true);
    return runtime.getOffers(options);
  }

  /** @override */
  async showOffers(options) {
    const runtime = await this.configured_(true);
    return runtime.showOffers(options);
  }

  /** @override */
  async showUpdateOffers(options) {
    const runtime = await this.configured_(true);
    return runtime.showUpdateOffers(options);
  }

  /** @override */
  async showSubscribeOption(options) {
    const runtime = await this.configured_(true);
    return runtime.showSubscribeOption(options);
  }

  /** @override */
  async showAbbrvOffer(options) {
    const runtime = await this.configured_(true);
    return runtime.showAbbrvOffer(options);
  }

  /** @override */
  async showContributionOptions(options) {
    const runtime = await this.configured_(true);
    return runtime.showContributionOptions(options);
  }

  /** @override */
  async waitForSubscriptionLookup(accountPromise) {
    const runtime = await this.configured_(true);
    return runtime.waitForSubscriptionLookup(accountPromise);
  }

  /** @override */
  async setOnNativeSubscribeRequest(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnNativeSubscribeRequest(callback);
  }

  /** @override */
  async setOnSubscribeResponse(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnSubscribeResponse(callback);
  }

  /** @override */
  async subscribe(sku) {
    const runtime = await this.configured_(true);
    return runtime.subscribe(sku);
  }

  /** @override */
  async updateSubscription(subscriptionRequest) {
    const runtime = await this.configured_(true);
    return runtime.updateSubscription(subscriptionRequest);
  }

  /** @override */
  async setOnContributionResponse(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnContributionResponse(callback);
  }

  /** @override */
  async setOnPaymentResponse(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnPaymentResponse(callback);
  }

  /** @override */
  async contribute(skuOrSubscriptionRequest) {
    const runtime = await this.configured_(true);
    return runtime.contribute(skuOrSubscriptionRequest);
  }

  /** @override */
  async completeDeferredAccountCreation(options) {
    const runtime = await this.configured_(true);
    return runtime.completeDeferredAccountCreation(options);
  }

  /** @override */
  async setOnLoginRequest(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnLoginRequest(callback);
  }

  /** @override */
  async triggerLoginRequest(request) {
    const runtime = await this.configured_(false);
    return runtime.triggerLoginRequest(request);
  }

  /** @override */
  async setOnLinkComplete(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnLinkComplete(callback);
  }

  /** @override */
  async linkAccount(params = {}) {
    const runtime = await this.configured_(true);
    return runtime.linkAccount(params);
  }

  /** @override */
  async setOnFlowStarted(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnFlowStarted(callback);
  }

  /** @override */
  async setOnFlowCanceled(callback) {
    const runtime = await this.configured_(false);
    return runtime.setOnFlowCanceled(callback);
  }

  /** @override */
  async saveSubscription(saveSubscriptionRequestCallback) {
    const runtime = await this.configured_(true);
    return runtime.saveSubscription(saveSubscriptionRequestCallback);
  }

  /** @override */
  async showLoginPrompt() {
    const runtime = await this.configured_(true);
    return runtime.showLoginPrompt();
  }

  /** @override */
  async showLoginNotification() {
    const runtime = await this.configured_(true);
    return runtime.showLoginNotification();
  }

  /** @override */
  createButton(optionsOrCallback, callback) {
    return this.buttonApi_.create(optionsOrCallback, callback);
  }

  /** @override */
  async attachSmartButton(button, optionsOrCallback, callback) {
    const runtime = await this.configured_(true);
    return runtime.attachSmartButton(button, optionsOrCallback, callback);
  }

  /** @override */
  attachButton(button, optionsOrCallback, callback) {
    return this.buttonApi_.attach(button, optionsOrCallback, callback);
  }

  /** @override */
  async getPropensityModule() {
    const runtime = await this.configured_(true);
    return runtime.getPropensityModule();
  }

  /** @override */
  async getLogger() {
    const runtime = await this.configured_(true);
    return runtime.getLogger();
  }

  /** @override */
  async getEventManager() {
    const runtime = await this.configured_(true);
    return runtime.getEventManager();
  }

  /** @override */
  async setShowcaseEntitlement(entitlement) {
    const runtime = await this.configured_(true);
    return runtime.setShowcaseEntitlement(entitlement);
  }

  /** @override */
  async consumeShowcaseEntitlementJwt(showcaseEntitlementJwt, onCloseDialog) {
    const runtime = await this.configured_(true);
    return runtime.consumeShowcaseEntitlementJwt(
      showcaseEntitlementJwt,
      onCloseDialog
    );
  }

  /** @override */
  showBestAudienceAction() {
    warn('Not implemented yet');
  }

  /** @override */
  async setPublisherProvidedId(publisherProvidedId) {
    const runtime = await this.configured_(true);
    return runtime.setPublisherProvidedId(publisherProvidedId);
  }

  /** @override */
  async linkSubscription(request) {
    const runtime = await this.configured_(true);
    return runtime.linkSubscription(request);
  }
}

/**
 * @implements {DepsDef}
 * @implements {SubscriptionsInterface}
 */
export class ConfiguredRuntime {
  /**
   * @param {!Window|!Document|!DocInterface} winOrDoc
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {{
   *     fetcher: (!FetcherInterface|undefined),
   *     configPromise: (!Promise|undefined),
   *     enableGoogleAnalytics: (boolean|undefined),
   *     enableDefaultMeteringHandler: (boolean|undefined),
   *     useArticleEndpoint: (boolean|undefined)
   *   }=} integr
   * @param {!../api/subscriptions.Config=} config
   * @param {!{
   *   lang: (string|undefined),
   *   theme: (!../api/basic-subscriptions.ClientTheme|undefined),
   *   }=} clientOptions
   */
  constructor(winOrDoc, pageConfig, integr, config, clientOptions) {
    integr = integr || {};
    integr.configPromise = integr.configPromise || Promise.resolve();

    /** @private @const {!ClientEventManager} */
    this.eventManager_ = new ClientEventManager(integr.configPromise);

    /** @private @const {!DocInterface} */
    this.doc_ = resolveDoc(winOrDoc);

    /** @private @const {!Window} */
    this.win_ = this.doc_.getWin();

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = defaultConfig();

    if (config) {
      this.configure_(config);
    }

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = pageConfig;

    /** @private @const {!Promise} */
    this.documentParsed_ = this.doc_.whenReady();

    /** @private @const {!JsError} */
    this.jserror_ = new JsError(this.doc_);

    /** @private @const {!FetcherInterface} */
    this.fetcher_ = integr.fetcher || new XhrFetcher(this.win_);

    /** @private @const {!Storage} */
    this.storage_ = new Storage(this.win_);

    /** @private @const {!DialogManager} */
    this.dialogManager_ = new DialogManager(this.doc_);

    /** @private @const {!Callbacks} */
    this.callbacks_ = new Callbacks();

    /** @private {?OffersFlow} */
    this.lastOffersFlow_ = null;

    /** @private {?ContributionsFlow} */
    this.lastContributionsFlow_ = null;

    /** @private {string|undefined} */
    this.publisherProvidedId_ = undefined;

    // Start listening to Google Analytics events, if applicable.
    if (integr.enableGoogleAnalytics) {
      /** @private @const {!GoogleAnalyticsEventListener} */
      this.googleAnalyticsEventListener_ = new GoogleAnalyticsEventListener(
        this
      );
      this.googleAnalyticsEventListener_.start();
    }

    // WARNING: DepsDef ('this') is being progressively defined below.
    // Constructors will crash if they rely on something that doesn't exist yet.
    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = new ActivityPorts(this);

    /** @private @const {!AnalyticsService} */
    this.analyticsService_ = new AnalyticsService(this, this.fetcher_);

    /** @private @const {!PayClient} */
    this.payClient_ = new PayClient(this);

    /** @private @const {!Logger} */
    this.logger_ = new Logger(this);

    /** @private @const {!EntitlementsManager} */
    this.entitlementsManager_ = new EntitlementsManager(
      this.win_,
      this.pageConfig_,
      this.fetcher_,
      this, // See note about 'this' above
      integr.useArticleEndpoint || false,
      integr.enableDefaultMeteringHandler || false
    );

    /** @private @const {!ClientConfigManager} */
    this.clientConfigManager_ = new ClientConfigManager(
      this, // See note about 'this' above
      pageConfig.getPublicationId(),
      this.fetcher_,
      clientOptions
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
  clientConfigManager() {
    return this.clientConfigManager_;
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
    for (const key in config) {
      const value = config[key];
      switch (key) {
        case 'windowOpenMode':
          if (
            value != WindowOpenMode.AUTO &&
            value != WindowOpenMode.REDIRECT
          ) {
            error = 'Unknown windowOpenMode: ' + value;
          }
          break;
        case 'experiments':
          for (const experiment of value) {
            setExperiment(this.win_, experiment, true);
          }
          if (this.analytics()) {
            // If analytics service isn't set up yet, then it will get the
            // experiments later.
            this.analytics().addLabels(value);
          }
          break;
        case 'analyticsMode':
          if (
            value != AnalyticsMode.DEFAULT &&
            value != AnalyticsMode.IMPRESSIONS
          ) {
            error = 'Unknown analytics mode: ' + value;
          }
          break;
        case 'enableSwgAnalytics':
          if (!isBoolean(value)) {
            error = 'Unknown enableSwgAnalytics value: ' + value;
          }
          break;
        case 'enablePropensity':
          if (!isBoolean(value)) {
            error = 'Unknown enablePropensity value: ' + value;
          }
          break;
        case 'skipAccountCreationScreen':
          if (!isBoolean(value)) {
            error = 'Unknown skipAccountCreationScreen value: ' + value;
          }
          break;
        case 'publisherProvidedId':
          if (
            value != undefined &&
            !(typeof value === 'string' && value != '')
          ) {
            error = 'publisherProvidedId must be a string, value: ' + value;
          }
          break;
        default:
          error = 'Unknown config property: ' + key;
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
    this.closeDialog();
  }

  /** @override */
  clear() {
    this.entitlementsManager_.clear();
    this.closeDialog();
  }

  /** Close dialog. */
  closeDialog() {
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
  async getEntitlements(params) {
    if (params?.publisherProvidedId) {
      params.publisherProvidedId = this.publisherProvidedId_;
    }
    const entitlements = await this.entitlementsManager_.getEntitlements(
      params
    );
    // The swg user token is stored in the entitlements flow, so the analytics service is ready for logging.
    this.analyticsService_.setReadyForLogging();
    this.analyticsService_.start();
    // Auto update internal things tracking the user's current SKU.
    if (entitlements) {
      try {
        const skus = entitlements.entitlements.map(
          (entitlement) => entitlement.getSku() || 'unknown subscriptionToken'
        );
        if (skus.length > 0) {
          this.analyticsService_.setSku(skus.join(','));
        }
      } catch (ex) {}
    }
    return entitlements.clone();
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
  async showOffers(options) {
    await this.documentParsed_;
    const errorMessage =
      'The showOffers() method cannot be used to update a subscription. ' +
      'Use the showUpdateOffers() method instead.';
    assert(options ? !options['oldSku'] : true, errorMessage);
    this.lastOffersFlow_ = new OffersFlow(this, options);
    return this.lastOffersFlow_.start();
  }

  /** @override */
  async showUpdateOffers(options) {
    assert(
      isExperimentOn(this.win_, ExperimentFlags.REPLACE_SUBSCRIPTION),
      'Not yet launched!'
    );
    await this.documentParsed_;
    const errorMessage =
      'The showUpdateOffers() method cannot be used for new subscribers. ' +
      'Use the showOffers() method instead.';
    assert(options ? !!options['oldSku'] : false, errorMessage);
    const flow = new OffersFlow(this, options);
    return flow.start();
  }

  /** @override */
  async showSubscribeOption(options) {
    await this.documentParsed_;
    const flow = new SubscribeOptionFlow(this, options);
    return flow.start();
  }

  /** @override */
  async showAbbrvOffer(options) {
    await this.documentParsed_;
    const flow = new AbbrvOfferFlow(this, options);
    return flow.start();
  }

  /** @override */
  async showContributionOptions(options) {
    await this.documentParsed_;
    this.lastContributionsFlow_ = new ContributionsFlow(this, options);
    return this.lastContributionsFlow_.start();
  }

  /**
   * Get the last contribution offers flow.
   * @return {?ContributionsFlow}
   */
  getLastContributionsFlow() {
    return this.lastContributionsFlow_;
  }

  /** @override */
  async waitForSubscriptionLookup(accountPromise) {
    await this.documentParsed_;
    const wait = new WaitForSubscriptionLookupApi(this, accountPromise);
    return wait.start();
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
  async linkAccount(params = {}) {
    await this.documentParsed_;
    return new LinkbackFlow(this).start(params);
  }

  /** @override */
  async saveSubscription(saveSubscriptionRequestCallback) {
    await this.documentParsed_;
    return new LinkSaveFlow(this, saveSubscriptionRequestCallback).start();
  }

  /** @override */
  async showLoginPrompt() {
    await this.documentParsed_;
    return new LoginPromptApi(this).start();
  }

  /** @override */
  async showLoginNotification() {
    await this.documentParsed_;
    return new LoginNotificationApi(this).start();
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
  async subscribe(sku) {
    const errorMessage =
      'The subscribe() method can only take a sku as its parameter; ' +
      'for subscription updates please use the updateSubscription() method';
    assert(typeof sku === 'string', errorMessage);
    await this.documentParsed_;
    return new PayStartFlow(this, {'skuId': sku}).start();
  }

  /** @override */
  async updateSubscription(subscriptionRequest) {
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
    await this.documentParsed_;
    return new PayStartFlow(this, subscriptionRequest).start();
  }

  /** @override */
  setOnContributionResponse(callback) {
    this.callbacks_.setOnContributionResponse(callback);
  }

  /** @override */
  async contribute(skuOrSubscriptionRequest) {
    /** @type {!../api/subscriptions.SubscriptionRequest} */
    const request =
      typeof skuOrSubscriptionRequest == 'string'
        ? {'skuId': skuOrSubscriptionRequest}
        : skuOrSubscriptionRequest;
    await this.documentParsed_;
    return new PayStartFlow(this, request, ProductType.UI_CONTRIBUTION).start();
  }

  /** @override */
  async completeDeferredAccountCreation(options) {
    await this.documentParsed_;
    return new DeferredAccountFlow(this, options || null).start();
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
   * Get the last subscription offers flow.
   * @return {?OffersFlow}
   */
  getLastOffersFlow() {
    return this.lastOffersFlow_;
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
      !isSecure(this.win().location) ||
      !queryStringHasFreshGaaParams(
        this.win().location.search,
        /*allowAllAccessTypes=*/ true
      )
    ) {
      return Promise.resolve();
    }

    const eventsToLog =
      showcaseEventToAnalyticsEvents(entitlement.entitlement) || [];
    const params = new EventParams();
    params.setIsUserRegistered(entitlement.isUserRegistered);
    if (entitlement.subscriptionTimestamp) {
      params.setSubscriptionTimestamp(
        toTimestamp(
          convertPotentialTimestampToMilliseconds(
            entitlement.subscriptionTimestamp
          )
        )
      );
    }

    for (let i = 0; i < eventsToLog.length; i++) {
      this.eventManager().logEvent({
        eventType: eventsToLog[i],
        eventOriginator: EventOriginator.SHOWCASE_CLIENT,
        isFromUserAction: false,
        additionalParameters: params,
      });
    }

    return Promise.resolve();
  }

  /** @override */
  consumeShowcaseEntitlementJwt(showcaseEntitlementJwt, onCloseDialog) {
    const entitlements = this.entitlementsManager().parseEntitlements({
      signedEntitlements: showcaseEntitlementJwt,
    });
    entitlements.consume(onCloseDialog);
  }

  /** @override */
  showBestAudienceAction() {
    warn('Not implemented yet');
  }

  /** @override */
  setPublisherProvidedId(publisherProvidedId) {
    this.publisherProvidedId_ = publisherProvidedId;
  }

  /** @override */
  async linkSubscription(request) {
    await this.documentParsed_;
    return new SubscriptionLinkingFlow(this).start(request);
  }
}

/**
 * @param {!Runtime} runtime
 * @return {!SubscriptionsInterface}
 */
function createPublicRuntime(runtime) {
  return /** @type {!SubscriptionsInterface} */ ({
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
    showSubscribeOption: runtime.showSubscribeOption.bind(runtime),
    showContributionOptions: runtime.showContributionOptions.bind(runtime),
    waitForSubscriptionLookup: runtime.waitForSubscriptionLookup.bind(runtime),
    subscribe: runtime.subscribe.bind(runtime),
    updateSubscription: runtime.updateSubscription.bind(runtime),
    contribute: runtime.contribute.bind(runtime),
    completeDeferredAccountCreation:
      runtime.completeDeferredAccountCreation.bind(runtime),
    setOnEntitlementsResponse: runtime.setOnEntitlementsResponse.bind(runtime),
    setOnLoginRequest: runtime.setOnLoginRequest.bind(runtime),
    triggerLoginRequest: runtime.triggerLoginRequest.bind(runtime),
    setOnLinkComplete: runtime.setOnLinkComplete.bind(runtime),
    setOnNativeSubscribeRequest:
      runtime.setOnNativeSubscribeRequest.bind(runtime),
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
    consumeShowcaseEntitlementJwt:
      runtime.consumeShowcaseEntitlementJwt.bind(runtime),
    showBestAudienceAction: runtime.showBestAudienceAction.bind(runtime),
    setPublisherProvidedId: runtime.setPublisherProvidedId.bind(runtime),
    linkSubscription: runtime.linkSubscription.bind(runtime),
  });
}
