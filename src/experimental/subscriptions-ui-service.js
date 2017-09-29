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


// TODO(dparikh): Resolve x-origin issue.
/**
 * @const {string}
 */
const SUBSCRIPTION_HOST = 'http://pub.localhost:8000';

/**
 * @const {string}
 */
const SUBSCRIPTION_PATH = '/examples/sample-sp/api?access-type=allowed';


/**
 * Gets the details of the current user, such as if user is a subscriber.
 * @return {!Promise}
 */
export function getSubscriptionDetails() {
  return fetch(`${SUBSCRIPTION_HOST}${SUBSCRIPTION_PATH}`).then(response => {
    if (!response.ok) {
      throw new Error(response);
    }

    return response.json();
  });
}

