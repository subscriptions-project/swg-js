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

import {debugLog} from '../utils/log';
import {tryParseJson} from "../utils/json";
import {UserState} from '../model/user-state';

const LOGIN_REDIRECT_PARAM = 'googleLoginRedirect';

/**
 */
export class AppLoginManager {
  constructor() {
    /** @private {?MessagePort} */
    this.messagePort_ = null;

    /** @private {?string} */
    this.postLoginRedirectUrl_ =
      new URL(window.location.href).searchParams.get(LOGIN_REDIRECT_PARAM);

    /** @private {?string} */
    this.loginPageUrl_ = null;

    /** @private {!Promise<!UserState>} */
    this.loginPromise_ = new Promise((resolve, reject) => {
      const messageListener = messageEvent => {
        const data = tryParseJson(messageEvent.data);
        if (data && data['app'] === '__GOOGLE_APP_LOGIN__') {
          if (data['name'] === 'handshake-poll' && !this.redirectUrl_) {
            this.messagePort_ = messageEvent.ports[0];
            this.messagePort_.postMessage('{ \'name\': \'handshake\' }');
            this.messagePort_.onmessage = messageListener;
            this.postLoginRedirectUrl_ = data['loginRedirectUrl'];
            debugLog('App login handshake complete.');
          } else if (data['name'] === 'login-payload') {
            debugLog(`Received app login payload: ${data['payload']}`);
            resolve(this.parseUserState(data['payload']));
          }
        }
      }
      window.addEventListener('message', messageListener);
    });
  }

  /**
   * @return {boolean}
   */
  isGoogleAppLoginFlowActive() {
    return !!this.postLoginRedirectUrl_;
  }

  /**
   * @return {boolean}
   */
  isGoogleAppLoginFlowRequired() {
    return !!this.loginPageUrl_;
  }

  /**
   * @param {string} loginUrl
   * @return {!Promise<!UserState>}
   */
  startGoogleAppLoginFlow(loginUrl) {
    if (this.messagePort_ && this.postLoginRedirectUrl_) {
      const url = new URL(loginUrl);
      url.searchParams.append(LOGIN_REDIRECT_PARAM, this.postLoginRedirectUrl_);
      debugLog('Starting app login flow.');
      this.messagePort_.postMessage(`{ 'name': 'login', 'url': '${url.href}' }`);
    }
    return this.loginPromise_;
  }

  /**
   * @param {!UserState} userState
   */
  googleAppLoginFlowComplete(userState) {
    const userStateStr = encodeURI(this.stringifyUserState(userState));
    window.location.href =
      `${this.postLoginRedirectUrl_}?userState=${userStateStr}`;
  }

  /**
   * @param {string} userStateStr
   * @return {UserState}
   */
  parseUserState(userStateStr) {
    const parsedUserStateStr = parseJson(userStateStr);
    return new UserState(parsedUserStateStr["userId"],
      parsedUserStateStr["userAttributes"],
      parsedUserStateStr["data"]);
  }

  /**
   * @param {UserState} userState
   * @return {string}
   */
  stringifyUserState(userState) {
    return `{
      'userId': ${JSON.stringify(userState.getUserId())},
      'userAttributes': ${JSON.stringify(userState.getUserAttributes())},
      'data': ${JSON.stringify(/** @type {!JsonObject} */ (userState.getData()))}
    }`
  }
}
