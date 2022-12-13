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
  GOOGLE_SIGN_IN_IFRAME_STYLES,
  SIGN_IN_WITH_GOOGLE_BUTTON_ID,
} from './html-templates';
import {GoogleIdentityV1Def} from './typedefs';
import {I18N_STRINGS} from '../../i18n/strings';
import {JwtHelper} from '../../utils/jwt';
import {
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
} from './constants';
import {parseQueryString} from '../../utils/url';
import {createElement, injectStyleSheet} from '../../utils/dom';
import {warn} from '../../utils/log';
import {msg} from '../../utils/i18n';
import {QueryStringUtils} from './utils';
import {resolveDoc} from '../../model/doc';

export class GaaSignInWithGoogleButton {
  /**
   * Renders the Google Sign-In button.
   * @nocollapse
   * @param {{ clientId: string, allowedOrigins: !Array<string>, rawJwt: boolean }} params
   */
  static async show({clientId, allowedOrigins, rawJwt = false}) {
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

    async function sendClickMessageToParent() {
      const sendMessageToParent = await sendMessageToParentFnPromise;
      sendMessageToParent({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK,
      });
    }

    // Validate origins.
    for (let i = 0; i < allowedOrigins.length; i++) {
      const allowedOrigin = allowedOrigins[i];
      const url = new URL(allowedOrigin);

      const isOrigin = url.origin === allowedOrigin;
      const protocolIsValid =
        url.protocol === 'http:' || url.protocol === 'https:';
      const isValidOrigin = isOrigin && protocolIsValid;

      if (!isValidOrigin) {
        warn(
          `[swg-gaa.js:GaaSignInWithGoogleButton.show]: You specified an invalid origin: ${allowedOrigin}`
        );
        sendErrorMessageToParent();
        return;
      }
    }

    try {
      const buttonEl = createElement(self.document, 'div', {
        id: SIGN_IN_WITH_GOOGLE_BUTTON_ID,
        tabIndex: 0,
      });
      self.document.body.appendChild(buttonEl);

      const jwt = await new Promise((resolve) => {
        self.google.accounts.id.initialize({
          /* eslint-disable google-camelcase/google-camelcase */
          client_id: clientId,
          callback: resolve,
          allowed_parent_origin: allowedOrigins,
          /* eslint-enable google-camelcase/google-camelcase */
        });
        self.google.accounts.id.renderButton(
          self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID),
          {
            'type': 'standard',
            'theme': 'outline',
            'text': 'continue_with',
            'logo_alignment': 'center',
            'width': buttonEl.offsetWidth,
            'height': buttonEl.offsetHeight,
            'click_listener': sendClickMessageToParent,
          }
        );
      });

      const jwtPayload = /** @type {!GoogleIdentityV1Def} */ (
        new JwtHelper().decode(jwt.credential)
      );
      const returnedJwt = rawJwt ? jwt : jwtPayload;

      // Send GAA user to parent frame.
      const sendMessageToParent = await sendMessageToParentFnPromise;
      sendMessageToParent({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_USER,
        // Note: jwtPayload is deprecated in favor of returnedJwt.
        jwtPayload,
        returnedJwt,
      });
    } catch (err) {
      sendErrorMessageToParent();
    }
  }
}
