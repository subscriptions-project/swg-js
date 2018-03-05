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

const SERVICE_ID = 'subscribe.google.com';


/**
 */
export class EntitlementsManager {

  /**
   * @param {!Window} win
   * @param {!../model/page-config.PageConfig} config
   * @param {!./fetcher.Fetcher} fetcher
   */
  constructor(win, config, fetcher) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!../model/page-config.PageConfig} */
    this.config_ = config;

    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;

    /** @private @const {!JwtHelper} */
    this.jwtHelper_ = new JwtHelper();

    /** @private {?Promise<!Entitlements>} */
    this.responsePromise_ = null;

    /** @private {number} */
    this.positiveRetries_ = 0;
  }

  /**
   * @return {!Promise<!Entitlements>}
   */
  getEntitlements() {
    if (!this.responsePromise_) {
      this.responsePromise_ = this.fetchConsistent_();
    }
    return this.responsePromise_;
  }

  /**
   * @param {boolean=} opt_expectPositive
   */
  reset(opt_expectPositive) {
    this.responsePromise_ = null;
    this.positiveRetries_ = Math.max(
        this.positiveRetries_, opt_expectPositive ? 3 : 0);
  }

  /**
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetchConsistent_() {
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
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetch_() {
    const url =
        '$entitlements$/_/v1/publication/' +
        encodeURIComponent(this.config_.getPublisherId()) +
        '/entitlements';
    return this.fetcher_.fetchCredentialedJson(url).then(json => {
      const signedData = json['signedEntitlements'];
      if (signedData) {
        const jwt = this.jwtHelper_.decode(signedData);
        const entitlementsClaim = jwt['entitlements'];
        if (entitlementsClaim) {
          return new Entitlements(
              SERVICE_ID,
              signedData,
              Entitlement.parseListFromJson(entitlementsClaim),
              this.config_.getProductId());
        }
      } else {
        const plainEntitlements = json['entitlements'];
        if (plainEntitlements) {
          return new Entitlements(
              SERVICE_ID,
              '',
              Entitlement.parseListFromJson(plainEntitlements),
              this.config_.getProductId());
        }
      }
      // Empty response.
      return new Entitlements(SERVICE_ID, '', [], this.config_.getProductId());
    });
  }
}
