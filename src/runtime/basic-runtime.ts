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

import {ActivityPortDef, ActivityPorts} from '../components/activities';
import {AnalyticsService} from './analytics-service';
import {AudienceActionLocalFlow} from './audience-action-local-flow';
import {AudienceActivityEventListener} from './audience-activity-listener';
import {AutoPromptManager} from './auto-prompt-manager';
import {
  AutoPromptType,
  BasicSubscriptions,
  ClientOptions,
  ContentType,
} from '../api/basic-subscriptions';
import {ButtonApi, ButtonAttributeValues} from './button-api';
import {Callbacks} from './callbacks';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Config} from '../api/subscriptions';
import {ConfiguredRuntime} from './runtime';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {Doc, resolveDoc} from '../model/doc';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {Fetcher, XhrFetcher} from './fetcher';
import {JsError} from './jserror';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {PageConfigWriter} from '../model/page-config-writer';
import {PayClient} from './pay-client';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {SubscribeResponse} from '../api/subscribe-response';
import {Toast} from '../ui/toast';
import {acceptPortResultData} from '../utils/activity-utils';
import {assert} from '../utils/log';
import {feArgs, feOrigin, feUrl} from './services';
import {msg} from '../utils/i18n';

const BASIC_RUNTIME_PROP = 'SWG_BASIC';
const BUTTON_ATTRIUBUTE = 'swg-standard-button';
const CHECK_ENTITLEMENTS_REQUEST_ID = 'CHECK_ENTITLEMENTS';

/**
 * Reference to the runtime, for testing.
 */
let basicRuntimeInstance: BasicRuntime;

/**
 * Returns runtime for testing if available. Throws if the runtime is not
 * initialized yet.
 */
export function getBasicRuntime(): BasicRuntime {
  assert(basicRuntimeInstance, 'not initialized yet');
  return basicRuntimeInstance;
}

/**
 * Installs runtime for SwG Basic.
 */
export function installBasicRuntime(win: Window): void {
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
   */
  async function callWhenRuntimeIsReady(
    callback: (runtime: BasicSubscriptions) => void
  ): Promise<void> {
    if (!callback) {
      return;
    }

    // Wait for next event loop.
    // This helps ensure an ideal execution order for callbacks.
    await 0;

    callback(publicBasicRuntime);
  }

  // Queue up any callbacks the publication might have provided.
  const waitingCallbacks = ([] as ((api: BasicSubscriptions) => void)[]).concat(
    win[BASIC_RUNTIME_PROP]
  );
  for (const waitingCallback of waitingCallbacks) {
    callWhenRuntimeIsReady(waitingCallback);
  }

  // If any more callbacks are `push`ed to the global SwG Basic variables,
  // they'll be queued up to receive the SwG Basic runtime when it's ready.
  (win[BASIC_RUNTIME_PROP] as {}) = {
    push: callWhenRuntimeIsReady,
  };

  // Set variable for testing.
  basicRuntimeInstance = basicRuntime;

  // Automatically set up buttons already on the page.
  basicRuntime.setupButtons();
}

export class BasicRuntime implements BasicSubscriptions {
  private clientOptions_?: ClientOptions;
  private committed_ = false;
  private configuredResolver_:
    | ((
        runtime: ConfiguredBasicRuntime | Promise<ConfiguredBasicRuntime>
      ) => void)
    | null = null;
  private pageConfigWriter_: PageConfigWriter | null = null;
  private pageConfigResolver_: PageConfigResolver | null = null;
  private enableDefaultMeteringHandler_ = true;
  private publisherProvidedId_?: string;

  private readonly creationTimestamp_: number;
  private readonly doc_: Doc;
  private readonly config_: Config = {};
  private readonly configuredPromise_: Promise<ConfiguredBasicRuntime>;

  constructor(win: Window) {
    this.creationTimestamp_ = Date.now();

    this.doc_ = resolveDoc(win);

    this.configuredPromise_ = new Promise((resolve) => {
      this.configuredResolver_ = resolve;
    });
  }

  private configured_(commit: boolean): Promise<ConfiguredBasicRuntime> {
    this.config_.publisherProvidedId = this.publisherProvidedId_;
    if (!this.committed_ && commit && !this.pageConfigWriter_) {
      this.committed_ = true;

      this.pageConfigResolver_ = new PageConfigResolver(this.doc_);
      this.pageConfigResolver_.resolveConfig().then(
        (pageConfig) => {
          this.pageConfigResolver_ = null;
          this.configuredResolver_!(
            new ConfiguredBasicRuntime(
              this.doc_,
              pageConfig,
              /* integr */ {
                configPromise: this.configuredPromise_.then(),
                enableDefaultMeteringHandler:
                  this.enableDefaultMeteringHandler_,
              },
              this.config_,
              this.clientOptions_,
              this.creationTimestamp_
            )
          );
          this.configuredResolver_ = null;
        },
        (reason: Error) => {
          this.configuredResolver_!(Promise.reject(reason));
          this.configuredResolver_ = null;
        }
      );
    } else if (commit && this.pageConfigResolver_) {
      this.pageConfigResolver_.check();
    }
    return this.configuredPromise_;
  }

