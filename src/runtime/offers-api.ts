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

import {Fetcher} from './fetcher';
import {Offer} from '../api/offer';
import {PageConfig} from '../model/page-config';
import {serviceUrl} from './services';

export class OffersApi {
  constructor(
    private readonly config_: PageConfig,
    private readonly fetcher_: Fetcher
  ) {}

  getOffers(
    productId: string | null = this.config_.getProductId()
  ): Promise<Offer[]> {
    if (!productId) {
      throw new Error('getOffers requires productId in config or arguments');
    }
    return this.fetch_(productId);
  }

  private async fetch_(productId: string): Promise<Offer[]> {
    const url = serviceUrl(
      '/publication/' +
        encodeURIComponent(this.config_.getPublicationId()) +
        '/offers' +
        '?label=' +
        encodeURIComponent(productId)
    );
    // TODO(dvoytenko): switch to a non-credentialed request after launch.
    const json = (await this.fetcher_.fetchCredentialedJson(url)) as {
      offers?: Offer[];
    };
    return json['offers'] || [];
  }
}
