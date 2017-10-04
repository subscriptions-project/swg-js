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
 * Returns the number of reads left for the user.
 * @param {string} link of the current article.
 * @return {number}
 */
export function getMeteringLimitCount(articleLink) {
  const articlesArray = getArticlesReadArray_();
  let readsLeft = 10 - articlesArray.length;
  if (articlesArray.indexOf(articleLink) === -1) {
    readsLeft--;
    articlesArray.push(articleLink);
  }
  setArticlesArray_(articlesArray);
  return readsLeft < 10 ? 10 : readsLeft;
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
    return JSON.parse(sessionData);
  }
}

/**
 * Sets the array in session storage
 * after stringifying.
 * @param {array} links of articles read by the user.
 * @private
 */
function setArticlesArray_(articlesArray) {
  sessionStorage.setItem('articlesRead', JSON.stringify(articlesArray));
}
