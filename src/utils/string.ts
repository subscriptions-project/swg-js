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
import {warn} from './log';

const CHARS = '0123456789ABCDEF';

/**
 * Ensures the passed value is safe to use for character 19 per rfc4122,
 * sec. 4.1.5.  "Sets the high bits of clock sequence".
 */
function getChar19(v: number): string {
  return CHARS[(v & 0x3) | 0x8];
}

/**
 * The returned identifier will always be an 8 digit valid hexidecimal number
 * and will be unique for each MS within a given month.
 */
function getMonthlyTimeIdentifier(): string {
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
 */
function padString(str: string, format: string): string {
  return (format + str).slice(-format.length);
}

const PADDING = '00000000';
function toHex(buffer: ArrayBuffer) {
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
 * Returns a hexadecimal 128 character string that is the
 * SHA-512 hash of the passed string.
 * @param {string} stringToHash
 * @return {!Promise<string>}
 */
export async function hash(stringToHash: string): Promise<string> {
  const subtle = self.crypto?.subtle;

  if (!subtle) {
    const message = 'Swgjs only works on secure (HTTPS or localhost) pages.';
    warn(message);
    return Promise.reject(message);
  }

  return toHex(await subtle.digest('SHA-512', utf8EncodeSync(stringToHash)));
}
