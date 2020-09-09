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

/** Sentinel used to tell parent that we are communicating with it. */
export const SENTINEL = 'google_signin';
/** Command name for when the parent frame is ready for iframe start. */
export const PARENT_READY_COMMAND = 'parent_frame_ready';
/** Command name for when the Google Sign-in iframe is ready. */
export const INTERMEDIATE_IFRAME_READY_COMMAND = 'intermediate_iframe_ready';
/** Command name for when the user's metering parameters are returned from the publisher. */
export const METERING_PARAMS_READY_COMMAND = 'metering_params_ready';

/** Helper class to handle Google Sign-in configurations for the publisher's Sign-in iframe. */
export class SwgGoogleSigninCreator {
  /**
   * @param {!Array<string>} allowedOrigins
   * @param {!string} googleClientId
   * @param {!function()} publisherGoogleSignInCallback
   * @param {!Window} win
   */
  constructor(
    allowedOrigins,
    googleClientId,
    publisherGoogleSignInCallback,
    win
  ) {
    /** @private @const {!Array<string>} */
    this.allowedOrigins_ = allowedOrigins;

    /** @private @constant {!Window} */
    this.win_ = win;

    /** @private @constant {!Object} */
    this.google_ = (() => {
      if (typeof self.google === 'undefined') {
        const script = this.win_.document.createElement('script');
        script.src = 'https://news.google.com/swg/js/v1/google_signin.js';
        this.win_.document.body.appendChild(script);
      }
      return self.google;
    })();

    /** @private @const {!function()} */
    this.signinCallback_ = () => {
      this.google_.accounts.id.initialize({
        /* eslint-disable google-camelcase/google-camelcase */
        client_id: googleClientId,
        callback: this.createGoogleSigninCallback_(
          publisherGoogleSignInCallback
        ),
        auto_select: true,
        /* eslint-enable google-camelcase/google-camelcase */
      });
      this.google_.accounts.id.renderButton(this.win_.parent, {});
    };

    /** @private {?string}  */
    this.pendingNonce_ = null;
  }

  /**
   * Registers a domain-verifying event listener and requests domain verification.
   */
  start() {
    this.registerDomainVerifier_();
    this.requestDomainVerification_();
  }

  /**
   * Modifies the input call back to chain parent notification of response.
   * The input callback should call a publisher endpoint and return a JSON Metering
   * object described here:
   * https://github.com/subscriptions-project/swg-js/blob/main/docs/entitlements-flow.md#swg-entitlements-flow
   * The input argument for the callback is a Google Sign-in CredentialResponse:
   * https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse
   * @param {!function()} callback
   */
  createGoogleSignInCallback(callback) {
    return (signinResponse) => {
      const response = callback(signinResponse);
      this.notifyParent_({
        sentinel: SENTINEL,
        command: METERING_PARAMS_READY_COMMAND,
        response: (response && JSON.parse(response)) || {},
      });
    };
  }

  /**
   * Registers an event listener that calls the signinCallback to display the Sign-in
   * button after the event is verified.
   */
  registerDomainVerifier_() {
    if (!this.win_.parent) {
      return;
    }
    this.win_.addEventListener('message', (event) => {
      // Only allow events from the parent window (SwG)
      if (event.source !== this.win_.parent || !event.data) {
        return;
      }
      // If the nonce isn't set we can't verify the message.
      if (!this.pendingNonce_) {
        return;
      }
      // Checking if the sentinel and commands are as we expect.
      if (
        event.data['sentinel'] != SENTINEL ||
        event.data['command'] != PARENT_READY_COMMAND
      ) {
        return;
      }
      // Check nonce.
      if (!event.data['nonce'] || event.data['nonce'] !== this.pendingNonce_) {
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

  /** Generates a verification nonce. */
  generateNonce_() {
    return btoa(Math.floor(Math.random() * 100000) + 1 + '-nonce');
  }

  /**
   * Sends a post message to the window's parent.
   * Using any domain here ('*') since we have already verified
   * the domain of the parent to be trustworthy due to matching nonces
   * in registerDomainVerifier_.
   * @param {!Object} message
   */
  notifyParent_(message) {
    this.win_.parent && this.win_.parent.postMessage(message, '*');
  }
}
