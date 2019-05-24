/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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
import {adsUrl} from './services';
import {Event} from '../api/propensity-api';
import {AnalyticsEvent,EventOriginator} from '../proto/api_messages';
import {isObject,isBoolean} from '../utils/types';
import {ExperimentFlags} from './experiment-flags';
import {isExperimentOn} from './experiments';

/** @private @const {!Object<number,string>} */
const AnalyticsEventToPropensityEvent = {
  [AnalyticsEvent.UNKNOWN]: null,
  [AnalyticsEvent.IMPRESSION_PAYWALL]: Event.IMPRESSION_PAYWALL,
  [AnalyticsEvent.IMPRESSION_AD]: Event.IMPRESSION_AD,
  [AnalyticsEvent.IMPRESSION_OFFERS]: Event.IMPRESSION_OFFERS,
  [AnalyticsEvent.IMPRESSION_SUBSCRIBE_BUTTON]: null,
  [AnalyticsEvent.IMPRESSION_SMARTBOX]: null,
  [AnalyticsEvent.ACTION_SUBSCRIBE]: null,
  [AnalyticsEvent.ACTION_PAYMENT_COMPLETE]: Event.ACTION_PAYMENT_COMPLETED,
  [AnalyticsEvent.ACTION_ACCOUNT_CREATED]: null,
  [AnalyticsEvent.ACTION_ACCOUNT_ACKNOWLEDGED]: null,
  [AnalyticsEvent.ACTION_SUBSCRIPTIONS_LANDING_PAGE]:
      Event.ACTION_SUBSCRIPTIONS_LANDING_PAGE,
  [AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED]:
      Event.ACTION_PAYMENT_FLOW_STARTED,
  [AnalyticsEvent.ACTION_OFFER_SELECTED]: Event.ACTION_OFFER_SELECTED,
  [AnalyticsEvent.EVENT_PAYMENT_FAILED]: null,
  [AnalyticsEvent.EVENT_CUSTOM]: Event.EVENT_CUSTOM,
};


/**
 * Implements interface to Propensity server
 */
export class PropensityServer {
  /**
   * Page configuration is known when Propensity API
   * is available, publication ID is therefore used
   * in constructor for the server interface.
   * @param {string} publicationId
   * @param {!../api/client-event-manager-api.ClientEventManagerApi} eventManager
   */
  constructor(win, publicationId, eventManager) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private @const {string} */
    this.publicationId_ = publicationId;
    /** @private {?string} */
    this.clientId_ = null;
    /** @private {boolean} */
    this.userConsent_ = false;
    /** @private @const {!Xhr} */
    this.xhr_ = new Xhr(win);
    /** @private @const {number} */
    this.version_ = 1;

    eventManager.registerEventListener(event => this.handleClientEvent_(event));

    // TODO(mborof): b/133519525
    /** @private @const {!boolean} */
    this.logSwgEventsExperiment_ = isExperimentOn(win,
        ExperimentFlags.LOG_SWG_TO_PROPENSITY);

