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

import {ASSETS} from '../constants';
import {AbbrvOfferFlow, OffersFlow, SubscribeOptionFlow} from './offers-flow';
import {ActivityPorts} from '../components/activities';
import {
  AnalyticsEvent,
  EventOriginator,
  EventParams,
} from '../proto/api_messages';
import {
  AnalyticsMode,
  ButtonOptions,
  ClientTheme,
  Config,
  LinkSubscriptionRequest,
  LinkSubscriptionResult,
  LoginRequest,
  OffersRequest,
  PublisherEntitlement,
  SaveSubscriptionRequestCallback,
  SmartButtonOptions,
  SubscriptionRequest,
  Subscriptions,
} from '../api/subscriptions';
import {AnalyticsService} from './analytics-service';
import {ArticleExperimentFlags} from './experiment-flags';
import {AvailableIntervention} from '../api/available-intervention';
import {ButtonApi} from './button-api';
import {Callbacks} from './callbacks';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {ClientEventManagerApi} from '../api/client-event-manager-api';
import {ContributionsFlow} from './contributions-flow';
import {DIALOG_CSS} from '../ui/ui-css';
import {
  DeferredAccountCreationRequest,
  DeferredAccountCreationResponse,
} from '../api/deferred-account-creation';
import {DeferredAccountFlow} from './deferred-account-flow';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {Doc as DocInterface, resolveDoc} from '../model/doc';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {Fetcher as FetcherInterface, XhrFetcher} from './fetcher';
import {GetEntitlementsParamsExternalDef} from '../api/subscriptions';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {JsError} from './jserror';
import {
  LinkCompleteFlow,
  LinkSaveFlow,
  LinkbackFlow,
} from './link-accounts-flow';
import {Logger} from './logger';
import {LoggerApi} from '../api/logger-api';
import {LoginNotificationApi} from './login-notification-api';
import {LoginPromptApi} from './login-prompt-api';
import {Offer} from '../api/offer';
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
import {PropensityApi} from '../api/propensity-api';
import {Storage} from './storage';
import {SubscribeResponse} from '../api/subscribe-response';
import {SubscriptionLinkingFlow} from './subscription-linking-flow';
import {WaitForSubscriptionLookupApi} from './wait-for-subscription-lookup-api';
import {assert} from '../utils/log';
import {
  convertPotentialTimestampToMilliseconds,
  toTimestamp,
} from '../utils/date-utils';
import {debugLog} from '../utils/log';
import {getLanguageCodeFromElement} from '../utils/i18n';
import {injectStyleSheet} from '../utils/dom';
import {isBoolean} from '../utils/types';
import {isSecure} from '../utils/url';
import {queryStringHasFreshGaaParams} from './extended-access';
import {setExperiment} from './experiments';
import {showcaseEventToAnalyticsEvents} from './event-type-mapping';
import {warn} from '../utils/log';

const RUNTIME_PROP = 'SWG';
const RUNTIME_LEGACY_PROP = 'SUBSCRIPTIONS'; // MIGRATE

/**
 * Reference to the runtime, for testing.
 */
let runtimeInstance: Runtime;

/**
 * Returns runtime for testing if available. Throws if the runtime is not
 * initialized yet.
 *
 * Visible for testing.
 */
export function getRuntime(): Runtime {
  assert(runtimeInstance, 'not initialized yet');
  return runtimeInstance;
}

/**
 * Installs SwG runtime.
 */
export function installRuntime(win: Window): void {
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
   */
  async function callWhenRuntimeIsReady(
    callback: (api: SubscriptionsInterface) => void
  ): Promise<void> {
    if (!callback) {
      return;
    }

    // Wait for next event loop.
    // This helps ensure an ideal execution order for callbacks.
    await 0;

    callback(publicRuntime);
  }

  // Queue up any callbacks the publication might have provided.
  const waitingCallbacks = ([] as ((api: Subscriptions) => void)[]).concat(
    win[RUNTIME_PROP],
    win[RUNTIME_LEGACY_PROP]
  );
  for (const waitingCallback of waitingCallbacks) {
    callWhenRuntimeIsReady(waitingCallback);
  }

  // If any more callbacks are `push`ed to the global SwG variables,
  // they'll be queued up to receive the SwG runtime when it's ready.
  (win[RUNTIME_PROP] as {}) = (win[RUNTIME_LEGACY_PROP] as {}) = {
    push: callWhenRuntimeIsReady,
  };

  // Set variable for testing.
  runtimeInstance = runtime;

  // Kick off subscriptions flow.
  runtime.startSubscriptionsFlowIfNeeded();
}