  private async writePageConfig_(markupValues: {
    type: string | Array<string>;
    isAccessibleForFree: boolean;
    isPartOfType: string | Array<string>;
    isPartOfProductId: string;
  }): Promise<void> {
    this.pageConfigWriter_ = new PageConfigWriter(this.doc_);
    await this.pageConfigWriter_.writeConfigWhenReady(markupValues);
    this.pageConfigWriter_ = null;
    this.configured_(true);
  }

  init({
    type,
    isAccessibleForFree,
    isPartOfType,
    isPartOfProductId,
    clientOptions,
    autoPromptType,
    alwaysShow = false,
    disableDefaultMeteringHandler = false,
    publisherProvidedId,
  }: {
    type: string | string[];
    isAccessibleForFree?: boolean;
    isPartOfType: string | string[];
    isPartOfProductId: string;
    autoPromptType?: AutoPromptType;
    clientOptions?: ClientOptions;
    alwaysShow?: boolean;
    disableDefaultMeteringHandler?: boolean;
    publisherProvidedId?: string;
  }): void {
    this.enableDefaultMeteringHandler_ = !disableDefaultMeteringHandler;
    this.publisherProvidedId_ = publisherProvidedId;
    const isOpenAccess = this.isOpenAccessProductId_(isPartOfProductId);

    this.writePageConfig_({
      type,
      isAccessibleForFree: isAccessibleForFree ?? isOpenAccess,
      isPartOfType,
      isPartOfProductId,
    });

    this.clientOptions_ = Object.assign({}, clientOptions, {
      forceLangInIframes: true,
    });

    let isClosable = isAccessibleForFree;
    // Only default isClosable to true if product is openaccess, else leave undefined.
    if (isOpenAccess) {
      isClosable ??= true;
    }
    this.setupAndShowAutoPrompt({
      autoPromptType,
      alwaysShow,
      isClosable,
      contentType: this.getContentType_(isAccessibleForFree ?? isOpenAccess),
    });
    this.setOnLoginRequest();
    this.processEntitlements();
  }

  async setOnEntitlementsResponse(
    callback: (entitlementsPromise: Promise<Entitlements>) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    runtime.setOnEntitlementsResponse(callback);
  }

  async setOnPaymentResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): Promise<void> {
    const runtime = await this.configured_(false);
    runtime.setOnPaymentResponse(callback);
  }

  async setOnLoginRequest(): Promise<void> {
    const runtime = await this.configured_(false);
    runtime.setOnLoginRequest();
  }

  async setupAndShowAutoPrompt(options: {
    autoPromptType?: AutoPromptType;
    alwaysShow?: boolean;
    isClosable?: boolean;
    contentType: ContentType;
  }): Promise<void> {
    const runtime = await this.configured_(false);
    runtime.setupAndShowAutoPrompt(options);
  }

  async dismissSwgUI(): Promise<void> {
    const runtime = await this.configured_(false);
    runtime.dismissSwgUI();
  }

  /**
   * Sets up all the buttons on the page with attribute
   * 'swg-standard-button:subscription' or 'swg-standard-button:contribution'.
   */
  async setupButtons(): Promise<void> {
    const runtime = await this.configured_(false);
    runtime.setupButtons();
  }

  /** Process result from checkentitlements view */
  async processEntitlements(): Promise<void> {
    const runtime = await this.configured_(false);
    runtime.processEntitlements();
  }

  /**
   * Checks whether productId is 'openaccess'.
   */
  isOpenAccessProductId_(productId: string): boolean {
    return productId.endsWith(':openaccess');
  }

  /**
   * Returns ContentType Enum string from isLocked page config status.
   */
  getContentType_(isOpenAccess: boolean): ContentType {
    return isOpenAccess ? ContentType.OPEN : ContentType.CLOSED;
  }
}

export class ConfiguredBasicRuntime implements Deps, BasicSubscriptions {
  private audienceActivityEventListener_?: AudienceActivityEventListener;

  private readonly doc_: Doc;
  private readonly win_: Window;
  private readonly fetcher_: Fetcher;
  private readonly configuredClassicRuntime_: ConfiguredRuntime;
  private readonly autoPromptManager_: AutoPromptManager;
  private readonly buttonApi_: ButtonApi;

