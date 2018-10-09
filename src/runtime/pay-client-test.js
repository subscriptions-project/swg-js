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
  ActivityPort,
  ActivityPorts,
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {PayClient, RedirectVerifierHelper} from './pay-client';
import {Xhr} from '../utils/xhr';


const INTEGR_DATA_STRING =
    'eyJzd2dDYWxsYmFja0RhdGEiOnsicHVyY2hhc2VEYXRhIjoie1wib3JkZXJJZFwiOlwiT1' +
    'JERVJcIn0iLCJwdXJjaGFzZURhdGFTaWduYXR1cmUiOiJQRF9TSUciLCJpZFRva2VuIjoi' +
    'ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnpkV0lpT2lKSlJGOV' +
    'VUMHNpZlEuU0lHIiwic2lnbmVkRW50aXRsZW1lbnRzIjoiZXlKaGJHY2lPaUpJVXpJMU5p' +
    'SXNJblI1Y0NJNklrcFhWQ0o5LmV5SmxiblJwZEd4bGJXVnVkSE1pT2x0N0luTnZkWEpqWl' +
    'NJNklsUkZVMVFpZlYxOS5TSUcifX0=';

const EMPTY_ID_TOK = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiJJRF9UT0sifQ.SIG';

const INTEGR_DATA_OBJ = {
  'integratorClientCallbackData': INTEGR_DATA_STRING,
};

const INTEGR_DATA_OBJ_DECODED = {
  'swgCallbackData': {
    'purchaseData': '{"orderId":"ORDER"}',
    'purchaseDataSignature': 'PD_SIG',
    'idToken': EMPTY_ID_TOK,
  },
};


describes.realWin('PayClientBindingSwg', {}, env => {
  let win;
  let activityPorts, activitiesMock, port;
  let resultCallback, resultStub;
  let payClient;

  beforeEach(() => {
    win = env.win;
    activityPorts = new ActivityPorts(win);
    activityPorts.onResult = (requestId, callback) => {
      if (requestId == 'swg-pay') {
        resultCallback = callback;
      }
    };
    port = new ActivityPort();
    activitiesMock = sandbox.mock(activityPorts);
    payClient = new PayClient(win, activityPorts);
    resultStub = sandbox.stub();
    payClient.onResponse(resultStub);
  });

  afterEach(() => {
    activitiesMock.verify();
  });

  /**
   * @param {!ActivityResult} result
   * @return {!Promise<!Object>}
   */
  function withResult(result) {
    sandbox.stub(port, 'acceptResult', () => Promise.resolve(result));
    resultCallback(port);
    expect(resultStub).to.be.calledOnce;
    return resultStub.args[0][0];
  }

  it('should select the right binding', () => {
    expect(payClient.getType()).to.equal('SWG');
  });

  it('should have valid flow constructed', () => {
    const popupWin = {};
    activitiesMock.expects('open').withExactArgs(
        'swg-pay',
        'PAY_ORIGIN/gp/p/ui/pay?_=_',
        '_blank',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'paymentArgs': {'a': 1},
        },
        {})
        .returns({targetWin: popupWin})
        .once();
    const opener = payClient.start({
      'paymentArgs': {'a': 1},
    });
    expect(opener).to.equal(popupWin);
  });

  it('should force redirect mode', () => {
    activitiesMock.expects('open').withExactArgs(
        'swg-pay',
        'PAY_ORIGIN/gp/p/ui/pay?_=_',
        '_top',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'paymentArgs': {'a': 1},
        },
        {})
        .returns(undefined)
        .once();
    const opener = payClient.start({
      'paymentArgs': {'a': 1},
    }, {
      forceRedirect: true,
    });
    expect(opener).to.be.null;
  });

  it('should catch mismatching channel', () => {
    const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ);
    return withResult(result).then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/channel mismatch/);
    });
  });

  it('should require secure channel for unencrypted payload', () => {
    const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ,
        'REDIRECT', 'PAY_ORIGIN', true, false);
    return withResult(result).then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/channel mismatch/);
    });
  });

  it('should require secure channel for unverified payload', () => {
    const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ,
        'REDIRECT', 'PAY_ORIGIN', false, true);
    return withResult(result).then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/channel mismatch/);
    });
  });

  it('should accept a correct payment response', () => {
    const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ,
        'POPUP', 'PAY_ORIGIN', true, true);
    return withResult(result).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ);
    });
  });

  it('should accept a correct payment response as decoded obj', () => {
    const result = new ActivityResult(ActivityResultCode.OK,
        INTEGR_DATA_OBJ_DECODED,
        'POPUP', 'PAY_ORIGIN', true, true);
    return withResult(result).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ_DECODED);
    });
  });

  it('should accept a correct payment response as encrypted obj' +
     ' in PRODUCTION', () => {
    const encryptedData = 'ENCRYPTED';
    const encryptedResponse = {
      redirectEncryptedCallbackData: encryptedData,
      environment: 'PRODUCTION',
    };
    const result = new ActivityResult(ActivityResultCode.OK,
        encryptedResponse,
        'POPUP', 'PAY_ORIGIN', true, true);
    const xhrFetchStub = sandbox.stub(Xhr.prototype, 'fetch',
        () => Promise.resolve(
        {json: () => Promise.resolve(INTEGR_DATA_OBJ_DECODED)}));
    return withResult(result).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ_DECODED);
      // Verify xhr call.
      expect(xhrFetchStub).to.be.calledOnce;
      expect(xhrFetchStub).to.be.calledWith(
          'PAY_ORIGIN/gp/p/apis/buyflow/process', ({
            method: 'post',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
            body: encryptedData,
            mode: 'cors',
          }));
    });
  });

  it('should accept a correct payment response as encrypted obj' +
    ' in SANDBOX', () => {
    const encryptedData = 'ENCRYPTED';
    const encryptedResponse = {
      redirectEncryptedCallbackData: encryptedData,
      environment: 'SANDBOX',
    };
    const result = new ActivityResult(ActivityResultCode.OK,
        encryptedResponse,
        'POPUP', 'PAY_ORIGIN', true, true);
    const xhrFetchStub = sandbox.stub(Xhr.prototype, 'fetch',
        () => Promise.resolve(
          {json: () => Promise.resolve(INTEGR_DATA_OBJ_DECODED)}));
    return withResult(result).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ_DECODED);
      // Verify xhr call.
      expect(xhrFetchStub).to.be.calledOnce;
      expect(xhrFetchStub).to.be.calledWith(
          'PAY_ORIGIN/gp/p/apis/buyflow/process', ({
            method: 'post',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
            body: encryptedData,
            mode: 'cors',
          }));
    });
  });

  it('should propagate cancelation', () => {
    sandbox.stub(port, 'acceptResult', () => Promise.reject(
        new DOMException('cancel', 'AbortError')));
    resultCallback(port);
    expect(resultStub).to.be.calledOnce;
    return resultStub.args[0][0].then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/cancel/);
    });
  });

  it('should propagate an error', () => {
    sandbox.stub(port, 'acceptResult', () => Promise.reject(
        new Error('intentional')));
    resultCallback(port);
    expect(resultStub).to.be.calledOnce;
    return resultStub.args[0][0].then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/intentional/);
    });
  });
});


