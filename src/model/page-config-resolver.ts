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

import {Doc as DocInterface, resolveDoc} from './doc';
import {PageConfig} from './page-config';
import {debugLog} from '../utils/log';
import {hasNextNodeInDocumentOrder} from '../utils/dom';
import {tryParseJson} from '../utils/json';

const ALREADY_SEEN = '__SWG-SEEN__';
const ALREADY_SEEN_FOR_ACCESS_INFO = 'alreadySeenForAccessInfo';
const ALREADY_SEEN_FOR_PRODUCT_INFO = 'alreadySeenForProductInfo';

const CONTROL_FLAG = 'subscriptions-control';

const ALLOWED_TYPES = [
  'CreativeWork',
  'Article',
  'NewsArticle',
  'Blog',
  'Comment',
  'Course',
  'HowTo',
  'Message',
  'Review',
  'WebPage',
];

// RegExp for quickly scanning LD+JSON for allowed types
const RE_ALLOWED_TYPES = new RegExp(ALLOWED_TYPES.join('|'));

export class PageConfigResolver {
  private readonly doc_: DocInterface;
  private configResolver_: ((pageConfig: PageConfig) => void) | null = null;
  private configRejecter_: ((error: string) => void) | null = null;
  private readonly configPromise_: Promise<PageConfig>;
  private readonly metaParser_: MetaParser;
  private readonly ldParser_: JsonLdParser;
  private readonly microdataParser_: MicrodataParser;

  constructor(winOrDoc: Window | Document | DocInterface) {
    this.doc_ = resolveDoc(winOrDoc);

    this.configPromise_ = new Promise(
      (resolve: (pageConfig: PageConfig) => void, reject) => {
        this.configResolver_ = resolve;
        this.configRejecter_ = reject;
      }
    );

    this.metaParser_ = new MetaParser(this.doc_);
    this.ldParser_ = new JsonLdParser(this.doc_);
    this.microdataParser_ = new MicrodataParser(this.doc_);
  }

  resolveConfig(): Promise<PageConfig> {
    // Try resolve the config at different times.
    Promise.resolve().then(this.check.bind(this));
    this.doc_.whenReady().then(this.check.bind(this));
    return this.configPromise_;
  }

  check(): PageConfig | null {
    // Already resolved.
    if (!this.configResolver_ || !this.configRejecter_) {
      return null;
    }

    const config =
      this.metaParser_.check() ||
      this.ldParser_.check() ||
      this.microdataParser_.check();
    if (config) {
      // Product ID has been found: initialize the rest of the config.
      this.configResolver_(config);
      this.configResolver_ = null;
      this.configRejecter_ = null;
    } else if (this.doc_.isReady()) {
      this.configRejecter_('No config could be discovered in the page');
      this.configResolver_ = null;
      this.configRejecter_ = null;
    }

    debugLog(config);
    return config;
  }
}

class TypeChecker {
  /** Checks an unknown value from JSON. */
  checkValue(value: unknown, expectedTypes: string[]): boolean {
    if (typeof value !== 'string' && !Array.isArray(value)) {
      return false;
    }
    return this.checkList_(this.toArray_(value), expectedTypes);
  }

  /** Checks space delimited list of types. */
  checkSpaceDelimitedList(
    spaceDelimitedList: string,
    expectedTypes: string[]
  ): boolean {
    const types = spaceDelimitedList.split(/\s+/);
    return this.checkList_(types, expectedTypes);
  }

  /** Checks list of types. */
  private checkList_(types: string[], expectedTypes: string[]): boolean {
    for (let type of types) {
      type = type.replace(/^http:\/\/schema.org\//i, '');
      if (expectedTypes.includes(type)) {
        return true;
      }
    }
    return false;
  }

  private toArray_(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
  }
}

class MetaParser {
  constructor(private readonly doc_: DocInterface) {}

