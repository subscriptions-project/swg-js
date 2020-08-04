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

import {getRandomInts} from './random';
import {utf8EncodeSync} from './bytes';

const CHARS = '0123456789ABCDEF';

/**
 * @param {string} _match
 * @param {string} character
 * @return {string}
 */
function toUpperCase(_match, character) {
  return character.toUpperCase();
}

/**
 * @param {string} name Attribute name with dashes
 * @return {string} Dashes removed and character after to upper case.
 * visibleForTesting
 */
export function dashToCamelCase(name) {
  return name.replace(/-([a-z])/g, toUpperCase);
}

/**
 * @param {string} name Attribute name with dashes
 * @return {string} Dashes replaced by underlines.
 */
export function dashToUnderline(name) {
  return name.replace('-', '_');
}

/**
 * Polyfill for String.prototype.endsWith.
 * @param {string} string
 * @param {string} suffix
 * @return {boolean}
 */
export function endsWith(string, suffix) {
  const index = string.length - suffix.length;
  return index >= 0 && string.indexOf(suffix, index) == index;
}

/**
 * Polyfill for String.prototype.startsWith.
 * @param {string} string
 * @param {string} prefix
 * @return {boolean}
 */
export function startsWith(string, prefix) {
  if (prefix.length > string.length) {
    return false;
  }
  return string.lastIndexOf(prefix, 0) == 0;
}

/**
 * Expands placeholders in a given template string with values.
 *
 * Placeholders use ${key-name} syntax and are replaced with the value
 * returned from the given getter function.
 *
 * @param {string} template The template string to expand.
 * @param {!function(string):*} getter Function used to retrieve a value for a
 *   placeholder. Returns values will be coerced into strings.
 * @param {number=} maxIterations Number of times to expand the template.
 *   Defaults to 1, but should be set to a larger value your placeholder tokens
 *   can be expanded to other placeholder tokens. Take caution with large values
 *   as recursively expanding a string can be exponentially expensive.
 */
export function expandTemplate(template, getter, maxIterations = 1) {
  for (let i = 0; i < maxIterations; i++) {
    let matches = 0;
    template = template.replace(/\${([^}]*)}/g, (_a, b) => {
      matches++;
      return getter(b);
    });
    if (!matches) {
      break;
    }
  }
  return template;
}

/**
 * Hash function djb2a
 * This is intended to be a simple, fast hashing function using minimal code.
 * It does *not* have good cryptographic properties.
 * @param {string} str
 * @return {string} 32-bit unsigned hash of the string
 */
export function stringHash32(str) {
  const length = str.length;
  let hash = 5381;
  for (let i = 0; i < length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert from 32-bit signed to unsigned.
  return String(hash >>> 0);
}

/**
 * Ensures the passed value is safe to use for character 19 per rfc4122,
 * sec. 4.1.5.  "Sets the high bits of clock sequence".
 * @param {!number} v
 */
function getChar19(v) {
  return CHARS[(v & 0x3) | 0x8];
}

/**
 * The returned identifier will always be an 8 digit valid hexidecimal number
 * and will be unique for each MS within a given month.
 * @return {string}
 */
function getMonthlyTimeIdentifier() {
  const hexTime = Date.now().toString(16);
  return hexTime.substring(hexTime.length - 8).toUpperCase();
}

/**
 * Generates a RFC 4122 V4 UUID. Ex: "92329D39-6F5C-4520-ABFC-AAB64544E172"
 * The first 8 digits are unique for the millisecond of the month.  The rest
 * are randomly generated.
 */
export function getUuid() {
  let uuid = getMonthlyTimeIdentifier() + '-';
  let rIndex = 0;
  const rands = getRandomInts(23, 16);
  for (let i = 9; i < 36; i++) {
    switch (i) {
      case 13:
      case 18:
      case 23:
        uuid += '-';
        break;
      case 14:
        uuid += '4';
        break;
      case 19:
        uuid += getChar19(rands[rIndex++]);
        break;
      default:
        uuid += CHARS[rands[rIndex++]];
        break;
    }
  }
  return uuid;
}

export function getSwgTransactionId() {
  return getUuid() + '.swg';
}

/**
 * Returns a string whose length matches the length of format.
 * @param {string} str
 * @param {string} format
 * @return {string}
 */
function padString(str, format) {
  return (format + str).slice(-format.length);
}

const PADDING = '00000000';
function toHex(buffer) {
  const hexCodes = [];
  const view = new DataView(buffer);
  for (let i = 0; i < view.byteLength; i += 4) {
    // toString(16) will give the hex representation of the number without padding
    const stringValue = view.getUint32(i).toString(16);
    hexCodes.push(padString(stringValue, PADDING));
  }
  return hexCodes.join('');
}

/**
 * Applies SHA-512 and returns a hexadecimally encoded string of 128 characters.
 * @param {string} stringToHash
 * @return {!Promise<string>}
 */
export function hash(stringToHash) {
  const crypto = self.crypto || self.msCrypto;
  const subtle = crypto.subtle;
  return subtle
    .digest('SHA-512', utf8EncodeSync(stringToHash))
    .then((digest) => toHex(digest));
}