describes.sandboxed('RedirectVerifierHelper', {}, () => {
  const TEST_KEY = 'AQIDBAUGBwgJCgsMDQ4PEA==';
  const TEST_VERIFIER = 'QlJKRUNCVkhDeGhLRGh0TkVSNVFGQj4+';

  let win;
  let localStorage, storageMap;
  let subtle, crypto;
  let helper;

  beforeEach(() => {

    storageMap = {};
    localStorage = {
      getItem: key => storageMap[key],
      setItem: (key, value) => {storageMap[key] = value;},
    };

    subtle = {
      digest: (options, bytes) => {
        const hash = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          hash[i] = bytes[i] + 1;
        }
        return Promise.resolve(hash);
      },
    };

    crypto = {
      subtle,
      getRandomValues: bytes => {
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = i + 1;
        }
      },
    };

    win = {
      crypto,
      localStorage,
    };
    helper = new RedirectVerifierHelper(win);
  });

  function useVerifierPromise() {
    return new Promise(resolve => {
      helper.useVerifier(resolve);
    });
  }

  function useVerifierSync() {
    let verifier;
    helper.useVerifier(v => {
      verifier = v;
    });
    return verifier;
  }

  it('should create key/verifier pair', () => {
    return useVerifierPromise().then(verifier => {
      expect(verifier).to.equal(TEST_VERIFIER);
      expect(helper.restoreKey()).to.equal(TEST_KEY);
    });
  });

  it('should resolve verifier sync after prepare', () => {
    return helper.prepare().then(() => {
      expect(useVerifierSync()).to.equal(TEST_VERIFIER);
      expect(helper.restoreKey()).to.equal(TEST_KEY);
    });
  });

  it('should tolerate storage failures', () => {
    sandbox.stub(localStorage, 'setItem', () => {
      throw new Error('intentional');
    });
    return useVerifierPromise().then(verifier => {
      expect(verifier).to.be.null;
      expect(helper.restoreKey()).to.be.null;
    });
  });

  it('should tolerate random values failures', () => {
    sandbox.stub(crypto, 'getRandomValues', () => {
      throw new Error('intentional');
    });
    return useVerifierPromise().then(verifier => {
      expect(verifier).to.be.null;
      expect(helper.restoreKey()).to.be.null;
    });
  });

  it('should tolerate hashing failures', () => {
    sandbox.stub(subtle, 'digest', () => {
      return Promise.reject('intentional');
    });
    return useVerifierPromise().then(verifier => {
      expect(verifier).to.be.null;
      expect(helper.restoreKey()).to.be.null;
    });
  });

  it('should tolerate storage retrieval failures', () => {
    sandbox.stub(localStorage, 'getItem', () => {
      throw new Error('intentional');
    });
    expect(helper.restoreKey()).to.be.null;
  });

  describe('not supported', () => {
    it('should default to null if crypto not supported', () => {
      delete win.crypto;
      expect(useVerifierSync()).to.be.null;
    });

    it('should default to null if subtle not supported', () => {
      delete crypto.subtle;
      expect(useVerifierSync()).to.be.null;
    });

    it('should default to null if digest not supported', () => {
      delete subtle.digest;
      expect(useVerifierSync()).to.be.null;
    });

    it('should default to null if crypto random not supported', () => {
      delete crypto.getRandomValues;
      expect(useVerifierSync()).to.be.null;
    });

    it('should default to null if storage not supported', () => {
      delete win.localStorage;
      expect(useVerifierSync()).to.be.null;
    });
  });
});
