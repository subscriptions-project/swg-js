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
import {parseQueryString} from '../utils/url';
import {serviceUrl} from './services';

const CONTEXT = new AnalyticsContext([
  null,
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

describes.realWin('XhrFetcher', {}, env => {
  let fetcher;
  let win;
  let fetchInit;
  let fetchArray;
  let fetchUrl;

  function getFormData(url) {
    const qry = parseQueryString(url.split('?')[1]);
    return JSON.parse(decodeURIComponent(qry['f.req']));
  }

  function testFormData(formData, originalValue) {
    formData.unshift(null);
    const newValues = new AnalyticsContext(formData);
    // booleans are converted to 1/0; convert it back.
    newValues.setReadyToPay(!!newValues.getReadyToPay());
    expect(newValues).to.deep.equal(originalValue);
  }

  beforeEach(() => {
    win = env.win;
    fetchInit = null;
    fetchArray = null;
    fetchUrl = null;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake((url, init) => {
      fetchInit = init;
      fetchUrl = url;
      fetchArray = getFormData(url);
      return Promise.resolve({});
    });
    fetcher = new XhrFetcher(win);
  });

  describe('Beacon', () => {
    it('should send beacon', () => {
      let beaconArray = null;
      sandbox
        .stub(navigator, 'sendBeacon')
        .callsFake(url => (beaconArray = getFormData(url)));
      fetcher.sendBeacon(serviceUrl('clientlogs'), CONTEXT);
      expect(beaconArray).to.not.be.null;
      expect(fetchArray).to.be.null;
      testFormData(beaconArray, CONTEXT);
    });

    it('should fallback to standard POST', () => {
      navigator.sendBeacon = null;
      fetcher.sendBeacon(serviceUrl('clientlogs'), CONTEXT);
      expect(fetchArray).to.not.be.null;
      expect(fetchInit).to.deep.equal({
        method: 'POST',
        headers: {'Accept': 'text/plain, application/json'},
        credentials: 'include',
      });
      testFormData(fetchArray, CONTEXT);
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
  });
});
