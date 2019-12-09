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

import {ActivityPortDef} from '../components/activities';
import {
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {acceptPortResultData} from './activity-utils';

const OK = ActivityResultCode.OK;
const CANCELED = ActivityResultCode.CANCELED;
const FAILED = ActivityResultCode.FAILED;

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
  let port;

  beforeEach(() => {
    port = new ActivityPortDef();
  });

  function result(code, dataOrError, origin, originVerified, secureChannel) {
    const result = new ActivityResult(
      code,
      dataOrError,
      'MODE',
      origin,
      originVerified,
      secureChannel
    );
    sandbox.stub(port, 'acceptResult').callsFake(() => {
      if (result.code == OK) {
        return Promise.resolve(result);
      }
      if (result.code == CANCELED) {
        return Promise.reject(new DOMException('cancel', 'AbortError'));
      }
      return Promise.reject(result.error);
    });
  }

  it('should resolve success with everything required ', async () => {
    result(OK, 'A', ORIGIN, VERIFIED, SECURE);
    const data = await acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      REQUIRE_SECURE
    );
    expect(data).to.equal('A');
  });

  it('should fail success on wrong origin', async () => {
    result(OK, 'A', OTHER_ORIGIN, VERIFIED, SECURE);

    await expect(
      acceptPortResultData(port, ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE)
    ).to.be.rejectedWith(/channel mismatch/);
  });

  it('should fail success on not verified', async () => {
    result(OK, 'A', ORIGIN, NOT_VERIFIED, SECURE);

    await expect(
      acceptPortResultData(port, ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE)
    ).to.be.rejectedWith(/channel mismatch/);
  });

  it('should allow success on not verified', async () => {
    result(OK, 'A', ORIGIN, NOT_VERIFIED, SECURE);
    const data = await acceptPortResultData(
      port,
      ORIGIN,
      DONT_REQUIRE_VERIFIED,
      REQUIRE_SECURE
    );
    expect(data).to.equal('A');
  });

  it('should fail success on not secure channel', async () => {
    result(OK, 'A', ORIGIN, VERIFIED, NOT_SECURE);

    await expect(
      acceptPortResultData(port, ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE)
    ).to.be.rejectedWith(/channel mismatch/);
  });

  it('should allow success on not secure channel', async () => {
    result(OK, 'A', ORIGIN, VERIFIED, NOT_SECURE);
    const data = await acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      DONT_REQUIRE_SECURE
    );
    expect(data).to.equal('A');
  });

  it('should resolve unexpected failure', async () => {
    sandbox
      .stub(port, 'acceptResult')
      .callsFake(() => Promise.reject(new Error('intentional')));

    await expect(
      acceptPortResultData(port, ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE)
    ).to.be.rejectedWith(/intentional/);
  });

  it('should resolve cancel', async () => {
    result(CANCELED, null, ORIGIN, VERIFIED, NOT_SECURE);

    await expect(
      acceptPortResultData(port, ORIGIN, REQUIRE_VERIFIED, DONT_REQUIRE_SECURE)
    ).to.be.rejectedWith('cancel');
  });

  it('should resolve failure', async () => {
    result(FAILED, 'failure', ORIGIN, VERIFIED, NOT_SECURE);

    await expect(
      acceptPortResultData(port, ORIGIN, REQUIRE_VERIFIED, DONT_REQUIRE_SECURE)
    ).to.be.rejectedWith(/failure/);
  });
});
