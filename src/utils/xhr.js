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

import {assert} from './log';
import {parseJson} from './json';
import {parseUrl} from './url';
import {utf8EncodeSync} from './bytes';

/**
 * The "init" argument of the Fetch API. Currently, only "credentials: include"
 * is implemented.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch
 *
 * @typedef {{
 *   body: (!FormData|string|undefined),
 *   credentials: (string|undefined),
 *   headers: (!Object|undefined),
 *   method: (string|undefined),
 *   responseType: (string)
 * }}
 */
export let FetchInitDef;

/** @private @const {!Array<string>} */
const allowedMethods_ = ['GET', 'POST'];

/** @private @enum {number} Allowed fetch responses. */
const allowedFetchTypes_ = {
  document: 1,
  text: 2,
};

/**
 * A class that polyfills Fetch API.
 */
export class Xhr {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @const {!Window} */
    this.win = win;
  }

  /**
   * We want to call `fetch_` unbound from any context since it could
   * be either the native fetch or our polyfill.
   *
   * @param {string} input
   * @param {!FetchInitDef} init
   * @return {!Promise<!FetchResponse>|!Promise<!Response>}
   * @private
   */
  fetch_(input, init) {
    // TODO(avimehta): Should the requests go through when page is not visible?
    assert(typeof input == 'string', 'Only URL supported: %s', input);
    // In particular, Firefox does not tolerate `null` values for
    // `credentials`.
    const creds = init.credentials;
    assert(
      creds === undefined || creds == 'include' || creds == 'omit',
      'Only credentials=include|omit support: %s',
      creds
    );
    // Fallback to xhr polyfill since `fetch` api does not support
    // responseType = 'document'. We do this so we don't have to do any parsing
    // and document construction on the UI thread which would be expensive.
    if (init.responseType == 'document') {
      return fetchPolyfill(input, init);
    }
    return (this.win.fetch || fetchPolyfill).apply(null, arguments);
  }

  /**
   * @param {string} input URL
   * @param {?FetchInitDef} init Fetch options object.
   * @return {!Promise<!FetchResponse>}
   */
  fetch(input, init) {
    // TODO (avimehta): Figure out if CORS needs be handled the way AMP does it.
    init = setupInit(init);
    return this.fetch_(input, init)
      .then(
        (response) => response,
        (reason) => {
          const targetOrigin = parseUrl(input).origin;
          throw new Error(
            `XHR Failed fetching (${targetOrigin}/...):`,
            reason && reason.message
          );
        }
      )
      .then((response) => assertSuccess(response));
  }
}

/**
 * Normalized method name by uppercasing.
 * @param {string|undefined} method
 * @return {string}
 * @private
 */
function normalizeMethod_(method) {
  if (method === undefined) {
    return 'GET';
  }
  method = method.toUpperCase();

  assert(
    allowedMethods_.includes(method),
    'Only one of %s is currently allowed. Got %s',
    allowedMethods_.join(', '),
    method
  );

  return method;
}

/**
 * Sets up and normalizes the FetchInitDef
 *
 * @param {?FetchInitDef=} init Fetch options object.
 * @param {string=} accept The HTTP Accept header value.
 * @return {!FetchInitDef}
 */
function setupInit(init, accept) {
  init = init || /** @type {FetchInitDef} */ ({});
  init.method = normalizeMethod_(init.method);
  init.headers = init.headers || {};
  if (accept) {
    init.headers['Accept'] = accept;
  }
  return init;
}

/**
 * A minimal polyfill of Fetch API. It only polyfills what we currently use.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch
 *
 * Notice that the "fetch" method itself is not exported as that would require
 * us to immediately support a much wide API.
 *
 * @param {string} input
 * @param {!FetchInitDef} init
 * @return {!Promise<!FetchResponse>}
 * @private Visible for testing
 */
export function fetchPolyfill(input, init) {
  return new Promise(function (resolve, reject) {
    const xhr = createXhrRequest(init.method || 'GET', input);

    if (init.credentials == 'include') {
      xhr.withCredentials = true;
    }

    if (init.responseType in allowedFetchTypes_) {
      xhr.responseType = init.responseType;
    }

    if (init.headers) {
      Object.keys(init.headers).forEach(function (header) {
        xhr.setRequestHeader(header, init.headers[header]);
      });
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState < /* STATUS_RECEIVED */ 2) {
        return;
      }
      if (xhr.status < 100 || xhr.status > 599) {
        xhr.onreadystatechange = null;
        reject(new Error(`Unknown HTTP status ${xhr.status}`));
        return;
      }

      // TODO(dvoytenko): This is currently simplified: we will wait for the
      // whole document loading to complete. This is fine for the use cases
      // we have now, but may need to be reimplemented later.
      if (xhr.readyState == /* COMPLETE */ 4) {
        resolve(new FetchResponse(xhr));
      }
    };
    xhr.onerror = () => {
      reject(new Error('Network failure'));
    };
    xhr.onabort = () => {
      reject(new Error('Request aborted'));
    };

    if (init.method == 'POST') {
      xhr.send(init.body);
    } else {
      xhr.send();
    }
  });
}

