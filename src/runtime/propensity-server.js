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

/**
 * @interface
 */
export class PropensityServerInterface {
  /**
   * @param {string} state
   * @param {string=} entitlements
   */
  sendSubscriptionState(state, entitlements) {}

  /**
   * @param {string} event
   * @param {string=} context
   */
  sendEvent(event, context) {}

  /**
   * @param {string=} type
   * @param {string=} referrer
   * @return {?Promise<JsonObject>}
   */
  getPropensity(type, referrer) {}

  /**
   * @param {boolean} userConsent
   */
  setUserConsent(userConsent) {}
}

/**
 * @implements {PropensityServerInterface}
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
   * Returns the client ID to be used
   * @return {?string}
   * @private
   */
  getClientId_() {
    if (!this.clientId_) {
      if (!this.userConsent_) {
        this.clientId_ = 'noConsent';
      } else {
        const gadsmatch = this.win_.document.cookie.match(
            '(^|;)\\s*__gads\\s*=\\s*([^;]+)');
        this.clientId_ = gadsmatch && encodeURIComponent(gadsmatch.pop());
      }
    }
    return this.clientId_;
  }

  /** @override */
  setUserConsent(consent) {
    this.userConsent_ = consent;
  }

  /** @override */
  sendSubscriptionState(state, entitlements) {
    this.product_ = entitlements;
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
      headers: {'Accept': 'text/plain, application/json'},
    });
    const cookie = this.getClientId_();
    let url = this.getUrl_() + '/subopt/data?states=' + this.publicationId_
        + ':' + state;
    if (this.product_) {
      url = url + ':' + this.product_;
    }
    if (cookie) {
      url = url + '&cookie=' + cookie;
    }
    url = url + '&u_tz=240';
    this.sendRequest_(url, init).then(response => {
      console.log('subscription state response', response);
      return this.processResponse_(response);
    }).catch(reason => {
      // Rethrow async.
      setTimeout(() => {
        throw reason;
      });
    });
  }

  /**
   * Send request
   * @param {string} url
   * @param {!../utils/xhr.FetchInitDef} init
   * @return {!Promise<!Response>}
   */
  sendRequest_(url, init) {
    const xhr = new XMLHttpRequest();
    let responseResolver = null;
    let responseFailure = null;
    const responsePromise = new Promise((resolve, reject) => {
      responseResolver = resolve;
      responseFailure = reject;
    });
    if (init.credentials == 'include') {
      xhr.withCredentials = true;
    }
    xhr.onreadystatechange = () => {
      if (xhr.readyState < /* STATUS_RECEIVED */ 2) {
        return;
      }
      if (xhr.readyState == /* COMPLETE */ 4) {
        const response = new Response();
        response.status = xhr.status;
        response.ok = xhr.status >= 200 && xhr.status < 300;
        response.statusText = xhr.statusText;
        xhr.bodyUsed = true;
        response.responseText = xhr.responseText;
        response.url = xhr.responseURL;
        response.headers = xhr.getAllResponseHeaders();
        responseResolver(response);
      }
    };
    xhr.onerror = () => {
      responseFailure(new Error('Network failure'));
    };
    xhr.onabort = () => {
      responseFailure(new Error('Request aborted'));
    };
    xhr.open(init.method, url, true);
    Object.keys(init.headers).forEach(function(header) {
      xhr.setRequestHeader(header, init.headers[header]);
    });
    if (init.method == 'POST') {
      xhr.send(init.body);
    } else {
      xhr.send();
    }
    return responsePromise;
  }

  /**
   * Translate status code to error message
   * @param {!Object} response
   * @return {!Promise}
   */
  processResponse_(response) {
    const status = response.status;
    if (status == 404) {
      return Promise.reject(new Error('Publisher not whitelisted'));
    }
    if (status == 403) {
      return Promise.reject(new Error('Not sent from allowed origin'));
    }
    if (status == 400) {
      return Promise.reject(new Error('Invalid request sent'));
    }
    if (status == 500) {
      return Promise.reject(new Error('Server not available'));
    }
    if (!response.ok) {
      return Promise.reject(new Error(response.statusText));
    }
    console.log('response was', response);
    if (response.ok && response.status == 200) {
      return Promise.resolve(response.responseText);
    }
  }

  /** @override */
  sendEvent(event, context) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
      headers: {'Accept': 'text/plain, application/json'},
    });
    const cookie = this.getClientId_();
    let url = this.getUrl_() + '/subopt/data?events=' + this.publicationId_
        + ':' + event;
    if (context) {
      url = url + ':' + context;
    }
    if (cookie) {
      url = url + '&cookie=' + cookie;
    }
    url = url + '&u_tz=240';
    this.sendRequest_(url, init).then(response => {
      console.log('send event response', response);
      return this.processResponse_(response);
    }).catch(reason => {
      // Rethrow async.
      setTimeout(() => {
        throw reason;
      });
    });
  }

  /** @override */
  getPropensity(type, referrer) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
      headers: {'Accept': 'text/plain, application/json'},
    });
    const cookie = this.getClientId_();
    let url = this.getUrl_() + '/subopt/pts?products=' + this.publicationId_
        + '&ref=' + referrer + '&type=' + type + '&u_tz=240';
    if (cookie) {
      url = url + '&cookie=' + cookie;
    }
    console.log('url ', url);
    return this.sendRequest_(url, init).then(response => {
      console.log('get Propensity response', response);
      return this.processResponse_(response);
    }).then(scores => {
      if (!scores) {
        scores = JSON.stringify({'values': [-1]});
      }
      return JSON.parse(scores);
    }).catch(reason => {
      // Rethrow async.
      setTimeout(() => {
        throw reason;
      });
    });
  }
}
