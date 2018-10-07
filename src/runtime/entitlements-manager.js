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

import {Entitlement, Entitlements} from '../api/entitlements';
import {JwtHelper} from '../utils/jwt';
import {Toast} from '../ui/toast';
import {serviceUrl} from './services';
import {feArgs, feUrl} from '../runtime/services';

const SERVICE_ID = 'subscribe.google.com';
const TOAST_STORAGE_KEY = 'toast';
const ENTS_STORAGE_KEY = 'ents';


/**
 */
export class EntitlementsManager {

  /**
   * @param {!Window} win
   * @param {!../model/page-config.PageConfig} config
   * @param {!./fetcher.Fetcher} fetcher
   * @param {!./deps.DepsDef} deps
   */
  constructor(win, config, fetcher, deps) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!../model/page-config.PageConfig} */
    this.config_ = config;

    /** @private @const {string} */
    this.publicationId_ = this.config_.getPublicationId();

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
  }

  /**
   * @param {boolean=} opt_expectPositive
   */
  reset(opt_expectPositive) {
    this.responsePromise_ = null;
    this.positiveRetries_ = Math.max(
        this.positiveRetries_, opt_expectPositive ? 3 : 0);
    if (opt_expectPositive) {
      this.storage_.remove(ENTS_STORAGE_KEY);
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
  }

  /**
   * @return {!Promise<!Entitlements>}
   */
  getEntitlements() {
    if (!this.responsePromise_) {
      this.responsePromise_ = this.getEntitlementsFlow_();
    }
    return this.responsePromise_;
  }

  /**
   * @param {string} raw
   * @param {boolean=} opt_isReadyToPay
   * @return {boolean}
   */
  pushNextEntitlements(raw, opt_isReadyToPay) {
    const entitlements = this.getValidJwtEntitlements_(
        raw, /* requireNonExpired */ true, opt_isReadyToPay);
    if (entitlements && entitlements.enablesThis()) {
      this.storage_.set(ENTS_STORAGE_KEY, raw);
      return true;
    }
    return false;
  }

  /**
   * @return {!Promise<!Entitlements>}
   * @private
   */
  getEntitlementsFlow_() {
    return this.fetchEntitlementsWithCaching_().then(entitlements => {
      this.onEntitlementsFetched_(entitlements);
      return entitlements;
    });
  }

  /**
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetchEntitlementsWithCaching_() {
    return this.storage_.get(ENTS_STORAGE_KEY).then(raw => {
      // Try cache first.
      if (raw) {
        const cached = this.getValidJwtEntitlements_(
            raw, /* requireNonExpired */ true);
        if (cached && cached.enablesThis()) {
          // Already have a positive response.
          this.positiveRetries_ = 0;
          return cached;
        }
      }
      // If cache didn't match, perform fetch.
      return this.fetchEntitlements_().then(ents => {
        // If entitlements match the product, store them in cache.
        if (ents && ents.enablesThis() && ents.raw) {
          this.storage_.set(ENTS_STORAGE_KEY, ents.raw);
        }
        return ents;
      });
    });
  }

  /**
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetchEntitlements_() {
    // TODO(dvoytenko): Replace retries with consistent fetch.
    let positiveRetries = this.positiveRetries_;
    this.positiveRetries_ = 0;
    const attempt = () => {
      positiveRetries--;
      return this.fetch_().then(entitlements => {
        if (entitlements.enablesThis() || positiveRetries <= 0) {
          return entitlements;
        }
        return new Promise(resolve => {
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
    const signedData = json['signedEntitlements'];
    if (signedData) {
      const entitlements = this.getValidJwtEntitlements_(
          signedData, /* requireNonExpired */ false, isReadyToPay);
      if (entitlements) {
        return entitlements;
      }
    } else {
      const plainEntitlements = json['entitlements'];
      if (plainEntitlements) {
        return this.createEntitlements_('', plainEntitlements, isReadyToPay);
      }
    }
    // Empty response.
    return this.createEntitlements_('', [], isReadyToPay);
  }

  /**
   * @param {string} raw
   * @param {boolean} requireNonExpired
   * @param {boolean=} opt_isReadyToPay
   * @return {?Entitlements}
   * @private
   */
  getValidJwtEntitlements_(raw, requireNonExpired, opt_isReadyToPay) {
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
      return entitlementsClaim && this.createEntitlements_(
          raw, entitlementsClaim, opt_isReadyToPay) || null;
    } catch (e) {
      // Ignore the error.
      this.win_.setTimeout(() => {throw e;});
    }
    return null;
  }

  /**
   * @param {string} raw
   * @param {!Object|!Array<!Object>} json
   * @param {boolean=} opt_isReadyToPay
   * @return {!Entitlements}
   * @private
   */
  createEntitlements_(raw, json, opt_isReadyToPay) {
    return new Entitlements(
        SERVICE_ID,
        raw,
        Entitlement.parseListFromJson(json),
        this.config_.getProductId(),
        this.ack_.bind(this),
        opt_isReadyToPay);
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
    this.deps_.callbacks().triggerEntitlementsResponse(
        Promise.resolve(entitlements));

    // Show a toast if needed.
    this.maybeShowToast_(entitlements);
  }

  /**
   * @param {!Entitlements} entitlements
   * @return {!Promise}
   * @private
   */
  maybeShowToast_(entitlements) {
    const entitlement = entitlements.getEntitlementForThis();
    if (!entitlement) {
      return Promise.resolve();
    }
    // Check if storage bit is set. It's only set by the `Entitlements.ack`
    // method.
    return this.storage_.get(TOAST_STORAGE_KEY).then(value => {
      if (value == '1') {
        // Already shown;
        return;
      }
      if (entitlement) {
        this.showToast_(entitlement);
      }
    });
  }

  /**
   * @param {!Entitlement} entitlement
   * @private
   */
  showToast_(entitlement) {
    const source = entitlement.source || 'google';
    return new Toast(this.deps_, feUrl('/toastiframe'), feArgs({
      'publicationId': this.publicationId_,
      'source': source,
    })).open();
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
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetch_() {
    const url = serviceUrl(
        '/publication/' +
        encodeURIComponent(this.publicationId_) +
        '/entitlements');
    return this.fetcher_.fetchCredentialedJson(url)
        .then(json => this.parseEntitlements(json));
  }
}