/**
 * @param {string} method
 * @param {string} url
 * @return {!XMLHttpRequest}
 * @private
 */
function createXhrRequest(method, url) {
  const xhr = new XMLHttpRequest();
  if ('withCredentials' in xhr) {
    xhr.open(method, url, true);
  } else {
    throw new Error('CORS is not supported');
  }
  return xhr;
}

/**
 * If 415 or in the 5xx range.
 * @param {number} status
 */
function isRetriable(status) {
  return status == 415 || (status >= 500 && status < 600);
}

/**
 * Returns the response if successful or otherwise throws an error.
 * @param {!FetchResponse} response
 * @return {!Promise<!FetchResponse>}
 * @private Visible for testing
 */
export function assertSuccess(response) {
  return new Promise((resolve) => {
    if (response.ok) {
      return resolve(response);
    }

    const {status} = response;
    const err = new Error(`HTTP error ${status}`);
    err.retriable = isRetriable(status);
    // TODO(@jridgewell, #9448): Callers who need the response should
    // skip processing.
    err.response = response;
    throw err;
  });
}

/**
 * Response object in the Fetch API.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch
 */
export class FetchResponse {
  /**
   * @param {!XMLHttpRequest} xhr
   */
  constructor(xhr) {
    /** @private @const {!XMLHttpRequest} */
    this.xhr_ = xhr;

    /** @const {number} */
    this.status = this.xhr_.status;

    /** @const {boolean} */
    this.ok = this.status >= 200 && this.status < 300;

    /** @const {!FetchResponseHeaders} */
    this.headers = new FetchResponseHeaders(xhr);

    /** @type {boolean} */
    this.bodyUsed = false;

    /** @type {?ReadableStream} */
    this.body = null;
  }

  /**
   * Create a copy of the response and return it.
   * @return {!FetchResponse}
   */
  clone() {
    assert(!this.bodyUsed, 'Body already used');
    return new FetchResponse(this.xhr_);
  }

  /**
   * Drains the response and returns the text.
   * @return {!Promise<string>}
   * @private
   */
  drainText_() {
    assert(!this.bodyUsed, 'Body already used');
    this.bodyUsed = true;
    return Promise.resolve(this.xhr_.responseText);
  }

  /**
   * Drains the response and returns a promise that resolves with the response
   * text.
   * @return {!Promise<string>}
   */
  text() {
    return this.drainText_();
  }

  /**
   * Drains the response and returns the JSON object.
   * @return {!Promise<!JsonObject>}
   */
  json() {
    return /** @type {!Promise<!JsonObject>} */ (this.drainText_().then(
      parseJson
    ));
  }

  /**
   * Reads the xhr responseXML.
   * @return {!Promise<!Document>}
   * @private
   */
  document_() {
    assert(!this.bodyUsed, 'Body already used');
    this.bodyUsed = true;
    assert(
      this.xhr_.responseXML,
      'responseXML should exist. Make sure to return ' +
        'Content-Type: text/html header.'
    );
    return /** @type {!Promise<!Document>} */ (Promise.resolve(
      assert(this.xhr_.responseXML)
    ));
  }

  /**
   * Drains the response and returns a promise that resolves with the response
   * ArrayBuffer.
   * @return {!Promise<!ArrayBuffer>}
   */
  arrayBuffer() {
    return /** @type {!Promise<!ArrayBuffer>} */ (this.drainText_().then(
      utf8EncodeSync
    ));
  }
}

/**
 * Provides access to the response headers as defined in the Fetch API.
 * @private Visible for testing.
 */
export class FetchResponseHeaders {
  /**
   * @param {!XMLHttpRequest} xhr
   */
  constructor(xhr) {
    /** @private @const {!XMLHttpRequest} */
    this.xhr_ = xhr;
  }

  /**
   * @param {string} name
   * @return {string}
   */
  get(name) {
    return this.xhr_.getResponseHeader(name);
  }

  /**
   * @param {string} name
   * @return {boolean}
   */
  has(name) {
    return this.xhr_.getResponseHeader(name) != null;
  }
}
