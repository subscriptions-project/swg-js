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

// PLEASE DO NOT HOST THIS FILE YOURSELF. DOING SO WILL BREAK THINGS.
//
// Publishers should load this file from:
// https://news.google.com/swg/js/v1/swg-gaa.js
//
// Thanks!

import {
  GOOGLE_SIGN_IN_BUTTON_ID,
  GOOGLE_SIGN_IN_IFRAME_STYLES,
} from './html-templates';
import {GaaUserDef, GoogleUserDef} from './typedefs';
import {I18N_STRINGS} from '../../i18n/strings';
import {
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_GSI_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
} from './constants';
import {QueryStringUtils, configureGoogleSignIn} from './utils';
import {createElement, injectStyleSheet} from '../../utils/dom';
import {msg} from '../../utils/i18n';
import {parseQueryString} from '../../utils/url';
import {resolveDoc} from '../../model/doc';
import {warn} from '../../utils/log';

export class GaaGoogleSignInButton {
  /**
   * Renders the Google Sign-In button.
   * @nocollapse
   * @param {{ allowedOrigins: !Array<string> }} params
   */
  static async show({allowedOrigins}) {
    // Optionally grab language code from URL.
    const queryString = QueryStringUtils.getQueryString();
    const queryParams = parseQueryString(queryString);
    const languageCode = queryParams['lang'] || 'en';

    // Apply iframe styles.
    const styleText = GOOGLE_SIGN_IN_IFRAME_STYLES.replace(
      '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$',
      msg(I18N_STRINGS['SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON'], languageCode)
    );
    injectStyleSheet(resolveDoc(self.document), styleText);

    // Promise a function that sends messages to the parent frame.
    // Note: A function is preferable to a reference to the parent frame
    // because referencing the parent frame outside of the 'message' event
    // handler throws an Error. A function defined within the handler can
    // effectively save a reference to the parent frame though.
    const sendMessageToParentFnPromise = new Promise((resolve) => {
      self.addEventListener('message', (e) => {
        if (
          allowedOrigins.indexOf(e.origin) !== -1 &&
          e.data.stamp === POST_MESSAGE_STAMP &&
          e.data.command === POST_MESSAGE_COMMAND_INTRODUCTION
        ) {
          resolve((message) => {
            e.source.postMessage(message, e.origin);
          });
        }
      });
    });

    async function sendErrorMessageToParent() {
      const sendMessageToParent = await sendMessageToParentFnPromise;
      sendMessageToParent({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_ERROR,
      });
    }

    // Validate origins.
    for (const allowedOrigin of allowedOrigins) {
      const url = new URL(allowedOrigin);

      const isOrigin = url.origin === allowedOrigin;
      const protocolIsValid =
        url.protocol === 'http:' || url.protocol === 'https:';
      const isValidOrigin = isOrigin && protocolIsValid;

      if (!isValidOrigin) {
        warn(
          `[swg-gaa.js:GaaGoogleSignInButton.show]: You specified an invalid origin: ${allowedOrigin}`
        );
        sendErrorMessageToParent();
        return;
      }
    }

    // Render the Google Sign-In button.
    try {
      await configureGoogleSignIn();

      // Render the Google Sign-In button.
      const buttonEl = createElement(self.document, 'div', {
        id: GOOGLE_SIGN_IN_BUTTON_ID,
        tabIndex: 0,
      });
      self.document.body.appendChild(buttonEl);

      // Track button clicks.
      buttonEl.addEventListener('click', async () => {
        // Tell parent frame about button click.
        const sendMessageToParent = await sendMessageToParentFnPromise;
        sendMessageToParent({
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_GSI_BUTTON_CLICK,
        });
      });

      // Promise credentials.
      const googleUser = await new Promise((resolve) => {
        self.gapi.signin2.render(GOOGLE_SIGN_IN_BUTTON_ID, {
          'longtitle': true,
          'onsuccess': resolve,
          'prompt': 'select_account',
          'scope': 'profile email',
          'theme': 'dark',
        });
      });

      // Gather GAA user details.
      const basicProfile = /** @type {!GoogleUserDef} */ (
        googleUser
      ).getBasicProfile();
      // Gather authorization response.
      const authorizationData = /** @type {!GoogleUserDef} */ (
        googleUser
      ).getAuthResponse(true);
      /** @type {!GaaUserDef} */
      const gaaUser = {
        idToken: authorizationData.id_token,
        name: basicProfile.getName(),
        givenName: basicProfile.getGivenName(),
        familyName: basicProfile.getFamilyName(),
        imageUrl: basicProfile.getImageUrl(),
        email: basicProfile.getEmail(),
        authorizationData,
      };

      // Send GAA user to parent frame.
      const sendMessageToParent = await sendMessageToParentFnPromise;
      sendMessageToParent({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_USER,
        gaaUser,
      });
    } catch (err) {
      sendErrorMessageToParent();
    }
  }
}
