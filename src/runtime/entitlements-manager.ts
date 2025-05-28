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

import {ActionOrchestration} from '../api/action-orchestration';
import {
  AnalyticsEvent,
  EntitlementJwt,
  EntitlementResult,
  EntitlementSource,
  EntitlementsRequest,
  EventOriginator,
  EventParams,
  Timestamp,
} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {AvailableIntervention} from '../api/available-intervention';
import {ClientConfig} from '../model/client-config';
import {ClientEvent} from '../api/client-event-manager-api';
import {
  Config,
  GetEntitlementsParamsExternalDef,
  GetEntitlementsParamsInternalDef,
} from '../api/subscriptions';
import {ContentType} from '../api/basic-subscriptions';
import {Deps} from './deps';
import {
  Entitlement,
  Entitlements,
  GOOGLE_METERING_SOURCE,
  PRIVILEGED_SOURCE,
} from '../api/entitlements';
import {Fetcher} from './fetcher';
import {Intervention} from './intervention';
import {InterventionType} from '../api/intervention-type';
import {JwtHelper} from '../utils/jwt';
import {MeterClientTypes} from '../api/metering';
import {MeterToastApi} from './meter-toast-api';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
import {addQueryParam, getCanonicalUrl, parseQueryString} from '../utils/url';
import {analyticsEventToEntitlementResult} from './event-type-mapping';
import {base64UrlEncodeFromBytes, utf8EncodeSync} from '../utils/bytes';
import {feArgs, feUrl} from './services';
import {hash} from '../utils/string';
import {queryStringHasFreshGaaParams} from './extended-access';
import {serviceUrl} from './services';
import {toTimestamp} from '../utils/date-utils';
import {warn} from '../utils/log';

const SERVICE_ID = 'subscribe.google.com';

// Interventions not in this list will be filtered from getAvailableInterventions
const ENABLED_INTERVENTIONS = new Set([
  InterventionType.TYPE_NEWSLETTER_SIGNUP,
  InterventionType.TYPE_REWARDED_SURVEY,
  InterventionType.TYPE_REWARDED_AD,
  InterventionType.TYPE_BYO_CTA,
]);

/**
 * Article response object.
 */
export interface Article {
  entitlements: Entitlements;
  clientConfig: ClientConfig;
  audienceActions?: {
    actions?: Intervention[];
    engineId?: string;
  };
  actionOrchestration?: ActionOrchestration;
  experimentConfig: {
    experimentFlags: string[];
  };
  previewEnabled: boolean;
}

export class EntitlementsManager {
  private readonly analyticsService_: AnalyticsService;
  private readonly config_: Config;
  private readonly jwtHelper_: JwtHelper;
  private readonly publicationId_: string;
  private readonly storage_: Storage;

  private article_: Article | null = null;
  private blockNextNotification_ = false;
  private blockNextToast_ = false;
  private enableMeteredByGoogle_ = false;
  private lastMeterToast_: MeterToastApi | null = null;

  /**
   * String containing encoded metering parameters currently.
   * We may expand this to contain more information in the future.
   */
  private encodedParams_: string | null = null;
  private positiveRetries_ = 0;
  private responsePromise_: Promise<Entitlements> | null = null;

  /**
   * Tests can use this promise to wait for POST requests to finish.
   * Visible for testing.
   */
  entitlementsPostPromise: Promise<void> | null = null;

  constructor(
    private readonly win_: Window,
    private readonly pageConfig_: PageConfig,
    private readonly fetcher_: Fetcher,
    private readonly deps_: Deps,
    private readonly enableDefaultMeteringHandler_: boolean
  ) {
    this.publicationId_ = this.pageConfig_.getPublicationId();

    this.jwtHelper_ = new JwtHelper();

    this.storage_ = deps_.storage();

    this.analyticsService_ = deps_.analytics();

    this.config_ = deps_.config();

    this.deps_
      .eventManager()
      .registerEventListener(this.possiblyPingbackOnClientEvent_.bind(this));
  }

  reset(expectPositive = false): void {
    this.responsePromise_ = null;
    this.positiveRetries_ = Math.max(
      this.positiveRetries_,
      expectPositive ? 3 : 0
    );
    if (expectPositive) {
      this.storage_.remove(StorageKeys.ENTITLEMENTS);
      this.storage_.remove(StorageKeys.IS_READY_TO_PAY);
    }
  }