  check(): PageConfig | null {
    if (!this.doc_.getBody()) {
      // Wait until the whole `<head>` is parsed.
      return null;
    }

    // Try to find product id.
    const productId = getMetaTag(
      this.doc_.getRootNode(),
      'subscriptions-product-id'
    );
    if (!productId) {
      return null;
    }

    // Is locked?
    const accessibleForFree = getMetaTag(
      this.doc_.getRootNode(),
      'subscriptions-accessible-for-free'
    );
    const locked = !!(
      accessibleForFree && accessibleForFree.toLowerCase() === 'false'
    );

    return new PageConfig(productId, locked);
  }
}

type AlreadySeenAttribute =
  | typeof ALREADY_SEEN
  | typeof ALREADY_SEEN_FOR_ACCESS_INFO
  | typeof ALREADY_SEEN_FOR_PRODUCT_INFO;

/**
 * Swgjs marks seen elements with a custom property.
 */
type SeeableElement = HTMLElement & {
  [key in AlreadySeenAttribute]: boolean;
};

type UnknownObject = {[key: string]: unknown};

class JsonLdParser {
  private readonly checkType_ = new TypeChecker();

  constructor(private readonly doc_: DocInterface) {}

  check(): PageConfig | null {
    if (!this.doc_.getBody()) {
      // Wait until the whole `<head>` is parsed.
      return null;
    }

    const domReady = this.doc_.isReady();

    // type: 'application/ld+json'
    const elements = Array.from(
      this.doc_
        .getRootNode()
        .querySelectorAll('script[type="application/ld+json"]')
    ) as SeeableElement[];
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (
        element[ALREADY_SEEN] ||
        !element.textContent ||
        (!domReady && !hasNextNodeInDocumentOrder(element))
      ) {
        continue;
      }
      element[ALREADY_SEEN] = true;
      if (!RE_ALLOWED_TYPES.test(element.textContent)) {
        continue;
      }
      const possibleConfig = this.tryExtractConfig_(element);
      if (possibleConfig) {
        return possibleConfig;
      }
    }
    return null;
  }

  private tryExtractConfig_(element: Element): PageConfig | null {
    let possibleConfigs = tryParseJson(element.textContent || '');
    if (!possibleConfigs) {
      return null;
    }

    // Support arrays of JSON objects.
    if (!Array.isArray(possibleConfigs)) {
      possibleConfigs = [possibleConfigs];
    }

    let configs = possibleConfigs as UnknownObject[];
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];

      if (config['@graph'] && Array.isArray(config['@graph'])) {
        configs = configs.concat(config['@graph']);
      }

      // Must be an ALLOWED_TYPE
      if (!this.checkType_.checkValue(config['@type'], ALLOWED_TYPES)) {
        continue;
      }

      // Must have a isPartOf[@type=Product].
      let productId = null;
      const partOfArray = this.valueArray_(config, 'isPartOf');
      if (partOfArray) {
        for (let j = 0; j < partOfArray.length; j++) {
          productId = this.discoverProductId_(partOfArray[j] as UnknownObject);
          if (productId) {
            break;
          }
        }
      }
      if (!productId) {
        continue;
      }

      // Found product id, just check for the access flag.
      const isAccessibleForFree = this.bool_(
        this.singleValue_(config, 'isAccessibleForFree'),
        /* default */ true
      );

      return new PageConfig(productId, !isAccessibleForFree);
    }

    return null;
  }

  private bool_(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lowercase = value.toLowerCase();
      if (lowercase === 'false') {
        return false;
      }
      if (lowercase === 'true') {
        return true;
      }
    }

    return defaultValue;
  }

  private discoverProductId_(json: UnknownObject): string | null {
    // Must have type `Product`.
    if (!this.checkType_.checkValue(json['@type'], ['Product'])) {
      return null;
    }
    const productId = this.singleValue_(json, 'productID') as string;
    return productId || null;
  }

  private valueArray_(json: UnknownObject, name: string): unknown[] | null {
    const value = json[name];
    if (value == null || value === '') {
      return null;
    }
    return Array.isArray(value) ? value : [value];
  }

  private singleValue_(json: UnknownObject, name: string): unknown {
    const valueArray = this.valueArray_(json, name);
    const value = valueArray && valueArray[0];
    return value == null || value === '' ? null : value;
  }
}

class MicrodataParser {
  private access_: boolean | null = null;
  private productId_: string | null = null;
  private readonly checkType_ = new TypeChecker();

  constructor(private readonly doc_: DocInterface) {}

