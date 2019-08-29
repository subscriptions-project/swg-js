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

import {getRandomFloat} from './Math.uuid';

/**
 *
 * @param {!function():string} fun
 */
function testUuidGenerator(fun) {
  const uuid = fun();
  const uuidArray = uuid.split('-');
  expect(uuidArray.length).to.equal(5);
  expect(uuidArray[0].length).to.equal(8);
  expect(uuidArray[1].length).to.equal(4);
  expect(uuid).to.not.be.undefined;
  expect(uuid.length).to.equal(36);
  const uuid2 = fun();
  expect(uuid2).to.not.be.undefined;
  expect(uuid2.length).to.equal(36);
  expect(uuid2).to.not.equal(uuid);
  const uuid3 = fun();
  expect(uuid3).to.not.be.undefined;
  expect(uuid3.length).to.equal(36);
  expect(uuid3).to.not.equal(uuid2);
  expect(uuid3).to.not.equal(uuid);
}

describe('getRandomFloat', () => {
  it('should generate numbers > 0 and < 1', () => {
    for (let i = 10000; i > 0; i--) {
      const v = getRandomFloat();
      expect(v).to.be.greaterThan(0);
      expect(v).to.be.lessThan(1);
    }
  });
});

describe('uuid', () => {
  it('should generate a uuidFast', () => {
    testUuidGenerator(Math.uuidFast);
  });

  it('should generate a uuid', () => {
    testUuidGenerator(Math.uuid);
  });

  it('should generate a uuidCompact', () => {
    testUuidGenerator(Math.uuidCompact);
  });
});
