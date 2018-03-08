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

import {parseUrl} from '../utils/url';


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
 * @param {string} url Relative URL, e.g. "/offersiframe".
 * @param {string=} prefix
 * @return {string} The complete URL.
 */
export function feUrl(url, prefix = '') {
  // TODO(dvoytenko): switch to "/swg/_/ui/v1" URLs.
  return '$frontend$' + prefix + '/swglib' + url;
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