  /**
   * Clears all of the entitlements state and cache.
   */
  clear(): void {
    this.responsePromise_ = null;
    this.positiveRetries_ = 0;
    this.unblockNextNotification();
    this.storage_.remove(StorageKeys.ENTITLEMENTS);
    this.storage_.remove(StorageKeys.TOAST);
    this.storage_.remove(StorageKeys.IS_READY_TO_PAY);
  }

  async getEntitlements(
    params?: GetEntitlementsParamsExternalDef
  ): Promise<Entitlements> {
    // Remain backwards compatible by accepting
    // `encryptedDocumentKey` string as a first param.
    if (typeof params === 'string') {
      // TODO: Delete the fallback if nobody needs it. Use a log to verify.
      if (Date.now() > 1600289016959) {
        // TODO: Remove the conditional check for this warning
        // after the AMP extension is updated to pass an object.
        warn(
          `[swg.js:getEntitlements]: If present, the first param of getEntitlements() should be an object of type GetEntitlementsParamsExternalDef.`
        );
      }

      params = {
        encryption: {encryptedDocumentKey: params},
      };
    }

    if (!this.responsePromise_) {
      this.responsePromise_ = this.getEntitlementsFlow_(params);
    }
    const response = await this.responsePromise_;
    if (response.isReadyToPay != null) {
      this.analyticsService_.setReadyToPay(response.isReadyToPay);
    }
    return response;
  }

  pushNextEntitlements(raw: string, isReadyToPay?: boolean): boolean {
    const entitlements = this.getValidJwtEntitlements_(
      raw,
      /* requireNonExpired */ true,
      isReadyToPay
    );
    if (entitlements && entitlements.enablesThis()) {
      this.storage_.set(StorageKeys.ENTITLEMENTS, raw);
      return true;
    }
    return false;
  }

  /**
   * Retrieves the 'gaa_n' parameter from the query string.
   */
  private getGaaToken_(): string {
    return parseQueryString(this.win_.location.search)['gaa_n'];
  }

  /**
   * Sends a pingback that marks a metering entitlement as used.
   */
  private consumeMeter_(entitlement: Entitlement | null): void {
    if (!entitlement || entitlement.source !== GOOGLE_METERING_SOURCE) {
      return;
    }

    // If GAA params are present, include them in the pingback.
    let gaaToken;
    let entitlementSource;
    if (
      (
        entitlement.subscriptionTokenContents as {
          metering: {clientType: number};
        }
      )?.['metering']['clientType'] === MeterClientTypes.METERED_BY_GOOGLE
    ) {
      // If clientType is METERED_BY_GOOGLE, this is the appropriate
      // EntitlementSource, and no GAA params are required.
      entitlementSource =
        EntitlementSource.SUBSCRIBE_WITH_GOOGLE_METERING_SERVICE;
    } else {
      // Expected: clientType is LICENSED_BY_GOOGLE
      if (queryStringHasFreshGaaParams(this.win_.location.search)) {
        // GAA params are valid. Post back as Showcase.
        entitlementSource = EntitlementSource.GOOGLE_SHOWCASE_METERING_SERVICE;
        gaaToken = this.getGaaToken_();
      } else {
        // Sanity check:
        // If we're not METERED_BY_GOOGLE, and GAA params are not valid, do not
        // post back.
        return;
      }
    }

    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_UNLOCKED_BY_METER, false);

