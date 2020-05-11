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

import {getRandomInts} from './random';

const RAND_FACTOR = 0.7;
const NUM_ROUNDS = 1000;
const NUM_PER_ROUND = 20;

function testRand(maxVal) {
  let maxFound = 0;
  let minFound = maxVal;

  for (let i = NUM_ROUNDS; i > 0; i--) {
    const vals = getRandomInts(NUM_PER_ROUND, maxVal);
    expect(vals.length).to.equal(NUM_PER_ROUND);
    for (let j = 0; j < NUM_PER_ROUND; j++) {
      expect(vals[j] >= 0).to.be.true;
      expect(vals[j]).to.be.lessThan(maxVal);
      if (vals[j] > maxFound) {
        maxFound = vals[j];
      }
      if (vals[j] < minFound) {
        minFound = vals[j];
      }
    }
  }

  // Flakiness warning: Could randomly fail a small percentage of the time.
  // If it fails consistently then there is something wrong with the random
  // number generator.

  // Expect at least 1 value higher than 70% of max value.
  expect(maxFound).to.be.greaterThan(maxVal * RAND_FACTOR);

  // Expect at least 1 value lower than 30% of max value.
  expect(minFound).to.be.lessThan(maxVal * (1 - RAND_FACTOR));
}

describe('getRandomInts', () => {
  it('should generate random small ints that respect boundaries', () => {
    testRand(250);
  });

  it('should generate random medium ints that respect boundaries', () => {
    testRand(32000);
  });

  it('should generate random large ints that respect boundaries', () => {
    testRand(4000000);
  });

  it('should use polyfill if `crypto.getRandomValues` is not available', () => {
    // Mock missing `crypto.getRandomValues` function.
    const getRandomValues = crypto.getRandomValues;
    crypto.getRandomValues = null;
    testRand(1000);

    // Restore `crypto.getRandomValues` function.
    crypto.getRandomValues = getRandomValues;
  });
});
