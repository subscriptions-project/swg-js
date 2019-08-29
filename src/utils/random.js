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
 * int will vary between 0 and maxInt.
 * @param {!number} numInts
 * @param {!number} maxInt
 */
export function getRandomInts(numInts, maxInt) {
  const arr = new Uint32Array(numInts);
  if (crypto && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
    for (let i = arr.length - 1; i > -1; i--) {
      arr[i] = arr[i] % maxInt;
    }
  } else {
    for (let i = arr.length - 1; i > -1; i--) {
      arr[i] = Math.floor(Math.random() * maxInt);
    }
  }

  return arr; //for older browsers
}
