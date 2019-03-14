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
import {parseJson} from '../utils/json';
export class XhrInterface {

  /**
   * Map of error code to error message
   * @param {!Object.<number, string>} errorMap
   */
  constructor(errorMap) {
    this.errorMap_ = errorMap;
  }

  /**
   * Send request
   * @param {string} url
   * @param {!../utils/xhr.FetchInitDef} init
   * @return {!Promise<!Response>}
   */
  sendRequest(url, init) {
    return new Promise((resolve, reject) => {
      /** @type {XMLHttpRequest} */
      const xhr = new XMLHttpRequest();
      const method = init.method || 'GET';
      xhr.open(method, url, true);
      if (init.headers) {
        Object.keys(init.headers).forEach(function(header) {
          xhr.setRequestHeader(header, init.headers[header]);
        });
      }
      xhr.onreadystatechange = () => {
        if (xhr.readyState < /* STATUS_RECEIVED */ 2) {
          return;
        }
        if (xhr.readyState == /* COMPLETE */ 4) {
          if (xhr.status in this.errorMap_) {
            let errorMessage = xhr.status + ':' + this.errorMap_[xhr.status];
            if (xhr.statusText) {
              errorMessage = errorMessage + ' ' + xhr.statusText;
            }
            reject(new Error(errorMessage));
          } else if (xhr.status < 200 || xhr.status > 300) {
            const errorMessage = xhr.status + ':' + xhr.statusText;
            reject(new Error(errorMessage));
          } else {
            const response = new Response();
            response.status = xhr.status;
            response.ok = true;
            response.statusText = xhr.statusText;
            xhr.bodyUsed = true;
            response.responseText = xhr.responseText;
            response.url = xhr.responseURL;
            response.headers = this.getResponseHeader_(
                xhr.getAllResponseHeaders());
            resolve(response);
          }
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
   * Creates header from XHR header
   * @param {?string} responseHeaders
   * @return {!Headers}
   */
  getResponseHeader_(responseHeaders) {
    const headerMap = new Headers();
    if (!responseHeaders) {
      return headerMap;
    }
    const arr = responseHeaders.trim().split(/[/r/n]+/);
    arr.forEach(function(line) {
      const parts = line.split(': ');
      const header = parts.shift();
      const value = parts.join(': ');
      headerMap[header] = value;
    });
    return headerMap;
  }
}

/**
 * Implements interface to Propensity server
 */
export class PropensityServer {
  /**
   * Page configuration is known when Propensity API
   * is available, publication ID is therefore used
   * in constructor for the server interface.
   * @param {string} publicationId
   */
  constructor(win, publicationId) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private @const {string} */
    this.publicationId_ = publicationId;
    /** @private {?string} */
    this.clientId_ = null;
    /** @private {?string} */
    this.product_ = null;
    /** @private {boolean} */
    this.userConsent_ = false;
    /** @private @const {boolean}*/
    this.TEST_SERVERS_ = true;
    /** {!Object.<number, string>} */
    const errorMap = {
      404: 'Publisher not whitelisted',
      403: 'Not sent from allowed origin',
      400: 'Invalid request',
      500: 'Server not available',
    };
    /** @private @const {!XhrInterface} */
    this.xhrInterface_ = new XhrInterface(errorMap);
  }

  /**
   * @return {string}
   */
  getUrl_() {
    if (this.TEST_SERVERS_) {
      return 'http://sohanirao.mtv.corp.google.com:8080';
    } else {
      return 'https://pubads.g.doubleclick.net/gampad/adx';
    }
  }

  /**
   * @return {?string}
   */
  getGads_() {
    let gads = null;
    const gadsmatch = this.win_.document.cookie.match(
        '(^|;)\\s*__gads\\s*=\\s*([^;]+)');
    gads = gadsmatch && encodeURIComponent(gadsmatch.pop());
    return gads;
  }

  /**
   * Returns the client ID to be used
   * @return {?string}
   * @private
   */
  getClientId_() {
    if (!this.clientId_) {
      if (!this.userConsent_) {
        this.clientId_ = 'noConsent';
      } else {
        this.clientId_ = this.getGads_();
      }
    }
    return this.clientId_;
  }

  /**
   * @param {boolean} userConsent
   */
  setUserConsent(userConsent) {
    this.userConsent_ = userConsent;
  }

  /**
   * @param {string} state
   * @param {?string} entitlements
   */
  sendSubscriptionState(state, entitlements) {
    this.product_ = entitlements;
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
      headers: {'Accept': 'text/plain, application/json'},
    });
    const clientId = this.getClientId_();
    let url = this.getUrl_() + '/subopt/data?states=' + this.publicationId_
        + ':' + state;
    if (this.product_) {
      url = url + ':' + this.product_;
    }
    if (clientId) {
      url = url + '&cookie=' + clientId;
    }
    url = url + '&u_tz=240';
    return this.xhrInterface_.sendRequest(url, init);
  }

  /**
   * @param {string} event
   * @param {?string} context
   */
  sendEvent(event, context) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
      headers: {'Accept': 'text/plain, application/json'},
    });
    const clientId = this.getClientId_();
    let url = this.getUrl_() + '/subopt/data?events=' + this.publicationId_
        + ':' + event;
    if (context) {
      url = url + ':' + JSON.stringify(context);
    }
    if (clientId) {
      url = url + '&cookie=' + clientId;
    }
    url = url + '&u_tz=240';
    return this.xhrInterface_.sendRequest(url, init);
  }

  /**
   * @param {string} referrer
   * @param {string} type
   * @return {?Promise<JsonObject>}
   */
  getPropensity(referrer, type) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
      headers: {'Accept': 'text/plain, application/json'},
    });
    const clientId = this.getClientId_();
    let url = this.getUrl_() + '/subopt/pts?products=' + this.publicationId_
        + '&type=' + type + '&u_tz=240';
    url = url + '&ref=' + referrer;
    if (clientId) {
      url = url + '&cookie=' + clientId;
    }
    return this.xhrInterface_.sendRequest(url, init).then(response => {
      let score = response && response.responseText;
      if (!score) {
        score = "{'values': [-1]}";
      }
      return parseJson(score);
    });
  }
}
