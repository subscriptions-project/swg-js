/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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
 * Returns an array of random values.  The length of the array is numInts.  Each
 * int will be >= 0 and < maxVal.
 * @param {!number} numInts
 * @param {!number} maxVal
 */
export function getRandomInts(numInts, maxVal) {
  // Ensure array type is appropriate for the max value (performance)
  const arr =
    maxVal < 256
      ? new Uint8Array(numInts)
      : maxVal < 32768
      ? new Uint16Array(numInts)
      : new Uint32Array(numInts);

  const isIE = !!self.msCrypto;
  const localCrypto = isIE ? self.msCrypto : self.crypto;
  if (localCrypto && localCrypto.getRandomValues) {
    localCrypto.getRandomValues(arr);
    for (let i = arr.length - 1; i > -1; i--) {
      arr[i] = arr[i] % maxVal;
    }
  } else {
    // For older browsers
    for (let i = arr.length - 1; i > -1; i--) {
      arr[i] = Math.floor(Math.random() * maxVal);
    }
  }

  return arr;
}
