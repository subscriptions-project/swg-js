/*!
Math.uuid.js (v1.4) : http://www.broofa.com/Tools/Math.uuid.js
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */

// Private array of chars to use
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(
  ''
);

const FACTOR1 = Math.pow(2, 20);
const FACTOR2 = Math.pow(2, -52);

/**
 * Returns a random number between 0 and 1.
 */
export function getRandomFloat() {
  if (crypto && crypto.getRandomValues) {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    const mantissa = arr[0] * FACTOR1 + (arr[1] >>> 12);
    return mantissa * FACTOR2;
  }
  return Math.random(); //for older browsers
}

/**
 * Drops all decimal points in number.  This varies from Math.floor in that it
 * is faster and will round up instead of down if the number is negative.
 * @param {Number} v
 */
function fastFloor(v) {
  return 0 | v;
}

/**
 * Returns a random integer between 0 and maxInt.
 * @param {Number?} maxInt
 */
function getRandomInt(maxInt) {
  return fastFloor(getRandomFloat() * (maxInt || 16));
}

/**
 * Ensures the passed value is safe to use for character 19 per rfc4122,
 * sec. 4.1.5.  "Sets the high bits of clock sequence".
 * @param {!Number} v
 */
function getYVal(v) {
  return (v & 0x3) | 0x8;
}

/**
 * Generates a RFC4122v4 uuid.  This implementation balances readability with
 * execution speed.
 */
Math.uuid = function(len, radix) {
  const uuid = [];
  let i;

  if (len) {
    radix = Math.max(radix || CHARS.length, CHARS.length);
    // Compact form
    for (i = 0; i < len; i++) {
      uuid[i] = CHARS[getRandomInt(radix)];
    }
  } else {
    // rfc4122, version 4 form
    let r;

    // rfc4122 requires these characters
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';

    // Fill in random data.  At i==19 set the high bits of clock sequence as
    // per rfc4122, sec. 4.1.5
    for (i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = getRandomInt(16);
        uuid[i] = CHARS[i == 19 ? getYVal(r) : r];
      }
    }
  }

  return uuid.join('');
};

/**
 * Generates a RFC4122v4 uuid.  This implementation runs the fastest but may
 * be less random and have a smaller solution space.
 */
Math.uuidFast = function() {
  const uuid = new Array(36);
  let rnd = 0;
  let r;

  for (let i = 0; i < 36; i++) {
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      uuid[i] = '-';
    } else if (i == 14) {
      uuid[i] = '4';
    } else {
      if (rnd <= 0x02) {
        rnd = fastFloor(0x2000000 + getRandomFloat() * 0x1000000);
      }
      r = rnd & 0xf;
      rnd = rnd >> 4;
      uuid[i] = CHARS[i == 19 ? getYVal(r) : r];
    }
  }
  return uuid.join('');
};

/**
 * Generates a RFC4122v4 uuid.  This implementation runs slower than the other
 * options but has the highest level of readability.
 */
Math.uuidCompact = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = getRandomInt(16);
    const v = c == 'x' ? r : getYVal(r);
    return v.toString(16).toUpperCase();
  });
};
