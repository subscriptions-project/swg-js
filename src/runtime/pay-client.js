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

import {ExperimentFlags} from './experiment-flags';
import {PaymentsAsyncClient} from '../../third_party/gpay/src/payjs_async';
import {Preconnect} from '../utils/preconnect';
import {StorageKeys} from '../utils/constants';
import {bytesToString, stringToBytes} from '../utils/bytes';
import {createCancelError} from '../utils/errors';
import {feCached} from './services';
import {getSwgMode} from './services';
import {isExperimentOn} from './experiments';

/**
 * @typedef {{
 *   forceRedirect: (boolean|undefined),
 *   forceDisableNative: (boolean|undefined),
 * }}
 */
export let PayOptionsDef;

/**
 * @const {!Object<string, string>}
 * @package Visible for testing only.
 */
export const PAY_ORIGIN = {
  'PRODUCTION': 'https://pay.google.com',
  'SANDBOX': 'https://pay.sandbox.google.com',
};

/** @return {string} */
function payUrl() {
  return feCached(PAY_ORIGIN[getSwgMode().payEnv] + '/gp/p/ui/pay');
}

/**
 */
export class PayClient {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private {?function(!Promise<!PaymentData>)} */
    this.responseCallback_ = null;

    /** @private {?PaymentDataRequest} */
    this.request_ = null;

    /** @private {?Promise<!PaymentData>} */
    this.response_ = null;

    /** @private @const {!./analytics-service.AnalyticsService} */
    this.analytics_ = deps.analytics();

    /** @private @const {!RedirectVerifierHelper} */
    this.redirectVerifierHelper_ = new RedirectVerifierHelper(this.win_);

    /** @private {?PaymentsAsyncClient} */
    this.client_ = null;

    /** @private @const {!Preconnect} */
    this.preconnect_ = new Preconnect(this.win_.document);

    // If the page is started from a redirect, immediately initialize
    // client to avoid dropping user state.
    if (
      isExperimentOn(this.win_, ExperimentFlags.PAY_CLIENT_REDIRECT) &&
      this.pageIsInitializedFromPayRedirect_()
    ) {
      this.preconnect(this.preconnect_);
      this.initializePaymentsClient_();
    }

    // Prepare new verifier pair.
    this.redirectVerifierHelper_.prepare();

    /** @private @const {!./client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();
  }

  /**
   * @param {!PaymentOptions} options
   * @param {string} googleTransactionId
   * @param {function(!Promise<!PaymentData>)} handler
   * @return {!PaymentsAsyncClient}
   * @private
   */
  createClient_(options, googleTransactionId, handler) {
    // Assign Google Transaction ID to PaymentsAsyncClient.googleTransactionId_
    // so it can be passed to gpay_async.js and stored in payment clearcut log.
    PaymentsAsyncClient.googleTransactionId_ = googleTransactionId;
    return new PaymentsAsyncClient(
      options,
      handler,
      /* useIframe */ false,
      this.activityPorts_.getOriginalWebActivityPorts()
    );
  }

  /**
   * @param {!../utils/preconnect.Preconnect} pre
   */
  preconnect(pre) {
    pre.prefetch(payUrl());
    pre.prefetch(
      'https://payments.google.com/payments/v4/js/integrator.js?ss=md'
    );
    pre.prefetch('https://clients2.google.com/gr/gr_full_2.0.6.js');
  }

  /**
   * Initializes Payments client.
   */
  initializePaymentsClient_() {
    this.client_ = this.createClient_(
      /** @type {!PaymentOptions} */
      ({
        environment: getSwgMode().payEnv,
        'i': {
          'redirectKey': this.redirectVerifierHelper_.restoreKey(),
        },
      }),
      this.analytics_.getTransactionId(),
      this.handleResponse_.bind(this)
    );
  }

  /**
   * Detects if the window is started from a Pay redirect by
   * checking window's hash for Web Activities information.
   */
  pageIsInitializedFromPayRedirect_() {
    const hash = this.win_.location.hash;
    const hasRedirectEncryptedCallbackData =
      /redirectEncryptedCallbackData/.test(hash);
    const hasSwgRequest = /swgRequest/.test(hash);
    return hasRedirectEncryptedCallbackData && hasSwgRequest;
  }

