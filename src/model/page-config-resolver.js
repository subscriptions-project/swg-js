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

import {PageConfig} from './page-config';
import {isDocumentReady, whenDocumentReady} from '../utils/document-ready';


/**
 */
export class PageConfigResolver {

  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private {?function((!PageConfig|!Promise<!PageConfig>))} */
    this.configResolver_ = null;

    /** @private @const {!Promise<!PageConfig>} */
    this.configPromise_ = new Promise(resolve => {
      this.configResolver_ = resolve;
    });

    // Try resolve the config at different times.
    Promise.resolve().then(this.check.bind(this));
    whenDocumentReady(this.win_.document).then(this.check.bind(this));
  }

  /**
   * @return {!Promise<!PageConfig>}
   */
  resolveConfig() {
    return this.configPromise_;
  }

  /** */
  check() {
    // Already resolved.
    if (!this.configResolver_) {
      return;
    }

    // Try to find publication id.
    const publicationId = this.getMetaTag_('subscriptions-publication-id');
    if (!publicationId) {
      if (isDocumentReady(this.win_.document)) {
        this.configResolver_(Promise.reject(
            new Error('No publication id defined on the page')));
        this.configResolver_ = null;
      }
      return;
    }

    // Publication ID has been found: initialize the rest of the config.
    const label = this.getMetaTag_('subscriptions-product-label');
    this.configResolver_(new PageConfig({
      publicationId,
      label,
    }));
    this.configResolver_ = null;
  }

  /**
   * Returns the value from content attribute of a meta tag with given name.
   *
   * If multiple tags are found, the first value is returned.
   *
   * @private
   * @param {string} name The tag name to look for.
   * @return {?string} attribute value or empty string.
   */
  getMetaTag_(name) {
    const el = this.win_.document.querySelector(`meta[name="${name}"]`);
    if (el) {
      return el.getAttribute('content') || '';
    }
    return null;
  }
}
