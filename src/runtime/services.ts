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

import {
  ADS_SERVER,
  FRONTEND,
  FRONTEND_CACHE,
  INTERNAL_RUNTIME_VERSION,
  PAY_ENVIRONMENT,
  PLAY_ENVIRONMENT,
} from '../constants';
import {addQueryParam, parseQueryString, parseUrl} from '../utils/url';

/**
 * Have to put these in the map to avoid compiler optimization. Due to
 * optimization issues, this map only allows property-style keys. E.g. "hr1",
 * as opposed to "1hr".
 */
export const CACHE_KEYS: {[key: string]: string} = {
  'zero': '0', //testing value
  'nocache': '1',
  'hr1': '3600000', // 1hr = 1000 * 60 * 60
  'hr12': '43200000', // 12hr = 1000 * 60 * 60 * 12
};

interface OperatingMode {
  frontEnd: string;
  payEnv: string;
  playEnv: string;
  feCache: string;
}

/**
 * Default operating Mode
 */
export const DEFAULT: OperatingMode = {
  frontEnd: FRONTEND,
  payEnv: PAY_ENVIRONMENT,
  playEnv: PLAY_ENVIRONMENT,
  feCache: FRONTEND_CACHE,
};

/**
 * Default operating Mode
 */
const PROD: OperatingMode = {
  frontEnd: 'https://news.google.com',
  payEnv: 'PRODUCTION',
  playEnv: 'PROD',
  feCache: CACHE_KEYS.hr1,
};

/**
 * Default operating Mode
 */
const AUTOPUSH: OperatingMode = {
  frontEnd: 'https://subscribe-autopush.sandbox.google.com',
  payEnv: 'PRODUCTION',
  playEnv: 'AUTOPUSH',
  feCache: CACHE_KEYS.nocache,
};

/**
 * Default operating Mode
 */
const QUAL: OperatingMode = {
  frontEnd: 'https://subscribe-qual.sandbox.google.com',
  payEnv: 'SANDBOX',
  playEnv: 'STAGING',
  feCache: CACHE_KEYS.hr1,
};

/**
 * Operating modes, only runtime switchable modes are here.
 * Build time modes set the default and are configured in prepare.sh.
 *
 * IMPORTANT: modes other than prod will only work on Google internal networks!
 */
export const MODES: {[key: string]: OperatingMode} = {
  'default': DEFAULT,
  'prod': PROD,
  'autopush': AUTOPUSH,
  'qual': QUAL,
};

/**
 * Check for swg.mode= in url fragment. If it exists, use it,
 * otherwise use the default build mode.
 */
export function getSwgMode(): OperatingMode {
  const query = parseQueryString(self.location.hash);
  const swgMode = query['swg.mode'];
  if (swgMode && MODES[swgMode]) {
    return MODES[swgMode];
  }
  return MODES['default'];
}

export function feOrigin(): string {
  return parseUrl(getSwgMode().frontEnd).origin;
}

/**
 * @param url Relative URL, e.g. "/service1".
 * @return The complete URL.
 */
export function serviceUrl(url: string): string {
  // Allows us to make API calls with enabled experiments.
  const query = parseQueryString(self.location.hash);
  const experiments = query['swg.experiments'];
  if (experiments !== undefined) {
    url = addQueryParam(url, 'e', experiments);
  }

  return `${getSwgMode().frontEnd}/swg/_/api/v1` + url;
}

/**
 * @param url Relative URL, e.g. "/service1".
 * @return The complete URL.
 */
export function adsUrl(url: string): string {
  return ADS_SERVER + url;
}

/**
 * @param url Relative URL, e.g. "/offersiframe".
 * @param params List of extra params to append to the URL.
 * @param prefix
 * @return The complete URL.
 */
export function feUrl(
  url: string,
  params: {[key: string]: string} = {},
  prefix = ''
): string {
  // Add cache param.
  const prefixed = prefix ? `swg/${prefix}` : 'swg';
  url = feCached(`${getSwgMode().frontEnd}/${prefixed}/ui/v1${url}`);

  // Optionally add jsmode param. This allows us to test against "aggressively" compiled Boq JS.
  const query = parseQueryString(self.location.hash);
  const boqJsMode = query['swg.boqjsmode'];
  if (boqJsMode !== undefined) {
    url = addQueryParam(url, 'jsmode', boqJsMode);
  }

  // Allows us to open iframes with enabled experiments.
  const experiments = query['swg.experiments'];
  if (experiments !== undefined) {
    url = addQueryParam(url, 'e', experiments);
  }

  for (const param in params) {
    url = addQueryParam(url, param, params[param]);
  }

  return url;
}

/**
 * @param url FE URL.
 * @return The complete URL including cache param.
 */
export function feCached(url: string): string {
  return addQueryParam(url, '_', cacheParam(getSwgMode().feCache));
}

export function feArgs(args: {[key: string]: unknown}): {
  [key: string]: unknown;
} {
  return Object.assign(args, {
    '_client': `SwG ${INTERNAL_RUNTIME_VERSION}`,
  });
}

export function cacheParam(cacheKey: string): string {
  let period = CACHE_KEYS[cacheKey];
  if (period == null) {
    period = '1';
  }
  if (period === '0') {
    return '_';
  }
  const now = Date.now();
  return String(+period <= 1 ? now : Math.floor(now / +period));
}
