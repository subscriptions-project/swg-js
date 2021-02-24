/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

import {AnalyticsContext} from '../proto/api_messages';
import {Xhr} from '../utils/xhr';
import {XhrFetcher} from './fetcher';
import {serializeProtoMessageForUrl} from '../utils/url';
import {serviceUrl} from './services';

const CONTEXT = new AnalyticsContext([
  'AnalyticsContext',
  'embed',
  'tx',
  'refer',
  'utmS',
  'utmC',
  'utmM',
  'sku',
  true,
  [],
  'version',
  'baseUrl',
]);

describes.realWin('XhrFetcher', {}, (env) => {
  let fetcher;
  let win;
  let fetchInit;
  let fetchUrl;

  beforeEach(() => {
    win = env.win;
    fetchInit = null;
    fetchUrl = null;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake((url, init) => {
      fetchInit = init;
      fetchUrl = url;
      return Promise.resolve({});
    });
    fetcher = new XhrFetcher(win);
  });

  describe('Beacon', () => {
    it('should send beacon', () => {
      let receivedUrl = null;
      let receivedBody = null;
      sandbox.stub(navigator, 'sendBeacon').callsFake((url, body) => {
        receivedUrl = url;
        receivedBody = body;
      });

      const sentUrl = serviceUrl('clientlogs');
      fetcher.sendBeacon(sentUrl, CONTEXT);

      const expectedBlob = new Blob(
        ['f.req=' + serializeProtoMessageForUrl(CONTEXT)],
        {type: 'application/x-www-form-urlencoded;charset=UTF-8'}
      );
      expect(receivedBody).to.deep.equal(expectedBlob);
      expect(receivedUrl).to.equal(sentUrl);
    });

    it('should fallback to standard POST', () => {
      navigator.sendBeacon = null;
      const url = serviceUrl('clientlogs');
      fetcher.sendBeacon(url, CONTEXT);

      const type = 'application/x-www-form-urlencoded;charset=UTF-8';
      const body = 'f.req=' + serializeProtoMessageForUrl(CONTEXT);
      expect(fetchInit).to.deep.equal({
        method: 'POST',
        headers: {'Content-Type': type},
        credentials: 'include',
        body,
      });
      expect(fetchUrl).to.equal(url);
    });
  });

  describe('Fetch', () => {
    let sentInit;
    const sentUrl = 'url?f.req=' + encodeURIComponent(JSON.stringify({}));

    afterEach(() => {
      expect(fetchUrl).to.equal(sentUrl);
      expect(fetchInit).to.deep.equal(sentInit);
    });

    it('should pass through to fetch', () => {
      sentInit = {};
      fetcher.fetch(sentUrl, sentInit);
    });

    it('should fetch credentialed JSON', () => {
      sentInit = {
        method: 'GET',
        headers: {'Accept': 'text/plain, application/json'},
        credentials: 'include',
      };
      fetcher.fetchCredentialedJson(sentUrl);
    });

    it('should fetch credentialed JSON with safety prefix', async () => {
      sandbox.restore();
      sandbox.stub(Xhr.prototype, 'fetch').callsFake((url, init) => {
        fetchInit = init;
        fetchUrl = url;
        return Promise.resolve({
          text: () => Promise.resolve(")]}'\n{}"),
        });
      });
      sentInit = {
        method: 'GET',
        headers: {'Accept': 'text/plain, application/json'},
        credentials: 'include',
      };
      const response = await fetcher.fetchCredentialedJson(sentUrl);
      expect(response).to.deep.equal({});
    });

    it('should post json', () => {
      sentInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        credentials: 'include',
        body: 'f.req=' + serializeProtoMessageForUrl(CONTEXT),
      };
      fetcher.sendPost(sentUrl, CONTEXT);
    });
  });
});
