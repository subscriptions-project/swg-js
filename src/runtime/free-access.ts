/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

import {FreeAccessApi} from '../api/free-access-api';
import {LocationProvider} from './location-provider';

export class FreeAccess implements FreeAccessApi {
  private static readonly GOOGLE_REFERERS_PREFIX_LIST = [
    'https://www.google.com/',
    'android-app://com.google.android.googlequicksearchbox',
    'android-app://com.google.android.googlequicksearchbox/https/www.google.com',
    'ios-app://com.google.app.ios',
  ];

  private static readonly HOLDBACK_QUERY_PARAM = 'eafs_enabled';
  private static readonly HOLDBACK_ENABLED_VALUE = 'false';

  constructor(private readonly locationProvider = new LocationProvider()) {}

  /**
   * Checks if free access is eligible to be granted to the user under the
   * Free Access program.
   * @return True if article free access regwall is eligible to be shown
   * to the user.
   */
  shouldAllowFreeAccess() {
    const googleReferer = FreeAccess.GOOGLE_REFERERS_PREFIX_LIST.some(
      (prefix) => self.document.referrer.toLowerCase().startsWith(prefix)
    );
    const queryMap = this.getQueryParamsAsMap();
    const holdBackSet =
      queryMap.has(FreeAccess.HOLDBACK_QUERY_PARAM) &&
      queryMap.get(FreeAccess.HOLDBACK_QUERY_PARAM) ===
        FreeAccess.HOLDBACK_ENABLED_VALUE;
    return googleReferer && !holdBackSet;
  }

  returnLocation(): string {
    return this.locationProvider.getSearch();
  }

  private getQueryParamsAsMap(): Map<string, string> {
    const params = new URLSearchParams(this.locationProvider.getSearch());
    const queryMap = new Map<string, string>();

    for (const [key, value] of params.entries()) {
      queryMap.set(key.toLowerCase(), value.toLowerCase());
    }

    return queryMap;
  }
}