    const jwt = new EntitlementJwt();
    jwt.setSource(entitlement.source);
    jwt.setJwt(entitlement.subscriptionToken);
    this.entitlementsPostPromise = this.postEntitlementsRequest_(
      /* usedEntitlement */ jwt,
      /* entitlementResult */ EntitlementResult.UNLOCKED_METER,
      /* entitlementSource */ entitlementSource,
      /* optionalToken */ gaaToken
    );
  }

  /**
   * Listens for events from the event manager and informs the server
   * about publisher entitlements and non-consumable Google entitlements.
   */
  private possiblyPingbackOnClientEvent_(event: ClientEvent): void {
    // Verify GAA params are present, otherwise bail since the pingback
    // shouldn't happen on non-metering requests.
    // We don't validate access type since we want to pingback on all access types.
    if (
      !queryStringHasFreshGaaParams(
        this.win_.location.search,
        /*allowAllAccessTypes=*/ true
      )
    ) {
      return;
    }

    // A subset of analytics events are also an entitlement result
    const result = analyticsEventToEntitlementResult(event.eventType!);
    if (!result) {
      return;
    }
    let source = null;

    switch (event.eventOriginator) {
      // Publisher JS logged this event.
      case EventOriginator.SHOWCASE_CLIENT:
        source = EntitlementSource.PUBLISHER_ENTITLEMENT;
        break;
      // Swgjs logged this event.
      case EventOriginator.SWG_CLIENT:
        if (result == EntitlementResult.UNLOCKED_METER) {
          // The `consumeMeter_` method already tracks this.
          return;
        }

        source = EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT;
        break;
      default:
        return;
    }
    const token = this.getGaaToken_();
    const isUserRegistered = (
      event?.additionalParameters as EntitlementsRequest
    )?.getIsUserRegistered?.();
    const subscriptionTimestamp = (
      event?.additionalParameters as EntitlementsRequest
    )?.getSubscriptionTimestamp?.();
    this.entitlementsPostPromise = this.postEntitlementsRequest_(
      new EntitlementJwt(),
      result,
      source,
      token,
      isUserRegistered,
      subscriptionTimestamp
    );
  }

  /**
   * Informs the Entitlements server about the entitlement used
   * to unlock the page.
   */
  private async postEntitlementsRequest_(
    usedEntitlement: EntitlementJwt,
    entitlementResult: EntitlementResult,
    entitlementSource: EntitlementSource,
    optionalToken = '',
    optionalIsUserRegistered: boolean | null = null,
    optionalSubscriptionTimestamp: Timestamp | null = null
  ): Promise<void> {
    const message = new EntitlementsRequest();
    message.setUsedEntitlement(usedEntitlement);
    message.setClientEventTime(toTimestamp(Date.now()));
    message.setEntitlementResult(entitlementResult);
    message.setEntitlementSource(entitlementSource);
    message.setToken(optionalToken);
    if (typeof optionalIsUserRegistered === 'boolean') {
      message.setIsUserRegistered(optionalIsUserRegistered);
    }
    if (optionalSubscriptionTimestamp) {
      message.setSubscriptionTimestamp(optionalSubscriptionTimestamp);
    }

    let url = `/publication/${encodeURIComponent(this.publicationId_)}/article`;
    url = addDevModeParamsToUrl(this.win_.location, url);

    // Set encoded params, once.
    if (!this.encodedParams_) {
      const encodableParams = {
        metering: {
          resource: {
            hashedCanonicalUrl: await this.getHashedCanonicalUrl_(),
          },
        },
      };

      this.encodedParams_ = base64UrlEncodeFromBytes(
        utf8EncodeSync(JSON.stringify(encodableParams))
      );
    }

    // Get swgUserToken from local storage
    const swgUserToken = await this.storage_.get(StorageKeys.USER_TOKEN, true);
    if (swgUserToken) {
      url = addQueryParam(url, 'sut', swgUserToken);
    }
    url = addQueryParam(url, 'encodedEntitlementsParams', this.encodedParams_);

    await this.fetcher_.sendPost(serviceUrl(url), message);
  }

  private async getHashedCanonicalUrl_(): Promise<string> {
    return hash(getCanonicalUrl(this.deps_.doc()));
  }

  private async getEntitlementsFlow_(
    params?: GetEntitlementsParamsExternalDef
  ): Promise<Entitlements> {
    const entitlements = await this.fetchEntitlementsWithCaching_(params);
    this.onEntitlementsFetched_(entitlements);
    return entitlements;
  }

  private async fetchEntitlementsWithCaching_(
    params?: GetEntitlementsParamsExternalDef
  ): Promise<Entitlements> {
    const raw = await this.storage_.get(StorageKeys.ENTITLEMENTS);
    const irtp = await this.storage_.get(StorageKeys.IS_READY_TO_PAY);

    // Try cache first.
    const needsDecryption = !!(params && params.encryption);
    if (raw && !needsDecryption) {
      const cached = this.getValidJwtEntitlements_(
        raw,
        /* requireNonExpired */ true,
        irtpStringToBoolean(irtp)
      );
      if (cached && cached.enablesThis()) {
        // Already have a positive response.
        this.positiveRetries_ = 0;
        return cached;
      }
    }

    // If cache didn't match, perform fetch.
    const ents = await this.fetchEntitlements_(params);

    // If the product is enabled by cacheable entitlements, store them in cache.
    if (ents && ents.enablesThisWithCacheableEntitlements() && ents.raw) {
      this.storage_.set(StorageKeys.ENTITLEMENTS, ents.raw);
    }

    return ents;
  }

  /**
   * If the manager is also responsible for fetching the Article, it
   * will be accessible from here and should resolve a null promise otherwise.
   */
  async getArticle(): Promise<Article | null> {
    if (!this.responsePromise_) {
      return null;
    }

    await this.responsePromise_;

    return this.article_;
  }

  /**
   * The experiment flags that are returned by the article endpoint should be accessible from here.
   */
  async getExperimentConfigFlags(): Promise<string[]> {
    const article = await this.getArticle();
    return this.parseArticleExperimentConfigFlags(article);
  }

  /**
   * Parses the experiment flags from the Article.
   */
  parseArticleExperimentConfigFlags(article: Article | null): string[] {
    if (article) {
      const expConfig = article['experimentConfig'];
      if (expConfig != null) {
        const expFlags = expConfig['experimentFlags'];
        if (expFlags != null) {
          return expFlags;
        }
      }
    }

    return [];
  }

  private fetchEntitlements_(
    params?: GetEntitlementsParamsExternalDef
  ): Promise<Entitlements> {
    // TODO(dvoytenko): Replace retries with consistent fetch.
    let positiveRetries = this.positiveRetries_;
    this.positiveRetries_ = 0;
    const attempt = async () => {
      positiveRetries--;

      const entitlements = await this.fetch_(params);
      if (entitlements.enablesThis() || positiveRetries <= 0) {
        return entitlements;
      }

      return new Promise<Entitlements>((resolve) => {
        this.win_.setTimeout(() => {
          resolve(attempt());
        }, 550);
      });
    };
    return attempt();
  }

  setToastShown(value: boolean): void {
    this.storage_.set(StorageKeys.TOAST, value ? '1' : '0');
  }

  blockNextNotification(): void {
    this.blockNextNotification_ = true;
  }

  blockNextToast(): void {
    this.blockNextToast_ = true;
  }

  unblockNextNotification(): void {
    this.blockNextNotification_ = false;
  }

  /**
   * Allow Google to handle metering for the given page.
   */
  enableMeteredByGoogle(): void {
    this.enableMeteredByGoogle_ = true;
  }

  /** Get the last shown meter toast. */
  getLastMeterToast(): MeterToastApi | null {
    return this.lastMeterToast_;
  }

  /**
   * The JSON must either contain a "signedEntitlements" with JWT, or
   * "entitlements" field with plain JSON object.
   */
  parseEntitlements(json: {
    isReadyToPay?: boolean;
    signedEntitlements?: string;
    decryptedDocumentKey?: string | null;
    swgUserToken?: string | null;
    entitlements?: {};
  }): Entitlements {
    const isReadyToPay = json['isReadyToPay'];
    if (isReadyToPay == null) {
      this.storage_.remove(StorageKeys.IS_READY_TO_PAY);
    } else {
      this.storage_.set(StorageKeys.IS_READY_TO_PAY, String(isReadyToPay));
    }
    const signedData = json['signedEntitlements'];
    const decryptedDocumentKey = json['decryptedDocumentKey'];
    const swgUserToken = json['swgUserToken'];
    if (swgUserToken) {
      this.saveSwgUserToken_(swgUserToken);
    }
    if (signedData) {
      const entitlements = this.getValidJwtEntitlements_(
        signedData,
        /* requireNonExpired */ false,
        isReadyToPay,
        decryptedDocumentKey
      );
      if (entitlements) {
        return entitlements;
      }
    } else {
      const plainEntitlements = json['entitlements'];
      if (plainEntitlements) {
        return this.createEntitlements_(
          '',
          plainEntitlements,
          isReadyToPay,
          decryptedDocumentKey
        );
      }
    }
    // Empty response.
    return this.createEntitlements_('', [], isReadyToPay);
  }

  /**
   * Persist swgUserToken in local storage if entitlements and swgUserToken exist
   */
  private saveSwgUserToken_(swgUserToken?: string | null): void {
    if (swgUserToken) {
      this.storage_.set(StorageKeys.USER_TOKEN, swgUserToken, true);
    }
  }

  private getValidJwtEntitlements_(
    raw: string,
    requireNonExpired: boolean,
    isReadyToPay?: boolean,
    decryptedDocumentKey?: string | null
  ): Entitlements | null {
    try {
      const jwt = this.jwtHelper_.decode(raw) as {
        exp: string;
        entitlements?: {};
      };
      if (requireNonExpired) {
        const now = Date.now();
        const exp = jwt['exp'];
        if (parseFloat(exp) * 1000 < now) {
          return null;
        }
      }
      const entitlementsClaim = jwt['entitlements'];
      return (
        (entitlementsClaim &&
          this.createEntitlements_(
            raw,
            entitlementsClaim,
            isReadyToPay,
            decryptedDocumentKey
          )) ||
        null
      );
    } catch (e) {
      // Ignore the error.
      this.win_.setTimeout(() => {
        throw e;
      });
    }
    return null;
  }

  private createEntitlements_(
    raw: string,
    json: unknown,
    isReadyToPay?: boolean,
    decryptedDocumentKey?: string | null
  ): Entitlements {
    return new Entitlements(
      SERVICE_ID,
      raw,
      Entitlement.parseListFromJson(json, this.jwtHelper_),
      this.pageConfig_.getProductId(),
      this.ack_.bind(this),
      this.consume_.bind(this),
      isReadyToPay,
      decryptedDocumentKey
    );
  }

  private onEntitlementsFetched_(entitlements: Entitlements): void {
    // Skip any notifications and toast if other flows are ongoing.
    // TODO(dvoytenko): what's the right action when pay flow was canceled?
    const blockNotification = this.blockNextNotification_;
    this.blockNextNotification_ = false;
    // Let people specifically block toasts too, without blocking notifications.
    const blockToast = this.blockNextToast_;
    this.blockNextToast_ = false;
    if (blockNotification) {
      return;
    }

    // Notify on the received entitlements.
    this.deps_
      .callbacks()
      .triggerEntitlementsResponse(Promise.resolve(entitlements));

    // Implementation of the default ability to always consume metered entitlements
    // if they are provided in an entitlements response.
    if (this.enableDefaultMeteringHandler_) {
      if (entitlements.enablesThisWithGoogleMetering()) {
        entitlements.consume();
      }
    }

    const entitlement = entitlements.getEntitlementForThis();
    if (!entitlement) {
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      return;
    }

    if (blockToast) {
      return;
    }
    this.maybeShowToast_(entitlement);
  }

  private async maybeShowToast_(entitlement: Entitlement): Promise<void> {
    // Don't show toast for metering entitlements.
    if (entitlement.source === GOOGLE_METERING_SOURCE) {
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.EVENT_HAS_METERING_ENTITLEMENTS, false);
      return Promise.resolve();
    }

    const params = new EventParams();
    params.setIsUserRegistered(true);
    if (entitlement.subscriptionTimestamp) {
      params.setSubscriptionTimestamp(entitlement.subscriptionTimestamp);
    }

    // Log unlock event.
    const eventType =
      entitlement.source === PRIVILEGED_SOURCE
        ? AnalyticsEvent.EVENT_UNLOCKED_FOR_CRAWLER
        : AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION;
    this.deps_.eventManager().logSwgEvent(eventType, false, params);

    // Check if storage bit is set. It's only set by the `Entitlements.ack` method.
    const toastWasShown = (await this.storage_.get(StorageKeys.TOAST)) === '1';
    if (toastWasShown) {
      return;
    }

    // Show toast.
    const source = entitlement.source || GOOGLE_METERING_SOURCE;
    return new Toast(
      this.deps_,
      feUrl('/toastiframe'),
      feArgs({
        'publicationId': this.publicationId_,
        'source': source,
      })
    ).open();
  }

  private ack_(entitlements: Entitlements): void {
    if (entitlements.getEntitlementForThis()) {
      this.setToastShown(true);
    }
  }

  /**
   * @param entitlements
   * @param onCloseDialog Called after the user closes the dialog.
   */
  private consume_(
    entitlements: Entitlements,
    onCloseDialog?: (() => void) | null
  ): Promise<void> | void {
    if (entitlements.enablesThisWithGoogleMetering()) {
      const entitlement = entitlements.getEntitlementForThis()!;

      const onConsumeCallback = () => {
        if (onCloseDialog) {
          onCloseDialog();
        }
        this.consumeMeter_(entitlement);
      };

      const subscriptionTokenContents =
        entitlement.subscriptionTokenContents as
          | {
              metering?: {
                clientType?: MeterClientTypes;
                clientUserAttribute?: string;
                showToast: boolean;
              };
            }
          | undefined;

      if (!subscriptionTokenContents) {
        // Ignore decoding errors. Don't show a toast, and return
        // onConsumeCallback directly.
        return onConsumeCallback();
      }

      if (subscriptionTokenContents['metering']?.['showToast'] === true) {
        // Return a delegation to the meterToastApi, which will return the
        // onConsumeCallback when the toast is dismissed.
        const meterToastApi = new MeterToastApi(this.deps_, {
          meterClientType: subscriptionTokenContents['metering']['clientType'],
          meterClientUserAttribute:
            subscriptionTokenContents['metering']['clientUserAttribute'],
        });
        meterToastApi.setOnConsumeCallback(onConsumeCallback);
        this.lastMeterToast_ = meterToastApi;
        return meterToastApi.start();
      } else {
        // If showToast isn't true, don't show a toast, and return
        // onConsumeCallback directly.
        return onConsumeCallback();
      }
    }
  }

  private async fetch_(
    params?: GetEntitlementsParamsExternalDef
  ): Promise<Entitlements> {
    // Get swgUserToken from local storage
    const swgUserToken = await this.storage_.get(StorageKeys.USER_TOKEN, true);

    // Get read_time from session storage
    const readTime = await this.storage_.get(
      StorageKeys.READ_TIME,
      /*useLocalStorage=*/ false
    );

    let url = `/publication/${encodeURIComponent(this.publicationId_)}/article`;

    url = addDevModeParamsToUrl(this.win_.location, url);

    url = addPreviewConfigIdToUrl(this.win_.location, url);

    url = addPreviewKeyToUrl(this.win_.location, url);

    // Add encryption param.
    if (params?.encryption) {
      url = addQueryParam(url, 'crypt', params.encryption.encryptedDocumentKey);
    }

    // Add swgUserToken param.
    if (swgUserToken) {
      url = addQueryParam(url, 'sut', swgUserToken);
    }

    // Add publisherProvidedId param for swg-basic.
    if (this.config_.publisherProvidedId) {
      url = addQueryParam(url, 'ppid', this.config_.publisherProvidedId);
    }

    // Add publisherProvidedId param for swg-classic.
    else if (
      params?.publisherProvidedId &&
      typeof params.publisherProvidedId === 'string' &&
      params.publisherProvidedId.length > 0
    ) {
      url = addQueryParam(url, 'ppid', params.publisherProvidedId);
    }

    // Add interaction_age param.
    if (readTime) {
      const last = parseInt(readTime, 10);
      if (last) {
        const interactionAge = Math.floor((Date.now() - last) / 1000);
        if (interactionAge >= 0) {
          url = addQueryParam(
            url,
            'interaction_age',
            interactionAge.toString()
          );
        }
      }
    }

    url = addQueryParam(url, 'locked', String(this.pageConfig_.isLocked()));
    url = addQueryParam(
      url,
      'contentType',
      getContentTypeParamString(this.pageConfig_.isLocked())
    );

    const hashedCanonicalUrl = await this.getHashedCanonicalUrl_();

    let encodableParams: GetEntitlementsParamsInternalDef | undefined = this
      .enableMeteredByGoogle_
      ? {
          metering: {
            clientTypes: [MeterClientTypes.METERED_BY_GOOGLE],
            owner: this.publicationId_,
            resource: {
              hashedCanonicalUrl,
            },
          },
        }
      : undefined;

    // Add metering params.
    if (
      this.publicationId_ &&
      params?.metering?.state &&
      queryStringHasFreshGaaParams(this.win_.location.search)
    ) {
      const meteringStateId = params.metering.state.id;
      if (typeof meteringStateId === 'string' && meteringStateId.length > 0) {
        encodableParams = {
          metering: {
            clientTypes: [MeterClientTypes.LICENSED_BY_GOOGLE],
            owner: this.publicationId_,
            resource: {
              hashedCanonicalUrl,
            },
            // Add publisher provided state and additional fields.
            state: {
              id: meteringStateId,
              attributes: [],
            },
            token: this.getGaaToken_(),
          },
        };

        // Collect attributes.
        function collectAttributes({
          attributes,
          category,
        }: {
          attributes?: {
            [key: string]: {
              timestamp: number;
            };
          };
          category: string;
        }) {
          if (!attributes) {
            return;
          }

          const attributeNames = Object.keys(attributes);
          for (const attributeName of attributeNames) {
            const name = `${category}_${attributeName}`;
            const timestamp = Number(attributes[attributeName].timestamp);

            // Validate timestamp.
            const timestampIsTooFarInTheFuture =
              timestamp > (Date.now() / 1000) * 2;
            if (!timestamp || timestampIsTooFarInTheFuture) {
              warn(
                `SwG Entitlements: Please specify a Unix timestamp, in seconds, for the "${attributeName}" ${category} attribute. The timestamp you passed (${attributes[attributeName].timestamp}) looks invalid.`
              );
            }

            // Collect attribute.
            encodableParams!.metering!.state!.attributes.push({
              name,
              timestamp,
            });
          }
        }

        collectAttributes({
          attributes: params.metering.state.standardAttributes,
          category: 'standard',
        });

        collectAttributes({
          attributes: params.metering.state.customAttributes,
          category: 'custom',
        });
      } else {
        warn(
          `SwG Entitlements: Please specify a metering state ID string, ideally a hash to avoid PII.`
        );
      }
    }

    // Build URL.
    if (encodableParams) {
      // Encode params.
      this.encodedParams_ = base64UrlEncodeFromBytes(
        utf8EncodeSync(JSON.stringify(encodableParams))
      );
      url = addQueryParam(
        url,
        'encodedEntitlementsParams',
        this.encodedParams_
      );
    }
    url = serviceUrl(url);

    // Get entitlements.
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
    const json = await this.fetcher_.fetchCredentialedJson(url);
    this.article_ = json as Article;
    const response = this.article_['entitlements'] || {};

    // Log errors.
    const errorMessages = (json as {errorMessages?: string[]})['errorMessages'];
    if (Number(errorMessages?.length) > 0) {
      for (const errorMessage of errorMessages!) {
        warn('SwG Entitlements: ' + errorMessage);
      }
    }

    return this.parseEntitlements(response);
  }

  /**
   * Returns a list of available interventions. If there are no interventions available
   * an empty array is returned. If the article does not exist, null is returned.
   */
  async getAvailableInterventions(): Promise<AvailableIntervention[] | null> {
    const article = await this.getArticle();
    if (!article) {
      warn('[swg.js:getAvailableInterventions] Article is null.');
      return null;
    }
    return (
      article.audienceActions?.actions
        ?.filter((action) => ENABLED_INTERVENTIONS.has(action.type))
        .map((action) => new AvailableIntervention(action, this.deps_)) || []
    );
  }
}

