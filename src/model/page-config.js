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


/**
 */
export class PageConfig {

  /**
   * @param {string} productOrPublisherId
   */
  constructor(productOrPublisherId) {
    let publisherId, productId, label;
    const div = productOrPublisherId.indexOf(':');
    if (div != -1) {
      // The argument is a product id.
      productId = productOrPublisherId;
      publisherId = productId.substring(0, div);
      label = productId.substring(div + 1);
    } else {
      // The argument is a publisher id.
      publisherId = productOrPublisherId;
      productId = null;
      label = null;
    }

    /** @private @const {string} */
    this.publisherId_ = publisherId;
    /** @private @const {?string} */
    this.productId_ = productId;
    /** @private @const {?string} */
    this.label_ = label;
  }

  /**
   * @return {string}
   */
  getPublisherId() {
    return this.publisherId_;
  }

  /**
   * @return {?string}
   */
  getProductId() {
    return this.productId_;
  }

  /**
   * @return {?string}
   */
  getLabel() {
    return this.label_;
  }
}