  /**
   * @return {string}
   */
  getType() {
    // TODO(alin04): remove once all references removed.
    return 'PAYJS';
  }

  /**
   * @param {!PaymentDataRequest} paymentRequest
   * @param {!PayOptionsDef=} options
   */
  start(paymentRequest, options = {}) {
    this.request_ = paymentRequest;

    if (!this.client_) {
      this.preconnect(this.preconnect_);
      this.initializePaymentsClient_();
    }

    if (options.forceRedirect) {
      paymentRequest = Object.assign(paymentRequest, {
        'forceRedirect': options.forceRedirect || false,
      });
    }

    setInternalParam(
      paymentRequest,
      'disableNative',
      // The page cannot be iframed at this time. May be relaxed later
      // for AMP and similar contexts.
      options.forceDisableNative || this.win_ != this.top_()
    );

    let resolver = null;
    const promise = new Promise((resolve) => (resolver = resolve));

    // Notice that the callback for verifier may execute asynchronously.
    this.redirectVerifierHelper_.useVerifier(async (verifier) => {
      if (verifier) {
        setInternalParam(paymentRequest, 'redirectVerifier', verifier);
      }

      if (options.forceRedirect) {
        await this.eventManager_.getReadyPromise();
        await this.analytics_.getLoggingPromise();
      }

      this.client_.loadPaymentData(paymentRequest);
      resolver(true);
    });

    return promise;
  }

  /**
   * @param {function(!Promise<!PaymentData>)} callback
   */
  async onResponse(callback) {
    this.responseCallback_ = callback;

    if (!this.response_) {
      return;
    }

    // Wait for next task.
    await 0;

    callback(this.convertResponse_(this.response_, this.request_));
  }

  /**
   * @param {!Promise<!PaymentData>} responsePromise
   * @private
   */
  handleResponse_(responsePromise) {
    this.response_ = responsePromise;
    if (this.responseCallback_) {
      this.responseCallback_(
        this.convertResponse_(this.response_, this.request_)
      );
    }
  }

  /**
   * @param {!Promise<!PaymentData>} response
   * @param {?PaymentDataRequest} request
   * @return {!Promise<!PaymentData>}
   * @private
   */
  async convertResponse_(response, request) {
    try {
      const res = await response;
      // Temporary client side solution to remember the
      // input params. TODO: Remove this once server-side
      // input preservation is done and is part of the response.
      if (request) {
        res['paymentRequest'] = request;
      }
      return res;
    } catch (reason) {
      if (typeof reason == 'object' && reason['statusCode'] == 'CANCELED') {
        const error = createCancelError(this.win_);
        if (request) {
          error['productType'] = /** @type {!PaymentDataRequest} */ (request)[
            'i'
          ]['productType'];
        } else {
          error['productType'] = null;
        }
        throw error;
      }

      throw reason;
    }
  }

  /**
   * @return {!Window}
   * @private
   */
  top_() {
    // Only exists for testing since it's not possible to override `window.top`.
    return this.win_.top;
  }
}

/**
 * @typedef {{
 *   key: string,
 *   verifier: string,
 * }}
 */
let RedirectVerifierPairDef;

/**
 * This helper generates key/verifier pair for the redirect mode. When the
 * redirect mode is used, the encrypted payload is returned via nivigation URL.
 * This payload need to be decrypted and to avoid session fixation attacks, a
 * verifier has to be used. This redirect verifier is not the only session
 * verifier in use: we also use GAIA. However, we have to fallback to this
 * verifier when GAIA is not available.
 *
 * @package Visible for testing only.
 */
export class RedirectVerifierHelper {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private {?Promise<?RedirectVerifierPairDef>} */
    this.pairPromise_ = null;

