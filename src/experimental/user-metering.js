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

import {parseJson} from '../utils/json';
import {map} from '../utils/object';

/**
 * Returns the number of reads left for the user.
 * @param {string} link of the current article.
 * @param {JsonObject} metering response.
 * @return {number}
 */
export function updateMeteringResponse(articleLink, meteringResponse) {
  const readArticlesArray = getArticlesReadArray_();
  meteringResponse =
    Object.assign(getDefaultMeteringQuota_(), meteringResponse);
  if (readArticlesArray.indexOf(articleLink) == -1) {
    readArticlesArray.push(articleLink);
  }
  setArticlesArray_(readArticlesArray);
  meteringResponse.quotaLeft = Math.max(0, meteringResponse.quotaMax
      - readArticlesArray.length);

  return meteringResponse;
}

/**
 * Get default metering quota if not present in response.
 * @private
 */
function getDefaultMeteringQuota_() {
  return map({
    'quotaLeft': 3,
    'quotaMax': 10,
    'quotaPeriod': 'month',
    'display': true,
  });
}

/**
 * Gets the array from session storage
 * and parses it.
 * @private
 */
function getArticlesReadArray_() {
  const sessionData = sessionStorage.getItem('articlesRead');
  if (!sessionData) {
    return [];
  } else {
    return parseJson(sessionData);
  }
}

/**
 * Sets the array in session storage
 * after stringifying.
 * @param {array} links of articles read by the user.
 * @private
 */
function setArticlesArray_(readArticlesArray) {
  sessionStorage.setItem('articlesRead', JSON.stringify(readArticlesArray));
}
