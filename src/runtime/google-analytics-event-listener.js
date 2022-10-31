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
import {isFunction} from '../utils/types';

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
   * @param {(!../api/client-event-manager-api.ClientEventParams|undefined)=} eventParams
   */
  handleClientEvent_(event, eventParams = undefined) {
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
    let gaEvent = analyticsEventToGoogleAnalyticsEvent(
      event.eventType,
      subscriptionFlow
    );
    if (!gaEvent) {
      return;
    }

    const analyticsParams = eventParams?.googleAnalyticsParameters || {};
    gaEvent = {
      ...gaEvent,
      eventCategory: analyticsParams.event_category || gaEvent.eventCategory,
      eventLabel: analyticsParams.event_label || gaEvent.eventLabel,
    };
    // TODO(b/234825847): Remove it once universal analytics is deprecated in 2023.
    const ga = this.win_.ga || null;
    if (isFunction(ga)) {
      ga('send', 'event', gaEvent);
    }

    const gtag = this.win_.gtag || null;
    if (isFunction(gtag)) {
      const gtagEvent = {
        'event_category': gaEvent.eventCategory,
        'event_label': gaEvent.eventLabel,
        'non_interaction': gaEvent.nonInteraction,
        ...analyticsParams,
      };
      gtag('event', gaEvent.eventAction, gtagEvent);
    }
  }

  /**
   * Function to determine whether event is eligible for GA logging.
   * @param {!./deps.DepsDef} deps
   * @returns {boolean}
   */
  static isGaEligible(deps) {
    return isFunction(deps.win().ga);
  }

  /**
   * Function to determine whether event is eligible for gTag logging.
   * @param {!./deps.DepsDef} deps
   * @returns {boolean}
   */
  static isGtagEligible(deps) {
    return isFunction(deps.win().gtag);
  }
}
