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

function testRand(maxVal) {
  for (let i = 1000; i > 0; i--) {
    const vals = getRandomInts(5, maxVal);
    expect(vals.length).to.equal(5);
    for (let j = 0; j < 5; j++) {
      expect(vals[j] >= 0).to.be.true;
      expect(vals[j]).to.be.lessThan(maxVal);
    }
  }
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
});
