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

import {GetEntitlementsParamsExternalDef} from '../../src/api/subscriptions';

/** Sentinel used to tell parent that we are communicating with it. */
export const SENTINEL = 'google_signin';

/** Command name for when the parent frame is ready for iframe start. */
export const PARENT_READY_COMMAND = 'parent_frame_ready';

/** Command name for when the Google Sign-in iframe is ready. */
export const INTERMEDIATE_IFRAME_READY_COMMAND = 'intermediate_iframe_ready';

/** Command name for when the user's metering parameters are returned from the publisher. */
export const METERING_PARAMS_READY_COMMAND = 'metering_params_ready';

/** Location of the Google Sign-in API */
export const GOOGLE_SIGN_IN_URL = 'https://accounts.google.com/gsi/client';

/** Origin of SwG server. Used for postMessages. */
export const SWG_SERVER_ORIGIN = '$frontend$';

/**
 * @typedef {function(!Object): (!GetEntitlementsParamsExternalDef|!Promise<!GetEntitlementsParamsExternalDef>)}
 */
let PublisherGoogleSignInCallbackDef;

/** Renders SwG Google Sign-In buttons in publisher sign-in iframes. */
export class SwgGoogleSignInButtonCreator {
  /**
   * @param {string} googleClientId
   * @param {!PublisherGoogleSignInCallbackDef} publisherGoogleSignInCallback
   * @param {!Window} win
   */
  constructor(googleClientId, publisherGoogleSignInCallback, win) {
    /**
     * The Google Sign-In button renders in this window.
     * @private @constant {!Window}
     */
    this.win_ = win;

    /**
     * The Google Sign-In API.
     * @private @constant {!Promise<{
     *   initialize: function(!Object): void,
     *   renderButton: function(!Window, !Object): void,
     * }>}
     */
    this.googleSignInApiPromise_ = (() =>
      new Promise((resolve) => {
        const script = this.win_.document.createElement('script');
        // Listen for the script's `load` event.
        // This must come before the script's `src` is defined.
        // The script loads instantly if it's cached.
        script.onload = () => {
          resolve(/** @type {!Object} */ (self.google)['accounts']['id']);
        };
        script.src = GOOGLE_SIGN_IN_URL;
        this.win_.document.body.appendChild(script);
      }))();

    /**
     * The publisher-provided function that's called with Google Sign-In
     * credentials after a successful sign-in.
     *
     * The input argument for the callback is a Google Sign-In CredentialResponse:
     * https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse
     *
     * The function must return a promise that resolves with
     * `getEntitlements` method params, as described here:
     * https://github.com/subscriptions-project/swg-js/blob/main/docs/entitlements-flow.md
     * @private @const
     */
    this.publisherGoogleSignInCallback_ = publisherGoogleSignInCallback;

    /**
     * The OAuth Client's ID.
     * @private @const {string}
     */
    this.googleClientId_ = googleClientId;

    /**
     * This nonce identifies a single request sent to the parent iframe.
     * This nonce will be present in valid responses to such requests.
     * @private {?string}
     */
    this.requestNonce_ = null;
  }

  /** Starts process of rendering a SwG Google Sign-In button. */
  start() {
    this.registerDomainVerifier_();
    this.requestDomainVerification_();
  }

  /**
   * Returns a method that sends the parent window the result of calling
   * the publisherGoogleSignInCallback with Google Sign-In credentials.
   * @param {!PublisherGoogleSignInCallbackDef} publisherGoogleSignInCallback
   * @return {function(!Object): void}
   */
  createGoogleSignInCallback_(publisherGoogleSignInCallback) {
    return (googleSignInResponse) => {
      const getEntitlementsParamsPromise = Promise.resolve(
        publisherGoogleSignInCallback(googleSignInResponse)
      );

      getEntitlementsParamsPromise.then((getEntitlementsParams) => {
        this.sendMessageToParent_({
          command: METERING_PARAMS_READY_COMMAND,
          response: getEntitlementsParams,
        });
      });
    };
  }

  /** Renders the Google Sign-In button. */
  renderGoogleSignInButton_() {
    this.googleSignInApiPromise_.then((googleSignInApi) => {
      googleSignInApi.initialize({
        /* eslint-disable google-camelcase/google-camelcase */
        auto_select: true,
        client_id: this.googleClientId_,
        /* eslint-enable google-camelcase/google-camelcase */
        callback: this.createGoogleSignInCallback_(
          this.publisherGoogleSignInCallback_
        ),
      });

      googleSignInApi.renderButton(this.win_.parent, {});
    });
  }

  /**
   * Registers an event listener that calls the signinCallback to display
   * the Google Sign-In button after the event is verified.
   */
  registerDomainVerifier_() {
    this.win_.addEventListener('message', (event) => {
      this.handleVerificationMessage_(event);
    });
  }

  /**
   * Returns true if a given message event is valid.
   * @param {!MessageEvent} event
   * @return {boolean}
   */
  messageEventIsValid_(event) {
    // Ignore missing events.
    if (!event) {
      return false;
    }

    // Ignore events that didn't come from the parent window.
    if (event.source !== this.win_.parent) {
      return false;
    }

    // Ignore unrequested events.
    if (!this.requestNonce_ || event.data['nonce'] !== this.requestNonce_) {
      return false;
    }

    // Ignore events with incorrect sentinels or commands.
    if (
      !event.data ||
      event.data['sentinel'] !== SENTINEL ||
      event.data['command'] !== PARENT_READY_COMMAND
    ) {
      return false;
    }

    // Ignore events with unallowed origins.
    if (event.origin !== SWG_SERVER_ORIGIN) {
      return false;
    }

    // Don't sleep on this one.
    return true;
  }

  /**
   * Renders the Google Sign-In button if a valid verification message comes through.
   * @param {Event} event
   */
  handleVerificationMessage_(event) {
    // Ignore invalid message events.
    if (!this.messageEventIsValid_(/** @type {!MessageEvent} */ (event))) {
      console.log('Ignoring message event:', event);
      return;
    }

    // Render the sign-in button.
    this.renderGoogleSignInButton_();
    this.requestNonce_ = null;
  }

  /** Generates a request nonce and notifies parent that the iframe is ready. */
  requestDomainVerification_() {
    this.requestNonce_ = this.generateRequestNonce_();
    this.sendMessageToParent_({
      command: INTERMEDIATE_IFRAME_READY_COMMAND,
      nonce: this.requestNonce_,
    });
  }

  /**
   * Returns a nonce that identifies a single request sent to the parent iframe.
   * This nonce will be present in valid responses to such requests.
   */
  generateRequestNonce_() {
    return btoa(Math.floor(Math.random() * 100000) + 1 + '-nonce');
  }

  /**
   * Sends a post message to the parent window.
   * @param {!Object} message
   */
  sendMessageToParent_(message) {
    // Add sentinel to message.
    Object.assign(message, {sentinel: SENTINEL});

    // Send message to parent.
    this.win_.parent.postMessage(message, SWG_SERVER_ORIGIN);
  }
}

// Add class to public window scope.
self.SwgGoogleSignInButtonCreator = SwgGoogleSignInButtonCreator;
