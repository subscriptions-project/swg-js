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

import {addQueryParam, parseQueryString, parseUrl} from '../utils/url';

/**
 * Have to put these in the map to avoid compiler optimization. Due to
 * optimization issues, this map only allows property-style keys. E.g. "hr1",
 * as opposed to "1hr".
 * @type {!Object<string, number>}
 * @package Visible for testing only.
 */
export const CACHE_KEYS = {
  'nocache': 1,
  'hr1': 3600000, // 1hr = 1000 * 60 * 60
  'hr12': 43200000, // 12hr = 1000 * 60 * 60 * 12
};

/**
 * @return {string}
 */
export function feOrigin() {
  return parseUrl('$frontend$').origin;
}

/**
 * @param {string} url Relative URL, e.g. "/service1".
 * @return {string} The complete URL.
 */
export function serviceUrl(url) {
  return '$frontend$/swg/_/api/v1' + url;
}

/**
 * @param {string} url  Relative URL, e.g. "/service1".
 * @return {string} The complete URL.
 */
export function adsUrl(url) {
  return '$adsServer$' + url;
}

/**
 * @param {string} url Relative URL, e.g. "/offersiframe".
 * @param {string=} prefix
 * @return {string} The complete URL.
 */
export function feUrl(url, prefix = '') {
  // Add cache param.
  url = feCached('$frontend$' + prefix + '/swg/_/ui/v1' + url);

  // Optionally add jsmode param. This allows us to test against "aggressively" compiled Boq JS.
  const query = parseQueryString(self.location.hash);
  const boqJsMode = query['swg.boqjsmode'];
  if (boqJsMode !== undefined) {
    url = addQueryParam(url, 'jsmode', boqJsMode);
  }

  return url;
}

/**
 * @param {string} url FE URL.
 * @return {string} The complete URL including cache param.
 */
export function feCached(url) {
  return addQueryParam(url, '_', cacheParam('$frontendCache$'));
}

/**
 * @param {!Object<string, ?>} args
 * @return {!Object<string, ?>}
 */
export function feArgs(args) {
  return Object.assign(args, {
    '_client': 'SwG $internalRuntimeVersion$',
  });
}

/**
 * @param {string} cacheKey
 * @return {string}
 * @package Visible for testing only.
 */
export function cacheParam(cacheKey) {
  let period = CACHE_KEYS[cacheKey];
  if (period == null) {
    period = 1;
  }
  if (period === 0) {
    return '_';
  }
  const now = Date.now();
  return String(period <= 1 ? now : Math.floor(now / period));
}