  constructor(
    winOrDoc: Window | Document | Doc,
    pageConfig: PageConfig,
    integr: {
      fetcher?: Fetcher;
      configPromise?: Promise<void>;
      enableDefaultMeteringHandler?: boolean;
      enableGoogleAnalytics?: boolean;
    } = {},
    config?: Config,
    clientOptions?: ClientOptions,
    private readonly creationTimestamp_ = 0
  ) {
    this.doc_ = resolveDoc(winOrDoc);

    this.win_ = this.doc_.getWin();

    integr.configPromise ||= Promise.resolve();
    integr.fetcher = integr.fetcher || new XhrFetcher(this.win_);
    integr.enableGoogleAnalytics = true;

    this.fetcher_ = integr.fetcher;

    this.configuredClassicRuntime_ = new ConfiguredRuntime(
      winOrDoc,
      pageConfig,
      integr,
      config,
      clientOptions,
      creationTimestamp_
    );

    // Do not show toast in swgz.
    this.entitlementsManager().blockNextToast();

    // Enable Google metering in basic runtime by default;
    if (pageConfig.isLocked()) {
      this.entitlementsManager().enableMeteredByGoogle();
    }

    // Handle clicks on the Metering Toast's "Subscribe" button.
    this.setOnOffersFlowRequest_(() => {
      // Close the current dialog to allow a new one with potentially different configurations
      // to take over the screen.
      this.dismissSwgUI();
      this.configuredClassicRuntime_.showOffers({isClosable: true});
    });

    // Fetches entitlements.
    this.configuredClassicRuntime_.start();

    // Fetch the client config.
    this.configuredClassicRuntime_.clientConfigManager().fetchClientConfig(
      // Wait on the entitlements to resolve before accessing the clientConfig
      this.configuredClassicRuntime_.getEntitlements()
    );

    // Start listening to Audience Activity events.
    this.audienceActivityEventListener_ = new AudienceActivityEventListener(
      this,
      this.fetcher_
    );
    this.audienceActivityEventListener_.start();

    this.autoPromptManager_ = new AutoPromptManager(
      this,
      this.configuredClassicRuntime_
    );

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

  creationTimestamp(): number {
    return this.creationTimestamp_;
  }

  doc(): Doc {
    return this.doc_;
  }

  win(): Window {
    return this.win_;
  }

  config(): Config {
    return this.configuredClassicRuntime_.config();
  }

  pageConfig(): PageConfig {
    return this.configuredClassicRuntime_.pageConfig();
  }

  activities(): ActivityPorts {
    return this.configuredClassicRuntime_.activities();
  }

  payClient(): PayClient {
    return this.configuredClassicRuntime_.payClient();
  }

  dialogManager(): DialogManager {
    return this.configuredClassicRuntime_.dialogManager();
  }

  entitlementsManager(): EntitlementsManager {
    return this.configuredClassicRuntime_.entitlementsManager();
  }

  callbacks(): Callbacks {
    return this.configuredClassicRuntime_.callbacks();
  }

  storage(): Storage {
    return this.configuredClassicRuntime_.storage();
  }

  analytics(): AnalyticsService {
    return this.configuredClassicRuntime_.analytics();
  }

  jserror(): JsError {
    return this.configuredClassicRuntime_.jserror();
  }

  eventManager(): ClientEventManager {
    return this.configuredClassicRuntime_.eventManager();
  }

  clientConfigManager(): ClientConfigManager {
    return this.configuredClassicRuntime_.clientConfigManager();
  }

  init(): void {
    // Implemented by the 'BasicRuntime' class.
  }

  setOnEntitlementsResponse(
    callback: (entitlementsPromise: Promise<Entitlements>) => void
  ): void {
    this.configuredClassicRuntime_.setOnEntitlementsResponse(callback);
  }

  setOnPaymentResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): void {
    this.configuredClassicRuntime_.setOnPaymentResponse(callback);
  }

  setOnLoginRequest(): void {
    this.configuredClassicRuntime_.setOnLoginRequest(() => {
      const publicationId = this.pageConfig().getPublicationId();
      const args = feArgs({
        'publicationId': publicationId,
      });

      this.activities().open(
        CHECK_ENTITLEMENTS_REQUEST_ID,
        feUrl('/checkentitlements', {
          'publicationId': publicationId,
        }),
        '_blank',
        args,
        {'width': 600, 'height': 600}
      );
    });
  }

  /** Process result from checkentitlements view */
  processEntitlements(): void {
    this.activities().onResult(
      CHECK_ENTITLEMENTS_REQUEST_ID,
      this.entitlementsResponseHandler.bind(this)
    );
  }

