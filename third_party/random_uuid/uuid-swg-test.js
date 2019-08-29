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

import {uuidFast, getRandomFloat} from './uuid-swg';

/**
 * Returns true if the UUID has a valid format.
 * @param {string} uuid
 */
function isValidUuid(uuid) {
  expect(uuid).to.not.be.undefined;
  expect(uuid.length).to.equal(36);
  const uuidArray = uuid.split('-');
  expect(uuidArray.length).to.equal(5);
  expect(uuidArray[0].length).to.equal(8);
  expect(uuidArray[1].length).to.equal(4);
  expect(uuidArray[2][0]).to.equal('4');
}

/**
 * @param {!function():string} fun
 */
function testUuidGenerator(fun) {
  const uuid = fun();
  const uuid2 = fun();
  const uuid3 = fun();
  isValidUuid(uuid);
  isValidUuid(uuid2);
  isValidUuid(uuid3);
  expect(uuid2).to.not.equal(uuid);
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

describe('uuidFast', () => {
  it('should generate a uuid', () => {
    testUuidGenerator(uuidFast);
  });
});
