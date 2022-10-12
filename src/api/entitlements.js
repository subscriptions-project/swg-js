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

import {Timestamp} from '../proto/api_messages';
import {debugLog} from '../utils/log';
import {findInArray} from '../utils/object';
import {getPropertyFromJsonString} from '../utils/json';
import {warn} from '../utils/log';

/** Source for Google-provided non-metering entitlements. */
export const GOOGLE_SOURCE = 'google';

/** Source for Google-provided metering entitlements. */
export const GOOGLE_METERING_SOURCE = 'google:metering';

/** Source for privileged entitlements. */
export const PRIVILEGED_SOURCE = 'privileged';

/** Subscription token for dev mode entitlements. */
export const DEV_MODE_TOKEN = 'GOOGLE_DEV_MODE_TOKEN';

/** Order ID returned for dev mode entitlements. */
export const DEV_MODE_ORDER = 'GOOGLE_DEV_MODE_ORDER';

/**
 * The holder of the entitlements for a service.
 */
export class Entitlements {
  /**
   * @param {string} service
   * @param {string} raw
   * @param {!Array<!Entitlement>} entitlements
   * @param {?string} currentProduct
   * @param {function(!Entitlements)} ackHandler
   * @param {function(!Entitlements, ?Function=)} consumeHandler
   * @param {?boolean|undefined} isReadyToPay
   * @param {?string|undefined} decryptedDocumentKey
   */
  constructor(
    service,
    raw,
    entitlements,
    currentProduct,
    ackHandler,
    consumeHandler,
    isReadyToPay,
    decryptedDocumentKey
  ) {
    /** @const {string} */
    this.service = service;
    /** @const {string} */
    this.raw = raw;
    /** @const {!Array<!Entitlement>} */
    this.entitlements = entitlements;
    /** @const {boolean} */
    this.isReadyToPay = isReadyToPay || false;
    /** @const {?string} */
    this.decryptedDocumentKey = decryptedDocumentKey || null;

    /** @private @const {?string} */
    this.product_ = currentProduct;
    /** @private @const {function(!Entitlements)} */
    this.ackHandler_ = ackHandler;
    /** @private @const {function(!Entitlements, ?Function=)} */
    this.consumeHandler_ = consumeHandler;
  }

  /**
   * @return {!Entitlements}
   */
  clone() {
    return new Entitlements(
      this.service,
      this.raw,
      this.entitlements.map((ent) => ent.clone()),
      this.product_,
      this.ackHandler_,
      this.consumeHandler_,
      this.isReadyToPay,
      this.decryptedDocumentKey
    );
  }

  /**
   * @return {!Object}
   */
  json() {
    return {
      'service': this.service,
      'entitlements': this.entitlements.map((item) => item.json()),
      'isReadyToPay': this.isReadyToPay,
    };
  }

  /**
   * Returns true if the current article is unlocked by a cacheable entitlement.
   * Metering entitlements aren't cacheable, because each metering entitlement
   * is meant to be used for one article. Subscription entitlements that are
   * not returned by dev mode are cacheable, because subscription entitlements
   * are meant to be used across multiple articles on a publication.
   * @return {boolean}
   */
  enablesThisWithCacheableEntitlements() {
    const entitlement = this.getEntitlementForThis();
    return (
      !!entitlement &&
      !this.enablesThisWithGoogleMetering() &&
      !this.enablesThisWithGoogleDevMode()
    );
  }

  /**
   * Returns true if the current article is unlocked by a
   * Google metering entitlement. These entitlements may come
   * from Google News Intiative's licensing program to support news.
   * https://www.blog.google/outreach-initiatives/google-news-initiative/licensing-program-support-news-industry-/
   * They may also come from Google's Subscribe With Google Metering
   * functionality.
   * @return {boolean}
   */
  enablesThisWithGoogleMetering() {
    const entitlement = this.getEntitlementForThis();
    return !!entitlement && entitlement.source === GOOGLE_METERING_SOURCE;
  }