  /**
   * Handler function to process EntitlementsResponse.
   */
  async entitlementsResponseHandler(port: ActivityPortDef): Promise<void> {
    const response = (await acceptPortResultData(
      port,
      feOrigin(),
      /* requireOriginVerified */ true,
      /* requireSecureChannel */ false
    )) as {jwt?: string; usertoken?: string};

    const jwt = response['jwt'];
    if (jwt) {
      // If entitlements are returned, close the prompt
      const lastAudienceActionFlow =
        this.autoPromptManager_.getLastAudienceActionFlow();
      if (lastAudienceActionFlow instanceof AudienceActionLocalFlow) {
        lastAudienceActionFlow.close();
      } else {
        this.configuredClassicRuntime_.closeDialog();
      }

      // Also save the entitlements and user token
      this.entitlementsManager().pushNextEntitlements(jwt);
      const userToken = response['usertoken'];
      if (userToken) {
        this.storage().set(StorageKeys.USER_TOKEN, userToken, true);
      }

      // Show 'Signed in as abc@gmail.com' toast on the pub page.
      new Toast(
        this,
        feUrl('/toastiframe', {
          flavor: 'basic',
        })
      ).open();
    } else {
      // If no entitlements are returned, subscription/contribution offers or audience
      // action iframe will show a toast with label "no subscription/contribution found"
      const lastOffersFlow = this.configuredClassicRuntime_.getLastOffersFlow();
      if (lastOffersFlow) {
        lastOffersFlow.showNoEntitlementFoundToast();
        return;
      }

      const lastContributionsFlow =
        this.configuredClassicRuntime_.getLastContributionsFlow();
      if (lastContributionsFlow) {
        lastContributionsFlow.showNoEntitlementFoundToast();
        return;
      }

      const lastMeterFlow = this.entitlementsManager().getLastMeterToast();
      if (lastMeterFlow) {
        lastMeterFlow.showNoEntitlementFoundToast();
        return;
      }

      const lastAudienceActionFlow =
        this.autoPromptManager_.getLastAudienceActionFlow();
      if (lastAudienceActionFlow) {
        lastAudienceActionFlow.showNoEntitlementFoundToast();
        return;
      }

      // Fallback in case there is no active flow. This occurs when the entitlment check
      // runs as a redirect.
      const language = this.clientConfigManager().getLanguage();
      const customText = msg(
        SWG_I18N_STRINGS['NO_MEMBERSHIP_FOUND_LANG_MAP'],
        language
      )!;
      new Toast(
        this,
        feUrl('/toastiframe', {
          flavor: 'custom',
          customText,
        })
      ).open();
    }
  }

  setupAndShowAutoPrompt(options: {
    autoPromptType?: AutoPromptType;
    alwaysShow?: boolean;
    isClosable?: boolean;
    contentType: ContentType;
  }): Promise<void> {
    return this.autoPromptManager_.showAutoPrompt(options);
  }

  /** Dismiss displayed SwG UI */
  dismissSwgUI(): void {
    this.dialogManager().completeAll();
  }

  /**
   * Sets up all the buttons on the page with attribute
   * 'swg-standard-button:subscription' or 'swg-standard-button:contribution'.
   * Prompts are dismissible as they are triggered by user clicks (b/281122183).
   */
  async setupButtons(): Promise<void> {
    const enable = await this.clientConfigManager().shouldEnableButton();
    this.buttonApi_.attachButtonsWithAttribute(
      BUTTON_ATTRIUBUTE,
      [ButtonAttributeValues.SUBSCRIPTION, ButtonAttributeValues.CONTRIBUTION],
      {
        theme: this.clientConfigManager().getTheme(),
        lang: this.clientConfigManager().getLanguage(),
        enable: !!enable,
      },
      {
        [ButtonAttributeValues.SUBSCRIPTION]: () => {
          this.configuredClassicRuntime_.showOffers({
            isClosable: true,
          });
        },
        [ButtonAttributeValues.CONTRIBUTION]: () => {
          this.configuredClassicRuntime_.showContributionOptions({
            isClosable: true,
          });
        },
      }
    );
  }

  /**
   * Sets the callback when the offers flow is requested.
   */
  private setOnOffersFlowRequest_(callback: () => void): void {
    this.callbacks().setOnOffersFlowRequest(callback);
  }
}

/**
 * Creates and returns the public facing BasicSubscription object.
 */
function createPublicBasicRuntime(
  basicRuntime: BasicRuntime
): BasicSubscriptions {
  return {
    init: basicRuntime.init.bind(basicRuntime),
    setOnEntitlementsResponse:
      basicRuntime.setOnEntitlementsResponse.bind(basicRuntime),
    setOnPaymentResponse: basicRuntime.setOnPaymentResponse.bind(basicRuntime),
    setOnLoginRequest: basicRuntime.setOnLoginRequest.bind(basicRuntime),
    setupAndShowAutoPrompt:
      basicRuntime.setupAndShowAutoPrompt.bind(basicRuntime),
    dismissSwgUI: basicRuntime.dismissSwgUI.bind(basicRuntime),
  };
}
