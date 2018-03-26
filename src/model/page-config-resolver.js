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

import {Doc, resolveDoc} from './doc';
import {PageConfig} from './page-config';
import {hasNextNodeInDocumentOrder} from '../utils/dom';
import {isArray} from '../utils/types';
import {tryParseJson} from '../utils/json';

const ALREADY_SEEN = '__SUBSCRIPTIONS-SEEN__';
const CONTROL_FLAG = 'subscriptions-control';


/**
 */
export class PageConfigResolver {

  /**
   * @param {!Window|!Document|!Doc} winOrDoc
   */
  constructor(winOrDoc) {
    /** @private @const {!Doc} */
    this.doc_ = resolveDoc(winOrDoc);

    /** @private {?function((!PageConfig|!Promise))} */
    this.configResolver_ = null;

    /** @private @const {!Promise<!PageConfig>} */
    this.configPromise_ = new Promise(resolve => {
      this.configResolver_ = resolve;
    });

    /** @private @const {!MetaParser} */
    this.metaParser_ = new MetaParser(this.doc_);
    /** @private @const {!JsonLdParser} */
    this.ldParser_ = new JsonLdParser(this.doc_);
    /** @private @const {!MicrodataParser} */
    this.microdataParser_ = new MicrodataParser(this.doc_);
  }

  /**
   * @return {!Promise<!PageConfig>}
   */
  resolveConfig() {
    // Try resolve the config at different times.
    Promise.resolve().then(this.check.bind(this));
    this.doc_.whenReady().then(this.check.bind(this));
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
    if (!config) {
      config = this.microdataParser_.check();
    }

    if (config) {
      // Product ID has been found: initialize the rest of the config.
      this.configResolver_(config);
      this.configResolver_ = null;
    } else if (this.doc_.isReady()) {
      this.configResolver_(Promise.reject(
          new Error('No config could be discovered in the page')));
      this.configResolver_ = null;
    }
    return config;
  }
}


class MetaParser {
  /**
   * @param {!Doc} doc
   */
  constructor(doc) {
    /** @private @const {!Doc} */
    this.doc_ = doc;
  }

  /**
   * @return {?PageConfig}
   */
  check() {
    if (!this.doc_.getBody()) {
      // Wait until the whole `<head>` is parsed.
      return null;
    }

    // Try to find product id.
    const productId = getMetaTag(this.doc_.getRootNode(),
        'subscriptions-product-id');
    if (!productId) {
      return null;
    }

    // Is locked?
    const accessibleForFree = getMetaTag(this.doc_.getRootNode(),
        'subscriptions-accessible-for-free');
    const locked = (accessibleForFree &&
        accessibleForFree.toLowerCase() == 'false') || false;

    return new PageConfig(productId, locked);
  }
}


class JsonLdParser {
  /**
   * @param {!Doc} doc
   */
  constructor(doc) {
    /** @private @const {!Doc} */
    this.doc_ = doc;
  }

