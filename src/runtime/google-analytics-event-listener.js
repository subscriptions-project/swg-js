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

import {analyticsEventToGoogleAnalyticsEvent} from './event-type-mapping';

export class GoogleAnalyticsEventListener {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!./client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();
  }

  /**
   * Start listening to client events
   */
  start() {
    this.eventManager_.registerEventListener(
      this.handleClientEvent_.bind(this)
    );
  }

  /**
   *  Listens for new events from the events manager and logs appropriate events to Google Analytics.
   * @param {!../api/client-event-manager-api.ClientEvent} event
   */
  handleClientEvent_(event) {
    // Bail immediately if neither ga function (analytics.js) nor gtag function (gtag.js) exists in Window.
    if (
      typeof this.win_.ga !== 'function' &&
      typeof this.win_.gtag !== 'function'
    ) {
      return;
    }
    let subscriptionFlow = '';
    if (event.additionalParameters) {
      // additionalParameters isn't strongly typed so checking for both object and class notation.
      subscriptionFlow =
        event.additionalParameters.subscriptionFlow ||
        event.additionalParameters.getSubscriptionFlow();
    }
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      event.eventType,
      subscriptionFlow
    );
    if (!gaEvent) {
      return;
    }

    // TODO(oyj9109): Remove it once universal analytics is deprecated in 2023.
    if (typeof this.win_.ga === 'function') {
      this.win_.ga('send', 'event', gaEvent);
    }

    if (typeof this.win_.gtag === 'function') {
      this.win_.gtag('event', gaEvent.eventAction, {
        'event_category': gaEvent.eventCategory,
        'event_label': gaEvent.eventLabel,
        'non_interaction': gaEvent.nonInteraction,
      });
    }
  }
}
