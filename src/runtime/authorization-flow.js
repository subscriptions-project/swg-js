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
import {isObject} from '../utils/types';
import {log} from '../utils/log';
import {map} from '../utils/object';
import {parseJson} from '../utils/json';
import {Timer} from '../utils/timer';
import {Xhr} from '../utils/xhr';


const AUTH_TIMEOUT = 10000;  // 10 seconds.


/**
 * Performs authorization to check if a user has access to a given article.
 */
export class AuthorizationFlow {
  /**
   * Creates a new AuthorizationFlow object.
   * @param  {!Window} win
   * @param  {!./subscription-markup.SubscriptionMarkup} markup
   * @param  {!./subscription-state.SubscriptionState} state
   */
  constructor(win, markup, state) {
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

    /**
     * Map of service ids to their weights. Used for sorting responses sent
     * from services.
     * @private {!Object<string, number>}
     */
    this.serviceWeights_ = map();

    /** @private {!../utils/xhr.Xhr} */
    this.xhr_ = new Xhr(this.win);

    /** @private @const */
    this.state_ = state;
  }

  /**
   * Starts the authorization.
   *
   * This starts the process of gathering all the data from the page, sending
   * requests to subscription platforms and getting the response. From the
   * response, it then either navigates to an authorized page or returns a
   * string that can be passed to payments flow for purchase.
   *
   * @param {?./runtime.SubscriptionPlatformSelector=} opt_platformSelector
   * @return {!Promise}
   */
  start(opt_platformSelector) {
    const platformSelector =
        /** @type {./runtime.SubscriptionPlatformSelector}*/ (
            opt_platformSelector || this.platformSelector_.bind(this));

    return new Timer(this.win).timeoutPromise(
        AUTH_TIMEOUT,
        this.getPaywallConfig_()
            .then(config => this.sendAuthRequests_(config))
            .then(authResponses => {
              if (!authResponses) {
                throw new Error('Auth responses not found.');
              }
              this.state_.activeResponse =
                  platformSelector(this.sortResponses_(authResponses));
              if (this.state_.isSubscriber() || this.state_.isMeteredUser()) {
                this.markup_.setEntitled(EntitledState.ENTITLED);
              }
            }),
        'Authorization could not complete on time');
  }

  /**
   * Retrieves the subscription config from the page or server and returns it.
   *
   * @private
   * @return {!Promise<!JsonObject>}
   */
  getPaywallConfig_() {
    log('Reading paywall config');
    if (this.config_) {
      return Promise.resolve(this.config_);
    }
    const el = this.win.document.getElementById('subscriptionsConfig');
    if (!el) {
      throw new Error('No Subscription config found.');
    }
    if (el.nodeName != 'SCRIPT' ||
        el.getAttribute('type') != 'application/json') {
      throw new Error('Subscription config was invalid.');
    }

    let config;
    try {
      config = parseJson(el.textContent);
    } catch (e) {
      throw new Error('Subscription config could not be parsed.');
    }
    if (!config || !isObject(config) || Object.keys(config).length == 0) {
      throw new Error('Subscription config is empty.');
    }

    this.config_ = config;
    return Promise.resolve(/** @type {!JsonObject} */ (this.config_));
  }

  /**
   * Sends the auth requests to all subscription servers and returns a promise
   * which resolves to data from all the servers.
   *
   * @private
   * @param  {JsonObject} config Configuration that contains details about
   *     servers to contact.
   * @return {!Promise<!Array<!SubscriptionResponse>>}
   */
  sendAuthRequests_(config) {
    log('Sending auth requests.');
    const profiles = config['profiles'];
    if (!this.accessType_ || !profiles || !profiles[this.accessType_]) {
      throw new Error(
          'Can\'t find the subscriber profile for this page in subscription ' +
          'config.');
    }

    // TODO(avimehta, #21): Move XHR utils to a separate class.
    const services = profiles[this.accessType_]['services'];
    const /** !Array<!Promise<!SubscriptionResponse>> */ authPromises = [];
    for (let i = 0; i < services.length; i++) {
      const service = services[i];

      if (this.serviceWeights_[service['id']] == undefined) {
        this.serviceWeights_[service['id']] =
            service['weight'] == undefined ? 1 : service['weight'];
      }

      const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
        method: 'GET',
        headers: {'Accept': 'application/json'},
        credentials: 'include',
      });
      // TODO(dvoytenko): Add URL utils to construct URLs reliably
      const url = service['authorizationUrl'] +
          `&access-type=${encodeURIComponent(this.accessType_)}` +
          `&label=${encodeURIComponent(this.accessType_)}` +
          `&content_id=${encodeURIComponent(this.win.location.pathname)}`;
      authPromises.push(
          this.xhr_.fetch(url, init)
          .then(response => response.json())
          .then(json => /** @type {!SubscriptionResponse} */ ({
            'id': service['id'],
            'response': json,
          })));
    }
    return Promise.all(authPromises);
  }

  /**
   * Sorts the subscription responses based on weights specified in paywall
   * config.
   *
   * @param  {Array<!./runtime.SubscriptionPlatformEntry>} responses
   * @return {Array<!./runtime.SubscriptionPlatformEntry>}
   * @private
   */
  sortResponses_(responses) {
    return responses.sort((a, b) => {
      return this.serviceWeights_[b['id']] - this.serviceWeights_[a['id']];
    });
  }

  /**
   * Sorts the subscription responses based on weights specified in paywall
   * config.
   *
   * @param  {Array<!./runtime.SubscriptionPlatformEntry>} responses
   * @return {!SubscriptionResponse}
   * @private
   */
  platformSelector_(responses) {
    responses.sort((a, b) => {
      const aRes = a.response;
      const bRes = b.response;
      const aIsSub = this.state_.isSubscriber(aRes);
      const aIsMetered = this.state_.isMeteredUser(aRes);
      const bIsSub = this.state_.isSubscriber(bRes);
      const bIsMetered = this.state_.isMeteredUser(bRes);
      const sortKeyA =
          (aIsSub ? 400 : aIsMetered ? 300 : aRes['offer'] ? 200 : 100) +
          this.serviceWeights_[a['id']];
      const sortKeyB =
          (bIsSub ? 400 : bIsMetered ? 300 : bRes['offer'] ? 200 : 100) +
          this.serviceWeights_[b['id']];
      return sortKeyB - sortKeyA;
    });

    return responses[0].response;
  }
}