  /**
   * @return {?PageConfig}
   */
  check() {
    if (!this.doc_.getBody()) {
      // Wait until the whole `<head>` is parsed.
      return null;
    }

    const domReady = this.doc_.isReady();

    // type: 'application/ld+json'
    const elements = this.doc_.getRootNode().querySelectorAll(
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
 * Class the describes the microdata found in the page
 */
class Microdata {
  /**
   * @param {!Array<{id: {number}, properties:[{key:value}]}>} entries of microdata
   */
  constructor(entries) {
    this.entries = entries;
  }

  /**
   * Returns the first page configuration found, if present
  * @return {?PageConfig} pageConfig found
  */
  getPageConfig() {
    const pageConfigs = [];
    let locked = false;
    let productId = null;
    this.entries.forEach(item => {
      Object.keys(item.properties).forEach(property => {
        if (property == 'isAccessibleForFree') {
          locked = !item.properties[property];
        }
        if (property == 'productID') {
          productId = item.properties[property];
        }
      });
      if (productId != null) {
        pageConfigs.push(new PageConfig(productId, locked));
      }
    });
    if (pageConfigs.length == 0) {
      return null;
    } else {
      return pageConfigs[0];
    }
  }
}

class MicrodataParser {
  /**
   * @param {!Doc} doc
   */
  constructor(doc) {
    /** @private @const {!Doc} */
    this.doc_ = doc;
  }

  /**
   * Returns true if access is restricted, otherwise false
   * @param {Node} root A node that is an item of type 'NewsArticle'
   * @return {?boolean} locked access
   * @private
   */
  discoverLocked_(root) {
    const ALREADY_SEEN = 'alreadySeenForAccessInfo';
    const nodeList = root
        .querySelectorAll("[itemprop='isAccessibleForFree']");
    for (let i = 0; nodeList[i]; i++) {
      const element = nodeList[i];
      const content = element.content || element.textContent;
      let value = null;
      if (content.toLowerCase() == 'true') {
        value = true;
      } else if (content.toLowerCase() == 'false') {
        value = false;
      }
      if (this.isValidElement_(element, root, ALREADY_SEEN)) {
        return !value;
      }
    }
    return null;
  }

  /**
   * Verifies if a node is valid based on the following
   * - child of an item of type 'NewsArticle'
   * - not a child of an item of type 'Section'
   * - not seen before, marked using the alreadySeen tag
   * @param current the node to be verified
   * @param root the parent to track up to
   * @param alreadySeen used to tag already visited nodes
   * @return {!@boolean} valid node
   * @private
   */
  isValidElement_(current, root, alreadySeen) {
    while (current && !current[alreadySeen]) {
      current[alreadySeen] = true;
      if (current.hasAttribute('itemscope')) {
        const type = current.getAttribute('itemtype');
        if (type == 'http://schema.org/NewsArticle') {
          // This parent may need to be check for other nodes
          current[alreadySeen] = false;
          return true;
        } else if (type.indexOf('Section') >= 0) {
          return false;
        }
      }
      current = current.parentNode;
    }
    return false;
  }

  /**
   * Obtains the product ID that meets the requirements
   * - child of an item of type 'NewsArticle'
   * - Not a child of an item of type 'Section'
   * - child of an item of type 'productID'
   * @param {Node} root A node that is an item of type 'NewsArticle'
   * @return {?string} product ID, if found
   * @private
   */
  discoverProductId_(root) {
    const ALREADY_SEEN = 'alreadySeenForProductInfo';
    const nodeList = root
        .querySelectorAll("[itemprop='productID']");
    for (let i = 0; nodeList[i]; i++) {
      const element = nodeList[i];
      const value = nodeList[i].content;
      const item = element.closest('[itemtype][itemscope]');
      const type = item.getAttribute('itemtype');
      if (type.indexOf('Product') <= -1) {
        continue;
      }
      if (this.isValidElement_(item.parentNode, root, ALREADY_SEEN)) {
        return value;
      }
    }
    return null;
  }

  /**
   * Extracts microdata embedded in the DOM
   * @param {!Document} doc
   * @return {!Mircordata} microdata found in the doc
   */
  tryExtractConfig_(doc) {
    let itemId = 0;
    const results = [];
    const nodeList = doc.querySelectorAll(
        "[itemscope][itemtype='http://schema.org/NewsArticle']");
    const domReady = isDocumentReady(this.win_.document);
    for (let i = 0; nodeList[i]; i++) {
      const element = nodeList[i];
      if (!domReady && !hasNextNodeInDocumentOrder(element)) {
        continue;
      }
      const locked = this.discoverLocked_(element);
      const productInfo = this.discoverProductId_(element);
      const props = {};
      if (!!locked) {
        props['isAccessibleForFree'] = !locked;
      }
      if (productInfo) {
        props['productID'] = productInfo;
      }
      results.push({id: ++itemId, properties: props});
    }
    return new Microdata(results);
  }

  /**
   * @return {?PageConfig}
   */
  check() {
    if (!this.doc_.getBody()) {
      // Wait until the whole `<head>` is parsed.
      return null;
    }
    const microdata = this.tryExtractConfig_(this.win_.document);
    return microdata.getPageConfig();
  }
}

/**
 * @param {!Node} rootNode
 * @return {?string}
 */
export function getControlFlag(rootNode) {
  // Look for the flag in `meta`.
  const flag = getMetaTag(rootNode, CONTROL_FLAG);
  if (flag) {
    return flag;
  }
  // Look for the flag in `script`.
  const el = rootNode.querySelector(`script[${CONTROL_FLAG}]`);
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
 * @param {!Node} rootNode
 * @param {string} name The tag name to look for.
 * @return {?string} attribute value or empty string.
 * @private
 */
function getMetaTag(rootNode, name) {
  const el = rootNode.querySelector(`meta[name="${name}"]`);
  if (el) {
    return el.getAttribute('content');
  }
  return null;
}


/** @package Visible for testing only. */
export function getDocClassForTesting() {
  return Doc;
}
