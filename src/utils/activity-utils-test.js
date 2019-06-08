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

import {
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {
  acceptPortResultData,
} from './activity-utils';

const OK = ActivityResultCode.OK;

const ORIGIN = 'https://example.com';
const OTHER_ORIGIN = 'https://other.com';

const VERIFIED = true;
const NOT_VERIFIED = false;
const REQUIRE_VERIFIED = true;
const DONT_REQUIRE_VERIFIED = false;

const SECURE = true;
const NOT_SECURE = false;
const REQUIRE_SECURE = true;
const DONT_REQUIRE_SECURE = false;


describes.sandboxed('acceptPortResultData', {}, () => {

  beforeEach(() => {
  });

  it('should resolve success with everything required ', () => {
    const result = new ActivityResult(
      OK, 'A', 'MODE',
      ORIGIN, VERIFIED, SECURE);
    expect(acceptPortResultData(result, ORIGIN,
        REQUIRE_VERIFIED, REQUIRE_SECURE)).to.be.true;
  });

  it('should fail success on wrong origin', () => {
    expect(() => acceptPortResultData(
        new ActivityResult(OK, 'A', 'MODE', OTHER_ORIGIN, VERIFIED, SECURE),
        ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE)).to.throw(/channel mismatch/);
  });

  it('should fail success on not verified', () => {
    expect(() => acceptPortResultData(
        new ActivityResult(OK, 'A', 'MODE', ORIGIN, NOT_VERIFIED, SECURE),
        ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE)).to.throw(/channel mismatch/);
  });

  it('should allow success on not verified', () => {
    const result = new ActivityResult(OK,
        'A', 'MODE', ORIGIN, NOT_VERIFIED, SECURE);
    expect(acceptPortResultData(
        result,
        ORIGIN, DONT_REQUIRE_VERIFIED, REQUIRE_SECURE)).to.be.true;
  });

  it('should fail success on not secure channel', () => {
    expect(() => acceptPortResultData(
        new ActivityResult(OK, 'A', 'MODE', ORIGIN, VERIFIED, NOT_SECURE),
        ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE)).to.throw(/channel mismatch/);
  });

  it('should allow success on not secure channel', () => {
    expect(acceptPortResultData(
        new ActivityResult(OK, 'A', 'MODE', ORIGIN, VERIFIED, NOT_SECURE),
        ORIGIN, REQUIRE_VERIFIED, DONT_REQUIRE_SECURE)).to.be.true;
  });
});