  /**
   * Returns true if the current article is unlocked by a Google dev mode
   * entitlement.
   * @return {boolean}
   */
  enablesThisWithGoogleDevMode() {
    const entitlement = this.getEntitlementForThis();
    if (!entitlement) {
      return false;
    }
    const isFirstPartyToken =
      entitlement.source === GOOGLE_SOURCE &&
      entitlement.subscriptionToken.indexOf(DEV_MODE_ORDER) !== -1;
    const isThirdPartyToken = entitlement.subscriptionToken === DEV_MODE_TOKEN;
    return isFirstPartyToken || isThirdPartyToken;
  }

  /**
   * @param {string=} source
   * @return {boolean}
   */
  enablesThis(source) {
    return this.enables(this.product_, source);
  }

  /**
   * @param {string=} source
   * @return {boolean}
   */
  enablesAny(source) {
    for (let i = 0; i < this.entitlements.length; i++) {
      if (
        this.entitlements[i].products.length > 0 &&
        (!source || source == this.entitlements[i].source)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Whether these entitlements enable the specified product, optionally also
   * restricting the source.
   * @param {?string} product
   * @param {string=} source
   * @return {boolean}
   */
  enables(product, source) {
    if (!product) {
      return false;
    }
    return !!this.getEntitlementFor(product, source);
  }

  /**
   * Returns the first matching entitlement for the current product,
   * optionally also matching the specified source.
   * @param {string=} source
   * @return {?Entitlement}
   */
  getEntitlementForThis(source) {
    return this.getEntitlementFor(this.product_, source);
  }

  /**
   * Returns the first matching entitlement for the specified product,
   * optionally also matching the specified source.
   *
   * Returns non-metering entitlements if possible, to avoid consuming
   * metered reads unnecessarily.
   *
   * @param {?string} product
   * @param {string=} source
   * @return {?Entitlement}
   */
  getEntitlementFor(product, source) {
    if (!product) {
      // Require a product ID.
      warn(
        'SwG needs this article to define a product ID (e.g. example.com:premium). Articles can define a product ID using JSON+LD. SwG can check entitlements after this article defines a product ID.'
      );
      return null;
    }

    // Prefer subscription entitlements over metering entitlements.
    // Metering entitlements are a limited resource. When a metering entitlement
    // unlocks an article, that depletes the user's remaining "free reads".
    // Subscription entitlements are *not* depleted when they unlock articles.
    // They are essentially unlimited if the subscription remains valid.
    // For this reason, subscription entitlements are preferred.
    const entitlementsThatUnlockArticle = this.entitlements.filter(
      (entitlement) =>
        entitlement.enables(product) &&
        (!source || source === entitlement.source)
    );

    const subscriptionEntitlement = findInArray(
      entitlementsThatUnlockArticle,
      (entitlement) => entitlement.source !== GOOGLE_METERING_SOURCE
    );

    const meteringEntitlement = findInArray(
      entitlementsThatUnlockArticle,
      (entitlement) => entitlement.source === GOOGLE_METERING_SOURCE
    );

    return subscriptionEntitlement || meteringEntitlement || null;
  }

  /**
   * Returns the first matching entitlement for the specified source w/o
   * matching any specific products.
   * @param {string} source
   * @return {?Entitlement}
   */
  getEntitlementForSource(source) {
    if (this.entitlements.length > 0) {
      for (let i = 0; i < this.entitlements.length; i++) {
        if (
          this.entitlements[i].subscriptionToken &&
          source == this.entitlements[i].source
        ) {
          return this.entitlements[i];
        }
      }
    }
    return null;
  }

  /**
   * A 3p site should call this method to acknowledge that it "saw" and
   * "understood" entitlements.
   */
  ack() {
    this.ackHandler_(this);
  }

  /**
   * A 3p site should call this method to consume a Google metering entitlement.
   * When a metering entitlement is consumed, SwG shows the user a metering dialog.
   * When the user closes the dialog, SwG depletes one of the user's remaining
   * "free reads".
   * @param {?Function=} onCloseDialog Called after the user closes the dialog.
   */
  consume(onCloseDialog) {
    this.consumeHandler_(this, onCloseDialog);
  }
}

/**
 * The single entitlement object.
 */
export class Entitlement {
  /**
   * @param {string} source
   * @param {!Array<string>} products
   * @param {string} subscriptionToken
   * @param {JsonObject|null|undefined} subscriptionTokenContents
   * @param {!Timestamp} subscriptionTimestamp
   */
  constructor(
    source,
    products,
    subscriptionToken,
    subscriptionTokenContents,
    subscriptionTimestamp
  ) {
    /** @const {string} */
    this.source = source;
    /** @const {!Array<string>} */
    this.products = products;
    /** @const {string} */
    this.subscriptionToken = subscriptionToken;
    /** @const {JsonObject|null|undefined} */
    this.subscriptionTokenContents = subscriptionTokenContents;
    /** @const {!Timestamp} */
    this.subscriptionTimestamp = subscriptionTimestamp;
  }

  /**
   * @return {!Entitlement}
   */
  clone() {
    return new Entitlement(
      this.source,
      this.products.slice(0),
      this.subscriptionToken,
      this.subscriptionTokenContents,
      this.subscriptionTimestamp
    );
  }

  /**
   * @return {!Object}
   */
  json() {
    return {
      'source': this.source,
      'products': this.products,
      'subscriptionToken': this.subscriptionToken,
    };
  }

  /**
   * @param {?string} product
   * @return {boolean}
   */
  enables(product) {
    if (!product) {
      return false;
    }
    const eq = product.indexOf(':');
    // Handle wildcards
    if (eq != -1) {
      // Wildcard product (publication:*) unlocks on any entitlement matching publication
      const publication = product.substring(0, eq + 1);
      if (
        publication + '*' == product &&
        this.products.filter(
          (candidate) => candidate.substring(0, eq + 1) == publication
        ).length >= 1
      ) {
        debugLog('enabled with wildcard productId');
        return true;
      }
      // Wildcard entitlement allows any product matching this publication
      if (this.products.includes(publication + '*')) {
        debugLog('enabled with wildcard entitlement');
        return true;
      }
    }
    return this.products.includes(product);
  }

  /**
   * @param {?Object} json
   * @param {!../utils/jwt.JwtHelper} jwtHelper
   * @return {!Entitlement}
   */
  static parseFromJson(json, jwtHelper) {
    if (!json) {
      json = {};
    }
    const source = json['source'] || '';
    const products = json['products'] || [];
    const subscriptionToken = json['subscriptionToken'];
    let subscriptionTokenContents;
    const timestampJson = json['subscriptionTimestamp'];
    let subscriptionTimestamp;
    try {
      subscriptionTokenContents = subscriptionToken
        ? jwtHelper.decode(subscriptionToken)
        : null;
    } catch (e) {
      subscriptionTokenContents = null;
    }
    try {
      subscriptionTimestamp = new Timestamp(
        [timestampJson.seconds_, timestampJson.nanos_],
        false
      );
    } catch (e) {
      subscriptionTimestamp = new Timestamp();
    }
    return new Entitlement(
      source,
      products,
      subscriptionToken,
      subscriptionTokenContents,
      subscriptionTimestamp
    );
  }

  /**
   * The JSON is expected in one of the forms:
   * - Single entitlement: `{products: [], ...}`.
   * - A list of entitlements: `[{products: [], ...}, {...}]`.
   * @param {!Object|!Array<!Object>} json
   * @param {!../utils/jwt.JwtHelper} jwtHelper
   * @return {!Array<!Entitlement>}
   */
  static parseListFromJson(json, jwtHelper) {
    const jsonList = Array.isArray(json)
      ? /** @type {!Array<Object>} */ (json)
      : [json];
    return jsonList.map((json) => Entitlement.parseFromJson(json, jwtHelper));
  }

  /**
   * Returns the SKU associated with this entitlement.
   * @return {?string}
   */
  getSku() {
    if (this.source !== 'google') {
      return null;
    }
    const sku = /** @type {?string} */ (
      getPropertyFromJsonString(this.subscriptionToken, 'productId') || null
    );
    if (!sku) {
      warn('Unable to retrieve SKU from SwG subscription token');
    }
    return sku;
  }
}
