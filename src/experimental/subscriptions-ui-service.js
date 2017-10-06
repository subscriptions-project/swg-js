/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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


/**
 * @const {string}
 */
const OFFERS_API_URL = 'http://sp.localhost:8000/examples/sample-sp/api';
import {updateMeteringResponse} from './user-metering.js';

/**
 * Gets the details of the current user, such as if user is a subscriber.
 * @return {!Promise}
 */
export function getSubscriptionDetails() {
  return fetch(`${OFFERS_API_URL}`).then(response => {
    if (!response.ok) {
      throw new Error(response);
    }

    return response.json().then(json => {
      // Updating metering info
      json.metering = updateMeteringResponse(
          window.location.href, json.metering);
      return json;
    });
  });
}
