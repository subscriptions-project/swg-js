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

import {serviceUrl} from './services';

export class OffersApi {
  /**
   * @param {!../model/page-config.PageConfig} config
   * @param {!./fetcher.Fetcher} fetcher
   */
  constructor(config, fetcher) {
    /** @private @const {!../model/page-config.PageConfig} */
    this.config_ = config;

    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;
  }

  /**
   * @param {?string=} productId
   * @return {!Promise<!Array<!../api/offer.Offer>>}
   */
  getOffers(productId = this.config_.getProductId()) {
    if (!productId) {
      throw new Error('getOffers requires productId in config or arguments');
    }
    return this.fetch_(productId);
  }

  /**
   * @param {string} productId
   * @return {!Promise<!Array<!../api/offer.Offer>>}
   * @private
   */
  fetch_(productId) {
    const url = serviceUrl(
      '/publication/' +
        encodeURIComponent(this.config_.getPublicationId()) +
        '/offers' +
        '?label=' +
        encodeURIComponent(productId)
    );
    // TODO(dvoytenko): switch to a non-credentialed request after launch.
    return this.fetcher_.fetchCredentialedJson(url).then(json => {
      return json['offers'] || [];
    });
  }
}
