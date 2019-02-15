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
import {Xhr} from '../utils/xhr';

class EventMap {

    /**
     * A list of events
     * @param {?Array<string>} events
     */
    constructor(events) {
      /** @private {Object.<string, number>*/
      this.eventMap_ = {};

      if (events && events.length > 0) {
        for (event in events) {
          this.addEvent(event);
        }
      }

      /** @private @const {number} */
      SUBSCRIPTION_EVENT_MASK = 1;

      /** @private @const {number} */
      NO_PARAMS_EVENT_MASK = 2;
    }

    addSubscriptionEvents(events) {
      for(event in events) {
        this.addEvent(event);
        this.eventMap_[event] |= SUBSCRIPTION_EVENT_MASK;
      }
    }

    addEventsWithNoParams(events) {
      for(event in events) {
        addEvent(event);
        this.eventMap_[event] |= NO_PARAMS_EVENT_MASK;
      }
    }

    addEvent(event) {
      let val = this.eventMap_[event];
      if (val == null) {
        this.eventMap_[event] = 0;
      }
    }

    isSubscriptionEvent(event) {
      return this.eventMap_[event] & SUBSCRIPTION_EVENT_MASK;
    }

    hasNoParams(event) {
      return this.eventMap_[event] & NO_PARAMS_EVENT_MASK;
    }
  }

  /**
   * @implements {PropensityApi}
   */
  export class PropensityImpl {

    /**
     * @param {!Window} win
     */
    constructor(win) {
      /** @private @const {!Window} */
      this.win_ = win;

      /** @private @const {!Xhr} */
      this.xhr_ = new Xhr(win);

      /** @private {string} */
      this.url_ = "https://doubleclick.net/subopts/pts";

      /** @private {string} */
      this.state_ = null;

      /** @private @const */
      this.eventMap_ = new EventMap();

      /** @private @const {Array<string>} */
      this.subscriptionEvents_ = ['subscribed', 'expired', 'cancelled'];

      /** @private @const {Array<string} */
      this.eventsWithoutParams_ = ['paywall'];

      /** @private @const {Array<string>} */
      this.events_ = ['offer_shown', 'ad_shown', 'custom'];

      // Setup Event map
      this.eventMap_.addEventsWithNoParams(this.eventsWithoutParams_);
      this.eventMap_.addSubscriptionEvents(this.subscriptionEvents_);
      for (event in this.events_) {
        this.eventMap_.addEvent(event);
      }
      /** @private {?function((string|!Promise))} */
      this.configuredResolver_ = null;

      /** @private @const {!Promise<string>} */
      this.configPromise_ = new Promise(resolve => {
        this.configResolver_ = resolve;
      });

      /** @private {?function((number|!Promise))} */
      this.propensityResolver_ = null;

      /** @private @const {!Promise<number>} */
      this.propensityPromise_ = new Promise.resolve(resolve => {
          this.propensityResolver_ = resolve;
      });

      /** @private {>function((string|!Promise)} */
      this.clientIdResolver_ = null;

      /** @private {!Promise<string>} */
      this.clientIdPromise_ = new Promise(resolve => {
        this.clientIdResolver_ = resolve;
      });
    }

    /**
     * Configure the propensity module with meta data info
     * @param {!Promise<!PageConfig>} configPromise
     * @return {Promise}
     */
    configure(configPromise) {
      return configPromise.then(pub_id => {
        this.configResolver_(pub_id);
      });
    }

    /**
     * Verifies if meta data/configuration is available
     */

    /**
     * Set subscription state in DRX server
     * @param {number} state
     */
    init_session(state) {
      this.configPromise_.then(pub_id => {
        this.state_ = state;
        this.sendSubscriptionState_(pub_id, state);
      });
    }

    /**
     * Updates DRX server with Subscription State
     * @param {number} newState
     */
    updateSubscriptionState_(newState) {
      this.configurePromise_.then(pub_id => {
        if (this.state_ != newState) {
          this.state_ = newState;
          this.sendSubscriptionState_(pub_id, newState);
        }
      });
    }

    /** @override */
    event(event, json_params) {
      this.configurePromise_.then(pub_id => {
        let paramString = null;
        if (this.eventMap_.isSubscriptionEvent(event)) {
          // TODO(sohanirao): Determine new subscription state
          // send subscription state to DRX server
        }
        if (!this.eventMap_.hasNoParams(event)) {
          paramString = json_params.stringify();
        }
        this.sendEvents_(pub_id, event, paramString);
      });
    }

    /** @override */
    getPropensity(type, referrer) {
      this.configurePromise_.then(pub_id => {
        this.getPropensity_(pub_id, type, referrer).then(propensity => {
          this.propensityResolver_(propensity);
        });
      });
      return this.propensityPromise_;
    }

    sendSubscriptionState_(pub_id, state) {
      this.getClientId_();        
      this.clientIdPromise_.then(client_id => {
        // TODO(sohanirao): use client_id, pub_id, and state to construct
        // A HTTP POST message to the subscription state end point in the
        // DRX server
      });
    }

    sendEvents_(pub_id, event, params) {
      this.getClientId_();        
      this.clientIdPromise_.then(client_id => {
        // TODO(sohanirao): use client_id, pub_id, event and params to construct
        // A HTTP POST message to the events end point in the
        // DRX server
      });
    }

    getPropensity_(pub_id, type, referrer) {
      this.getClientId_();
      this.clientIdPromise_.then(client_id => {
        // TODO(sohanirao): use client_id, pub_id, type and referrer to construct
        // A HTTP GET message to the DRX server
      });
    }

    getClientId_() {
      if (this.clientId_ == null || this.clientId_ == "") {
        var gadsmatch = this.win_.document.cookie.match("(^|;)\\s*__gads\\s*=\\s*([^;]+)");
        var gadsvalue = gadsmatch ? encodeURIComponent(gadsmatch.pop()) : "";
        this.clientId_ = gadsvalue;
      }
      if (this.clientId_ == "") {
        this.clientIdResolver_(Promise.reject(new Error('Client ID not available')));
      }
      this.clientIdResolver_(this.clientId_);
    }
  }