export class Runtime implements SubscriptionsInterface {
  private productOrPublicationId_: string | null = null;
  private startedConfiguringRuntime_ = false;
  private configuredRuntimeResolver_:
    | ((runtime: ConfiguredRuntime | Promise<ConfiguredRuntime>) => void)
    | null = null;
  private pageConfigResolver_: PageConfigResolver | null = null;

  private readonly creationTimestamp_: number;
  private readonly doc_: DocInterface;
  private readonly config_: Config = {};
  private readonly configuredRuntimePromise_: Promise<ConfiguredRuntime>;
  private readonly buttonApi_: ButtonApi;

  constructor(private readonly win_: Window) {
    this.creationTimestamp_ = Date.now();

    this.doc_ = resolveDoc(win_);

    this.configuredRuntimePromise_ = new Promise((resolve) => {
      this.configuredRuntimeResolver_ = resolve;
    });

    this.buttonApi_ = new ButtonApi(this.doc_, this.configuredRuntimePromise_);
    this.buttonApi_.init(); // Injects swg-button stylesheet.
  }

  /**
   * Returns a promise for the configured runtime. If requested, also begins
   * configuring the runtime.
   *
   * NOTE: Begininning runtime configuration prematurely can interfere with
   * publisher integrations (b/283281215). This method should only be called
   * with `startConfiguringRuntime=true` when immediate configuration is
   * required, after integrators have had an opportunity to begin configuration
   * using the `init` method.
   *
   * @param startConfiguringRuntime Whether to begin configuring the runtime.
   * @return A promise resolving to the configured runtime.
   */
  private async configured_(
    startConfiguringRuntime: boolean
  ): Promise<ConfiguredRuntime> {
    if (!startConfiguringRuntime) {
      // Configuration isn't necessary yet, so let's wait.
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
      /* integr */ {
        configPromise: this.configuredRuntimePromise_.then(),
      },
      this.config_,
      {
        lang: getLanguageCodeFromElement(this.doc_.getRootElement()),
        forceLangInIframes: true,
      },
      this.creationTimestamp_
    );
    this.configuredRuntimeResolver_!(configuredRuntime);

    return configuredRuntime;
  }

  /**
   * Creates or resolves the page config.
   */
  private async determinePageConfig_(): Promise<PageConfig> {
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
   */
  startSubscriptionsFlowIfNeeded(): Promise<void> | null {
    const control = getControlFlag(this.win_.document);
    debugLog(control, 'mode');
    if (control == 'manual') {
      // "Skipping automatic start because control flag is set to "manual".
      return null;
    }
    return this.start();
  }

  init(productOrPublicationId: string): void {
    if (this.startedConfiguringRuntime_) {
      // Throw and log an error if the runtime has already been configured.
      const error = new Error('already configured');
      this.configured_(false).then((configuredRuntime) => {
        configuredRuntime.jserror().error(error);
      });
      throw error;
    }

    this.productOrPublicationId_ = productOrPublicationId;

    // Process the page's config. Then start logging events in the
    // analytics service.
    this.configured_(true).then((configuredRuntime) => {
      configuredRuntime.analytics().setReadyForLogging();
      configuredRuntime.analytics().start();
    });
  }

  async configure(config: Config): Promise<void> {
    // Accumulate config for startup.
    Object.assign(this.config_, config);
    const runtime = await this.configured_(false);
    return runtime.configure(config);
  }

  async start(): Promise<void> {
    this.logStartApiEvent_();
    const runtime = await this.configured_(true);
    return runtime.start();
  }

  async reset(): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.reset();
  }

