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
import {
  AnalyticsEvent,
  EventOriginator,
  EventParams,
} from '../proto/api_messages';
import {TC_STRING_UNAVAILABLE} from './gdpr-tcfv2-constants';
import {TcfV2} from './gdpr-tcfv2';
import {addQueryParam} from '../utils/url';
import {adsUrl} from './services';
import {analyticsEventToPublisherEvent} from './event-type-mapping';
import {doArraysMatch, isBoolean, isObject} from '../utils/types';

/**
 * Implements interface to Propensity server
 */
export class PropensityServer {
  /**
   * Page configuration is known when Propensity API
   * is available, publication ID is therefore used
   * in constructor for the server interface.
   * @param {!Window} win
   * @param {!./deps.DepsDef} deps
   * @param {!./fetcher.Fetcher} fetcher
   */
  constructor(win, deps, fetcher) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;
    /** @private {?string} */
    this.clientId_ = null;
    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;
    /** @private @const {number} */
    this.version_ = 1;

    this.deps_
      .eventManager()
      .registerEventListener(this.handleClientEvent_.bind(this));

    /** @private {!Promise<?./gdpr-tcfv2-constants.TCData>} */
    this.tcDataPromise_ = Promise.resolve(null);
    /** @private {?TcfV2} */
    this.gdpr_ = null;
    /** @private {!Array<string>|undefined} */
    this.vendors_ = undefined;
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
    if (!this.clientId_) {
      // Match '__gads' (name of the cookie) dropped by Ads Tag.
      const gadsmatch = this.getDocumentCookie_().match(
        '(^|;)\\s*__gads\\s*=\\s*([^;]+)'
      );
      // Since the cookie will be consumed using decodeURIComponent(),
      // use encodeURIComponent() here to match.
      this.clientId_ = gadsmatch && encodeURIComponent(gadsmatch.pop());
    }
    return this.clientId_;
  }

  /**
   * @private
   * @param {string} url
   * @return {string}
   */
  propensityUrl_(url) {
    url = addQueryParam(url, 'u_tz', '240');
    url = addQueryParam(url, 'v', String(this.version_));
    const clientId = this.getClientId_();
    if (clientId) {
      url = addQueryParam(url, 'cookie', clientId);
    }
    url = addQueryParam(url, 'cdm', this.win_.location.hostname);
    return url;
  }

  /**
   * @param {string} state
   * @param {?string} productsOrSkus
   */
  sendSubscriptionState(state, productsOrSkus) {
    let url = adsUrl('/subopt/data');
    const pubId = this.deps_.pageConfig().getPublicationId();
    url = addQueryParam(url, 'states', pubId + ':' + state);
    if (productsOrSkus) {
      url = addQueryParam(url, 'extrainfo', productsOrSkus);
    }
    this.sendBeacon_(url);
  }

  /**
   * @param {string} event
   * @param {?string} context
   * @private
   */
  sendEvent_(event, context) {
    let url = adsUrl('/subopt/data');
    const pubId = this.deps_.pageConfig().getPublicationId();
    url = addQueryParam(url, 'events', pubId + ':' + event);
    if (context) {
      url = addQueryParam(url, 'extrainfo', context);
    }
    this.sendBeacon_(url);
  }

  /**
   *
   * @param {!../api/client-event-manager-api.ClientEvent} event
   */
  handleClientEvent_(event) {
    /**
     * Does a live check of the config because we don't know when publisher
     * called to enable (it may be after a consent dialog).
     */
    if (
      !this.deps_.config().enablePropensity &&
      event.eventOriginator !== EventOriginator.PROPENSITY_CLIENT
    ) {
      return;
    }

    if (event.eventType === AnalyticsEvent.EVENT_SUBSCRIPTION_STATE) {
      this.sendSubscriptionState(
        event.additionalParameters['state'],
        event.additionalParameters['productsOrSkus']
      );
      return;
    }
    const propEvent = analyticsEventToPublisherEvent(event.eventType);
    if (propEvent == null) {
      return;
    }
    let additionalParameters = event.additionalParameters;
    // The EventParams object is private to SwG analytics.  Do not send.
    if (additionalParameters instanceof EventParams) {
      additionalParameters = undefined;
    }
    if (isBoolean(event.isFromUserAction)) {
      if (!isObject(additionalParameters)) {
        additionalParameters = {};
      }
      additionalParameters['is_active'] = event.isFromUserAction;
    }
    this.sendEvent_(
      propEvent,
      JSON.stringify(/** @type {?JsonObject} */ (additionalParameters))
    );
  }

  /**
   * @param {string} url
   * @private
   */
  sendBeacon_(url) {
    this.setupGDPR_();
    this.tcDataPromise_.then(tcdata => {
      if (tcdata) {
        url = addQueryParam(url, 'gdpr_consent', tcdata.tcString || '');
        url = addQueryParam(url, 'gdpr', tcdata.gdprApplies ? '1' : '0');
      }
      this.fetcher_.sendBeacon(this.propensityUrl_(url));
    });
  }

  /**
   * Reads config and sets GDPR support as appropriate.
   * @private
   */
  setupGDPR_() {
    const vendors = this.deps_.config().gdprVendorIds || undefined;
    if (doArraysMatch(vendors, this.vendors_)) {
      return;
    }

    if (!vendors) {
      this.vendors_ = undefined;
      this.tcDataPromise_ = Promise.resolve(null);
      this.gdpr_.disposeInternal();
      this.gdpr_ = null;
      return;
    }

    let resolver;
    this.tcDataPromise_ = new Promise(resolve => void (resolver = resolve));
    const callback = TCData => {
      if (TCData.tcString === TC_STRING_UNAVAILABLE) {
        this.gdpr_.getTCData(callback, vendors);
        return;
      }
      resolver(TCData);
    };
    this.vendors_ = vendors;
    this.gdpr_ = new TcfV2(this.win_);
    this.gdpr_.getTCData(callback, vendors);
  }

  /**
   * @param {JsonObject} response
   * @return {!../api/propensity-api.PropensityScore}
   */
  parsePropensityResponse_(response) {
    let defaultScore = /** @type {!../api/propensity-api.PropensityScore} */ ({});
    if (!response['header']) {
      defaultScore = /** @type {!../api/propensity-api.PropensityScore} */ ({
        header: {ok: false},
        body: {error: 'No valid response'},
      });
      return defaultScore;
    }
    const status = response['header'];
    let scoreDetails = undefined;
    if (status['ok']) {
      const scores = response['scores'];
      scoreDetails = [];
      for (let i = 0; i < scores.length; i++) {
        const result = scores[i];
        const scoreStatus = !!result['score'];
        let scoreDetail;
        if (scoreStatus) {
          const value = /** @type {!../api/propensity-api.Score} */ ({
            value: result['score'],
            bucketed: result['score_type'] == 2,
          });
          scoreDetail = /** @type {!../api/propensity-api.Body} */ ({
            product: result['product'],
            score: value,
          });
        } else {
          scoreDetail = /** @type {!../api/propensity-api.Body} */ ({
            product: result['product'],
            error: result['error_message'],
          });
        }
        scoreDetails.push(scoreDetail);
      }
      if (scoreDetails) {
        defaultScore = /** @type {!../api/propensity-api.PropensityScore} */ ({
          header: {ok: true},
          body: {scores: scoreDetails},
        });
      }
      return defaultScore;
    }
    defaultScore = /** @type {!../api/propensity-api.PropensityScore} */ ({
      header: {ok: false},
      body: {error: response['error']},
    });
    return defaultScore;
  }
  /**
   * @param {string} referrer
   * @param {string} type
   * @return {?Promise<../api/propensity-api.PropensityScore>}
   */
  getPropensity(referrer, type) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
    });
    const pubId = this.deps_.pageConfig().getPublicationId();
    let url = addQueryParam(adsUrl('/subopt/pts'), 'products', pubId);
    url = addQueryParam(url, 'type', type);
    url = addQueryParam(url, 'ref', referrer);
    return this.fetcher_
      .fetch(this.propensityUrl_(url), init)
      .then(result => result.json())
      .then(response => {
        return this.parsePropensityResponse_(response);
      });
  }
}