/**
 * Parses entitlement dev mode params from the given hash fragment and adds it
 * to the given URL.
 */
function addDevModeParamsToUrl(location: Location, url: string): string {
  const hashParams = parseQueryString(location.hash);
  const devModeScenario = hashParams['swg.deventitlement'];
  if (devModeScenario === undefined) {
    return url;
  }
  return addQueryParam(url, 'devEnt', devModeScenario);
}

/**
 * Parses preview config id params from the given hash fragment and adds it
 * to the given URL.
 */
function addPreviewConfigIdToUrl(location: Location, url: string): string {
  const hashParams = parseQueryString(location.hash);
  const previewConfigIdRequested = hashParams['rrmPromptRequested'];
  if (previewConfigIdRequested === undefined) {
    return url;
  }
  return addQueryParam(url, 'previewConfigId', previewConfigIdRequested);
}

/**
 * Parses preview security key params from the given hash fragment and adds it
 * to the given URL.
 */
function addPreviewKeyToUrl(location: Location, url: string): string {
  const hashParams = parseQueryString(location.hash);
  const previewKeyRequested = hashParams['rrmPreviewKey'];
  if (previewKeyRequested === undefined) {
    return url;
  }
  return addQueryParam(url, 'previewKey', previewKeyRequested);
}

/**
 * Convert String value of isReadyToPay
 * (from JSON or Cache) to a boolean value.
 */
function irtpStringToBoolean(value: string | null): boolean | undefined {
  switch (value) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return undefined;
  }
}

/**
 * Returns ContentType Enum string from isLocked page config status.
 */
function getContentTypeParamString(isLocked: boolean): string {
  return isLocked ? ContentType.CLOSED.toString() : ContentType.OPEN.toString();
}
