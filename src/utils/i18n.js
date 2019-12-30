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

/**
 * @param {!Object<string, string>} map
 * @param {?string|?Element} langOrElement
 * @return {?string}
 */
export function msg(map, langOrElement) {
  const lang = !langOrElement
    ? ''
    : typeof langOrElement == 'string'
    ? langOrElement
    : langOrElement.lang ||
      (langOrElement.ownerDocument &&
        langOrElement.ownerDocument.documentElement.lang);
  let search = ((lang && lang.toLowerCase()) || '').replace(/_/g, '-');
  while (search) {
    if (search in map) {
      return map[search];
    }
    const dash = search.lastIndexOf('-');
    search = dash != -1 ? search.substring(0, dash) : '';
  }
  // "en" is always default.
  return map['en'];
}
