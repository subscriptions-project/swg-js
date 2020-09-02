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

import {Xhr} from './xhr';

/** Sentinel used to tell parent that we are communicating with it. */
export const SENTINEL = 'google_signin';
/** Command name for when the parent frame is ready for iframe start. */
export const PARENT_READY_COMMAND = 'parent_frame_ready';
/** Command name for when the Google Sign-in iframe is ready. */
export const INTERMEDIATE_IFRAME_READY_COMMAND = 'intermediate_iframe_ready';
/** Command name for when the user's entitlements are returned from the publisher. */
export const ENTITLEMENTS_READY_COMMAND = 'entitlements_ready';

/** Helper class to handle Google Sign-in configurations for the publisher's Sign-in iframe. */
export class SwgGoogleSigninCreator {
  /**
   * @param {!Array<string>} allowedOrigins
   * @param {!function()} signinCallback
   * @param {!Window} win
   */
  constructor(allowedOrigins, signinCallback, win) {
    /** @private @const {!Array<string>} */
    this.allowedOrigins_ = allowedOrigins;

    /** @private @const {!function()} */
    this.signinCallback_ = signinCallback;

    /** @private @constant {!Window} */
    this.win_ = win;

    /** @private {?string}  */
    this.pendingNonce_ = null;

    /** @const {!Xhr} */
    this.xhr_ = new Xhr(win);
  }

  /**
   * Registers a domain-verifying event listener and requests domain verification.
   */
  start() {
    this.registerDomainVerifier_();
    this.requestDomainVerification_();
  }

  /**
   * Creates the callback function to handle the Google Sign-in CredentialResponse.
   * https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse
   * @param {!string} loginEndpoint
   */
  createGoogleSigninCallback(loginEndpoint) {
    const callback = (response) => {
      if (!response || !response['credential']) {
        return;
      }
      // Create a FormData object containing the response info.
      const formData = new FormData();
      Object.keys(response).map(function (name) {
        formData.append(name, response[name]);
      });
      const init = /** @type {!./xhr.FetchInitDef} */ ({
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      this.xhr_.fetch(loginEndpoint, init).then((response) => {
        this.notifyParent_({
          sentinel: SENTINEL,
          command: ENTITLEMENTS_READY_COMMAND,
          response: (response && response.json()) || {},
        });
      });
    };
    return callback;
  }

  /**
   * Registers an event listener that calls the signinCallback to display the Sign-in button after the event is verified.
   */
  registerDomainVerifier_() {
    if (!this.win_.parent) {
      return;
    }
    this.win_.addEventListener('message', (event) => {
      if (event.source != this.win_.parent || !event.data) {
        return;
      }
      if (!this.pendingNonce_ || !this.signinCallback_) {
        return;
      }
      if (
        event.data['sentinel'] != SENTINEL ||
        event.data['command'] != PARENT_READY_COMMAND
      ) {
        return;
      }
      if (!event.data['nonce'] || event.data['nonce'] != this.pendingNonce_) {
        return;
      }
      this.pendingNonce_ = null;
      if (this.allowedOrigins_.includes(event.origin)) {
        const callback = /** typeof {function} */ this.signinCallback_;
        callback();
      }
    });
  }

  /**
   * Generates a  verification nonce and notifies parent that the iframe is ready.
   */
  requestDomainVerification_() {
    this.pendingNonce_ = this.generateNonce_();
    this.notifyParent_({
      sentinel: SENTINEL,
      command: INTERMEDIATE_IFRAME_READY_COMMAND,
      nonce: this.pendingNonce_,
    });
  }

  /**
   * Sends a post message to the current window's parent.
   * @param {!Object} message
   */
  notifyParent_(message) {
    this.win_.parent && this.win_.parent.postMessage(message, '*');
  }

  /** Generates a verification nonce. */
  generateNonce_() {
    return btoa(Math.floor(Math.random() * 100000) + 1 + '-nonce');
  }
}
