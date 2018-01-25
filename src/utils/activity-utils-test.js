/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

import {AbortError} from '../api/abort-error';
import {
  ActivityPort,
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {
  acceptPortResult,
} from './activity-utils';

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


describes.sandboxed('acceptPortResult', {}, () => {
  let port;

  beforeEach(() => {
    port = new ActivityPort();
  });

  function result(code, dataOrError, origin, originVerified, secureChannel) {
    sandbox.stub(port, 'getTargetOrigin', () => origin);
    sandbox.stub(port, 'isTargetOriginVerified', () => originVerified);
    sandbox.stub(port, 'isSecureChannel', () => secureChannel);
    const result = new ActivityResult(
        code, dataOrError,
        origin, originVerified, secureChannel);
    sandbox.stub(port, 'acceptResult', () => Promise.resolve(result));
  }

  it('should resolve success with everything required ', () => {
    result(OK, 'A', ORIGIN, VERIFIED, SECURE);
    return acceptPortResult(
        port,
        ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE).then(data => {
          expect(data).to.equal('A');
        });
  });

  it('should fail success on wrong origin', () => {
    result(OK, 'A', OTHER_ORIGIN, VERIFIED, SECURE);
    return acceptPortResult(
        port,
        ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE).then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(() => {throw reason;}).to.throw(/channel mismatch/);
        });
  });

  it('should fail success on not verified', () => {
    result(OK, 'A', ORIGIN, NOT_VERIFIED, SECURE);
    return acceptPortResult(
        port,
        ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE).then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(() => {throw reason;}).to.throw(/channel mismatch/);
        });
  });

  it('should allow success on not verified', () => {
    result(OK, 'A', ORIGIN, NOT_VERIFIED, SECURE);
    return acceptPortResult(
        port,
        ORIGIN, DONT_REQUIRE_VERIFIED, REQUIRE_SECURE).then(data => {
          expect(data).to.equal('A');
        });
  });

  it('should fail success on not secure channel', () => {
    result(OK, 'A', ORIGIN, VERIFIED, NOT_SECURE);
    return acceptPortResult(
        port,
        ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE).then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(() => {throw reason;}).to.throw(/channel mismatch/);
        });
  });

  it('should allow success on not secure channel', () => {
    result(OK, 'A', ORIGIN, VERIFIED, NOT_SECURE);
    return acceptPortResult(
        port,
        ORIGIN, REQUIRE_VERIFIED, DONT_REQUIRE_SECURE).then(data => {
          expect(data).to.equal('A');
        });
  });

  it('should resolve unexpected failure', () => {
    sandbox.stub(port, 'getTargetOrigin', () => ORIGIN);
    sandbox.stub(port, 'isTargetOriginVerified', () => VERIFIED);
    sandbox.stub(port, 'isSecureChannel', () => SECURE);
    sandbox.stub(port, 'acceptResult',
        () => Promise.reject(new Error('intentional')));
    return acceptPortResult(
        port,
        ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE).then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(() => {throw reason;}).to.throw(/intentional/);
        });
  });

  it('should resolve cancel', () => {
    result(CANCELED, null, ORIGIN, VERIFIED, NOT_SECURE);
    return acceptPortResult(
        port,
        ORIGIN, REQUIRE_VERIFIED, DONT_REQUIRE_SECURE).then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(reason).to.be.instanceof(AbortError);
        });
  });

  it('should resolve failure', () => {
    result(FAILED, 'failure', ORIGIN, VERIFIED, NOT_SECURE);
    return acceptPortResult(
        port,
        ORIGIN, REQUIRE_VERIFIED, DONT_REQUIRE_SECURE).then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(reason).to.not.be.instanceof(AbortError);
          expect(() => {throw reason;}).to.throw(/failure/);
        });
  });
});
