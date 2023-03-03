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

import {ErrorUtils} from '../utils/errors';
import {parseUrl, serializeProtoMessageForUrl} from '../utils/url';

const jsonSaftyPrefix = /^(\)\]\}'\n)/;

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
   * @param {!RequestInit} unusedInit
   * @return {!Promise<!Response>}
   */
  async fetch(unusedUrl, unusedInit) {}

  /**
   * POST data to a URL endpoint, do not wait for a response.
   * @param {!string} unusedUrl
   * @param {!../proto/api_messages.Message} unusedData
   */
  sendBeacon(unusedUrl, unusedData) {}

  /**
   * POST data to a URL endpoint, get a Promise for a response
   * @param {!string} unusedUrl
   * @param {!../proto/api_messages.Message} unusedMessage
   * @return {!Promise<!Object>}
   */
  sendPost(unusedUrl, unusedMessage) {}
}

/**
 * @implements {Fetcher}
 */
export class XhrFetcher {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @const {!Window} */
    this.win_ = win;
  }

  /** @override */
  async fetchCredentialedJson(url) {
    const init = /** @type {!RequestInit} */ ({
      method: 'GET',
      headers: {'Accept': 'text/plain, application/json'},
      credentials: 'include',
    });
    const response = await this.fetch(url, init);
    const text = await response.text();
    // Remove "")]}'\n" XSSI prevention prefix in safe responses.
    const cleanedText = text.replace(jsonSaftyPrefix, '');
    return /** @type {!Object} */ (JSON.parse(cleanedText));
  }

  /** @override */
  async sendPost(url, message) {
    const init = /** @type {!RequestInit} */ ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      credentials: 'include',
      body: 'f.req=' + serializeProtoMessageForUrl(message),
    });
    const response = await this.fetch(url, init);
    if (!response) {
      return {};
    }

    const text = await response.text();
    try {
      // Remove "")]}'\n" XSSI prevention prefix in safe responses.
      const cleanedText = text.replace(jsonSaftyPrefix, '');
      return /** @type {!Object} */ (JSON.parse(cleanedText));
    } catch (e) {
      ErrorUtils.throwAsync(e);
      return {};
    }
  }

  /** @override */
  async fetch(url, init) {
    try {
      // Wait for the request to succeed before returning the response,
      // allowing this method to catch failures.
      const response = await this.win_.fetch(url, init);
      return response;
    } catch (reason) {
      /*
       * If the domain is not valid for SwG we return 404 without
       * CORS headers and the browser throws a CORS error.
       * We include some helpful text in the message to point the
       * publisher towards the real problem.
       */
      const targetOrigin = parseUrl(url).origin;
      throw new Error(
        `XHR Failed fetching (${targetOrigin}/...): (Note: a CORS error above may indicate that this publisher or domain is not configured in Publisher Center. The CORS error happens because 4xx responses do not set CORS headers.)\n\n` +
          reason
      );
    }
  }

  /** @override */
  sendBeacon(url, data) {
    const headers = {type: 'application/x-www-form-urlencoded;charset=UTF-8'};
    const blob = new Blob(
      ['f.req=' + serializeProtoMessageForUrl(data)],
      headers
    );
    navigator.sendBeacon(url, blob);
  }
}
