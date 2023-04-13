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
import {ClientEvent} from '../api/client-event-manager-api';
import {Deps} from './deps';
import {Fetcher} from './fetcher';
import {PropensityScore} from '../api/propensity-api';
import {Score} from '../api/propensity-api';
import {ScoreDetail} from '../api/propensity-api';
import {addQueryParam} from '../utils/url';
import {adsUrl} from './services';
import {analyticsEventToPublisherEvent} from './event-type-mapping';
import {isBoolean, isObject} from '../utils/types';

interface PropensityResponse {
  header: {
    ok: boolean;
  };
  scores: {
    error_message?: string;
    product: string;
    score_type: number;
    score: number;
  }[];
  error?: string;
}

/**
 * Implements interface to Propensity server
 */
export class PropensityServer {
  private readonly publicationId_: string;
  clientId_: string | null = null;
  version_ = 1;

  /**
   * Page configuration is known when Propensity API
   * is available, publication ID is therefore used
   * in constructor for the server interface.
   */
  constructor(
    private readonly win_: Window,
    private readonly deps_: Deps,
    private readonly fetcher_: Fetcher
  ) {
    this.publicationId_ = this.deps_.pageConfig().getPublicationId();

    this.deps_
      .eventManager()
      .registerEventListener(this.handleClientEvent_.bind(this));
  }

  private getDocumentCookie_(): string {
    return this.win_.document.cookie;
  }

  /**
   * Returns the client ID to be used.
   */
  private getClientId_(): string | null {
    if (!this.clientId_) {
      // Match '__gads' (name of the cookie) dropped by Ads Tag.
      const gadsmatch = this.getDocumentCookie_().match(
        '(^|;)\\s*__gads\\s*=\\s*([^;]+)'
      );
      // Since the cookie will be consumed using decodeURIComponent(),
      // use encodeURIComponent() here to match.
      this.clientId_ = gadsmatch && encodeURIComponent(gadsmatch.pop()!);
    }
    return this.clientId_;
  }

  private propensityUrl_(url: string): string {
    url = addQueryParam(url, 'u_tz', '240');
    url = addQueryParam(url, 'v', String(this.version_));
    const clientId = this.getClientId_();
    if (clientId) {
      url = addQueryParam(url, 'cookie', clientId);
    }
    url = addQueryParam(url, 'cdm', this.win_.location.hostname);
    return url;
  }

  sendSubscriptionState(
    state: string,
    productsOrSkus: string | null
  ): Promise<Response> {
    const init: RequestInit = {
      method: 'GET',
      credentials: 'include',
    };
    let url = adsUrl('/subopt/data');
    url = addQueryParam(url, 'states', this.publicationId_ + ':' + state);
    if (productsOrSkus) {
      url = addQueryParam(url, 'extrainfo', productsOrSkus);
    }
    return this.fetcher_.fetch(this.propensityUrl_(url), init);
  }

  private sendEvent_(event: string, context: string | null): Promise<Response> {
    const init: RequestInit = {
      method: 'GET',
      credentials: 'include',
    };
    let url = adsUrl('/subopt/data');
    url = addQueryParam(url, 'events', this.publicationId_ + ':' + event);
    if (context) {
      url = addQueryParam(url, 'extrainfo', context);
    }
    return this.fetcher_.fetch(this.propensityUrl_(url), init);
  }

  handleClientEvent_(event: ClientEvent): void {
    // Propensity does not need this data and does not have the right to
    // it at this time.  We can consider this if necessary in the future.
    if (event.eventOriginator === EventOriginator.SHOWCASE_CLIENT) {
      return;
    }

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

    let additionalParameters = event.additionalParameters as
      | {
          state?: string;
          productsOrSkus?: string | null;
          is_active?: boolean | null;
        }
      | undefined;
    if (event.eventType === AnalyticsEvent.EVENT_SUBSCRIPTION_STATE) {
      this.sendSubscriptionState(
        additionalParameters!['state']!,
        additionalParameters!['productsOrSkus']!
      );
      return;
    }
    const propEvent = analyticsEventToPublisherEvent(event.eventType);
    if (propEvent == null) {
      return;
    }
    // The EventParams object is private to SwG analytics.  Do not send.
    if (additionalParameters instanceof EventParams) {
      additionalParameters = undefined;
    }
    if (isBoolean(event.isFromUserAction)) {
      if (!isObject(additionalParameters)) {
        additionalParameters = {};
      }
      additionalParameters!['is_active'] = event.isFromUserAction;
    }
    this.sendEvent_(propEvent, JSON.stringify(additionalParameters));
  }

  parsePropensityResponse_(
    response: PropensityResponse
  ): PropensityScore | null {
    if (!response['header']) {
      return {
        header: {ok: false},
        body: {error: 'No valid response'},
      };
    }

    const status = response['header'];
    if (status['ok']) {
      let propensityScore: PropensityScore | null = null;
      const scores = response['scores'];
      const scoreDetails = [];
      for (let i = 0; i < scores.length; i++) {
        const result = scores[i];
        const scoreStatus = !!result['score'];
        let scoreDetail: ScoreDetail;
        if (scoreStatus) {
          const value: Score = {
            value: result['score'],
            bucketed: result['score_type'] == 2,
          };
          scoreDetail = {
            product: result['product'],
            score: value,
          };
        } else {
          scoreDetail = {
            product: result['product'],
            error: result['error_message'],
          };
        }
        scoreDetails.push(scoreDetail);

        propensityScore = {
          header: {ok: true},
          body: {scores: scoreDetails},
        };
      }
      return propensityScore;
    }

    return {
      header: {ok: false},
      body: {error: response['error']},
    };
  }

  async getPropensity(
    referrer: string,
    type: string
  ): Promise<PropensityScore | null> {
    const init: RequestInit = {
      method: 'GET',
      credentials: 'include',
    };
    const url =
      adsUrl('/subopt/pts?products=') +
      this.publicationId_ +
      '&type=' +
      type +
      '&ref=' +
      referrer;
    const response = await this.fetcher_.fetch(this.propensityUrl_(url), init);
    const responseJson = await response.json();
    return this.parsePropensityResponse_(responseJson);
  }
}