  async clear(): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.clear();
  }

  async getEntitlements(
    params?: GetEntitlementsParamsExternalDef
  ): Promise<Entitlements> {
    const runtime = await this.configured_(true);
    return runtime.getEntitlements(params);
  }

  async setOnEntitlementsResponse(
    callback: (entitlements: Promise<Entitlements>) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnEntitlementsResponse(callback);
  }

  async getOffers(options?: {productId?: string}): Promise<Offer[]> {
    const runtime = await this.configured_(true);
    return runtime.getOffers(options);
  }

  async showOffers(options?: OffersRequest): Promise<void> {
    this.logShowOffersApiEvent_();
    const runtime = await this.configured_(true);
    return runtime.showOffers(options);
  }

  async showUpdateOffers(options?: OffersRequest): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.showUpdateOffers(options);
  }

  async showSubscribeOption(options?: OffersRequest): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.showSubscribeOption(options);
  }

  async showAbbrvOffer(options?: OffersRequest): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.showAbbrvOffer(options);
  }

  async showContributionOptions(options?: OffersRequest): Promise<void> {
    this.logShowContributionOptionsApiEvent_();
    const runtime = await this.configured_(true);
    return runtime.showContributionOptions(options);
  }

  async waitForSubscriptionLookup(
    accountPromise: Promise<unknown>
  ): Promise<unknown> {
    const runtime = await this.configured_(true);
    return runtime.waitForSubscriptionLookup(accountPromise);
  }

  async setOnNativeSubscribeRequest(callback: () => void): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnNativeSubscribeRequest(callback);
  }

  async setOnSubscribeResponse(
    callback: (subscribeResponse: Promise<SubscribeResponse>) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnSubscribeResponse(callback);
  }

  async subscribe(sku: string): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.subscribe(sku);
  }

  async updateSubscription(
    subscriptionRequest: SubscriptionRequest
  ): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.updateSubscription(subscriptionRequest);
  }

  async setOnContributionResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnContributionResponse(callback);
  }

  async setOnPaymentResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnPaymentResponse(callback);
  }

  async contribute(
    skuOrSubscriptionRequest: string | SubscriptionRequest
  ): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.contribute(skuOrSubscriptionRequest);
  }

  async completeDeferredAccountCreation(
    options?: DeferredAccountCreationRequest | null
  ): Promise<DeferredAccountCreationResponse> {
    const runtime = await this.configured_(true);
    return runtime.completeDeferredAccountCreation(options);
  }

  async setOnLoginRequest(
    callback: (loginRequest: LoginRequest) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnLoginRequest(callback);
  }

  async triggerLoginRequest(request: LoginRequest): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.triggerLoginRequest(request);
  }

  async setOnLinkComplete(callback: () => void): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnLinkComplete(callback);
  }

  async linkAccount(params?: {ampReaderId?: string}): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.linkAccount(params);
  }

  async setOnFlowStarted(
    callback: (params: {flow: string; data: object}) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnFlowStarted(callback);
  }

  async setOnFlowCanceled(
    callback: (params: {flow: string; data: object}) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    return runtime.setOnFlowCanceled(callback);
  }

  async saveSubscription(
    saveSubscriptionRequestCallback: SaveSubscriptionRequestCallback
  ): Promise<boolean> {
    const runtime = await this.configured_(true);
    return runtime.saveSubscription(saveSubscriptionRequestCallback);
  }

  async showLoginPrompt(): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.showLoginPrompt();
  }

  async showLoginNotification(): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.showLoginNotification();
  }

  createButton(
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): Element {
    return this.buttonApi_.create(optionsOrCallback, callback);
  }

  async attachSmartButton(
    button: HTMLElement,
    optionsOrCallback: SmartButtonOptions | (() => void),
    callback?: () => void
  ): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.attachSmartButton(button, optionsOrCallback, callback);
  }

  attachButton(
    button: HTMLElement,
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): void {
    this.buttonApi_.attach(button, optionsOrCallback, callback);
  }

  async getPropensityModule(): Promise<PropensityApi> {
    const runtime = await this.configured_(true);
    return runtime.getPropensityModule();
  }

  async getLogger(): Promise<LoggerApi> {
    const runtime = await this.configured_(true);
    return runtime.getLogger();
  }

  async getEventManager(): Promise<ClientEventManagerApi> {
    const runtime = await this.configured_(true);
    return runtime.getEventManager();
  }

  private async logSwgEvent_(event: AnalyticsEvent): Promise<void> {
    const now = Date.now();
    const configuredRuntime = await this.configured_(true);
    const manager = await configuredRuntime.getEventManager();
    manager.logSwgEvent(event, false, null, now);
  }

  private logStartApiEvent_(): Promise<void> {
    return this.logSwgEvent_(AnalyticsEvent.EVENT_START_API);
  }

  private logShowOffersApiEvent_(): Promise<void> {
    return this.logSwgEvent_(AnalyticsEvent.EVENT_SHOW_OFFERS_API);
  }

  private logShowContributionOptionsApiEvent_(): Promise<void> {
    return this.logSwgEvent_(
      AnalyticsEvent.EVENT_SHOW_CONTRIBUTION_OPTIONS_API
    );
  }

  async setShowcaseEntitlement(
    entitlement: PublisherEntitlement
  ): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.setShowcaseEntitlement(entitlement);
  }

  async consumeShowcaseEntitlementJwt(
    showcaseEntitlementJwt: string,
    onCloseDialog?: () => void | null
  ): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.consumeShowcaseEntitlementJwt(
      showcaseEntitlementJwt,
      onCloseDialog
    );
  }

  showBestAudienceAction(): void {
    warn('Not implemented yet');
  }

  async setPublisherProvidedId(publisherProvidedId: string): Promise<void> {
    const runtime = await this.configured_(true);
    return runtime.setPublisherProvidedId(publisherProvidedId);
  }

  async linkSubscription(
    request: LinkSubscriptionRequest
  ): Promise<LinkSubscriptionResult> {
    const runtime = await this.configured_(true);
    return runtime.linkSubscription(request);
  }

  async getAvailableInterventions(): Promise<AvailableIntervention[] | null> {
    const runtime = await this.configured_(true);
    return runtime.getAvailableInterventions();
  }
}

