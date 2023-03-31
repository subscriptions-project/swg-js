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
  GOOGLE_3P_SIGN_IN_BUTTON_HTML,
  GOOGLE_3P_SIGN_IN_BUTTON_ID,
  GOOGLE_3P_SIGN_IN_IFRAME_STYLES,
} from './html-templates';
import {GaaUserDef} from './interfaces';
import {I18N_STRINGS} from '../../i18n/strings';
import {
  POST_MESSAGE_COMMAND_3P_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
  REDIRECT_DELAY,
} from './constants';
import {QueryStringUtils} from './utils';
import {createElement, injectStyleSheet} from '../../utils/dom';
import {msg} from '../../utils/i18n';
import {parseQueryString} from '../../utils/url';
import {resolveDoc} from '../../model/doc';
import {warn} from '../../utils/log';

export class GaaGoogle3pSignInButton {
  /**
   * Renders the third party Google Sign-In button for external authentication.
   *
   * GaaGoogle3pSignInButton operates in two modes: redirect and popup.
   * The default mode is pop-up mode which opens the authorizationUrl in a new window.
   * To use a redirect mode and open the authorizationUrl in the same window,
   * set redirectMode to true. For webview applications redirectMode is recommended.
   */
  static show({
    allowedOrigins,
    authorizationUrl,
    redirectMode = false,
  }: {
    allowedOrigins: string[];
    authorizationUrl: string;
    redirectMode: boolean;
  }) {
    // Optionally grab language code from URL.
    const queryString = QueryStringUtils.getQueryString();
    const queryParams = parseQueryString(queryString);
    const languageCode = queryParams['lang'] || 'en';

    // Apply iframe styles.
    const styleText = GOOGLE_3P_SIGN_IN_IFRAME_STYLES.replace(
      '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$',
      msg(I18N_STRINGS['SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON'], languageCode)!
    );
    injectStyleSheet(resolveDoc(self.document), styleText);

    // Render the third party Google Sign-In button.
    const buttonEl = createElement(self.document, 'div', {
      id: GOOGLE_3P_SIGN_IN_BUTTON_ID,
      tabIndex: '0',
    });
    buttonEl./*OK*/ innerHTML = GOOGLE_3P_SIGN_IN_BUTTON_HTML;
    buttonEl.onclick = async () => {
      const sendMessageToParent = await sendMessageToParentFnPromise;
      sendMessageToParent({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_3P_BUTTON_CLICK,
      });

      if (redirectMode) {
        // TODO(b/242998655): Fix the downstream calls for logEvent to be chained to remove the need of delaying redirect.
        self.setTimeout(() => {
          self.open(authorizationUrl, '_parent');
        }, REDIRECT_DELAY);
      } else {
        self.open(authorizationUrl);
      }
    };
    self.document.body.appendChild(buttonEl);

    // Promise a function that sends messages to the parent frame.
    // Note: A function is preferable to a reference to the parent frame
    // because referencing the parent frame outside of the 'message' event
    // handler throws an Error. A function defined within the handler can
    // effectively save a reference to the parent frame though.
    const sendMessageToParentFnPromise = new Promise<
      (message: unknown) => void
    >((resolve) => {
      self.addEventListener('message', (e) => {
        if (
          allowedOrigins.indexOf(e.origin) !== -1 &&
          e.data.stamp === POST_MESSAGE_STAMP &&
          e.data.command === POST_MESSAGE_COMMAND_INTRODUCTION
        ) {
          resolve((message) => {
            (e.source as Window).postMessage(message, e.origin);
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
    for (let i = 0; i < allowedOrigins.length; i++) {
      const allowedOrigin = allowedOrigins[i];
      const url = new URL(allowedOrigin);

      const isOrigin = url.origin === allowedOrigin;
      const protocolIsValid =
        url.protocol === 'http:' || url.protocol === 'https:';
      const isValidOrigin = isOrigin && protocolIsValid;

      if (!isValidOrigin) {
        warn(
          `[swg-gaa.js:GaaGoogle3pSignInButton.show]: You specified an invalid origin: ${allowedOrigin}`
        );
        sendErrorMessageToParent();
        return;
      }
    }

    // Relay message to the parent frame (GAA Intervention).
    self.addEventListener('message', (e) => {
      if (
        allowedOrigins.indexOf(e.origin) !== -1 &&
        e.data.stamp === POST_MESSAGE_STAMP &&
        e.data.command === POST_MESSAGE_COMMAND_USER
      ) {
        self.parent.postMessage(e.data, e.origin);
      }
    });
  }

  /**
   * Notify Google Intervention of a complete sign-in event.
   */
  static gaaNotifySignIn({gaaUser}: {gaaUser: GaaUserDef}) {
    self.opener.postMessage({
      stamp: POST_MESSAGE_STAMP,
      command: POST_MESSAGE_COMMAND_USER,
      gaaUser,
    });
  }
}
