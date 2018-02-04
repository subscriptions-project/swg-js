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
import {isDocumentReady, whenDocumentReady} from '../utils/document-ready';

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

  /** */
  check() {
    // Already resolved.
    if (!this.configResolver_) {
      return;
    }

    // Try to find product id.
    const productId = getMetaTag(this.win_, 'subscriptions-product-id');
    if (!productId) {
      if (isDocumentReady(this.win_.document)) {
        this.configResolver_(Promise.reject(
            new Error('No product id defined on the page')));
        this.configResolver_ = null;
      }
      return;
    }

    // Is locked?
    const accessibleForFree =
        getMetaTag(this.win_, 'subscriptions-accessible-for-free');
    const locked = (accessibleForFree &&
        accessibleForFree.toLowerCase() == 'false') || false;

    // Product ID has been found: initialize the rest of the config.
    this.configResolver_(new PageConfig(productId, locked));
    this.configResolver_ = null;
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
