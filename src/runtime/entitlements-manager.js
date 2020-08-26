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

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {
  Entitlement,
  Entitlements,
  GOOGLE_METERING_SOURCE,
} from '../api/entitlements';
import {EntitlementsRequest,EntitlementJwt} from '../proto/api_messages';
import {JwtHelper} from '../utils/jwt';
import {MeterClientTypes} from '../api/metering';
import {ProductType} from '../api/subscriptions';
import {Toast} from '../ui/toast';
import {feArgs, feUrl} from '../runtime/services';
import {getCanonicalUrl} from '../utils/url';
import {hash} from '../utils/string';
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

    /** @private @const {!./storage.Storage} */
    this.storage_ = deps.storage();

    /** @private @const {!../runtime/analytics-service.AnalyticsService} */
    this.analyticsService_ = deps.analytics();

    /** @private @const {!../api/subscriptions.Config} */
    this.config_ = deps.config();
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
   * @return {string}
   * @private
   */
  getQueryString_() {
    return this.win_.location.search;
  }

  /**
   * @param {!GetEntitlementsParamsExternal=} params
   * @return {!Promise<!Entitlements>}
   */
  getEntitlements(params) {
    // Remain backwards compatible by accepting
    // `encryptedDocumentKey` string as a first param.
    if (typeof params === 'string') {
      // TODO: Delete the fallback if nobody needs it. Use a log to verify.
      if (Date.now() > 1598899876598) {
        // TODO: Remove the conditional check for this warning
        // after the AMP extension is updated to pass an object.
        warn(
          `[swg.js:getEntitlements]: If present, the first param of getEntitlements() should be an object of type GetEntitlementsParamsExternal.`
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
   * Sends a pingback that marks a metering entitlement as used.
   * @param {!Entitlements} entitlements
   */
  sendPingback_(entitlements) {
    const entitlement = entitlements.getEntitlementForThis();
    if (!entitlement || entitlement.source !== GOOGLE_METERING_SOURCE) {
      return;
    }

    const jwt = new EntitlementJwt();
    jwt.setSource(entitlement.source);
    jwt.setJwt(entitlement.subscriptionToken);

    const message = new EntitlementsRequest();
    message.setUsedEntitlement(jwt);
    message.setClientEventTime(toTimestamp(new Date()));

    const url =
      '/publication/' +
      encodeURIComponent(this.publicationId_) +
      '/entitlements';

    this.fetcher_.sendPost(serviceUrl(url), message);
  }

  /**
   * @param {!GetEntitlementsParamsExternal=} params
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
   * @param {!GetEntitlementsParamsExternal=} params
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
   * @param {!GetEntitlementsParamsExternal=} params
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
    // Check if storage bit is set. It's only set by the `Entitlements.ack`
    // method.
    return this.storage_.get(TOAST_STORAGE_KEY).then((value) => {
      const toastWasShown = value === '1';
      if (toastWasShown) {
        return;
      }

      // Show toast.
      const source = entitlement.source || 'google';
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
   * @private
   */
  consume_(entitlements) {
    if (entitlements.enablesThisWithGoogleMetering()) {
      // NOTE: This is just a placeholder. Once the metering prompt UI is ready,
      // it will be opened here instead of the contributions iframe.
      // TODO: Open metering prompt here instead of contributions iframe.
      const activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.deps_.activities(),
        feUrl('/metertoastiframe'),
        feArgs({
          'productId': this.deps_.pageConfig().getProductId(),
          'publicationId': this.deps_.pageConfig().getPublicationId(),
          'productType': ProductType.UI_CONTRIBUTION,
          'list': 'default',
          'skus': null,
          'isClosable': true,
        }),
        /* shouldFadeBody */ true
      );
      activityIframeView_.onCancel(() => {
        this.sendPingback_(entitlements);
      });
      return this.deps_.dialogManager().openView(activityIframeView_);
    }
  }

  /**
   * @param {!GetEntitlementsParamsExternal=} params
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetch_(params) {
    return hash(getCanonicalUrl(this.deps_.doc()))
      .then((hashedCanonicalUrl) => {
        const urlParams = [];

        // Add encryption param.
        if (params && params.encryption) {
          urlParams.push(
            'crypt=' +
              encodeURIComponent(params.encryption.encryptedDocumentKey)
          );
        }

        // Add metering params.
        const productId = this.pageConfig_.getProductId();
        if (productId && params && params.metering && params.metering.state) {
          /** @type {!GetEntitlementsParamsInternal} */
          const encodableParams = {
            metering: {
              clientTypes: [MeterClientTypes.LICENSED_BY_GOOGLE],
              owner: productId,
              resource: {
                hashedCanonicalUrl,
              },
              state: {
                id: params.metering.state.id,
                attributes: [],
              },
            },
          };

          // Add attributes.
          const standardAttributes = params.metering.state.standardAttributes;
          if (standardAttributes) {
            Object.keys(standardAttributes).forEach((key) => {
              encodableParams.metering.state.attributes.push({
                name: 'standard_' + key,
                timestamp: standardAttributes[key].timestamp,
              });
            });
          }
          const customAttributes = params.metering.state.customAttributes;
          if (customAttributes) {
            Object.keys(customAttributes).forEach((key) => {
              encodableParams.metering.state.attributes.push({
                name: 'custom_' + key,
                timestamp: customAttributes[key].timestamp,
              });
            });
          }

          // Encode params.
          const encodedParams = btoa(JSON.stringify(encodableParams));
          urlParams.push('encodedParams=' + encodedParams);
        }

        // Build URL.
        let url =
          '/publication/' +
          encodeURIComponent(this.publicationId_) +
          '/entitlements';
        if (urlParams.length > 0) {
          url += '?' + urlParams.join('&');
        }
        return serviceUrl(url);
      })
      .then((url) => this.fetcher_.fetchCredentialedJson(url))
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
