/** @license
Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com
Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

/*
 * Generate a random uuid.
 * EXAMPLES:
 *   returns RFC4122, version 4 ID
 *   >>> uuidFast()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 * Note: The original code was modified to ES6 and removed other functions,
 * since we are only using uuidFast().
 */

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(
  ''
);

/**
 * Returns a random number between 0 and 1.
 */
export function getRandomFloat() {
  try {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    const mantissa = arr[0] * Math.pow(2, 20) + (arr[1] >>> 12);
    return mantissa * Math.pow(2, -52);
  } catch (e) {
    return Math.random(); //for older browsers
  }
}

export function uuidFast() {
  const uuid = new Array(36);
  let rnd = 0;
  let r;
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid[i] = '-';
    } else if (i === 14) {
      uuid[i] = '4';
    } else {
      if (rnd <= 0x02) {
        rnd = 0x2000000 + (getRandomFloat() * 0x1000000) | 0;
      }
      r = rnd & 0xf;
      rnd = rnd >> 4;
      uuid[i] = CHARS[i == 19 ? (r & 0x3) | 0x8 : r];
    }
  }
  return uuid.join('');
}
