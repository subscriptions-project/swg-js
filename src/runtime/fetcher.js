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

import {Xhr} from '../utils/xhr';
import {addQueryParam, serializeMessageForUrl} from '../utils/url';

/**
 * @interface
 */
export class Fetcher {
  /**
   * @param {string} unusedUrl
   * @return {!Promise<!Object>}
   */
  fetchCredentialedJson(unusedUrl) {}

  /**
   * @param {string} unusedUrl
   * @param {!../utils/xhr.FetchInitDef} unusedInit
   * @return {!Promise<!../utils/xhr.FetchResponse>}
   */
  fetch(unusedUrl, unusedInit) {}

  /**
   * POST data to a URL endpoint, do not wait for a response.
   * @param {!string} unusedUrl
   * @param {!string|!Object} unusedData
   */
  sendBeacon(unusedUrl, unusedData) {}
}

/**
 * @implements {Fetcher}
 */
export class XhrFetcher {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @const {!Xhr} */
    this.xhr_ = new Xhr(win);
  }

  /** @override */
  fetchCredentialedJson(url) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      headers: {'Accept': 'text/plain, application/json'},
      credentials: 'include',
    });
    return this.xhr_.fetch(url, init).then(response => response.json());
  }

  /** @override */
  fetch(url, init) {
    return this.xhr_.fetch(url, init);
  }

  /** @override */
  sendBeacon(url, data) {
    url = addQueryParam(url, 'f.req', serializeMessageForUrl(data));
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
      return;
    }
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'POST',
      headers: {'Accept': 'text/plain, application/json'},
      credentials: 'include',
    });
    return this.xhr_.fetch(url, init).then(response => response.json());
  }
}
