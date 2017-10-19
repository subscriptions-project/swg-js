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

import {EntitledState} from '../runtime/subscription-markup';
import {isMeteredUser, isSubscriber} from '../experimental/utils';
import {isObject} from '../utils/types';
import {log} from '../utils/log';
import {parseJson} from '../utils/json';
import {updateMeteringResponse} from '../experimental/user-metering';

/**
 * Performs authorization to check if a user has access to a given article.
 */
export class AuthorizationFlow {

  /**
   * Creates a new AuthorizationFlow object.
   * @param  {!Window} win
   * @param  {!../runtime/subscription-markup.SubscriptionMarkup} markup
   */
  constructor(win, markup) {

    /** @const */
    this.win = win;

    /** @private @const */
    this.markup_ = markup;

    /** @private @const {string} The type of access required for this page. */
    this.accessType_ = this.markup_.getAccessType();

    /**
     * The subscription configuration associated with the page.
     * @private {JsonObject}
     */
    this.config_ = null;
  }

  /**
   * Starts the authorization.
   *
   * This starts the process of gathering all the data from the page, sending
   * requests to subscription platforms and getting the response. From the
   * response, it then either navigates to an authorized page or returns a
   * string that can be passed to payments flow for purchase.
   *
   * @return {!Promise<!SubscriptionResponse>}
   */
  start() {
    // TODO(avimehta, #21): Add a timeout to show offers.
    return this.getPaywallConfig_()
        .then(config => this.sendAuthRequests_(config))
        .then(authResponse => {
          if (!authResponse) {
            return Promise.reject(new Error('Auth response not found.'));
          }
          // TODO(avimehta, #21): Handle more than one responses.
          return authResponse[0];
        })
        .then(json => {
          // Updating metering info
          // TODO(avimehta, #21): Remove when server side metering is in place.
          json.metering = updateMeteringResponse(
              this.win.location.href, json.metering);

          if (isSubscriber(json) || isMeteredUser(json)) {
            this.markup_.setEntitled(EntitledState.ENTITLED);
          }
          return json;
        });
  }

  /**
   * Retrieves the subscription config from the page or server and returns it.
   *
   * @private
   * @return {!Promise<JsonObject>}
   */
  getPaywallConfig_() {
    log('Reading paywall config');
    if (this.config_) {
      return Promise.resolve(this.config_);
    }
    const el = this.win.document.getElementById('subscriptionsConfig');
    if (!el) {
      return Promise.reject(new Error('No Subscription config found.'));
    }
    if (el.nodeName != 'SCRIPT' ||
        el.getAttribute('type') != 'application/json') {
      return Promise.reject(new Error('Subscription config was invalid.'));
    }

    let config;
    try {
      config = parseJson(el.textContent);
    } catch (e) {
      return Promise.reject(
          new Error('Subscription config could not be parsed.'));
    }
    if (!config || !isObject(config) || Object.keys(config).length == 0) {
      return Promise.reject(new Error('Subscription config is empty.'));
    }

    this.config_ = config;
    return Promise.resolve(this.config_);
  }

  /**
   * Sends the auth requests to all subscription servers and returns a promise
   * which resolves to data from all the servers.
   *
   * @private
   * @param  {JsonObject} config Configuration that contains details about
   *                             servers to contact.
   * @return {!Promise<Array<JsonObject>>}
   */
  sendAuthRequests_(config) {
    log('Sending auth requests.');
    const profiles = config['profiles'];
    if (!this.accessType_ || !profiles || !profiles[this.accessType_]) {
      return Promise.reject(
          new Error('Can\'t find the subscriber profile for this page in ' +
              'subscription config.'));
    }

    // TODO(avimehta, #21): Move XHR utils to a separate class.
    const services = profiles[this.accessType_]['services'];
    const authPromises = [];
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      const init = {
        method: 'GET',
        headers: {'Accept': 'application/json'},
        credentials: 'include',
      };
      // TODO(dvoytenko): Add URL utils to construct URLs reliably
      const url = service['authorizationUrl'] +
          `&access-type=${encodeURIComponent(this.accessType_)}` +
          `&label=${encodeURIComponent(this.accessType_)}` +
          `&content_id=${encodeURIComponent(this.win.location.pathname)}`;
      authPromises.push(this.win.fetch(url, init)
          .then(response => parseJson(response.text())));
    }
    return Promise.all(authPromises);
  }
}
