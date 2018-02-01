/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import {findInArray} from '../utils/object';


/**
 * The holder of the entitlements for a service.
 */
export class Entitlements {

  /**
   * @param {string} service
   * @param {string} raw
   * @param {!Array<!Entitlement>} entitlements
   * @param {?string} currentLabel
   */
  constructor(service, raw, entitlements, currentLabel) {
    /** @const {string} */
    this.service = service;
    /** @const {string} */
    this.raw = raw;
    /** @const {!Array<!Entitlement>} */
    this.entitlements = entitlements;

    /** @private @const {?string} */
    this.label_ = currentLabel;
  }

  /**
   * @return {!Entitlements}
   */
  clone() {
    return new Entitlements(
        this.service,
        this.raw,
        this.entitlements.map(ent => ent.clone()),
        this.label_);
  }

  /**
   * @return {!Object}
   */
  json() {
    return {
      'service': this.service,
      'entitlements': this.entitlements.map(item => item.json()),
    };
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
    for (let i = 0; i < this.entitlements.length; i++) {
      if (this.entitlements[i].labels.length > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {?string} label
   * @return {boolean}
   */
  enables(label) {
    if (!label) {
      return false;
    }
    return !!this.getEntitlementFor(label);
  }

  /**
   * @return {?Entitlement}
   */
  getEntitlementForThis() {
    return this.getEntitlementFor(this.label_);
  }

  /**
   * @param {?string} label
   * @return {?Entitlement}
   */
  getEntitlementFor(label) {
    if (!label) {
      return null;
    }
    return findInArray(this.entitlements, entitlement => {
      return entitlement.enables(label);
    });
  }
}


/**
 * The single entitlement object.
 */
export class Entitlement {

  /**
   * @param {string} source
   * @param {!Array<string>} labels
   * @param {string} subscriptionToken
   */
  constructor(source, labels, subscriptionToken) {
    /** @const {string} */
    this.source = source;
    /** @const {!Array<string>} */
    this.labels = labels;
    /** @const {string} */
    this.subscriptionToken = subscriptionToken;
  }

  /**
   * @return {!Entitlement}
   */
  clone() {
    return new Entitlement(
        this.source,
        this.labels.slice(0),
        this.subscriptionToken);
  }

  /**
   * @return {!Object}
   */
  json() {
    return {
      'source': this.source,
      'labels': this.labels,
      'subscriptionToken': this.subscriptionToken,
    };
  }

  /**
   * @param {?string} label
   * @return {boolean}
   */
  enables(label) {
    if (!label) {
      return false;
    }
    return this.labels.includes(label);
  }
}