    /** @private {!boolean} */
    this.logSwgEventsConfig_ = false;
  }

  /**
   * @private
   * @return {string}
   */
  getDocumentCookie_() {
    return this.win_.document.cookie;
  }

  /**
   * Returns the client ID to be used.
   * @return {?string}
   * @private
   */
  getClientId_() {
    // No cookie is sent when user consent is not available.
    if (!this.userConsent_) {
      return 'noConsent';
    }
    // When user consent is available, get the first party cookie
    // for Google Ads.
    if (!this.clientId_) {
      // Match '__gads' (name of the cookie) dropped by Ads Tag.
      const gadsmatch = this.getDocumentCookie_().match(
          '(^|;)\\s*__gads\\s*=\\s*([^;]+)');
      // Since the cookie will be consumed using decodeURIComponent(),
      // use encodeURIComponent() here to match.
      this.clientId_ = gadsmatch && encodeURIComponent(gadsmatch.pop());
    }
    return this.clientId_;
  }

  /**
   * @param {boolean} userConsent
   */
  setUserConsent(userConsent) {
    this.userConsent_ = userConsent;
  }

  /**
   * @param {string} state
   * @param {?string} entitlements
   */
  sendSubscriptionState(state, entitlements) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
    });
    const clientId = this.getClientId_();
    let userState = this.publicationId_ + ':' + state;
    if (entitlements) {
      userState = userState + ':' + encodeURIComponent(entitlements);
    }
    let url = adsUrl('/subopt/data?states=')
        + encodeURIComponent(userState) + '&u_tz=240'
        + '&v=' + this.version_;
    if (clientId) {
      url = url + '&cookie=' + clientId;
    }
    return this.xhr_.fetch(url, init);
  }

  /**
   * @param {string} event
   * @param {?string} context
   */
  sendEvent(event, context) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
    });
    const clientId = this.getClientId_();
    let eventInfo = this.publicationId_ + ':' + event;
    if (context) {
      eventInfo = eventInfo + ':' + encodeURIComponent(context);
    }
    let url = adsUrl('/subopt/data?events=')
        + encodeURIComponent(eventInfo) + '&u_tz=240'
        + '&v=' + this.version_;
    if (clientId) {
      url = url + '&cookie=' + clientId;
    }
    return this.xhr_.fetch(url, init);
  }

  /**
   *
   * @param {!../api/client-event-manager-api.ClientEvent} event
   */
  handleClientEvent_(event) {
    const propEvent = AnalyticsEventToPropensityEvent[event.eventType];
    if (propEvent == null) {
      return;
    }
    if (!(this.logSwgEventsExperiment_ && this.logSwgEventsConfig_)
        && event.eventOriginator !== EventOriginator.PROPENSITY_CLIENT) {
      return;
    }
    const additionalParameters = isObject(event.additionalParameters) ?
      event.additionalParameters : {};
    if (isBoolean(event.isFromUserAction)) {
      additionalParameters['is_active'] = event.isFromUserAction;
    }
    this.sendEvent(propEvent,
        JSON.stringify(/** @type {!JsonObject} */ (additionalParameters)));
  }

  /**
   * @param {JsonObject} response
   * @return {!../api/propensity-api.PropensityScore}
   */
  parsePropensityResponse_(response) {
    let defaultScore =
        /** @type {!../api/propensity-api.PropensityScore} */ ({});
    if (!response['header']) {
      defaultScore =
        /** @type {!../api/propensity-api.PropensityScore} */ ({
          header: {ok: false},
          body: {result: 'No valid response'},
        });
    }
    const status = response['header'];
    if (status['ok']) {
      const scores = response['scores'];
      let found = false;
      for (let i = 0; i < scores.length; i++) {
        const result = scores[i];
        if (result['product'] == this.publicationId_) {
          found = true;
          const scoreStatus = !!result['score'];
          let value = undefined;
          if (scoreStatus) {
            value = result['score'];
          } else {
            value = result['error_message'];
          }
          defaultScore =
            /** @type {!../api/propensity-api.PropensityScore} */ ({
              header: {ok: scoreStatus},
              body: {result: value},
            });
          break;
        }
      }
      if (!found) {
        const errorMessage = 'No score available for ' + this.publicationId_;
        defaultScore = /** @type {!../api/propensity-api.PropensityScore} */ ({
          header: {ok: false},
          body: {result: errorMessage},
        });
      }
    } else {
      const errorMessage = response['error'];
      defaultScore = /** @type {!../api/propensity-api.PropensityScore} */ ({
        header: {ok: false},
        body: {result: errorMessage},
      });
    }
    return defaultScore;
  }
  /**
   * @param {string} referrer
   * @param {string} type
   * @return {?Promise<../api/propensity-api.PropensityScore>}
   */
  getPropensity(referrer, type) {
    const clientId = this.getClientId_();
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
    });
    let url = adsUrl('/subopt/pts?products=') + this.publicationId_
        + '&type=' + type + '&u_tz=240'
        + '&ref=' + referrer
        + '&v=' + this.version_;
    if (clientId) {
      url = url + '&cookie=' + clientId;
    }
    return this.xhr_.fetch(url, init).then(result => result.json())
        .then(response => {
          return this.parsePropensityResponse_(response);
        });
  }

  enableLoggingGoogleEvents() {
    this.logSwgEventsConfig_ = true;
  }
}
