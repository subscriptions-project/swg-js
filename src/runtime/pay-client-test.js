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
  ActivityIframePort as WebActivityIframePort,
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {
  ActivityPorts,
  ActivityIframePort,
} from '../model/activities';
import {DialogManager} from '../components/dialog-manager';
import {ExperimentFlags} from './experiment-flags';
import {GlobalDoc} from '../model/doc';
import {Dialog} from '../components/dialog';
import {
  PayClient,
  PayClientBindingPayjs,
  RedirectVerifierHelper,
} from './pay-client';
import {PaymentsAsyncClient} from '../../third_party/gpay/src/payjs_async';
import {Xhr} from '../utils/xhr';
import {isCancelError} from '../utils/errors';
import {
  setExperiment,
  setExperimentsStringForTesting,
} from './experiments';


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
  let dialogManagerMock;
  let resultCallback, resultStub;
  let payClient;
  let resultIdsAttached;
  let dialog;

  beforeEach(() => {
    win = env.win;
    resultIdsAttached = [];
    activityPorts = new ActivityPorts(win);
    activityPorts.onResult = (requestId, callback) => {
      if (requestId == 'swg-pay' || requestId == 'GPAY') {
        resultCallback = callback;
        resultIdsAttached.push(requestId);
      }
    };
    dialog = new Dialog(new GlobalDoc(win), {height: '100px'});
    port = new ActivityIframePort(
        new WebActivityIframePort(dialog.getElement(), '/hello'));
    activitiesMock = sandbox.mock(activityPorts);
    const dialogManager = new DialogManager(new GlobalDoc(win));
    dialogManagerMock = sandbox.mock(dialogManager);
    payClient = new PayClient(win, activityPorts, dialogManager);
    resultStub = sandbox.stub();
    payClient.onResponse(resultStub);
  });

  afterEach(() => {
    activitiesMock.verify();
    dialogManagerMock.verify();
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

  it('should support SwG and GPay result IDs', () => {
    expect(resultIdsAttached).to.contain('swg-pay');
    expect(resultIdsAttached).to.contain('GPAY');
  });

  it('should select the right binding', () => {
    expect(payClient.getType()).to.equal('SWG');
  });

  it('should have valid flow constructed', () => {
    const popupWin = {};
    dialogManagerMock.expects('popupOpened')
        .withExactArgs(popupWin)
        .once();
    activitiesMock.expects('open').withExactArgs(
        'GPAY',
        'PAY_ORIGIN/gp/p/ui/pay?_=_',
        '_blank',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'paymentArgs': {'a': 1},
        },
        {})
        .returns({targetWin: popupWin})
        .once();
    payClient.start({
      'paymentArgs': {'a': 1},
    });
  });

  it('should force redirect mode', () => {
    dialogManagerMock.expects('popupOpened')
        .withExactArgs(null)
        .once();
    activitiesMock.expects('open').withExactArgs(
        'GPAY',
        'PAY_ORIGIN/gp/p/ui/pay?_=_',
        '_top',
        {
          '_client': 'SwG $internalRuntimeVersion$',
          'paymentArgs': {'a': 1},
        },
        {})
        .returns(undefined)
        .once();
    payClient.start({
      'paymentArgs': {'a': 1},
    }, {
      forceRedirect: true,
    });
  });

  it('should catch mismatching channel', () => {
    dialogManagerMock.expects('popupClosed').once();
    const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ);
    return withResult(result).then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/channel mismatch/);
    });
  });

  it('should require secure channel for unencrypted payload', () => {
    dialogManagerMock.expects('popupClosed').once();
    const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ,
        'REDIRECT', 'PAY_ORIGIN', true, false);
    return withResult(result).then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/channel mismatch/);
    });
  });

  it('should require secure channel for unverified payload', () => {
    dialogManagerMock.expects('popupClosed').once();
    const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ,
        'REDIRECT', 'PAY_ORIGIN', false, true);
    return withResult(result).then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/channel mismatch/);
    });
  });

  it('should accept a correct payment response', () => {
    dialogManagerMock.expects('popupClosed').once();
    const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ,
        'POPUP', 'PAY_ORIGIN', true, true);
    return withResult(result).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ);
    });
  });

  it('should accept a correct payment response as decoded obj', () => {
    dialogManagerMock.expects('popupClosed').once();
    const result = new ActivityResult(ActivityResultCode.OK,
        INTEGR_DATA_OBJ_DECODED,
        'POPUP', 'PAY_ORIGIN', true, true);
    return withResult(result).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ_DECODED);
    });
  });

  it('should accept a correct payment response as encrypted obj' +
     ' in PRODUCTION', () => {
    dialogManagerMock.expects('popupClosed').once();
    const encryptedData = 'ENCRYPTED';
    const encryptedResponse = {
      redirectEncryptedCallbackData: encryptedData,
      environment: 'PRODUCTION',
      other: 'OTHER',
    };
    const result = new ActivityResult(ActivityResultCode.OK,
        encryptedResponse,
        'POPUP', 'PAY_ORIGIN', true, true);
    const xhrFetchStub = sandbox.stub(Xhr.prototype, 'fetch',
        () => Promise.resolve(
        {json: () => Promise.resolve(INTEGR_DATA_OBJ_DECODED)}));
    return withResult(result).then(data => {
      expect(data.swgCallbackData)
          .to.deep.equal(INTEGR_DATA_OBJ_DECODED.swgCallbackData);
      expect(data.environment).to.equal('PRODUCTION');
      expect(data.other).to.equal('OTHER');
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
    dialogManagerMock.expects('popupClosed').once();
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
      expect(data.swgCallbackData)
          .to.deep.equal(INTEGR_DATA_OBJ_DECODED.swgCallbackData);
      expect(data.environment).to.equal('SANDBOX');
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
    dialogManagerMock.expects('popupClosed').once();
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
    dialogManagerMock.expects('popupClosed').once();
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


describes.realWin('PayClientBindingPayjs', {}, env => {
  let win;
  let resultStub;
  let activityPorts;
  let payClient;
  let payClientStubs;
  let redirectVerifierHelperStubs, redirectVerifierHelperResults;
  let responseHandler;

  beforeEach(() => {
    win = env.win;
    activityPorts = new ActivityPorts(win);
    redirectVerifierHelperResults = {
      restoreKey: 'test_restore_key',
      verifier: 'test_verifier',
    };
    redirectVerifierHelperStubs = {
      restoreKey: sandbox.stub(RedirectVerifierHelper.prototype, 'restoreKey',
          () => redirectVerifierHelperResults.restoreKey),
      prepare: sandbox.stub(RedirectVerifierHelper.prototype, 'prepare'),
      useVerifier: sandbox.stub(RedirectVerifierHelper.prototype, 'useVerifier',
          callback => {
            callback(redirectVerifierHelperResults.verifier);
          }),
    };
    payClientStubs = {
      create: sandbox.stub(PayClientBindingPayjs.prototype,
          'createClient_',
          (options, handler) => {
            responseHandler = handler;
            return new PaymentsAsyncClient({});
          }),
      loadPaymentData: sandbox.stub(PaymentsAsyncClient.prototype,
          'loadPaymentData'),
    };
    payClient = new PayClientBindingPayjs(win, activityPorts);
    resultStub = sandbox.stub();
    payClient.onResponse(resultStub);
  });

  afterEach(() => {
    setExperimentsStringForTesting('');
  });

  /**
   * @param {!Promise<!Object>} result
   * @return {!Promise<!Object>}
   */
  function withResult(result) {
    responseHandler(result);
    expect(resultStub).to.be.calledOnce;
    return resultStub.args[0][0];
  }

  it('should select the right binding', () => {
    expect(payClient.getType()).to.equal('PAYJS');
    setExperiment(win, ExperimentFlags.GPAY_API, true);
    expect(new PayClient(win, activityPorts).getType()).to.equal('PAYJS');
  });

  it('should initalize correctly', () => {
    expect(payClientStubs.create).to.be.calledOnce.calledWith({
      'environment': '$payEnvironment$',
      'i': {
        'redirectKey': 'test_restore_key',
      },
    });
    expect(redirectVerifierHelperStubs.restoreKey).to.be.calledOnce;
    expect(redirectVerifierHelperStubs.prepare).to.be.calledOnce;
  });

  it('should have valid flow constructed', () => {
    payClient.start({
      'paymentArgs': {'a': 1},
    }, {});
    expect(redirectVerifierHelperStubs.useVerifier).to.be.calledOnce;
    expect(payClientStubs.loadPaymentData).to.be.calledOnce.calledWith({
      'paymentArgs': {'a': 1},
      'i': {
        'redirectVerifier': redirectVerifierHelperResults.verifier,
        'disableNative': true,
      },
    });
  });

  it('should force redirect mode', () => {
    payClient.start({
      'paymentArgs': {'a': 1},
    }, {
      forceRedirect: true,
    });
    expect(redirectVerifierHelperStubs.useVerifier).to.be.calledOnce;
    expect(payClientStubs.loadPaymentData).to.be.calledOnce.calledWith({
      'paymentArgs': {'a': 1},
      'forceRedirect': true,
      'i': {
        'redirectVerifier': redirectVerifierHelperResults.verifier,
        'disableNative': true,
      },
    });
  });

  it('should accept a correct payment response', () => {
    return withResult(Promise.resolve(INTEGR_DATA_OBJ)).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ);
    });
  });

  it('should accept a cancel signal', () => {
    return withResult(Promise.reject({'statusCode': 'CANCELED'})).then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(isCancelError(reason)).to.be.true;
    });
  });

  it('should accept other errors', () => {
    return withResult(Promise.reject('intentional')).then(() => {
      throw new Error('must have failed');
    }, reason => {
      expect(() => {throw reason;}).to.throw(/intentional/);
    });
  });

  it('should return response on initialization', () => {
    return withResult(Promise.resolve(INTEGR_DATA_OBJ)).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ);
      return new Promise(resolve => {
        payClient.onResponse(resolve);
      });
    }).then(data => {
      expect(data).to.deep.equal(INTEGR_DATA_OBJ);
    });
  });

  describe('native support', () => {
    let top;

    beforeEach(() => {
      top = win;
      sandbox.stub(payClient, 'top_', () => top);
      setExperiment(win, ExperimentFlags.GPAY_NATIVE, true);
    });

    it('should enable native mode', () => {
      payClient.start({}, {});
      expect(payClientStubs.loadPaymentData).to.be.calledOnce.calledWith({
        'i': {
          'redirectVerifier': redirectVerifierHelperResults.verifier,
          'disableNative': false,
        },
      });
    });

    it('should disable native mode for iframes', () => {
      top = {};
      payClient.start({}, {});
      expect(payClientStubs.loadPaymentData).to.be.calledOnce.calledWith({
        'i': {
          'redirectVerifier': redirectVerifierHelperResults.verifier,
          'disableNative': true,
        },
      });
    });

    it('should disable native mode w/o experiment', () => {
      setExperiment(win, ExperimentFlags.GPAY_NATIVE, false);
      payClient.start({}, {});
      expect(payClientStubs.loadPaymentData).to.be.calledOnce.calledWith({
        'i': {
          'redirectVerifier': redirectVerifierHelperResults.verifier,
          'disableNative': true,
        },
      });
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