    /** @private {?RedirectVerifierPairDef} */
    this.pair_ = null;
  }

  /**
   * To avoid popup blockers, the key/verifier pair is created as soon as
   * possible.
   * @return {?Promise}
   */
  prepare() {
    return this.getOrCreatePair_(() => {});
  }

  /**
   * Calls the provided callback with the generated redirect verifier. This
   * API is sync/async, which is a big anti-pattern. However, it's necessary
   * to reduce the risk of popup blockers. If the verifier is already available
   * (see `prepare` method), the callback will be called immediately and thus
   * in the same event loop as the user action.
   *
   * The return verifier could be `null`. This could mean either that its
   * generation failed, or if the platform doesn't support necessary APIs, such
   * as Web Crypto. The redirect can still proceed and try to fallback on GAIA
   * as a redirect verifier. The set of platforms where GAIA is not available
   * and the redirect verifier cannot be created is negligible.
   *
   * The key corresponding to the returned verifier is stored in the session
   * storage and can be later restored using `restoreKey` method.
   *
   * @param {function(?string)} callback
   */
  useVerifier(callback) {
    this.getOrCreatePair_((pair) => {
      if (pair) {
        try {
          this.win_.localStorage.setItem(StorageKeys.REDIRECT, pair.key);
        } catch (e) {
          // If storage has failed, there's no point in using the verifer.
          // However, there are other ways to recover the redirect, so it's
          // not necessarily a fatal condition.
          pair = null;
        }
      }
      callback((pair && pair.verifier) || null);
    });
  }

  /**
   * Restores the redirect key from the session storage. The key may be null.
   * @return {?string}
   */
  restoreKey() {
    try {
      return (
        (this.win_.localStorage &&
          this.win_.localStorage.getItem(StorageKeys.REDIRECT)) ||
        null
      );
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {function(?RedirectVerifierPairDef)} callback
   * @return {?Promise}
   * @private
   */
  async getOrCreatePair_(callback) {
    // Only create pair once.
    if (!this.pairPromise_) {
      if (this.supportsVerification_()) {
        this.pairPromise_ = this.createPair_();
        this.pair_ = await this.pairPromise_;
      } else {
        // Handle lack of verification support immediately.
        this.pairPromise_ = Promise.resolve();
        this.pair_ = null;
      }
    }

    callback(this.pair_);
  }

  /**
   * @return {boolean}
   * @private
   */
  supportsVerification_() {
    // Check that the platform can fully support verification. That means
    // that it's expected to implement the following APIs:
    // a. Local storage (localStorage);
    // b. WebCrypto (crypto.subtle);
    // c. Crypto random (crypto.getRandomValues);
    // d. SHA384 (crypto.subtle.digest).
    let supportsLocalStorage;
    try {
      supportsLocalStorage = !!this.win_.localStorage;
    } catch (e) {
      // Note: This can happen when cookies are disabled.
      return false;
    }

    // Support test mocks.
    const crypto = this.win_.crypto;

    return !!(
      supportsLocalStorage &&
      crypto &&
      crypto.getRandomValues &&
      crypto.subtle &&
      crypto.subtle.digest
    );
  }

  /**
   * @return {!Promise<?RedirectVerifierPairDef>}
   * @private
   */
  async createPair_() {
    // Support test mocks.
    const crypto = this.win_.crypto;

    try {
      // 1. Use crypto random to create a 128-bit (16 byte) redirect key.
      const keyBytes = new Uint8Array(16);
      crypto.getRandomValues(keyBytes);

      // 2. Encode key as base64.
      const key = btoa(bytesToString(keyBytes));

      // 3. Create a hash.
      const buffer = await crypto.subtle.digest(
        {name: 'SHA-384'},
        stringToBytes(key)
      );

      // 4. Create a verifier.
      const verifier = btoa(
        bytesToString(new Uint8Array(/** @type {!ArrayBuffer} */ (buffer)))
      );

      return {key, verifier};
    } catch (reason) {
      // Ignore failures. A failure to create a redirect verifier is often
      // recoverable.
      return null;
    }
  }
}

/**
 * @param {!PaymentDataRequest} paymentRequest
 * @param {string} param
 * @param {*} value
 */
function setInternalParam(paymentRequest, param, value) {
  paymentRequest['i'] = Object.assign(paymentRequest['i'] || {}, {
    [param]: value,
  });
}
