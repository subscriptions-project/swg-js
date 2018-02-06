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

import {PageConfig} from './page-config';
import {hasNextNodeInDocumentOrder} from '../utils/dom';
import {isArray} from '../utils/types';
import {isDocumentReady, whenDocumentReady} from '../utils/document-ready';
import {tryParseJson} from '../utils/json';

const ALREADY_SEEN = '__SUBSCRIPTIONS-SEEN__';
const CONTROL_FLAG = 'subscriptions-control';


/**
 */
export class PageConfigResolver {

  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private {?function((!PageConfig|!Promise))} */
    this.configResolver_ = null;

    /** @private @const {!Promise<!PageConfig>} */
    this.configPromise_ = new Promise(resolve => {
      this.configResolver_ = resolve;
    });

    /** @private @const {!MetaParser} */
    this.metaParser_ = new MetaParser(win);
    /** @private @const {!JsonLdParser} */
    this.ldParser_ = new JsonLdParser(win);
  }

  /**
   * @return {!Promise<!PageConfig>}
   */
  resolveConfig() {
    // Try resolve the config at different times.
    Promise.resolve().then(this.check.bind(this));
    whenDocumentReady(this.win_.document).then(this.check.bind(this));
    return this.configPromise_;
  }

  /**
   * @return {?PageConfig}
   */
  check() {
    // Already resolved.
    if (!this.configResolver_) {
      return null;
    }

    let config = this.metaParser_.check();
    if (!config) {
      config = this.ldParser_.check();
    }

    if (config) {
      // Product ID has been found: initialize the rest of the config.
      this.configResolver_(config);
      this.configResolver_ = null;
    } else if (isDocumentReady(this.win_.document)) {
      this.configResolver_(Promise.reject(
          new Error('No config could be discovered in the page')));
      this.configResolver_ = null;
    }
    return config;
  }
}


class MetaParser {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;
  }

  /**
   * @return {?PageConfig}
   */
  check() {
    if (!this.win_.document.body) {
      // Wait until the whole `<head>` is parsed.
      return null;
    }

    // Try to find product id.
    const productId = getMetaTag(this.win_, 'subscriptions-product-id');
    if (!productId) {
      return null;
    }

    // Is locked?
    const accessibleForFree =
        getMetaTag(this.win_, 'subscriptions-accessible-for-free');
    const locked = (accessibleForFree &&
        accessibleForFree.toLowerCase() == 'false') || false;

    return new PageConfig(productId, locked);
  }
}


class JsonLdParser {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;
  }

  /**
   * @return {?PageConfig}
   */
  check() {
    if (!this.win_.document.body) {
      // Wait until the whole `<head>` is parsed.
      return null;
    }

    const domReady = isDocumentReady(this.win_.document);

    // type: 'application/ld+json'
    const elements = this.win_.document.querySelectorAll(
        'script[type="application/ld+json"]');
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element[ALREADY_SEEN] ||
          !element.textContent ||
          !domReady && !hasNextNodeInDocumentOrder(element)) {
        continue;
      }
      element[ALREADY_SEEN] = true;
      if (element.textContent.indexOf('NewsArticle') == -1) {
        continue;
      }
      const possibleConfig = this.tryExtractConfig_(element);
      if (possibleConfig) {
        return possibleConfig;
      }
    }
    return null;
  }

  /**
   * @param {!Element} element
   * @return {?PageConfig}
   */
  tryExtractConfig_(element) {
    const json = tryParseJson(element.textContent);
    if (!json) {
      return null;
    }

    // Must be a NewsArticle.
    if (!this.checkType_(json, 'NewsArticle')) {
      return null;
    }

    // Must have a isPartOf[@type=Product].
    let productId = null;
    const partOfArray = this.valueArray_(json, 'isPartOf');
    if (partOfArray) {
      for (let i = 0; i < partOfArray.length; i++) {
        productId = this.discoverProductId_(partOfArray[i]);
        if (productId) {
          break;
        }
      }
    }
    if (!productId) {
      return null;
    }

    // Found product id, just check for the access flag.
    const isAccessibleForFree = this.bool_(
        this.singleValue_(json, 'isAccessibleForFree'),
        /* default */ true);

    return new PageConfig(productId, !isAccessibleForFree);
  }

  /**
   * @param {*} value
   * @param {boolean} def
   * @return {boolean}
   */
  bool_(value, def) {
    if (value == null || value === '') {
      return def;
    }
    if (typeof value == 'boolean') {
      return value;
    }
    if (typeof value == 'string') {
      const lowercase = value.toLowerCase();
      if (lowercase == 'false') {
        return false;
      }
      if (lowercase == 'true') {
        return true;
      }
    }
    return def;
  }

  /**
   * @param {!Object} json
   * @return {?string}
   */
  discoverProductId_(json) {
    // Must have type `Product`.
    if (!this.checkType_(json, 'Product')) {
      return null;
    }
    return /** @type {?string} */ (this.singleValue_(json, 'productID'));
  }

  /**
   * @param {!Object} json
   * @param {string} name
   * @return {?Array}
   */
  valueArray_(json, name) {
    const value = json[name];
    if (value == null || value === '') {
      return null;
    }
    return isArray(value) ? value : [value];
  }

  /**
   * @param {!Object} json
   * @param {string} name
   * @return {*}
   */
  singleValue_(json, name) {
    const valueArray = this.valueArray_(json, name);
    const value = valueArray && valueArray[0];
    return (value == null || value === '') ? null : value;
  }

  /**
   * @param {!Object} json
   * @param {string} expectedType
   * @return {boolean}
   */
  checkType_(json, expectedType) {
    const typeArray = this.valueArray_(json, '@type');
    if (!typeArray) {
      return false;
    }
    return (typeArray.includes(expectedType) ||
        typeArray.includes('http://schema.org/' + expectedType));
  }
}


/**
 * @param {!Window} win
 * @return {?string}
 */
export function getControlFlag(win) {
  // Look for the flag in `meta`.
  const flag = getMetaTag(win, CONTROL_FLAG);
  if (flag) {
    return flag;
  }
  // Look for the flag in `script`.
  const el = win.document.querySelector(`script[${CONTROL_FLAG}]`);
  if (el) {
    return el.getAttribute(CONTROL_FLAG);
  }
  return null;
}


/**
 * Returns the value from content attribute of a meta tag with given name.
 *
 * If multiple tags are found, the first value is returned.
 *
 * @param {!Window} win
 * @param {string} name The tag name to look for.
 * @return {?string} attribute value or empty string.
 * @private
 */
function getMetaTag(win, name) {
  const el = win.document.querySelector(`meta[name="${name}"]`);
  if (el) {
    return el.getAttribute('content');
  }
  return null;
}
