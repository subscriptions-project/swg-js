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
import {ClientEvent} from '../api/client-event-manager-api';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {Fetcher} from './fetcher';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {addQueryParam} from '../utils/url';
import {serviceUrl} from './services';

const audienceActivityLoggingEvents = new Set<AnalyticsEvent>([
  // Keep sorted
  AnalyticsEvent.ACTION_BYO_CTA_BUTTON_CLICK,
  AnalyticsEvent.ACTION_BYO_CTA_CLOSE,
  AnalyticsEvent.ACTION_CONTRIBUTION_OFFER_SELECTED,
  AnalyticsEvent.ACTION_NEWSLETTER_ALREADY_OPTED_IN_CLICK,
  AnalyticsEvent.ACTION_NEWSLETTER_OPT_IN_BUTTON_CLICK,
  AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
  AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
  AnalyticsEvent.ACTION_REGWALL_ALREADY_OPTED_IN_CLICK,
  AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK,
  AnalyticsEvent.ACTION_SURVEY_CLOSED,
  AnalyticsEvent.ACTION_SURVEY_NEXT_BUTTON_CLICK,
  AnalyticsEvent.ACTION_SURVEY_PREVIOUS_BUTTON_CLICK,
  AnalyticsEvent.ACTION_SURVEY_SUBMIT_CLICK,
  AnalyticsEvent.EVENT_NEWSLETTER_OPTED_IN,
  AnalyticsEvent.EVENT_REGWALL_OPTED_IN,
  AnalyticsEvent.EVENT_SURVEY_SUBMITTED,
  AnalyticsEvent.IMPRESSION_BYO_CTA,
  AnalyticsEvent.IMPRESSION_CONTRIBUTION_OFFERS,
  AnalyticsEvent.IMPRESSION_NEWSLETTER_OPT_IN,
  AnalyticsEvent.IMPRESSION_OFFERS,
  AnalyticsEvent.IMPRESSION_PAGE_LOAD,
  AnalyticsEvent.IMPRESSION_PAYWALL,
  AnalyticsEvent.IMPRESSION_REGWALL_OPT_IN,
  AnalyticsEvent.IMPRESSION_SURVEY,
]);

export class AudienceActivityEventListener {
  private readonly eventManager_: ClientEventManager;
  private readonly storage_: Storage;

  constructor(
    private readonly deps_: Deps,
    private readonly fetcher_: Fetcher
  ) {
    this.eventManager_ = this.deps_.eventManager();
    this.storage_ = this.deps_.storage();
  }

  /**
   * Start listening to client events.
   */
  start(): void {
    this.eventManager_.registerEventListener(
      this.handleClientEvent_.bind(this)
    );
  }

  /**
   * Listens for new audience activity events from the events manager and sends them to the SwG Client Server.
   */
  private async handleClientEvent_(event: ClientEvent): Promise<void> {
    // Bail if event is unrelated to Audience Activity.
    if (
      !event.eventType ||
      !audienceActivityLoggingEvents.has(event.eventType)
    ) {
      return;
    }

    // Bail if SUT is unavailable.
    const swgUserToken = await this.storage_.get(StorageKeys.USER_TOKEN, true);
    if (!swgUserToken) {
      return;
    }

    const pubId = encodeURIComponent(
      this.deps_.pageConfig().getPublicationId()
    );
    const audienceActivityClientLogsRequest = this.createLogRequest_(event);
    let url = `/publication/${pubId}/audienceactivity`;
    url = addQueryParam(url, 'sut', swgUserToken);
    this.fetcher_.sendBeacon(
      serviceUrl(url),
      audienceActivityClientLogsRequest
    );
  }

  private createLogRequest_(
    event: ClientEvent
  ): AudienceActivityClientLogsRequest {
    const request = new AudienceActivityClientLogsRequest();
    request.setEvent(event.eventType!);
    return request;
  }
}
