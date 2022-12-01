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

import {AudienceActivityEventListener} from './audience-activity-listener';
import {AutoPromptManager} from './auto-prompt-manager';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ButtonApi, ButtonAttributeValues} from './button-api';
import {ConfiguredRuntime} from './runtime';
import {Constants} from '../utils/constants';
import {ExperimentFlags} from './experiment-flags';
import {PageConfigResolver} from '../model/page-config-resolver';
import {PageConfigWriter} from '../model/page-config-writer';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';
import {acceptPortResultData} from '../utils/activity-utils';
import {feArgs, feOrigin, feUrl} from './services';
import {isExperimentOn} from './experiments';
import {msg} from '../utils/i18n';
import {resolveDoc} from '../model/doc';

const BASIC_RUNTIME_PROP = 'SWG_BASIC';
const BUTTON_ATTRIUBUTE = 'swg-standard-button';
const CHECK_ENTITLEMENTS_REQUEST_ID = 'CHECK_ENTITLEMENTS';

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
  async function callWhenRuntimeIsReady(callback) {
    if (!callback) {
      return;
    }

    await basicRuntime.whenReady();
    callback(publicBasicRuntime);
  }

  // Queue up any callbacks the publication might have provided.
  const waitingCallbacks = [].concat(win[BASIC_RUNTIME_PROP]);
  for (const waitingCallback of waitingCallbacks) {
    callWhenRuntimeIsReady(waitingCallback);
  }

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

    /** @private {boolean} */
    this.enableDefaultMeteringHandler_ = true;

    /** @private {string|undefined} */
    this.publisherProvidedId_ = undefined;
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
    this.config_.publisherProvidedId = this.publisherProvidedId_;
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
              /* integr */ {
                configPromise: this.configuredPromise_,
                enableDefaultMeteringHandler:
                  this.enableDefaultMeteringHandler_,
              },
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
  }) {
    this.enableDefaultMeteringHandler_ = !disableDefaultMeteringHandler;
    this.pageConfigWriter_ = new PageConfigWriter(this.doc_);
    this.publisherProvidedId_ = publisherProvidedId;
    this.pageConfigWriter_
      .writeConfigWhenReady({
        type,
        isAccessibleForFree,
        isPartOfType,
        isPartOfProductId,
      })
      .then(() => {
        this.pageConfigWriter_ = null;
        this.configured_(true);
      });

    this.clientOptions_ = Object.assign({}, clientOptions, {
      forceLangInIframes: true,
    });
    this.setupAndShowAutoPrompt({
      autoPromptType,
      alwaysShow,
    });
    this.setOnLoginRequest();
    this.processEntitlements();
  }

  /** @override */
  async setOnEntitlementsResponse(callback) {
    const runtime = await this.configured_(false);
    runtime.setOnEntitlementsResponse(callback);
  }

  /** @override */
  async setOnPaymentResponse(callback) {
    const runtime = await this.configured_(false);
    runtime.setOnPaymentResponse(callback);
  }

  /** @override */
  async setOnLoginRequest() {
    const runtime = await this.configured_(false);
    runtime.setOnLoginRequest();
  }

  /** @override */
  async setupAndShowAutoPrompt(options) {
    const runtime = await this.configured_(false);
    runtime.setupAndShowAutoPrompt(options);
  }

  /** @override */
  async dismissSwgUI() {
    const runtime = await this.configured_(false);
    runtime.dismissSwgUI();
  }

  /** @override */
  linkSubscription(request) {
    return this.configured_(false).then((runtime) =>
      runtime.linkSubscription(request)
    );
  }

  /**
   * Sets up all the buttons on the page with attribute
   * 'swg-standard-button:subscription' or 'swg-standard-button:contribution'.
   */
  async setupButtons() {
    const runtime = await this.configured_(false);
    runtime.setupButtons();
  }

  /** Process result from checkentitlements view */
  async processEntitlements() {
    const runtime = await this.configured_(false);
    runtime.processEntitlements();
  }
}

/**
 * @implements  {../api/basic-subscriptions.BasicSubscriptions}
 * @implements {./deps.DepsDef}
 */
