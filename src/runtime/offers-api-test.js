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

import {OffersApi} from './offers-api';
import {PageConfig} from '../model/page-config';
import {XhrFetcher} from './fetcher';

describes.realWin('OffersApi', (env) => {
  let offersApi;
  let pageConfig;
  let fetcherMock;

  beforeEach(() => {
    pageConfig = new PageConfig('pub1:label1');
    const fetcher = new XhrFetcher(env.win);
    fetcherMock = sandbox.mock(fetcher);
    offersApi = new OffersApi(pageConfig, fetcher);
  });

  afterEach(() => {
    fetcherMock.verify();
  });

  it('should fetch with default product', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pub1/offers?label=pub1%3Alabel1';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({offers: [{skuId: '1'}, {skuId: '2'}]})
      .once();

    const offers = await offersApi.getOffers();
    expect(offers).to.deep.equal([{skuId: '1'}, {skuId: '2'}]);
  });

  it('should fetch with a different product', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pub1/offers?label=pub1%3Alabel2';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({offers: [{skuId: '1'}, {skuId: '2'}]})
      .once();

    const offers = await offersApi.getOffers('pub1:label2');
    expect(offers).to.deep.equal([{skuId: '1'}, {skuId: '2'}]);
  });

  it('should fetch empty response', async () => {
    const expectedUrl =
      'https://news.google.com/swg/_/api/v1/publication/pub1/offers?label=pub1%3Alabel1';
    fetcherMock
      .expects('fetchCredentialedJson')
      .withExactArgs(expectedUrl)
      .resolves({})
      .once();

    const offers = await offersApi.getOffers();
    expect(offers).to.deep.equal([]);
  });

  it('rejects falsy offers', () => {
    fetcherMock.expects('fetchCredentialedJson').never();

    expect(() => offersApi.getOffers(false)).to.throw(
      'getOffers requires productId in config or arguments'
    );
  });
});