export class ConfiguredRuntime implements Deps, SubscriptionsInterface {
  private lastOffersFlow_: OffersFlow | null = null;
  private lastContributionsFlow_: ContributionsFlow | null = null;
  private publisherProvidedId_?: string;

  private readonly eventManager_: ClientEventManager;
  private readonly doc_: DocInterface;
  private readonly win_: Window;
  private readonly config_: Config;
  private readonly pageConfig_: PageConfig;
  private readonly documentParsed_: Promise<void>;
  private readonly jserror_: JsError;
  private readonly fetcher_: FetcherInterface;
  private readonly storage_: Storage;
  private readonly dialogManager_: DialogManager;
  private readonly callbacks_: Callbacks;
  private readonly googleAnalyticsEventListener_?: GoogleAnalyticsEventListener;
  private readonly activityPorts_: ActivityPorts;
  private readonly analyticsService_: AnalyticsService;
  private readonly payClient_: PayClient;
  private readonly logger_: Logger;
  private readonly entitlementsManager_: EntitlementsManager;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly propensityModule_: Propensity;
  private readonly offersApi_: OffersApi;
  private readonly buttonApi_: ButtonApi;

  constructor(
    winOrDoc: Window | Document | DocInterface,
    pageConfig: PageConfig,
    integr:
      | {
          fetcher?: FetcherInterface;
          configPromise?: Promise<void>;
          enableGoogleAnalytics?: boolean;
          enableDefaultMeteringHandler?: boolean;
        }
      | undefined,
    config?: Config,
    clientOptions?: {
      lang?: string;
      theme?: ClientTheme;
      forceLangInIframes?: boolean;
    },
    private readonly creationTimestamp_ = 0
  ) {
    integr = integr || {};
    integr.configPromise ||= Promise.resolve();

    this.eventManager_ = new ClientEventManager(integr.configPromise);

    this.doc_ = resolveDoc(winOrDoc);

    this.win_ = this.doc_.getWin();

    this.config_ = defaultConfig();

    if (config) {
      this.configure_(config);
    }

    this.pageConfig_ = pageConfig;

    this.documentParsed_ = this.doc_.whenReady();

    this.jserror_ = new JsError(this.doc_);

    this.fetcher_ = integr.fetcher || new XhrFetcher(this.win_);

    this.storage_ = new Storage(this.win_, this.pageConfig_);

    this.callbacks_ = new Callbacks();

    // Start listening to Google Analytics events, if applicable.
    if (integr.enableGoogleAnalytics) {
      this.googleAnalyticsEventListener_ = new GoogleAnalyticsEventListener(
        this
      );
      this.googleAnalyticsEventListener_.start();
    }

    // WARNING: Deps ('this') is being progressively defined below.
    // Constructors will crash if they rely on something that doesn't exist yet.
    this.activityPorts_ = new ActivityPorts(this);

    this.analyticsService_ = new AnalyticsService(this);

    this.payClient_ = new PayClient(this);

    this.logger_ = new Logger(this);

    this.entitlementsManager_ = new EntitlementsManager(
      this.win_,
      this.pageConfig_,
      this.fetcher_,
      this, // See note about 'this' above
      integr.enableDefaultMeteringHandler || false
    );

    this.dialogManager_ = new DialogManager(this.doc_);

    this.clientConfigManager_ = new ClientConfigManager(
      this, // See note about 'this' above
      pageConfig.getPublicationId(),
      this.fetcher_,
      clientOptions
    );

    this.propensityModule_ = new Propensity(
      this.win_,
      this, // See note about 'this' above
      this.fetcher_
    );

    // ALL CLEAR: Deps definition now complete.
    this.eventManager_.logSwgEvent(AnalyticsEvent.IMPRESSION_PAGE_LOAD, false);

    this.offersApi_ = new OffersApi(this.pageConfig_, this.fetcher_);

    this.buttonApi_ = new ButtonApi(this.doc_, Promise.resolve(this));

    const preconnect = new Preconnect(this.win_.document);

    preconnect.prefetch(`${ASSETS}/loader.svg`);
    preconnect.preconnect('https://www.gstatic.com/');
    preconnect.preconnect('https://www.google.com/');
    LinkCompleteFlow.configurePending(this);
    PayCompleteFlow.configurePending(this);

    injectStyleSheet(this.doc_, DIALOG_CSS);

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

  creationTimestamp(): number {
    return this.creationTimestamp_;
  }

  doc(): DocInterface {
    return this.doc_;
  }

  win(): Window {
    return this.win_;
  }

  pageConfig(): PageConfig {
    return this.pageConfig_;
  }

  jserror(): JsError {
    return this.jserror_;
  }

  activities(): ActivityPorts {
    return this.activityPorts_;
  }

  payClient(): PayClient {
    return this.payClient_;
  }

  dialogManager(): DialogManager {
    return this.dialogManager_;
  }

  entitlementsManager(): EntitlementsManager {
    return this.entitlementsManager_;
  }

  callbacks(): Callbacks {
    return this.callbacks_;
  }

  storage(): Storage {
    return this.storage_;
  }

  clientConfigManager(): ClientConfigManager {
    return this.clientConfigManager_;
  }

  analytics(): AnalyticsService {
    return this.analyticsService_;
  }

  init(): void {
    // Implemented by the `Runtime` class.
  }

  configure(config: Config): void {
    // Indirected for constructor testing.
    this.configure_(config);
  }

  private configure_(config: Config): void {
    // Validate first.
    let error = '';
    for (const key in config) {
      const value = (config as {[key: string]: unknown})[key];
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
          for (const experiment of value as string[]) {
            setExperiment(this.win_, experiment, true);
          }
          if (this.analytics()) {
            // If analytics service isn't set up yet, then it will get the
            // experiments later.
            this.analytics().addLabels(value as string[]);
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
            error =
              'enableSwgAnalytics must be a boolean, type: ' + typeof value;
          }
          break;
        case 'enablePropensity':
          if (!isBoolean(value)) {
            error = 'enablePropensity must be a boolean, type: ' + typeof value;
          }
          break;
        case 'skipAccountCreationScreen':
          if (!isBoolean(value)) {
            error =
              'skipAccountCreationScreen must be a boolean, type: ' +
              typeof value;
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
        case 'paySwgVersion':
          if (typeof value !== 'string') {
            error = 'paySwgVersion must be a string, type: ' + typeof value;
            break;
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

  config(): Config {
    return this.config_;
  }

  reset(): void {
    this.entitlementsManager_.reset();
    this.closeDialog();
  }

  clear(): void {
    this.entitlementsManager_.clear();
    this.closeDialog();
  }

  /** Close dialog. */
  closeDialog(): void {
    this.dialogManager_.completeAll();
  }

  start(): Promise<void> | void {
    // No need to run entitlements without a product or for an unlocked page.
    if (!this.pageConfig_.getProductId() || !this.pageConfig_.isLocked()) {
      return Promise.resolve();
    }
    this.getEntitlements();
  }

  async getEntitlements(
    params?: GetEntitlementsParamsExternalDef
  ): Promise<Entitlements> {
    if (params?.publisherProvidedId) {
      params.publisherProvidedId = this.publisherProvidedId_;
    }
    const entitlementsPromise =
      this.entitlementsManager_.getEntitlements(params);

    // Populate the client config. Wait for the entitlements since the
    // config is available in the /article response.
    this.clientConfigManager().fetchClientConfig(
      /* readyPromise= */ entitlementsPromise
    );

    const entitlements = await entitlementsPromise;

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

    const experiment = await this.entitlementsManager_
      .getExperimentConfigFlags()
      .then((flags) =>
        flags.includes(
          ArticleExperimentFlags.BACKGROUND_CLICK_BEHAVIOR_EXPERIMENT
        )
      );
    this.dialogManager_.setEnableBackgroundClickExperiment(experiment);

    return entitlements.clone();
  }

  setOnEntitlementsResponse(
    callback: (entitlements: Promise<Entitlements>) => void
  ): void {
    this.callbacks_.setOnEntitlementsResponse(callback);
  }

  getOffers(options?: {productId?: string}): Promise<Offer[]> {
    return this.offersApi_.getOffers(options && options.productId);
  }

  async showOffers(options?: OffersRequest): Promise<void> {
    await this.documentParsed_;
    const errorMessage =
      'The showOffers() method cannot be used to update a subscription. ' +
      'Use the showUpdateOffers() method instead.';
    assert(options ? !options['oldSku'] : true, errorMessage);
    this.lastOffersFlow_ = new OffersFlow(this, options);
    return this.lastOffersFlow_.start();
  }

  async showUpdateOffers(options?: OffersRequest): Promise<void> {
    await this.documentParsed_;
    const errorMessage =
      'The showUpdateOffers() method cannot be used for new subscribers. ' +
      'Use the showOffers() method instead.';
    assert(options ? !!options['oldSku'] : false, errorMessage);
    const flow = new OffersFlow(this, options);
    return flow.start();
  }

  async showSubscribeOption(options?: OffersRequest): Promise<void> {
    await this.documentParsed_;
    const flow = new SubscribeOptionFlow(this, options);
    return flow.start();
  }

  async showAbbrvOffer(options?: OffersRequest): Promise<void> {
    await this.documentParsed_;
    const flow = new AbbrvOfferFlow(this, options);
    return flow.start();
  }

  async showContributionOptions(options?: OffersRequest): Promise<void> {
    await this.documentParsed_;
    this.lastContributionsFlow_ = new ContributionsFlow(this, options);
    return this.lastContributionsFlow_.start();
  }

  /**
   * Get the last contribution offers flow.
   */
  getLastContributionsFlow(): ContributionsFlow | null {
    return this.lastContributionsFlow_;
  }

  async waitForSubscriptionLookup(
    accountPromise: Promise<unknown>
  ): Promise<unknown> {
    await this.documentParsed_;
    const wait = new WaitForSubscriptionLookupApi(this, accountPromise);
    return wait.start();
  }

  setOnLoginRequest(callback: (loginRequest: LoginRequest) => void): void {
    this.callbacks_.setOnLoginRequest(callback);
  }

  triggerLoginRequest(request: LoginRequest): void {
    this.callbacks_.triggerLoginRequest(request);
  }

  setOnLinkComplete(callback: () => void): void {
    this.callbacks_.setOnLinkComplete(callback);
  }

  async linkAccount(params?: {ampReaderId?: string}): Promise<void> {
    await this.documentParsed_;
    return new LinkbackFlow(this).start(params);
  }

  async saveSubscription(
    saveSubscriptionRequestCallback: SaveSubscriptionRequestCallback
  ): Promise<boolean> {
    await this.documentParsed_;
    return await new LinkSaveFlow(
      this,
      saveSubscriptionRequestCallback
    ).start();
  }

  async showLoginPrompt(): Promise<void> {
    await this.documentParsed_;
    return new LoginPromptApi(this).start();
  }

  async showLoginNotification(): Promise<void> {
    await this.documentParsed_;
    return new LoginNotificationApi(this).start();
  }

  setOnNativeSubscribeRequest(callback: () => void): void {
    this.callbacks_.setOnSubscribeRequest(callback);
  }

  setOnSubscribeResponse(
    callback: (subscribeResponse: Promise<SubscribeResponse>) => void
  ): void {
    this.callbacks_.setOnSubscribeResponse(callback);
  }

  setOnPaymentResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): void {
    this.callbacks_.setOnPaymentResponse(callback);
  }

  async subscribe(sku: string): Promise<void> {
    const errorMessage =
      'The subscribe() method can only take a sku as its parameter; ' +
      'for subscription updates please use the updateSubscription() method';
    assert(typeof sku === 'string', errorMessage);
    await this.documentParsed_;
    return new PayStartFlow(this, {'skuId': sku}).start();
  }

  async updateSubscription(
    subscriptionRequest: SubscriptionRequest
  ): Promise<void> {
    const errorMessage =
      'The updateSubscription() method should be used for subscription ' +
      'updates; for new subscriptions please use the subscribe() method';
    assert(subscriptionRequest?.oldSku, errorMessage);
    await this.documentParsed_;
    return new PayStartFlow(this, subscriptionRequest).start();
  }

  setOnContributionResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): void {
    this.callbacks_.setOnContributionResponse(callback);
  }

  async contribute(
    skuOrSubscriptionRequest: string | SubscriptionRequest
  ): Promise<void> {
    const request =
      typeof skuOrSubscriptionRequest == 'string'
        ? {'skuId': skuOrSubscriptionRequest}
        : skuOrSubscriptionRequest;
    await this.documentParsed_;
    return new PayStartFlow(this, request, ProductType.UI_CONTRIBUTION).start();
  }

  async completeDeferredAccountCreation(
    options: DeferredAccountCreationRequest | null = null
  ): Promise<DeferredAccountCreationResponse> {
    await this.documentParsed_;
    return new DeferredAccountFlow(this, options).start();
  }

  setOnFlowStarted(
    callback: (params: {flow: string; data: object}) => void
  ): void {
    this.callbacks_.setOnFlowStarted(callback);
  }

  setOnFlowCanceled(
    callback: (params: {flow: string; data: object}) => void
  ): void {
    this.callbacks_.setOnFlowCanceled(callback);
  }

  createButton(
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): Element {
    // This is a minor duplication to allow this code to be sync.
    return this.buttonApi_.create(optionsOrCallback, callback);
  }

  attachButton(
    button: HTMLElement,
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): void {
    // This is a minor duplication to allow this code to be sync.
    this.buttonApi_.attach(button, optionsOrCallback, callback);
  }

  attachSmartButton(
    button: HTMLElement,
    optionsOrCallback: SmartButtonOptions | (() => void),
    callback?: () => void
  ): void {
    this.buttonApi_.attachSmartButton(
      this,
      button,
      optionsOrCallback,
      callback
    );
  }

  getPropensityModule(): Promise<PropensityApi> {
    return Promise.resolve(this.propensityModule_);
  }

  /**
   * This one exists as an internal helper so SwG logging doesn't require a promise.
   */
  eventManager(): ClientEventManager {
    return this.eventManager_;
  }

  /**
   * Get the last subscription offers flow.
   */
  getLastOffersFlow(): OffersFlow | null {
    return this.lastOffersFlow_;
  }

  /**
   * This one exists as a public API so publishers can subscribe to SwG events.
   */
  getEventManager(): Promise<ClientEventManager> {
    return Promise.resolve(this.eventManager_);
  }

  getLogger(): Promise<Logger> {
    return Promise.resolve(this.logger_);
  }

  setShowcaseEntitlement(entitlement: PublisherEntitlement): Promise<void> {
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

    const eventsToLog = showcaseEventToAnalyticsEvents(entitlement.entitlement);
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

  consumeShowcaseEntitlementJwt(
    showcaseEntitlementJwt: string,
    onCloseDialog?: () => void | null
  ): void {
    const entitlements = this.entitlementsManager().parseEntitlements({
      signedEntitlements: showcaseEntitlementJwt,
    });
    entitlements.consume(onCloseDialog);
  }

  showBestAudienceAction(): void {
    warn('Not implemented yet');
  }

  setPublisherProvidedId(publisherProvidedId: string): void {
    this.publisherProvidedId_ = publisherProvidedId;
  }

  async linkSubscription(
    linkSubscriptionRequest: LinkSubscriptionRequest
  ): Promise<LinkSubscriptionResult> {
    await this.documentParsed_;
    return new SubscriptionLinkingFlow(this).start(linkSubscriptionRequest);
  }

  async getAvailableInterventions(): Promise<AvailableIntervention[] | null> {
    await this.getEntitlements();
    return this.entitlementsManager().getAvailableInterventions();
  }
}

function createPublicRuntime(runtime: Runtime): SubscriptionsInterface {
  return {
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
    getAvailableInterventions: runtime.getAvailableInterventions.bind(runtime),
  };
}
