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

import {isArray} from '../utils/types';


/**
 * @typedef {{
 *   source: string,
 *   labels: !Array<string>,
 *   subscriptionToken: string,
 * }}
 */
export let EntitlementDef;


/**
 * The holder of the entitlements for the service.
 * TODO(dvoytenko): Move to api/
 */
export class Entitlements {

  /**
   * @param {string} serviceId
   * @param {string} raw
   * @param {!Array<!EntitlementDef>} list
   * @param {?string} label
   */
  constructor(serviceId, raw, list, label) {
    /** @private @const {string} */
    this.serviceId_ = serviceId;
    /** @private @const {string} */
    this.raw_ = raw;
    /** @private @const {!Array<!EntitlementDef>} */
    this.list_ = list;
    /** @private @const {?label} */
    this.label_ = label;
  }

  /**
   * @return {string}
   */
  getServiceId() {
    return this.serviceId_;
  }

  /**
   * @return {string}
   */
  raw() {
    return this.raw_;
  }

  /**
   * @return {!Array<!EntitlementDef>}
   */
  list() {
    return this.list_;
  }

  /**
   * @return {boolean}
   */
  enablesThis() {
    return this.enables(this.label_);
  }

  /**
   * @return {boolean}
   */
  enablesAny() {
    for (let i = 0; i < this.list_.length; i++) {
      if (this.list_[i].labels.length > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {string} label
   * @return {boolean}
   */
  enables(label) {
    return !!this.getEntitlementFor(label);
  }

  /**
   * @return {?EntitlementDef}
   */
  getEntitlementForThis() {
    return this.getEntitlementFor(this.label_);
  }

  /**
   * @param {?string} label
   * @return {?EntitlementDef}
   */
  getEntitlementFor(label) {
    if (!label) {
      return null;
    }
    for (let i = 0; i < this.list_.length; i++) {
      if (this.list_[i].labels.indexOf(label) != -1) {
        return this.list_[i];
      }
    }
    return null;
  }
}


/**
 * The JSON is expected in one the forms:
 * - Single entitlement: `{labels: [], ...}`.
 * - A list of entitlements: `[{labels: [], ...}, {...}]`.
 * @param {!Object|!Array<!Object>} json
 * @return {!Array<!EntitlementDef>}
 */
export function parseEntitlementsFromJson(json) {
  const jsonList = isArray(json) ?
      /** @type {!Array<Object>} */ (json) : [json];
  return jsonList.map(parseEntitlementFromJson);
}


/**
 * @param {?Object} json
 * @return {!EntitlementDef}
 */
function parseEntitlementFromJson(json) {
  if (!json) {
    json = {};
  }
  const source = json['source'] || '';
  const labels = json['labels'] || (json['label'] ? [json['label']] : []);
  const subscriptionToken = json['subscriptionToken'];
  return {
    source,
    labels,
    subscriptionToken,
  };
}
