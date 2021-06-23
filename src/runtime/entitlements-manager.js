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

import {
  AnalyticsEvent,
  EntitlementJwt,
  EntitlementResult,
  EntitlementSource,
  EntitlementsRequest,
  EventOriginator,
} from '../proto/api_messages';
import {Constants} from '../utils/constants';
import {
  Entitlement,
  Entitlements,
  GOOGLE_METERING_SOURCE,
} from '../api/entitlements';
import {
  GetEntitlementsParamsExternalDef,
  GetEntitlementsParamsInternalDef,
} from '../api/subscriptions';
import {JwtHelper} from '../utils/jwt';
import {MeterClientTypes} from '../api/metering';
import {MeterToastApi} from './meter-toast-api';
import {Toast} from '../ui/toast';
import {addQueryParam, getCanonicalUrl, parseQueryString} from '../utils/url';
import {analyticsEventToEntitlementResult} from './event-type-mapping';
import {base64UrlEncodeFromBytes, utf8EncodeSync} from '../utils/bytes';
import {feArgs, feUrl} from '../runtime/services';
import {hash} from '../utils/string';
import {queryStringHasFreshGaaParams} from '../utils/gaa';
import {serviceUrl} from './services';
import {toTimestamp} from '../utils/date-utils';
import {warn} from '../utils/log';

const SERVICE_ID = 'subscribe.google.com';
const TOAST_STORAGE_KEY = 'toast';
const ENTS_STORAGE_KEY = 'ents';
const IS_READY_TO_PAY_STORAGE_KEY = 'isreadytopay';

/**
 */
export class EntitlementsManager {
  /**
   * @param {!Window} win
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {!./fetcher.Fetcher} fetcher
   * @param {!./deps.DepsDef} deps
   */
  constructor(win, pageConfig, fetcher, deps) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = pageConfig;