  /**
   * Returns false if access is restricted, true if unrestricted, or null if unknown.
   * @param root An element that is an item of type in ALLOWED_TYPES list.
   * @return Whether access is locked.
   */
  private discoverAccess_(root: Element): boolean | null {
    const nodeList = root.querySelectorAll("[itemprop='isAccessibleForFree']");
    for (let i = 0; nodeList[i]; i++) {
      const element = nodeList[i] as SeeableElement;
      const content = element.getAttribute('content') || element.textContent;
      if (!content) {
        continue;
      }
      if (this.isValidElement_(element, ALREADY_SEEN_FOR_ACCESS_INFO)) {
        let accessForFree = null;
        if (content.toLowerCase() === 'true') {
          accessForFree = true;
        } else if (content.toLowerCase() === 'false') {
          accessForFree = false;
        }
        return accessForFree;
      }
    }
    return null;
  }

  /**
   * Verifies if an element is valid based on the following
   * - child of an item of one the the ALLOWED_TYPES
   * - not a child of an item of any other type
   * - not seen before, marked using the alreadySeen tag
   * @param current the element to be verified.
   * @param root the parent to track up to.
   * @param alreadySeenAttribute used to tag already visited nodes.
   * @return Whether the node is valid.
   */
  private isValidElement_(
    current: SeeableElement | null,
    alreadySeenAttribute: AlreadySeenAttribute
  ): boolean {
    for (
      let node = current;
      node && !node[alreadySeenAttribute];
      node = node.parentNode as SeeableElement
    ) {
      node[alreadySeenAttribute] = true;
      // document nodes don't have hasAttribute
      if (
        node.hasAttribute &&
        node.hasAttribute('itemscope') &&
        node.hasAttribute('itemtype')
      ) {
        const type = node.getAttribute('itemtype') || '';
        return this.checkType_.checkSpaceDelimitedList(type, ALLOWED_TYPES);
      }
    }
    return false;
  }

  /**
   * Obtains the product ID that meets the requirements
   * - child of an item of one of ALLOWED_TYPES
   * - Not a child of an item of type 'Section'
   * - child of an item of type 'productID'
   * @param root An element that is an item of an ALLOWED_TYPES
   * @return Product ID, if found
   */
  private discoverProductId_(root: Element): string | null {
    const nodeList = root.querySelectorAll('[itemprop="productID"]');
    for (let i = 0; nodeList[i]; i++) {
      const element = nodeList[i];
      const content = element.getAttribute('content') || element.textContent;
      const item = element.closest('[itemtype][itemscope]');
      if (!item) {
        continue;
      }
      const type = item.getAttribute('itemtype');
      if (!type || type.indexOf('http://schema.org/Product') <= -1) {
        continue;
      }
      if (
        this.isValidElement_(
          item.parentElement as SeeableElement,
          ALREADY_SEEN_FOR_PRODUCT_INFO
        )
      ) {
        return content;
      }
    }
    return null;
  }

  /**
   * Returns PageConfig if available.
   * @return PageConfig found so far.
   */
  private getPageConfig_(): PageConfig | null {
    let locked = null;
    if (this.access_ != null) {
      locked = !this.access_;
    } else if (this.doc_.isReady()) {
      // Default to unlocked
      locked = false;
    }
    if (this.productId_ != null && locked != null) {
      return new PageConfig(this.productId_, locked);
    }
    return null;
  }

  /**
   * Extracts page config from Microdata in the DOM.
   * @return PageConfig found.
   */
  private tryExtractConfig_(): PageConfig | null {
    // Grab all the nodes with an itemtype and filter for our allowed types
    const nodeList = Array.prototype.slice
      .call(this.doc_.getRootNode().querySelectorAll('[itemscope][itemtype]'))
      .filter((node) =>
        this.checkType_.checkSpaceDelimitedList(
          node.getAttribute('itemtype'),
          ALLOWED_TYPES
        )
      );

    for (const element of nodeList) {
      if (this.access_ == null) {
        this.access_ = this.discoverAccess_(element);
      }

      if (!this.productId_) {
        this.productId_ = this.discoverProductId_(element);
      }

      const config = this.getPageConfig_();
      if (config) {
        return config;
      }
    }

    return null;
  }

  check(): PageConfig | null {
    if (!this.doc_.getBody()) {
      // Wait until the whole `<head>` is parsed.
      return null;
    }
    return this.tryExtractConfig_();
  }
}

export function getControlFlag(rootNode: Document): string | null {
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
 */
function getMetaTag(rootNode: Document, name: string): string | null {
  const el = rootNode.querySelector(`meta[name="${name}"]`);
  if (el) {
    return el.getAttribute('content');
  }
  return null;
}
