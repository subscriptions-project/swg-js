/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

import {log} from '../utils/log';
import {tryParseJson} from '../utils/json';
import {isObject} from '../utils/types';


/**
 * @return {!Promise<string>} Returns a string that ids what the customer chose
 * to purchase.
 */
export function startAuth() {
  return new Auth().start();
}


export class Auth {

  constructor() {
    this.accessType_ = this.getAccessType_();
    this.config_ = null;
    this.authResponse_ = null;
  }

  /**
   * To generate blob, see go/subs-pay-blob.
   * @return {!Promise}
   */
  start() {
    // TODO: Add a timeout so this doesn't wait forever to show offers.
    return this.getPaywallConfig_()
      .then(config => this.sendAuthRequests_(config))
      .then(authResponse => {
        this.authResponse_ = authResponse;
      });

  }

  getPaywallConfig_() {
    log('Reading paywall config');
    if (this.config_) {
      return Promise.resolve(this.config_);
    }
    // TODO: Look at the page for now. Eventually also support
    // http://domain/paywall.config.
    const elements = document.getElementsByName('paywall');
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.nodeName == 'SCRIPT' &&
          el.getAttribute('type') == 'application/json') {
        return Promise.resolve(tryParseJson(el.innerText));
      }
    }

    // TODO: Config not found. Handle error.
    return Promise.resolve();
  }

  sendAuthRequests_(config) {
    log('Sending auth requests.');
    if (!isObject(config) || Object.keys(config).length === 0) {
      return Promise.resolve();
    }
    const profiles = config['profiles'];
    if (!this.accessType_ || !profiles || !profiles[this.accessType_]) {
      return Promise.resolve();
    }

    // TODO Move XHR utils to a separate class.
    const services = profiles[this.accessType_]['services'];
    let authPromises = [];
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      const init = {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      };
      let url = service['authorizationUrl'] + '?';
      // TODO: Add polyfill for fetch.
      authPromises.push(window.fetch(url, init)
        .then(response => response.text())
        .then(responseText => {
          log("Got auth response: " + responseText);
          // TODO: Start the offers flow.
          return responseText;
        }));
    }
    return Promise.all(authPromises);
  }

  getAccessType_() {
    log('Checking access type.');
    const elements = document.getElementsByTagName('meta');
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.name == 'access-type') {
        return el.getAttribute('content');
      }
    }
    return null;
  }
}
