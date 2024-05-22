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
  ClientEvent,
  ClientEventParams,
  GoogleAnalyticsParameters,
} from '../api/client-event-manager-api';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {EventParams} from '../proto/api_messages';
import {analyticsEventToGoogleAnalyticsEvent} from './event-type-mapping';
import {isFunction} from '../utils/types';

type AnalyticsMethod = (
  command: string,
  eventAction: string,
  eventParams: unknown
) => void;

interface WindowWithAnalyticsMethods {
  ga?: AnalyticsMethod;
  gtag?: AnalyticsMethod;
  dataLayer?: unknown[];
}

export class GoogleAnalyticsEventListener {
  private readonly eventManager_: ClientEventManager;

  constructor(private readonly deps_: Deps) {
    this.eventManager_ = deps_.eventManager();
  }

  /**
   * Start listening to client events
   */
  start(): void {
    this.eventManager_.registerEventListener(
      this.handleClientEvent_.bind(this)
    );
  }

  /**
   * Listens for new events from the events manager and logs appropriate events to Google Analytics.
   */
  handleClientEvent_(
    event: ClientEvent,
    eventParams?: ClientEventParams
  ): void {
    // Require either ga function (analytics.js) or gtag function (gtag.js) or dataLayer.push function (gtm.js).
    const gaIsEligible = GoogleAnalyticsEventListener.isGaEligible(this.deps_);
    const gtagIsEligible = GoogleAnalyticsEventListener.isGtagEligible(
      this.deps_
    );
    const gtmIsEligible = GoogleAnalyticsEventListener.isGtmEligible(
      this.deps_
    );
    const anyGoogleAnalyticsLoggingIsEligible =
      gaIsEligible || gtagIsEligible || gtmIsEligible;
    if (!anyGoogleAnalyticsLoggingIsEligible) {
      return;
    }

    // Extract methods from window.
    const {ga, gtag, dataLayer} =
      this.deps_.win() as WindowWithAnalyticsMethods;

    // additionalParameters isn't strongly typed so checking for both object and class notation.
    const subscriptionFlow =
      (event.additionalParameters as {[key: string]: string})?.[
        'subscriptionFlow'
      ] ||
      (event.additionalParameters as EventParams)?.getSubscriptionFlow?.() ||
      '';
    let gaEvent = analyticsEventToGoogleAnalyticsEvent(
      event.eventType,
      subscriptionFlow
    );
    if (!gaEvent) {
      return;
    }

    const analyticsParams: GoogleAnalyticsParameters =
      eventParams?.googleAnalyticsParameters || {};
    gaEvent = {
      ...gaEvent,
      eventCategory: analyticsParams.event_category || gaEvent.eventCategory,
      eventLabel: analyticsParams.event_label || gaEvent.eventLabel,
    };

    // TODO(b/234825847): Remove this once universal analytics is deprecated in 2023.
    if (gaIsEligible) {
      ga!('send', 'event', gaEvent);
    }

    if (gtagIsEligible) {
      const gtagEvent = {
        'event_category': gaEvent.eventCategory,
        'event_label': gaEvent.eventLabel,
        'non_interaction': gaEvent.nonInteraction,
        ...analyticsParams,
      };
      gtag!('event', gaEvent.eventAction, gtagEvent);
    }

    // Support google tag manager.
    if (gtmIsEligible) {
      dataLayer!.push({
        'event': gaEvent.eventAction,
        'event_category': gaEvent.eventCategory,
        'event_label': gaEvent.eventLabel,
        'non_interaction': gaEvent.nonInteraction,
        'configurationId': event.configurationId || '',
        ...analyticsParams,
      });
    }
  }

  /**
   * Function to determine whether event is eligible for GA logging.
   */
  static isGaEligible(deps: Deps): boolean {
    return isFunction((deps.win() as WindowWithAnalyticsMethods).ga);
  }

  /**
   * Function to determine whether event is eligible for gTag logging.
   */
  static isGtagEligible(deps: Deps): boolean {
    return isFunction((deps.win() as WindowWithAnalyticsMethods).gtag);
  }

  /**
   * Function to determine whether event is eligible for GTM logging.
   */
  static isGtmEligible(deps: Deps): boolean {
    return isFunction(
      (deps.win() as WindowWithAnalyticsMethods).dataLayer?.push
    );
  }
}
