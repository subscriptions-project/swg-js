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

import {
  convertPotentialTimestampToMilliseconds,
  convertPotentialTimestampToSeconds,
  toTimestamp,
} from './date-utils';

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
    const millis = 819199441032;
    const stamp = toTimestamp(millis);
    expect(stamp).to.not.be.null;
    expect(stamp.getSeconds()).to.equal(819199441);
    expect(stamp.getNanos()).to.equal(32000000);
  });

  it('should populate integers', () => {
    const stamp = toTimestamp(Date.now());
    expect(isInteger(stamp.getSeconds())).to.be.true;
    expect(isInteger(stamp.getNanos())).to.be.true;
  });
});

describe('convertPotentialTimestampToSeconds', () => {
  it('returns seconds if seconds are provided', () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    expect(convertPotentialTimestampToSeconds(nowInSeconds)).to.equal(
      nowInSeconds
    );
  });
  it('converts milliseconds to seconds', () => {
    const nowInMilliseconds = Date.now();
    const nowInSeconds = Math.floor(nowInMilliseconds / 1000);
    expect(convertPotentialTimestampToSeconds(nowInMilliseconds)).to.equal(
      nowInSeconds
    );
  });
  it('converts microseconds to seconds', () => {
    const nowInMicroseconds = Date.now() * 1000;
    const nowInSeconds = Math.floor(nowInMicroseconds / 1000000);
    expect(convertPotentialTimestampToSeconds(nowInMicroseconds)).to.equal(
      nowInSeconds
    );
  });
});

describe('convertPotentialTimestampToMilliseconds', () => {
  it('converts seconds to milliseconds ', () => {
    const nowInSeconds = Math.floor(Date.now() * 1000);
    const nowInMilliseconds = Date.now();
    expect(convertPotentialTimestampToMilliseconds(nowInSeconds)).to.equal(
      nowInMilliseconds
    );
  });
  it('returns seconds if seconds are provided', () => {
    const nowInMilliseconds = Date.now();
    expect(convertPotentialTimestampToMilliseconds(nowInMilliseconds)).to.equal(
      nowInMilliseconds
    );
  });
  it('converts microseconds to milliseconds', () => {
    const nowInMicroseconds = Date.now() * 1000;
    const nowInMilliseconds = Math.floor(nowInMicroseconds / 1000);
    expect(convertPotentialTimestampToMilliseconds(nowInMicroseconds)).to.equal(
      nowInMilliseconds
    );
  });
});
