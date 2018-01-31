/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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
import {Xhr} from '../utils/xhr';
import {isArray} from '../utils/types';

const SERVICE_ID = 'subscribe.google.com';


/**
 */
export class EntitlementsManager {

  /**
   * @param {!Window} win
   * @param {!../model/page-config.PageConfig} config
   */
  constructor(win, config) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!../model/page-config.PageConfig} */
    this.config_ = config;

    /** @private @const {!Xhr} */
    this.xhr_ = new Xhr(this.win_);

    /** @private @const {!JwtHelper} */
    this.jwtHelper_ = new JwtHelper();

    /** @private {?Promise<!Entitlements>} */
    this.responsePromise_ = null;
  }

  /**
   * @return {!Promise<!Entitlements>}
   */
  getEntitlements() {
    if (!this.responsePromise_) {
      this.responsePromise_ = this.fetch_();
    }
    return this.responsePromise_;
  }

  /**
   */
  reset() {
    this.responsePromise_ = null;
  }

  /**
   * @return {!Promise<!Entitlements>}
   * @private
   */
  fetch_() {
    const url =
        '$entitlements$/_/v1/publication/' +
        encodeURIComponent(this.config_.getPublicationId()) +
        '/entitlements';
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      headers: {'Accept': 'text/plain, application/json'},
      credentials: 'include',
    });
    return this.xhr_.fetch(url, init).then(response => {
      return response.json();
    }).then(json => {
      const signedData = json['signedEntitlements'];
      if (signedData) {
        const jwt = this.jwtHelper_.decode(signedData);
        const entitlementsClaim = jwt['entitlements'];
        if (entitlementsClaim) {
          return new Entitlements(
              SERVICE_ID,
              signedData,
              parseEntitlementsFromJson(entitlementsClaim),
              this.config_.getLabel());
        }
      }
      // Empty response.
      return new Entitlements(SERVICE_ID, '', [], this.config_.getLabel());
    });
  }
}


/**
 * The JSON is expected in one the forms:
 * - Single entitlement: `{labels: [], ...}`.
 * - A list of entitlements: `[{labels: [], ...}, {...}]`.
 * @param {!Object|!Array<!Object>} json
 * @return {!Array<!Entitlement>}
 */
export function parseEntitlementsFromJson(json) {
  const jsonList = isArray(json) ?
      /** @type {!Array<Object>} */ (json) : [json];
  return jsonList.map(parseEntitlementFromJson);
}


/**
 * @param {?Object} json
 * @return {!Entitlement}
 */
function parseEntitlementFromJson(json) {
  if (!json) {
    json = {};
  }
  const source = json['source'] || '';
  const labels = json['labels'] || (json['label'] ? [json['label']] : []);
  const subscriptionToken = json['subscriptionToken'];
  return new Entitlement(source, labels, subscriptionToken);
}
