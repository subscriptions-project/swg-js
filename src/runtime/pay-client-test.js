/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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

import {ConfiguredRuntime} from './runtime';
import {ExperimentFlags} from './experiment-flags';
import {PageConfig} from '../model/page-config';
import {PayClient, RedirectVerifierHelper} from './pay-client';
import {PaymentsAsyncClient} from '../../third_party/gpay/src/payjs_async';
import {setExperiment, setExperimentsStringForTesting} from './experiments';

const INTEGR_DATA_STRING =
  'eyJzd2dDYWxsYmFja0RhdGEiOnsicHVyY2hhc2VEYXRhIjoie1wib3JkZXJJZFwiOlwiT1' +
  'JERVJcIn0iLCJwdXJjaGFzZURhdGFTaWduYXR1cmUiOiJQRF9TSUciLCJpZFRva2VuIjoi' +
  'ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnpkV0lpT2lKSlJGOV' +
  'VUMHNpZlEuU0lHIiwic2lnbmVkRW50aXRsZW1lbnRzIjoiZXlKaGJHY2lPaUpJVXpJMU5p' +
  'SXNJblI1Y0NJNklrcFhWQ0o5LmV5SmxiblJwZEd4bGJXVnVkSE1pT2x0N0luTnZkWEpqWl' +
  'NJNklsUkZVMVFpZlYxOS5TSUcifX0=';

const INTEGR_DATA_OBJ = {
  'integratorClientCallbackData': INTEGR_DATA_STRING,
};

const GOOGLE_TRANSACTION_ID = 'ABC12345-CDE0-XYZ1-ABAB-11609E6472E9';

