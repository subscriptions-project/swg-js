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
import {ActivityPort} from '../components/activities';
import {ConfiguredRuntime} from './runtime';
import {DialogManager} from '../components/dialog-manager';
import {ExperimentFlags} from './experiment-flags';
import {GlobalDoc} from '../model/doc';
import {PageConfig} from '../model/page-config';
import {
  PayClient,
  PayClientBindingPayjs,
  RedirectVerifierHelper,
} from './pay-client';
import {PaymentsAsyncClient} from '../../third_party/gpay/src/payjs_async';
import {Xhr} from '../utils/xhr';
import {isCancelError} from '../utils/errors';
import {setExperiment, setExperimentsStringForTesting} from './experiments';

const INTEGR_DATA_STRING =
  'eyJzd2dDYWxsYmFja0RhdGEiOnsicHVyY2hhc2VEYXRhIjoie1wib3JkZXJJZFwiOlwiT1' +
  'JERVJcIn0iLCJwdXJjaGFzZURhdGFTaWduYXR1cmUiOiJQRF9TSUciLCJpZFRva2VuIjoi' +
  'ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnpkV0lpT2lKSlJGOV' +
  'VUMHNpZlEuU0lHIiwic2lnbmVkRW50aXRsZW1lbnRzIjoiZXlKaGJHY2lPaUpJVXpJMU5p' +
  'SXNJblI1Y0NJNklrcFhWQ0o5LmV5SmxiblJwZEd4bGJXVnVkSE1pT2x0N0luTnZkWEpqWl' +
  'NJNklsUkZVMVFpZlYxOS5TSUcifX0=';

const EMPTY_ID_TOK =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJJRF9UT0sifQ.SIG';

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

const GOOGLE_TRANSACTION_ID = 'ABC12345-CDE0-XYZ1-ABAB-11609E6472E9';

describes.realWin('PayClientBindingPayjs', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let activityPorts;
  let analyticsService, analyticsMock;
  let resultStub;
  let payClient;
  let payClientStubs;
  let redirectVerifierHelperStubs, redirectVerifierHelperResults;
  let responseHandler;
  let googleTransactionId;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);

    activityPorts = runtime.activities();

    redirectVerifierHelperResults = {
      restoreKey: 'test_restore_key',
      verifier: 'test_verifier',
    };
    redirectVerifierHelperStubs = {
      restoreKey: sandbox
        .stub(RedirectVerifierHelper.prototype, 'restoreKey')
        .callsFake(() => redirectVerifierHelperResults.restoreKey),
      prepare: sandbox.stub(RedirectVerifierHelper.prototype, 'prepare'),
      useVerifier: sandbox
        .stub(RedirectVerifierHelper.prototype, 'useVerifier')
        .callsFake(callback => {
          callback(redirectVerifierHelperResults.verifier);
        }),
    };
    payClientStubs = {
      create: sandbox
        .stub(PayClientBindingPayjs.prototype, 'createClient_')
        .callsFake((options, googleTransactionId, handler) => {
          responseHandler = handler;
          return new PaymentsAsyncClient({});
        }),
      loadPaymentData: sandbox.stub(
        PaymentsAsyncClient.prototype,
        'loadPaymentData'
      ),
    };

    googleTransactionId = GOOGLE_TRANSACTION_ID;
    analyticsService = runtime.analytics();
    analyticsMock = sandbox.mock(analyticsService);
    sandbox.stub(analyticsService, 'getTransactionId').callsFake(() => {
      return googleTransactionId;
    });

    payClient = new PayClientBindingPayjs(
      win,
      activityPorts,
      googleTransactionId
    );

    resultStub = sandbox.stub();
    payClient.onResponse(resultStub);
  });

  afterEach(() => {
    setExperimentsStringForTesting('');
    analyticsMock.verify();
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
    expect(new PayClient(runtime).getType()).to.equal('PAYJS');
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
    payClient.start(
      {
        'paymentArgs': {'a': 1},
      },
      {}
    );
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
    payClient.start(
      {
        'paymentArgs': {'a': 1},
      },
      {
        forceRedirect: true,
      }
    );
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

  it('should accept a correct payment response', async () => {
    const data = await withResult(Promise.resolve(INTEGR_DATA_OBJ));
    expect(data).to.deep.equal(INTEGR_DATA_OBJ);
  });

  it('should accept a cancel signal', async () => {
    try {
      await withResult(Promise.reject({'statusCode': 'CANCELED'}));
      throw new Error('must have failed');
    } catch (reason) {
      expect(isCancelError(reason)).to.be.true;
    }
  });

  it('should accept other errors', async () => {
    try {
      await withResult(Promise.reject('intentional'));
      throw new Error('must have failed');
    } catch (reason) {
      expect(reason).to.equal('intentional');
    }
  });

  it('should return response on initialization', async () => {
    const data = await withResult(Promise.resolve(INTEGR_DATA_OBJ));
    expect(data).to.deep.equal(INTEGR_DATA_OBJ);

    const response = await new Promise(resolve => {
      payClient.onResponse(resolve);
    });
    expect(response).to.deep.equal(INTEGR_DATA_OBJ);
  });

  describe('native support', () => {
    let top;

    beforeEach(() => {
      top = win;
      sandbox.stub(payClient, 'top_').callsFake(() => top);
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
      setItem: (key, value) => {
        storageMap[key] = value;
      },
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

  it('should create key/verifier pair', async () => {
    const verifier = await useVerifierPromise();
    expect(verifier).to.equal(TEST_VERIFIER);
    expect(helper.restoreKey()).to.equal(TEST_KEY);
  });

  it('should resolve verifier sync after prepare', () => {
    return helper.prepare().then(() => {
      expect(useVerifierSync()).to.equal(TEST_VERIFIER);
      expect(helper.restoreKey()).to.equal(TEST_KEY);
    });
  });

  it('should tolerate storage failures', async () => {
    sandbox.stub(localStorage, 'setItem').callsFake(() => {
      throw new Error('intentional');
    });

    const verifier = await useVerifierPromise();
    expect(verifier).to.be.null;
    expect(helper.restoreKey()).to.be.null;
  });

  it('should tolerate random values failures', async () => {
    sandbox.stub(crypto, 'getRandomValues').callsFake(() => {
      throw new Error('intentional');
    });

    const verifier = await useVerifierPromise();
    expect(verifier).to.be.null;
    expect(helper.restoreKey()).to.be.null;
  });

  it('should tolerate hashing failures', async () => {
    sandbox
      .stub(subtle, 'digest')
      .callsFake(() => Promise.reject('intentional'));

    const verifier = await useVerifierPromise();
    expect(verifier).to.be.null;
    expect(helper.restoreKey()).to.be.null;
  });

  it('should tolerate storage retrieval failures', () => {
    sandbox.stub(localStorage, 'getItem').callsFake(() => {
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
