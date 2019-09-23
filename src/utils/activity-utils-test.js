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
import {acceptPortResultData, verifyResultData} from './activity-utils';
import {ActivityPortDef} from '../components/activities';

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
        const error = new Error();
        error.name = 'AbortError';
        return Promise.reject(error);
      }
      return Promise.reject(result.error);
    });
  }

  it('should resolve success with everything required ', () => {
    result(OK, 'A', ORIGIN, VERIFIED, SECURE);
    return acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      REQUIRE_SECURE
    ).then(data => {
      expect(data).to.equal('A');
    });
  });

  it('should verify success', () => {
    const result = new ActivityResult(
      OK,
      'A',
      'MODE',
      ORIGIN,
      VERIFIED,
      SECURE
    );
    let verified = false;
    try {
      verified = verifyResultData(
        result,
        ORIGIN,
        REQUIRE_VERIFIED,
        REQUIRE_SECURE
      );
    } catch (e) {
      // Ignore
    }
    expect(verified).to.be.true;
  });

  it('should fail success on wrong origin', () => {
    result(OK, 'A', OTHER_ORIGIN, VERIFIED, SECURE);
    return acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      REQUIRE_SECURE
    ).then(
      () => {
        throw new Error('must have failed');
      },
      reason => {
        expect(() => {
          throw reason;
        }).to.throw(/channel mismatch/);
      }
    );
  });

  it('should verify origin and fail', () => {
    const result = new ActivityResult(
      OK,
      'A',
      'MODE',
      OTHER_ORIGIN,
      VERIFIED,
      SECURE
    );
    try {
      verifyResultData(result, ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE);
    } catch (e) {
      expect(() => {
        throw new Error(e);
      }).to.throw(/channel mismatch/);
    }
  });

  it('should fail success on not verified', () => {
    result(OK, 'A', ORIGIN, NOT_VERIFIED, SECURE);
    return acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      REQUIRE_SECURE
    ).then(
      () => {
        throw new Error('must have failed');
      },
      reason => {
        expect(() => {
          throw reason;
        }).to.throw(/channel mismatch/);
      }
    );
  });

  it('should verify failure on not verified', () => {
    const result = new ActivityResult(
      OK,
      'A',
      'MODE',
      ORIGIN,
      NOT_VERIFIED,
      SECURE
    );
    try {
      verifyResultData(result, ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE);
    } catch (e) {
      expect(() => {
        throw new Error(e);
      }).to.throw(/channel mismatch/);
    }
  });

  it('should allow success on not verified', () => {
    result(OK, 'A', ORIGIN, NOT_VERIFIED, SECURE);
    return acceptPortResultData(
      port,
      ORIGIN,
      DONT_REQUIRE_VERIFIED,
      REQUIRE_SECURE
    ).then(data => {
      expect(data).to.equal('A');
    });
  });

  it('should verify success on not verified', () => {
    const result = new ActivityResult(
      OK,
      'A',
      'MODE',
      ORIGIN,
      VERIFIED,
      SECURE
    );
    let verified = false;
    try {
      verified = verifyResultData(
        result,
        ORIGIN,
        DONT_REQUIRE_VERIFIED,
        REQUIRE_SECURE
      );
    } catch (e) {
      // Ignore
    }
    expect(verified).to.be.true;
  });

  it('should fail success on not secure channel', () => {
    result(OK, 'A', ORIGIN, VERIFIED, NOT_SECURE);
    return acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      REQUIRE_SECURE
    ).then(
      () => {
        throw new Error('must have failed');
      },
      reason => {
        expect(() => {
          throw reason;
        }).to.throw(/channel mismatch/);
      }
    );
  });

  it('should verify fail on not secure channel', () => {
    const result = new ActivityResult(
      OK,
      'A',
      'MODE',
      ORIGIN,
      VERIFIED,
      NOT_SECURE
    );
    try {
      verifyResultData(result, ORIGIN, REQUIRE_VERIFIED, REQUIRE_SECURE);
    } catch (e) {
      expect(() => {
        throw new Error(e);
      }).to.throw(/channel mismatch/);
    }
  });

  it('should allow success on not secure channel', () => {
    result(OK, 'A', ORIGIN, VERIFIED, NOT_SECURE);
    return acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      DONT_REQUIRE_SECURE
    ).then(data => {
      expect(data).to.equal('A');
    });
  });

  it('should verify success', () => {
    const result = new ActivityResult(
      OK,
      'A',
      'MODE',
      ORIGIN,
      VERIFIED,
      NOT_SECURE
    );
    let verified = false;
    try {
      verified = verifyResultData(
        result,
        ORIGIN,
        REQUIRE_VERIFIED,
        DONT_REQUIRE_SECURE
      );
    } catch (e) {
      // Should not happen
    }
    expect(verified).to.be.true;
  });

  it('should resolve unexpected failure', () => {
    sandbox
      .stub(port, 'acceptResult')
      .callsFake(() => Promise.reject(new Error('intentional')));
    return acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      REQUIRE_SECURE
    ).then(
      () => {
        throw new Error('must have failed');
      },
      reason => {
        expect(() => {
          throw reason;
        }).to.throw(/intentional/);
      }
    );
  });

  it('should resolve cancel', () => {
    result(CANCELED, null, ORIGIN, VERIFIED, NOT_SECURE);
    return acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      DONT_REQUIRE_SECURE
    ).then(
      () => {
        throw new Error('must have failed');
      },
      reason => {
        expect(reason.name).to.equal('AbortError');
      }
    );
  });

  it('should verify cancel', () => {
    const result = new ActivityResult(
      CANCELED,
      null,
      'MODE',
      ORIGIN,
      VERIFIED,
      NOT_SECURE
    );
    try {
      verifyResultData(result, ORIGIN, REQUIRE_VERIFIED, DONT_REQUIRE_SECURE);
    } catch (e) {
      expect(() => {
        throw new Error(e);
      }).to.throw(/AbortError/);
    }
  });

  it('should resolve failure', () => {
    result(FAILED, 'failure', ORIGIN, VERIFIED, NOT_SECURE);
    return acceptPortResultData(
      port,
      ORIGIN,
      REQUIRE_VERIFIED,
      DONT_REQUIRE_SECURE
    ).then(
      () => {
        throw new Error('must have failed');
      },
      reason => {
        expect(reason.name).to.not.equal('AbortError');
        expect(() => {
          throw reason;
        }).to.throw(/failure/);
      }
    );
  });

  it('should fail and throw error', () => {
    const result = new ActivityResult(
      FAILED,
      'faliure',
      'MODE',
      ORIGIN,
      VERIFIED,
      NOT_SECURE
    );
    try {
      verifyResultData(result, ORIGIN, REQUIRE_VERIFIED, DONT_REQUIRE_SECURE);
    } catch (e) {
      expect(() => {
        throw new Error(e);
      }).to.throw(/channel mismatch/);
    }
  });
});
