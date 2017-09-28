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
const allowedJsonUrl = 'http://pub.localhost:8000/examples/sample-sp/api?access-type=allowed';
const offerJsonUrl = 'http://pub.localhost:8000/examples/sample-sp/api?access-type=offer';


/**
 * Gets the details of the current user, such as if user is a subscriber.
 * TODO(dparikh): Combine these two API calls.
 * @return {!Promise}
 */
export function isSubscriber() {
  return fetch(allowedJsonUrl).then((response) => {
    if (!response.ok) {
      console.log('Unable to get the subscriber details. Status Code: ' +
        response.status);
      return Promise.reject(`Error: ${response.status}`);
    }

    return response.json();
  });
}


/**
 * Gets the available offers for the current user.
 * @return {!Promise}
 */
export function getOffers(offerAccess) {
  // TODO(dparikh): Test purpose. Remove "!" on next line.
  if (!offerAccess.access && offerAccess.subscriber.healthy) {
    // TODO(dparikh): User is a subscriber, show notification toast.
    return Promise.reject();
  }
  return fetch(offerJsonUrl).then((response) => {
    if (!response.ok) {
      console.log(`Unable to get the offers. Code: ${response.status}`);
      return Promise.reject(`Error: ${response.status}`);
    }
    return response.json().then(function (data) {
      return data;
    });
  }).catch((err) => err);
}