    /** @private @const {string} */
    this.publicationId_ = this.pageConfig_.getPublicationId();

    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!JwtHelper} */
    this.jwtHelper_ = new JwtHelper();

    /** @private {?Promise<!Entitlements>} */
    this.responsePromise_ = null;

    /** @private {number} */
    this.positiveRetries_ = 0;

    /** @private {boolean} */
    this.blockNextNotification_ = false;

    /**
     * String containing encoded metering parameters currently.
     * We may expand this to contain more information in the future.
     * @private {?string}
     */
    this.encodedParams_ = null;

    /** @private @const {!./storage.Storage} */
    this.storage_ = deps.storage();

    /** @private @const {!../runtime/analytics-service.AnalyticsService} */
    this.analyticsService_ = deps.analytics();

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = deps.config();

    this.deps_
      .eventManager()
      .registerEventListener(this.possiblyPingbackOnClientEvent_.bind(this));
  }

  /**
   * @param {boolean=} expectPositive
   */
  reset(expectPositive) {
    this.responsePromise_ = null;
    this.positiveRetries_ = Math.max(
      this.positiveRetries_,
      expectPositive ? 3 : 0
    );
    if (expectPositive) {
      this.storage_.remove(ENTS_STORAGE_KEY);
      this.storage_.remove(IS_READY_TO_PAY_STORAGE_KEY);
    }
  }

  /**
   * Clears all of the entitlements state and cache.
   */
  clear() {
    this.responsePromise_ = null;
    this.positiveRetries_ = 0;
    this.unblockNextNotification();
    this.storage_.remove(ENTS_STORAGE_KEY);
    this.storage_.remove(TOAST_STORAGE_KEY);
    this.storage_.remove(IS_READY_TO_PAY_STORAGE_KEY);
  }

  /**
   * @param {!GetEntitlementsParamsExternalDef=} params
   * @return {!Promise<!Entitlements>}
   */
  getEntitlements(params) {
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
        encryption: {encryptedDocumentKey: /**@type {string} */ (params)},
      };
    }

    if (!this.responsePromise_) {
      this.responsePromise_ = this.getEntitlementsFlow_(params);
    }
    return this.responsePromise_.then((response) => {
      if (response.isReadyToPay != null) {
        this.analyticsService_.setReadyToPay(response.isReadyToPay);
      }
      return response;
    });
  }

  /**
   * @param {string} raw
   * @param {boolean=} isReadyToPay
   * @return {boolean}
   */
  pushNextEntitlements(raw, isReadyToPay) {
    const entitlements = this.getValidJwtEntitlements_(
      raw,
      /* requireNonExpired */ true,
      isReadyToPay
    );
    if (entitlements && entitlements.enablesThis()) {
      this.storage_.set(ENTS_STORAGE_KEY, raw);
      return true;
    }
    return false;
  }

  /**
   * Retrieves the 'gaa_n' parameter from the query string.
   */
  getGaaToken_() {
    return parseQueryString(this.win_.location.search)['gaa_n'];
  }

  /**
   * Sends a pingback that marks a metering entitlement as used.
   * @param {!Entitlements} entitlements
   */
  consumeMeter_(entitlements) {
    const entitlement = entitlements.getEntitlementForThis();
    if (!entitlement || entitlement.source !== GOOGLE_METERING_SOURCE) {
      return;
    }
    // Verify GAA params are present, otherwise bail since the pingback
    // shouldn't happen on non-metering requests.
    if (!queryStringHasFreshGaaParams(this.win_.location.search)) {
      return;
    }

    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_UNLOCKED_BY_METER, false);

    const token = this.getGaaToken_();

    const jwt = new EntitlementJwt();
    jwt.setSource(entitlement.source);
    jwt.setJwt(entitlement.subscriptionToken);
    return this.postEntitlementsRequest_(
      jwt,
      EntitlementResult.UNLOCKED_METER,
      EntitlementSource.GOOGLE_SHOWCASE_METERING_SERVICE,
      token
    );
  }

  /**
   * Listens for events from the event manager and informs the server
   * about publisher entitlements and non-consumable Google entitlements.
   * @param {!../api/client-event-manager-api.ClientEvent} event
   */
  possiblyPingbackOnClientEvent_(event) {
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
    const result = analyticsEventToEntitlementResult(event.eventType);
    if (!result) {
      return;
    }
    let source = null;

    switch (event.eventOriginator) {
      // The indicates the publisher reported it via subscriptions.setShowcaseEntitlement
      case EventOriginator.SHOWCASE_CLIENT:
        source = EntitlementSource.PUBLISHER_ENTITLEMENT;
        break;
      case EventOriginator.SWG_CLIENT: // Fallthrough, these are the same
      case EventOriginator.SWG_SERVER:
        if (result == EntitlementResult.UNLOCKED_METER) {
          // Meters from Google require a valid jwt, which is sent by
          // an entitlement.
          return;
        }
        source = EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT;
        break;
      // Permission to pingback other sources was not requested
      default:
        return;
    }
    const token = this.getGaaToken_();
    const isUserRegistered =
      event?.additionalParameters?.getIsUserRegistered?.();
    this.postEntitlementsRequest_(
      new EntitlementJwt(),
      result,
      source,
      token,
      isUserRegistered
    );
  }

  // Informs the Entitlements server about the entitlement used
  // to unlock the page.
  postEntitlementsRequest_(
    usedEntitlement,
    entitlementResult,
    entitlementSource,
    optionalToken = '',
    optionalIsUserRegistered = null
  ) {
    const message = new EntitlementsRequest();
    message.setUsedEntitlement(usedEntitlement);
    message.setClientEventTime(toTimestamp(Date.now()));
    message.setEntitlementResult(entitlementResult);
    message.setEntitlementSource(entitlementSource);
    message.setToken(optionalToken);
    if (typeof optionalIsUserRegistered === 'boolean') {
      message.setIsUserRegistered(optionalIsUserRegistered);
    }

    let url =
      '/publication/' +
      encodeURIComponent(this.publicationId_) +
      '/entitlements';
    // Promise that sets this.encodedParams_ when it resolves.
    const encodedParamsPromise = this.encodedParams_
      ? Promise.resolve()
      : hash(getCanonicalUrl(this.deps_.doc())).then((hashedCanonicalUrl) => {
          /** @type {!GetEntitlementsParamsInternalDef} */
          const encodableParams = {
            metering: {
              resource: {
                hashedCanonicalUrl,
              },
            },
          };
          this.encodedParams_ = base64UrlEncodeFromBytes(
            utf8EncodeSync(JSON.stringify(encodableParams))
          );
        });
    encodedParamsPromise.then(() => {
      url = addQueryParam(
        url,
        'encodedParams',
        /** @type {!string} */ (this.encodedParams_)
      );

      this.fetcher_.sendPost(serviceUrl(url), message);
    });
  }

  /**
   * @param {!GetEntitlementsParamsExternalDef=} params
   * @return {!Promise<!Entitlements>}
   * @private
   */
  getEntitlementsFlow_(params) {
    return this.fetchEntitlementsWithCaching_(params).then((entitlements) => {
      this.onEntitlementsFetched_(entitlements);
      return entitlements;
    });
  }

  /**
   * @param {!GetEntitlementsParamsExternalDef=} params
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetchEntitlementsWithCaching_(params) {
    return Promise.all([
      this.storage_.get(ENTS_STORAGE_KEY),
      this.storage_.get(IS_READY_TO_PAY_STORAGE_KEY),
    ]).then((cachedValues) => {
      const raw = cachedValues[0];
      const irtp = cachedValues[1];
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
      return this.fetchEntitlements_(params).then((ents) => {
        // If the product is enabled by cacheable entitlements, store them in cache.
        if (ents && ents.enablesThisWithCacheableEntitlements() && ents.raw) {
          this.storage_.set(ENTS_STORAGE_KEY, ents.raw);
        }
        return ents;
      });
    });
  }

  /**
   * @param {!GetEntitlementsParamsExternalDef=} params
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetchEntitlements_(params) {
    // TODO(dvoytenko): Replace retries with consistent fetch.
    let positiveRetries = this.positiveRetries_;
    this.positiveRetries_ = 0;
    const attempt = () => {
      positiveRetries--;
      return this.fetch_(params).then((entitlements) => {
        if (entitlements.enablesThis() || positiveRetries <= 0) {
          return entitlements;
        }
        return new Promise((resolve) => {
          this.win_.setTimeout(() => {
            resolve(attempt());
          }, 550);
        });
      });
    };
    return attempt();
  }

  /**
   * @param {boolean} value
   */
  setToastShown(value) {
    this.storage_.set(TOAST_STORAGE_KEY, value ? '1' : '0');
  }

  /**
   */
  blockNextNotification() {
    this.blockNextNotification_ = true;
  }

  /**
   */
  unblockNextNotification() {
    this.blockNextNotification_ = false;
  }

  /**
   * The JSON must either contain a "signedEntitlements" with JWT, or
   * "entitlements" field with plain JSON object.
   * @param {!Object} json
   * @return {!Entitlements}
   */
  parseEntitlements(json) {
    const isReadyToPay = json['isReadyToPay'];
    if (isReadyToPay == null) {
      this.storage_.remove(IS_READY_TO_PAY_STORAGE_KEY);
    } else {
      this.storage_.set(IS_READY_TO_PAY_STORAGE_KEY, String(isReadyToPay));
    }
    const signedData = json['signedEntitlements'];
    const decryptedDocumentKey = json['decryptedDocumentKey'];
    const swgUserToken = json['swgUserToken'];
    if (signedData) {
      const entitlements = this.getValidJwtEntitlements_(
        signedData,
        /* requireNonExpired */ false,
        isReadyToPay,
        decryptedDocumentKey
      );
      if (entitlements) {
        this.saveSwgUserToken_(swgUserToken);
        return entitlements;
      }
    } else {
      const plainEntitlements = json['entitlements'];
      if (plainEntitlements) {
        this.saveSwgUserToken_(swgUserToken);
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
   * @param {?string|undefined} swgUserToken
   * @private
   */
  saveSwgUserToken_(swgUserToken) {
    if (swgUserToken) {
      this.storage_.set(Constants.USER_TOKEN, swgUserToken, true);
    }
  }

  /**
   * @param {string} raw
   * @param {boolean} requireNonExpired
   * @param {boolean=} isReadyToPay
   * @param {?string=} decryptedDocumentKey
   * @return {?Entitlements}
   * @private
   */
  getValidJwtEntitlements_(
    raw,
    requireNonExpired,
    isReadyToPay,
    decryptedDocumentKey
  ) {
    try {
      const jwt = this.jwtHelper_.decode(raw);
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

  /**
   * @param {string} raw
   * @param {!Object|!Array<!Object>} json
   * @param {boolean=} isReadyToPay
   * @param {?string=} decryptedDocumentKey
   * @return {!Entitlements}
   * @private
   */
  createEntitlements_(raw, json, isReadyToPay, decryptedDocumentKey) {
    return new Entitlements(
      SERVICE_ID,
      raw,
      Entitlement.parseListFromJson(json),
      this.pageConfig_.getProductId(),
      this.ack_.bind(this),
      this.consume_.bind(this),
      isReadyToPay,
      decryptedDocumentKey
    );
  }

  /**
   * @param {!Entitlements} entitlements
   * @private
   */
  onEntitlementsFetched_(entitlements) {
    // Skip any notifications and toast if other flows are ongoing.
    // TODO(dvoytenko): what's the right action when pay flow was canceled?
    const blockNotification = this.blockNextNotification_;
    this.blockNextNotification_ = false;
    if (blockNotification) {
      return;
    }

    // Notify on the received entitlements.
    this.deps_
      .callbacks()
      .triggerEntitlementsResponse(Promise.resolve(entitlements));

    const entitlement = entitlements.getEntitlementForThis();
    if (!entitlement) {
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      return;
    }
    this.maybeShowToast_(entitlement);
  }

  /**
   * @param {!Entitlement} entitlement
   * @return {!Promise}
   * @private
   */
  maybeShowToast_(entitlement) {
    // Don't show toast for metering entitlements.
    if (entitlement.source === GOOGLE_METERING_SOURCE) {
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.EVENT_HAS_METERING_ENTITLEMENTS, false);
      return Promise.resolve();
    }

    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION, false);
    // Check if storage bit is set. It's only set by the `Entitlements.ack` method.
    return this.storage_.get(TOAST_STORAGE_KEY).then((value) => {
      const toastWasShown = value === '1';
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
    });
  }

  /**
   * @param {!Entitlements} entitlements
   * @private
   */
  ack_(entitlements) {
    if (entitlements.getEntitlementForThis()) {
      this.setToastShown(true);
    }
  }

  /**
   * @param {!Entitlements} entitlements
   * @param {?Function=} onCloseDialog Called after the user closes the dialog.
   * @private
   */
  consume_(entitlements, onCloseDialog) {
    if (entitlements.enablesThisWithGoogleMetering()) {
      const onConsumeCallback = () => {
        if (onCloseDialog) {
          onCloseDialog();
        }
        this.consumeMeter_(entitlements);
      };
      const showToast = this.getShowToastFromEntitlements_(entitlements);
      if (showToast === false) {
        // If showToast is explicitly false, call onConsumeCallback directly.
        return onConsumeCallback();
      }
      const meterToastApi = new MeterToastApi(this.deps_);
      meterToastApi.setOnConsumeCallback(onConsumeCallback);
      return meterToastApi.start();
    }
  }

  /**
   * Gets the `showToast` value (or null/undefined if unavailable) from
   * the Google metering entitlement details in the input entitlements.
   * @param {!Entitlements} entitlements
   * @return {boolean|undefined}
   * @private
   */
  getShowToastFromEntitlements_(entitlements) {
    const entitlement = entitlements.getEntitlementForThis();
    if (!entitlement || entitlement.source !== GOOGLE_METERING_SOURCE) {
      return;
    }
    try {
      const meteringJwt = this.jwtHelper_.decode(entitlement.subscriptionToken);
      return meteringJwt['metering'] && meteringJwt['metering']['showToast'];
    } catch (e) {
      // Ignore decoding errors.
      return;
    }
  }

  /**
   * @param {!GetEntitlementsParamsExternalDef=} params
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetch_(params) {
    // Get swgUserToken from getEntitlements params
    const swgUserTokenParam = params?.encryption?.swgUserToken;
    // Get swgUserToken from local storage if it is not in getEntitlements params
    const swgUserTokenPromise = swgUserTokenParam
      ? Promise.resolve(swgUserTokenParam)
      : this.storage_.get(Constants.USER_TOKEN, true);

    let url =
      '/publication/' +
      encodeURIComponent(this.publicationId_) +
      '/entitlements';

    return Promise.all([
      hash(getCanonicalUrl(this.deps_.doc())),
      swgUserTokenPromise,
    ])
      .then((values) => {
        const hashedCanonicalUrl = values[0];
        const swgUserToken = values[1];

        // Add encryption param.
        if (params?.encryption) {
          url = addQueryParam(
            url,
            'crypt',
            params.encryption.encryptedDocumentKey
          );
        }

        // Add swgUserToken param.
        if (swgUserToken) {
          url = addQueryParam(url, 'sut', swgUserToken);
        }

        // Add metering params.
        if (this.publicationId_ && params?.metering?.state) {
          const meteringStateId = params.metering.state.id;
          if (
            typeof meteringStateId === 'string' &&
            meteringStateId.length > 0
          ) {
            /** @type {!GetEntitlementsParamsInternalDef} */
            const encodableParams = {
              metering: {
                clientTypes: [MeterClientTypes.LICENSED_BY_GOOGLE],
                owner: this.publicationId_,
                resource: {
                  hashedCanonicalUrl,
                },
                // Publisher provided state.
                state: {
                  id: meteringStateId,
                  attributes: [],
                },
                token: this.getGaaToken_(),
              },
            };

            // Collect attributes.
            function collectAttributes({attributes, category}) {
              if (!attributes) {
                return;
              }

              const attributeNames = Object.keys(attributes);
              attributeNames.forEach((attributeName) => {
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
                encodableParams.metering.state.attributes.push({
                  name,
                  timestamp,
                });
              });
            }
            collectAttributes({
              attributes: params.metering.state.standardAttributes,
              category: 'standard',
            });
            collectAttributes({
              attributes: params.metering.state.customAttributes,
              category: 'custom',
            });

            // Encode params.
            this.encodedParams_ = base64UrlEncodeFromBytes(
              utf8EncodeSync(JSON.stringify(encodableParams))
            );
            url = addQueryParam(url, 'encodedParams', this.encodedParams_);
          } else {
            warn(
              `SwG Entitlements: Please specify a metering state ID string, ideally a hash to avoid PII.`
            );
          }
        }

        // Build URL.
        return serviceUrl(url);
      })
      .then((url) => {
        this.deps_
          .eventManager()
          .logSwgEvent(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
        return this.fetcher_.fetchCredentialedJson(url);
      })
      .then((json) => {
        if (json.errorMessages && json.errorMessages.length > 0) {
          json.errorMessages.forEach((errorMessage) => {
            warn('SwG Entitlements: ' + errorMessage);
          });
        }
        return this.parseEntitlements(json);
      });
  }
}

/**
 * Convert String value of isReadyToPay
 * (from JSON or Cache) to a boolean value.
 * @param {string} value
 * @return {boolean|undefined}
 * @private
 */
function irtpStringToBoolean(value) {
  switch (value) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return undefined;
  }
}