export class ConfiguredBasicRuntime {
  /**
   * @param {!Window|!Document|!../model/doc.Doc} winOrDoc
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {{
   *     fetcher: (!./fetcher.Fetcher|undefined),
   *     configPromise: (!Promise|undefined),
   *     enableDefaultMeteringHandler: (boolean|undefined),
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
    integr.enableGoogleAnalytics = true;
    integr.useArticleEndpoint = isExperimentOn(
      this.win_,
      ExperimentFlags.USE_ARTICLE_ENDPOINT
    );

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
      integr.useArticleEndpoint
        ? // Wait on the entitlements to resolve before accessing the clientConfig
          this.configuredClassicRuntime_.getEntitlements()
        : Promise.resolve()
    );

    // Start listening to Audience Activity events.
    if (
      isExperimentOn(
        this.doc_.getWin(),
        ExperimentFlags.LOGGING_AUDIENCE_ACTIVITY
      )
    ) {
      /** @private @const {!AudienceActivityEventListener} */
      this.audienceActivityEventListener_ = new AudienceActivityEventListener(
        this,
        this.fetcher_
      );
      this.audienceActivityEventListener_.start();
    }

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
  setOnLoginRequest() {
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
  processEntitlements() {
    this.activities().onResult(
      CHECK_ENTITLEMENTS_REQUEST_ID,
      this.entitlementsResponseHandler.bind(this)
    );
  }

  /**
   * Handler function to process EntitlementsResponse.
   * @param {!../components/activities.ActivityPortDef} port
   */
  async entitlementsResponseHandler(port) {
    const response = await acceptPortResultData(
      port,
      feOrigin(),
      /* requireOriginVerified */ true,
      /* requireSecureChannel */ false
    );

    const jwt = response['jwt'];
    if (jwt) {
      // If entitlements are returned, close the subscription/contribution offers iframe
      this.configuredClassicRuntime_.closeDialog();

      // Also save the entitlements and user token
      this.entitlementsManager().pushNextEntitlements(jwt);
      const userToken = response['usertoken'];
      if (userToken) {
        this.storage().set(Constants.USER_TOKEN, userToken, true);
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
      );
      new Toast(
        this,
        feUrl('/toastiframe', {
          flavor: 'custom',
          customText,
        })
      ).open();
    }
  }

  /** @override */
  setupAndShowAutoPrompt(options) {
    if (
      options.autoPromptType === AutoPromptType.SUBSCRIPTION ||
      options.autoPromptType == AutoPromptType.SUBSCRIPTION_LARGE
    ) {
      options.displayLargePromptFn = () => {
        this.configuredClassicRuntime_.showOffers({
          isClosable: !this.pageConfig().isLocked(),
        });
      };
    } else if (
      options.autoPromptType === AutoPromptType.CONTRIBUTION ||
      options.autoPromptType == AutoPromptType.CONTRIBUTION_LARGE
    ) {
      options.displayLargePromptFn = () => {
        this.configuredClassicRuntime_.showContributionOptions({
          isClosable: !this.pageConfig().isLocked(),
        });
      };
    }
    return this.autoPromptManager_.showAutoPrompt(options);
  }

  /** @override */
  /** Dismiss displayed SwG UI */
  dismissSwgUI() {
    this.dialogManager().completeAll();
  }

  /**
   * Sets up all the buttons on the page with attribute
   * 'swg-standard-button:subscription' or 'swg-standard-button:contribution'.
   */
  async setupButtons() {
    const enable = await this.clientConfigManager().shouldEnableButton();
    this.buttonApi_.attachButtonsWithAttribute(
      BUTTON_ATTRIUBUTE,
      [ButtonAttributeValues.SUBSCRIPTION, ButtonAttributeValues.CONTRIBUTION],
      {
        theme: this.clientConfigManager().getTheme(),
        lang: this.clientConfigManager().getLanguage(),
        enable,
      },
      {
        [ButtonAttributeValues.SUBSCRIPTION]: () => {
          this.configuredClassicRuntime_.showOffers({
            isClosable: !this.pageConfig().isLocked(),
          });
        },
        [ButtonAttributeValues.CONTRIBUTION]: () => {
          this.configuredClassicRuntime_.showContributionOptions({
            isClosable: !this.pageConfig().isLocked(),
          });
        },
      }
    );
  }

  /**
   * Sets the callback when the offers flow is requested.
   * @param {function()} callback
   * @private
   */
  setOnOffersFlowRequest_(callback) {
    this.callbacks().setOnOffersFlowRequest(callback);
  }

  /** @override */
  linkSubscription(request) {
    return this.configuredClassicRuntime_.linkSubscription(request);
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
    setOnEntitlementsResponse:
      basicRuntime.setOnEntitlementsResponse.bind(basicRuntime),
    setOnPaymentResponse: basicRuntime.setOnPaymentResponse.bind(basicRuntime),
    setOnLoginRequest: basicRuntime.setOnLoginRequest.bind(basicRuntime),
    setupAndShowAutoPrompt:
      basicRuntime.setupAndShowAutoPrompt.bind(basicRuntime),
    dismissSwgUI: basicRuntime.dismissSwgUI.bind(basicRuntime),
    linkSubscription: basicRuntime.linkSubscription.bind(basicRuntime),
  });
}