const ENCODED_WA_RES_REDIRECT_HASH =
  '#__WA_RES__=%7B%22requestId%22%3A%22GPAY%22%2C%22origin%22%3A%22https%3A%2F%2Fpay.google.com%22%2C%22code%22%3A%22ok%22%2C%22data%22%3A%7B%22redirectEncryptedCallbackData%22%3A%22ALmKuMgxpT9olhoadKoO%2FFEq8M00rv6UKLbaLcjQwlt4grw7lrELFFFaCYUtikAC3xC8mhePgSvT7LgLHnB2URIG1wRltYgUyJUZRwaOGwSs0tQjHWDo2Vq%2BXyflTCTHjE7sDeL9ICXt8DeUJpPyOr1PDafOtPcgUgHuNwFxgRHYHOSalYyzGuUR1tU80aVUmKPZQHtsp8YJ5wM9z9Oa2uRpR1O0P1rlaQ%2BwjCoyai%2B7Dyial2UFybMQtCKYwpBs%2FEKAe4F7l9SNDlzZvnYhV4LDJ3Uc03FKIS0e4Hqx3414v%2FRMJ6SxAhnvuOfl3nIBWdV%2B62fgZgI2fmQooHDWaEhFPvh3lTQr4byF9r9tDWnb%2BBTb7MWmiQqb7ijRpoAhsb%2BMPPHiAz3TCxMjdElw97RJlnGpNjg9e5RbWN8dn3fwMn5K0MOosqQurnckHcTvp8dtFiqTJj3XNEHLI2lI0ZLeaY%2F%2Fl22pgdOT8usc1zC%2FMC743Yw5QW6ouX58iTTcAEbH%2BEEQlB8VNzDUiHuS6ffc5CqQ320%2FDJq9uM4KnWoSXa%2FIn%2FjABf%2F286u900LsuVg4DU%2Fya69RXCmkUAVpSQ7uhU1reqEJx4CBMe38gCT4eEmFdIgWxQHK07g6HzTxAc3myyxflXDVIYQGR%2F%2Fh5loWEJsC1dzxH1pg64C8uveD6vinohYpxnG5FBrpF45Lu4kdJtp8lYhLZukwuO8VTtYtXBLEMHYTRkhqvYoS2kb6VDaec8fphDE9TYv%2BQG0Xsc9oP31nAWJoZBbU2zF00qPZXEKc9RQ8zqljiFOQH7%2BrldNGBjmqm49TvGOrJBQSOEMMuoTjyrS45epodbXaLaVG7Cej%2BF1o27QciRKjNBacTq8cu6tEGAqd%2F5s0QyzguRiPKIxCn%2BPCKSHITPIwU1x9FhilJTItYvbQoxIVrA3Gjg8%2BZPgAG3Ht6v%2BnCHy3gJq4wzph6iK2hBBVdHS5gKJFtTm2O97xx0Sy3nt%2Fff3hoxTTWuQxa9sMlXnWoVgOSMPP0kq2u0%2Bdg9agq%2BiAO8yDFMT1tZdONZSTFKPqnmpTArXsuA4aOTKjtFPUlLiaOmw1VqqdwXo6tOXzTUxc9NvcxYJgqgYd4o5h1Tp3cXhGou4W%2FA%2FPt1T5lV8QIGOgE06wqh9kA%2BTyutgUlZKYXqeJ1Q%2BpSaVtE%2FJ%2BvxhJGxzoxLncpmT0T%2FMtLHrZAnIBpZ%2FBNp0kNAk1WSlvhnScHIQwDNdfj5Q%2Blrqs3TvzErGTNjSd9XwX%2FKzQVcVrIGHvscVebNwoeYmmE2aHVDWPdnKto20J6V0vBQuOGsjLNhefdsCVLJlNkE0RgkFSYa4wH3cBofW3BKNKmYl5CR3z1HG471rsaE1oursSj0csfUajF6scF0KqUnFRpWdY%2FauUwDjfRXWxP6Y%2BR9RmW6iNYbxG7i5T5AA844fgcrdFxGwKJzhjpJyQEDn%2BjMCpNmaerOxGdpbZL5p%2BCLl950YZAUVGLv6aQB5RfdMpyF%2Fbnflufava1utaw51Q7Pjlhd3sPSHUJr904LxNFG2Td8bngLkWygkUdvXi2quXvLq8z7ArVVxhls6vNW876M%2FlQFbDMm6KR81DYuEKgrL810W%2FaBmhJks1Q51qlL9nwvNvcl0SnTAU1%2FE%2FMig%2FKTuV2yfaaH%2Bjc6siWHAJ9MA3L9upFYJO4j%2FnL%2F2%2B0vXnZUI2iwAKxPwzZrlh2AmkKTtGLq0FYO37axdN9qsNF%2BxIrNhaeeqMKcQT2OeMSB4tY5pfqb8yd0L8rTjL8heXnJBQlsaeHXKbrvcRIM%2BYxOY80mzG7T4GzaX5p8W8%2F12xr71dw9lMoscmwj5G%2FATrhHpQmkUZuOuhqJY34nWPdrpOZWn9DPRT0F8R4xstMlT%2BthmUIwJwo6ZSa68N3X2SzSESQUKemPepvFq3%2FJveUEEdneBPYDOV8tHpa6hda8zNkepYb6FM8oMQwZ5oWjuLABnZpXce7%2Bwaq%2FE5HZIkpjKv7Xewgd%2BGx3S%2Bz5yW%2BWz5G8U7iACDpyU9vrnUP3rm1WnCjUnGbsvE%2BRxk3I1HEtHlMH43%2Fs7vhX9CHBOtCGiOkazzH%2BjeDyAZRai%2Br2KcP%2FJbq%2FI30LU8YymusDdMSuAasri%2FPd4NYrzqzSjpnl2rJ1TCl1xxUlpfJLrVBz4s21OWcI8XcR3h5qszXecha%2Fqoqc%2BLco7o9zzNVHRSCHuzCBEpgdAtxyq%2BJjqR1ujS89qNVtxYNQTa6f%2B9fSL0okidStSurr8ClKSRQilO8sVrT6vaGewmMrLPwT7EuZ%2BXaxhfDVqI8Gse3qmvFSfUJobpK7ku6P059SeR7%2BdsAegl0etLYdc3S98KTaxz0IU8xS%2B1e%2B0zAFun2V6OO4aBiB1IkbQmSjR%2FJUK327WgEXxB6Sc7Hnsnbkb4ZlCfJhaMiGceb7RZ1%2Fdlch9IiHAqI0MbfA%2Fi6IjSvpcdGp87P947kzdCHfS04arpG9QDFr0VBaCzHhWeWFX0GKllIl2jnWj6Hv4nnv%2FqwPSLsW8Sy1Gmv3HfDUdymdFXorficEQUDukDgsO4md52XLjzvvYRDfXOYCMHGNtAVeFX38FtHWgVKfTkpoabXY27%2B7OffSRPXoemOji17hATKZq%2FoGKCgVliD8WMMBP50kRRiu5eSj%2FQgbtm%2BQu8rFCTcycLpBS23lxW9giZXdNoGx9ilqmPvsmkve%2B1CHJGaa55voEvgTyCt%2Bd8p19Qs44YlLNy8uvkICzXHJhGoKA1PLpS7eFTl8xqNsyMjo%2F14%2B6kz0qypfZYLMwOmxHZwSLLFnc20QRK21EfmdAyOBMaYV85n75rqiCVNoG7DkHdL4p45nmahP38KAE8EN%2BcsBsKkOXDLppw377mJS4euQN3X2LGUMzRGBWU%2FNlCjudptaChab13nq1vxcv6JgT4FxF93fqDBZOLX9KnQ63RawCg1LizEo%2B3Y7AG7kYIp%2B5%2B7ktFuRKtzdhiP%2F7oCtW4%2FSfujvrvEbI6%2Fi5FCsRxuaMfp4aSxts7q95Fc7hyyLM2m814%2B%2FtD7mYAfWCt2sHvFw%2BvE44lzULN%2ByiUrMRnGwegk9tLSrnRwa3mcACB99G735KuCfbcSEbC0y9necVLKIU4Rms6VFJffFsdTMbPeJxhXMy7VWmhxcVjIgl5U%2F9tcvvb%2BABE8dd5plt%2F94AVqxCYMb6fwuwD6nbyChWT%2Bt0xstfMS2qkD3Qy59x1Br0S%2FFq3ONSOmo1hXfzxCedlbKu%2FvJf5wEVwTUazdSNN3%2Fov%2BFpTeYfO%22%2C%22swgRequest%22%3A%7B%22skuId%22%3A%2250cent_test%22%2C%22publicationId%22%3A%22gtech-demo.appspot.com%22%7D%2C%22environment%22%3A%22PRODUCTION%22%2C%22googleTransactionId%22%3A%22F8E6EF9E-3224-4074-A540-DF5601678E2F.swg%22%2C%22productType%22%3A%22SUBSCRIPTION%22%7D%7D';

