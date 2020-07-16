/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

import {toTimestamp} from './date-utils';

/**
 *
 * @param {*} val
 * @return {boolean}
 */
function isInteger(val) {
  return Math.floor(val) === Math.ceil(val);
}

describe('toTimestamp', () => {
  it('should create a timestamp', () => {
    const date = new Date(819199441032);
    const stamp = toTimestamp(date);
    expect(stamp).to.not.be.null;
    expect(stamp.getSeconds()).to.equal(819199441);
    expect(stamp.getNanos()).to.equal(32000000);
  });

  it('should populate integers', () => {
    const stamp = toTimestamp(new Date());
    expect(isInteger(stamp.getSeconds())).to.be.true;
    expect(isInteger(stamp.getNanos())).to.be.true;
  });
});