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
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {isObject, isBoolean} from '../utils/types';
import {ExperimentFlags} from './experiment-flags';
import {isExperimentOn} from './experiments';
import {analyticsEventToPublisherEvent} from './event-type-mapping';

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
    /** @private @const {!Xhr} */
    this.xhr_ = new Xhr(win);
    /** @private @const {number} */
    this.version_ = 1;

    eventManager.registerEventListener(this.handleClientEvent_.bind(this));

    // TODO(mborof): b/133519525
    /** @private @const {!boolean} */
    this.logSwgEventsExperiment_ = isExperimentOn(
      win,
      ExperimentFlags.LOG_SWG_TO_PROPENSITY
    );

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
    url = url + '&u_tz=240&v=' + this.version_;
    const clientId = this.getClientId_();
    if (clientId) {
      url = url + '&cookie=' + clientId;
    }
    url = url + '&cdm=' + this.win_.location.hostname;
    return url;
  }

  /**
   * @param {string} state
   * @param {?string} productsOrSkus
   */
  sendSubscriptionState(state, productsOrSkus) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
    });
    let userState = this.publicationId_ + ':' + state;
    if (productsOrSkus) {
      userState = userState + ':' + encodeURIComponent(productsOrSkus);
    }
    const url = adsUrl('/subopt/data?states=') + encodeURIComponent(userState);
    return this.xhr_.fetch(this.propensityUrl_(url), init);
  }

  /**
   * @param {string} event
   * @param {?string} context
   * @private
   */
  sendEvent_(event, context) {
    const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
      method: 'GET',
      credentials: 'include',
    });
    let eventInfo = this.publicationId_ + ':' + event;
    if (context) {
      eventInfo = eventInfo + ':' + encodeURIComponent(context);
    }
    const url = adsUrl('/subopt/data?events=') + encodeURIComponent(eventInfo);
    return this.xhr_.fetch(this.propensityUrl_(url), init);
  }

  /**
   *
   * @param {!../api/client-event-manager-api.ClientEvent} event
   */
  handleClientEvent_(event) {
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
    if (
      !(this.logSwgEventsExperiment_ && this.logSwgEventsConfig_) &&
      event.eventOriginator !== EventOriginator.PROPENSITY_CLIENT
    ) {
      return;
    }
    let additionalParameters = event.additionalParameters;

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
    const url =
      adsUrl('/subopt/pts?products=') +
      this.publicationId_ +
      '&type=' +
      type +
      '&ref=' +
      referrer;
    return this.xhr_
      .fetch(this.propensityUrl_(url), init)
      .then(result => result.json())
      .then(response => {
        return this.parsePropensityResponse_(response);
      });
  }

  enableLoggingSwgEvents() {
    this.logSwgEventsConfig_ = true;
  }
}