describes.realWin('PayClient', {}, (env) => {
  let win;
  let pageConfig;
  let runtime;
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
        .callsFake((callback) => {
          callback(redirectVerifierHelperResults.verifier);
        }),
    };
    payClientStubs = {
      create: sandbox
        .stub(PayClient.prototype, 'createClient_')
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

    payClient = new PayClient(runtime);

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

  it('should initialize correctly', () => {
    expect(payClient.getType()).to.equal('PAYJS');
    expect(redirectVerifierHelperStubs.prepare).to.be.calledOnce;
    const ClientWrapper = function (handler) {
      this.handleResponse_ = handler;
      this.response_ = null;
    };
    const wrapper = new ClientWrapper(payClient.handleResponse_);
    const expectedResponse = Promise.resolve(INTEGR_DATA_OBJ);
    wrapper.handleResponse_(expectedResponse);
    expect(payClient.response_).to.not.equal(expectedResponse);
  });

  it('should initialize Payments client correctly upon redirect in experiment', () => {
    sandbox.reset();
    win = Object.assign({}, env.win, {
      location: {
        hash: ENCODED_WA_RES_REDIRECT_HASH,
      },
    });
    setExperiment(win, ExperimentFlags.PAY_CLIENT_REDIRECT, true);
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    expect(payClient.getType()).to.equal('PAYJS');
    expect(payClientStubs.create).to.be.calledOnce;
    expect(redirectVerifierHelperStubs.restoreKey).to.be.calledOnce;
    expect(redirectVerifierHelperStubs.prepare).to.be.calledOnce;
    const el = win.document.head.querySelector(
      'link[rel="preconnect prefetch"][href*="/pay?"]'
    );
    expect(el).to.exist;
    expect(el.getAttribute('href')).to.equal('PAY_ORIGIN/gp/p/ui/pay?_=_');
  });

  it('should not initialize Payments client correctly upon redirect when not in experiment', () => {
    sandbox.reset();
    win = Object.assign({}, env.win, {
      location: {
        hash: ENCODED_WA_RES_REDIRECT_HASH,
      },
    });
    setExperiment(win, ExperimentFlags.PAY_CLIENT_REDIRECT, false);
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    expect(payClient.getType()).to.equal('PAYJS');
    expect(payClientStubs.create).to.not.be.called;
    expect(redirectVerifierHelperStubs.restoreKey).to.not.be.called;
    const el = win.document.head.querySelector(
      'link[rel="preconnect prefetch"][href*="/pay?"]'
    );
    expect(el).to.not.exist;
  });

  it('should not initialize Payments client with bad redirect in experiment', () => {
    sandbox.reset();
    win = Object.assign({}, env.win, {
      location: {
        hash: '#__WA_RES__=%7B%7D',
      },
    });
    setExperiment(win, ExperimentFlags.PAY_CLIENT_REDIRECT, true);
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    expect(payClient.getType()).to.equal('PAYJS');
    expect(payClientStubs.create).to.not.be.called;
    expect(redirectVerifierHelperStubs.restoreKey).to.not.be.called;
    const el = win.document.head.querySelector(
      'link[rel="preconnect prefetch"][href*="/pay?"]'
    );
    expect(el).to.not.exist;
  });

  it('should not initialize Payments client upon start with redirect in experiment', () => {
    win = Object.assign({}, env.win, {
      location: {
        hash: ENCODED_WA_RES_REDIRECT_HASH,
      },
    });
    setExperiment(win, ExperimentFlags.PAY_CLIENT_REDIRECT, true);
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    sandbox.reset();
    expect(payClient.getType()).to.equal('PAYJS');
    expect(payClientStubs.create).to.not.be.called;
    expect(redirectVerifierHelperStubs.restoreKey).to.not.be.called;
  });

  it('should have valid flow constructed', () => {
    payClient.start({
      'paymentArgs': {'a': 1},
    });
    expect(payClientStubs.create).to.be.calledOnce.calledWith({
      'environment': '$payEnvironment$',
      'i': {
        'redirectKey': 'test_restore_key',
      },
    });
    expect(redirectVerifierHelperStubs.restoreKey).to.be.calledOnce;
    expect(redirectVerifierHelperStubs.useVerifier).to.be.calledOnce;
    expect(payClientStubs.loadPaymentData).to.be.calledOnce.calledWith({
      'paymentArgs': {'a': 1},
      'i': {
        'redirectVerifier': redirectVerifierHelperResults.verifier,
        'disableNative': true,
      },
    });
  });

  it('should force redirect mode', async function () {
    await payClient.start(
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

  it('should prefetch payments on start', () => {
    payClient.start({});
    const el = win.document.head.querySelector(
      'link[rel="preconnect prefetch"][href*="/pay?"]'
    );
    expect(el).to.exist;
    expect(el.getAttribute('href')).to.equal('PAY_ORIGIN/gp/p/ui/pay?_=_');
  });

  it('should accept a correct payment response', async () => {
    payClient.start({});
    const data = await withResult(Promise.resolve(INTEGR_DATA_OBJ));
    expect(data).to.deep.equal(INTEGR_DATA_OBJ);
  });

  it('should accept a correct payment response in redirect handle experiment', async () => {
    setExperiment(win, ExperimentFlags.PAY_CLIENT_REDIRECT, true);
    const tmpPayClient = new PayClient(runtime);
    tmpPayClient.onResponse(resultStub);
    tmpPayClient.start({});
    const data = await withResult(Promise.resolve(INTEGR_DATA_OBJ));
    expect(data).to.deep.equal(INTEGR_DATA_OBJ);
  });

  it('should preserve the paymentRequest in correct response', async () => {
    const paymentArgs = {'swg': {'sku': 'basic'}, 'i': {'a': 1}};
    payClient.start(paymentArgs);
    const data = await withResult(Promise.resolve(INTEGR_DATA_OBJ));
    const expectedData = Object.assign({}, INTEGR_DATA_OBJ);
    expectedData['paymentRequest'] = paymentArgs;
    expect(data).to.deep.equal(expectedData);
  });

  it('should accept a cancel signal', async () => {
    payClient.start({});
    await expect(
      withResult(Promise.reject({'statusCode': 'CANCELED'}))
    ).to.be.rejectedWith(/AbortError/);
  });

  it('should propogate productType with cancel signal', async () => {
    payClient.start({});
    await expect(withResult(Promise.reject({'statusCode': 'CANCELED'})))
      .to.be.rejectedWith(/AbortError/)
      .and.eventually.have.property('productType');
  });

  it('should accept other errors', async () => {
    payClient.start({});
    await expect(withResult(Promise.reject('intentional'))).to.be.rejectedWith(
      /intentional/
    );
  });

  it('should return response on initialization', async () => {
    payClient.start({});
    const data = await withResult(Promise.resolve(INTEGR_DATA_OBJ));
    expect(data).to.deep.equal(INTEGR_DATA_OBJ);

    const response = await new Promise((resolve) => {
      payClient.onResponse(resolve);
    });
    expect(response).to.deep.equal(INTEGR_DATA_OBJ);
  });

  describe('native support', () => {
    let top;

    beforeEach(() => {
      top = win;
      sandbox.stub(payClient, 'top_').callsFake(() => top);
    });

    it('should enable native mode', () => {
      payClient.start({});
      expect(payClientStubs.loadPaymentData).to.be.calledOnce.calledWith({
        'i': {
          'redirectVerifier': redirectVerifierHelperResults.verifier,
          'disableNative': false,
        },
      });
    });

    it('should disable native mode for iframes', () => {
      top = {};
      payClient.start({});
      expect(payClientStubs.loadPaymentData).to.be.calledOnce.calledWith({
        'i': {
          'redirectVerifier': redirectVerifierHelperResults.verifier,
          'disableNative': true,
        },
      });
    });

    it('should force disable native mode', () => {
      payClient.start({}, {forceDisableNative: true});
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
      getItem: (key) => storageMap[key],
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
      getRandomValues: (bytes) => {
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
    return new Promise((resolve) => {
      helper.useVerifier(resolve);
    });
  }

  function useVerifierSync() {
    let verifier;
    helper.useVerifier((v) => {
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
