/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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
  AnalyticsEvent as AnalyticsEventDef,
  EventOriginator,
} from '../../proto/api_messages';
import {
  ShowcaseEvent as ShowcaseEventDef,
  Subscriptions as SubscriptionsDef,
} from '../../api/subscriptions';
import {parseQueryString} from '../../utils/url';
import {showcaseEventToAnalyticsEvents} from '../event-type-mapping';

/**
 * Returns true if the query string contains fresh Google Article Access (GAA) params.
 * @param {string} queryString
 * @param {boolean} allowAllAccessTypes
 * @return {boolean}
 */
export function queryStringHasFreshGaaParams(
  queryString,
  allowAllAccessTypes = false
) {
  const params = parseQueryString(queryString);

  // Verify GAA params exist.
  if (
    !params['gaa_at'] ||
    !params['gaa_n'] ||
    !params['gaa_sig'] ||
    !params['gaa_ts']
  ) {
    return false;
  }

  if (!allowAllAccessTypes) {
    // Verify access type.
    const noAccess = params['gaa_at'] === 'na';
    if (noAccess) {
      return false;
    }
  }

  // Verify timestamp isn't stale.
  const expirationTimestamp = parseInt(params['gaa_ts'], 16);
  const currentTimestamp = Date.now() / 1000;
  if (expirationTimestamp < currentTimestamp) {
    return false;
  }

  return true;
}

/**
 * Calls Swgjs.
 * @param { function(!SubscriptionsDef) } callback
 */
export function callSwg(callback) {
  (self.SWG = self.SWG || []).push(callback);
}

/**
 * Loads the Google Sign-In API.
 *
 * This function is used in two places.
 * 1. The publisher's Google Sign-In iframe.
 * 2. (Optional) Demos that allow users to sign out.
 *
 * @return {!Promise}
 */
export async function configureGoogleSignIn() {
  // Wait for Google Sign-In API.
  await new Promise((resolve) => {
    const apiCheckInterval = setInterval(() => {
      if (!!self.gapi) {
        clearInterval(apiCheckInterval);
        resolve();
      }
    }, 50);
  });

  // Load Auth2 module.
  await new Promise((resolve) => self.gapi.load('auth2', resolve));

  // Specify "redirect" mode. It plays nicer with webviews.
  // Only initialize Google Sign-In once.
  self.gapi.auth2.getAuthInstance() || self.gapi.auth2.init();
}

/**
 * Logs Showcase events.
 * @param {{
 *   analyticsEvent: (AnalyticsEventDef|undefined),
 *   showcaseEvent: (ShowcaseEventDef|undefined),
 *   isFromUserAction: boolean,
 * }} params
 */
export function logEvent({
  analyticsEvent,
  showcaseEvent,
  isFromUserAction,
} = {}) {
  callSwg(async (swg) => {
    // Get reference to event manager.
    const eventManager = await swg.getEventManager();
    // Get list of analytics events.
    const eventTypes = showcaseEvent
      ? showcaseEventToAnalyticsEvents(showcaseEvent)
      : [analyticsEvent];

    // Log each analytics event.
    for (const eventType of eventTypes) {
      eventManager.logEvent({
        eventType,
        eventOriginator: EventOriginator.SWG_CLIENT,
        isFromUserAction,
        additionalParameters: null,
      });
    }
  });
}

export class QueryStringUtils {
  /**
   * Returns query string from current URL.
   * Tests can override this method to return different URLs.
   * @return {string}
   */
  static getQueryString() {
    return self.location.search;
  }
}
