/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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
  AudienceActivityClientLogsRequest,
} from '../proto/api_messages';
import {Constants} from '../utils/constants';
import {Storage} from './storage';
import {serviceUrl} from './services';

/** @const {!Set<!AnalyticsEvent>} */
const audienceActivityLoggingEvents = new Set([
  AnalyticsEvent.IMPRESSION_PAGE_LOAD,
  AnalyticsEvent.IMPRESSION_PAYWALL,
  AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN,
  AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN,
  AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
  AnalyticsEvent.ACTION_CONTRIBUTION_OFFER_SELECTED,
  AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK,
  AnalyticsEvent.ACTION_REGWALL_ALREADY_OPTED_IN_CLICK,
  AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_BUTTON_CLICK,
  AnalyticsEvent.ACTION_NEWSLETTER_ALREADY_OPTED_IN_CLICK,
  AnalyticsEvent.EVENT_REGWALL_OPTED_IN,
  AnalyticsEvent.EVENT_NEWSLETTER_OPTED_IN,
]);

export class AudienceActivityEventListener {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!./fetcher.Fetcher} fetcher
   */
  constructor(deps, fetcher) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!./client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();

    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;

    /** @private @const {!Storage} */
    this.storage_ = new Storage(this.win_);
  }
  /**
   * Start listening to client events.
   * @public
   */
  start() {
    this.eventManager_.registerEventListener(
      this.handleClientEvent_.bind(this)
    );
  }

  /**
   *  Listens for new audience activity events from the events manager and sends them to the SwG Client Server.
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @private
   */
  handleClientEvent_(event) {
    if (event.eventType && audienceActivityLoggingEvents.has(event.eventType)) {
      const pubId = encodeURIComponent(
        this.deps_.pageConfig().getPublicationId()
      );
      const audienceActivityClientLogsRequest = this.createLogRequest_(event);
      const url = serviceUrl(
        '/publication/' +
          pubId +
          '/audienceactivitylogs' +
          '&sut=' +
          Constants.USER_TOKEN
      );
      this.fetcher_.sendBeacon(url, audienceActivityClientLogsRequest);
      // Constants.USER_TOKEN
    }
  }

  /**
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @return {!AudienceActivityClientLogsRequest}
   * @private
   */
  createLogRequest_(event) {
    const request = new AudienceActivityClientLogsRequest();
    request.setEvent(/** @type {!AnalyticsEvent} */ (event.eventType));
    return request;
  }
}
