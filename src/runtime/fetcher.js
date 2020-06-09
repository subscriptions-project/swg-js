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
import {serializeProtoMessageForUrl} from '../utils/url';

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
    return this.fetch(url, init).then((response) => response.json());
  }

  /** @override */
  fetch(url, init) {
    return this.xhr_.fetch(url, init);
  }

  /** @override */
  sendBeacon(url, data) {
    const contentType = 'application/x-www-form-urlencoded;charset=UTF-8';
    const body = 'f.req=' + serializeProtoMessageForUrl(data);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], {type: contentType});
      navigator.sendBeacon(url, blob);
      return;
    }

    // Only newer browsers support beacon.  Fallback to standard XHR POST.
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'POST',
      headers: {'Content-Type': contentType},
      credentials: 'include',
      body,
    });
    this.fetch(url, init);
  }
}
