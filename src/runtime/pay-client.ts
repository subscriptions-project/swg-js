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

import {ActivityPorts} from '../components/activities';
import {AnalyticsService} from './analytics-service';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {
  PaymentData,
  PaymentDataError,
  PaymentDataRequest,
  PaymentOptions,
  PaymentsAsyncClient,
} from '../../third_party/gpay/src/payjs_async';
import {Preconnect} from '../utils/preconnect';
import {StorageKeys} from '../utils/constants';
import {bytesToString, stringToBytes} from '../utils/bytes';
import {createCancelError} from '../utils/errors';
import {feCached} from './services';
import {getSwgMode} from './services';

export interface PayOptionsDef {
  forceRedirect?: boolean;
  forceDisableNative?: boolean;
}

/**
 * Visible for testing only.
 */
export const PAY_ORIGIN: {[key: string]: string} = {
  'PRODUCTION': 'https://pay.google.com',
  'SANDBOX': 'https://pay.sandbox.google.com',
};

function payUrl(): string {
  return feCached(PAY_ORIGIN[getSwgMode().payEnv] + '/gp/p/ui/pay');
}

export interface PaymentCancelledError extends Error {
  productType: string | null;
}

export class PayClient {
  private readonly activityPorts_: ActivityPorts;
  private readonly analytics_: AnalyticsService;
  private readonly eventManager_: ClientEventManager;
  private readonly preconnect_: Preconnect;
  private readonly win_: Window;

  private client_: PaymentsAsyncClient | null = null;
  private redirectVerifierHelper_: RedirectVerifierHelper;
  private response_: Promise<PaymentData> | null = null;
  private responseCallback_:
    | ((paymentDataPromise: Promise<PaymentData>) => void)
    | null = null;
  private request_: PaymentDataRequest | null = null;

  constructor(deps: Deps) {
    this.win_ = deps.win();

    this.activityPorts_ = deps.activities();

    this.analytics_ = deps.analytics();

    this.redirectVerifierHelper_ = new RedirectVerifierHelper(this.win_);

    this.preconnect_ = new Preconnect(this.win_.document);

    // If the page is started from a redirect, immediately initialize
    // client to avoid dropping user state.
    if (this.pageIsInitializedFromPayRedirect_()) {
      this.preconnect(this.preconnect_);
      this.initializePaymentsClient_();
    }

    // Prepare new verifier pair.
    this.redirectVerifierHelper_.prepare();

    this.eventManager_ = deps.eventManager();
  }

  private createClient_(
    options: PaymentOptions,
    googleTransactionId: string,
    handler: (paymentDataPromise: Promise<PaymentData>) => void
  ): PaymentsAsyncClient {
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

  preconnect(pre: Preconnect): void {
    pre.prefetch(payUrl());
    pre.prefetch(
      'https://payments.google.com/payments/v4/js/integrator.js?ss=md'
    );
    pre.prefetch('https://clients2.google.com/gr/gr_full_2.0.6.js');
  }

  /**
   * Initializes Payments client.
   */
  private initializePaymentsClient_(): void {
    this.client_ = this.createClient_(
      {
        environment: getSwgMode().payEnv,
        'i': {
          'redirectKey': this.redirectVerifierHelper_.restoreKey(),
        },
      },
      this.analytics_.getTransactionId()!,
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

  getType(): string {
    // TODO(alin04): remove once all references removed.
    return 'PAYJS';
  }

  start(
    paymentRequest: PaymentDataRequest,
    options: PayOptionsDef = {}
  ): Promise<boolean> {
    this.request_ = paymentRequest;

    if (!this.client_) {
      this.preconnect(this.preconnect_);
      this.initializePaymentsClient_();
    }

    if (options.forceRedirect) {
      paymentRequest.forceRedirect = true;
    }

    setInternalParam(
      paymentRequest,
      'disableNative',
      // The page cannot be iframed at this time. May be relaxed later
      // for AMP and similar contexts.
      // Always disable native see b/298029927 jpettit 2023-08-30
      // restore when b/298029927 fixed
      true // options.forceDisableNative || this.win_ != this.top_()
    );

    let resolver: (result: boolean) => void;
    const promise = new Promise<boolean>((resolve) => {
      resolver = resolve;
    });

    // Notice that the callback for verifier may execute asynchronously.
    this.redirectVerifierHelper_.useVerifier(async (verifier) => {
      if (verifier) {
        setInternalParam(paymentRequest, 'redirectVerifier', verifier);
      }

      if (options.forceRedirect) {
        await this.eventManager_.getReadyPromise();
        await this.analytics_.getLoggingPromise();
      }

      this.client_!.loadPaymentData(paymentRequest);
      resolver(true);
    });

    return promise;
  }

  async onResponse(
    callback: (paymentDataPromise: Promise<PaymentData>) => void
  ): Promise<void> {
    this.responseCallback_ = callback;

    if (!this.response_) {
      return;
    }

    // Wait for next task.
    await 0;

    callback(this.convertResponse_(this.response_, this.request_));
  }

  private handleResponse_(responsePromise: Promise<PaymentData>): void {
    this.response_ = responsePromise;
    if (this.responseCallback_) {
      this.responseCallback_(
        this.convertResponse_(this.response_, this.request_)
      );
    }
  }

  private async convertResponse_(
    response: Promise<PaymentData>,
    request: PaymentDataRequest | null
  ): Promise<PaymentData> {
    try {
      const res = await response;
      // Temporary client side solution to remember the
      // input params. TODO: Remove this once server-side
      // input preservation is done and is part of the response.
      if (request) {
        res['paymentRequest'] = request;
      }
      return res;
    } catch (err) {
      const reason = err as PaymentDataError;
      if (typeof reason == 'object' && reason['statusCode'] === 'CANCELED') {
        const error = createCancelError('Cancelled') as PaymentCancelledError;
        if (request) {
          error['productType'] = request['i']!['productType']!;
        } else {
          error['productType'] = null;
        }
        throw error;
      }

      throw reason;
    }
  }

  /** Only exists for testing since it's not possible to override `window.top`. */
  private top_(): Window {
    return this.win_.top!;
  }
}

interface RedirectVerifierPairDef {
  key: string;
  verifier: string;
}

/**
 * This helper generates key/verifier pair for the redirect mode. When the
 * redirect mode is used, the encrypted payload is returned via nivigation URL.
 * This payload need to be decrypted and to avoid session fixation attacks, a
 * verifier has to be used. This redirect verifier is not the only session
 * verifier in use: we also use GAIA. However, we have to fallback to this
 * verifier when GAIA is not available.
 *
 * Visible for testing only.
 */
export class RedirectVerifierHelper {
  pairPromise_: Promise<RedirectVerifierPairDef | null> | null = null;
  pair_: RedirectVerifierPairDef | null = null;

  constructor(private readonly win_: Window) {
    this.pairPromise_ = null;

    this.pair_ = null;
  }

  /**
   * To avoid popup blockers, the key/verifier pair is created as soon as
   * possible.
   */
  prepare(): Promise<void> {
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
   */
  useVerifier(callback: (verifier: string | null) => void): void {
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
   */
  restoreKey(): string | null {
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

  private async getOrCreatePair_(
    callback: (pair: RedirectVerifierPairDef | null) => void
  ): Promise<void> {
    // Only create pair once.
    if (!this.pairPromise_) {
      if (this.supportsVerification_()) {
        this.pairPromise_ = this.createPair_();
        this.pair_ = await this.pairPromise_;
      } else {
        // Handle lack of verification support immediately.
        this.pairPromise_ = Promise.resolve(null);
        this.pair_ = null;
      }
    }

    callback(this.pair_);
  }

  private supportsVerification_(): boolean {
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
      crypto.subtle &&
      crypto.subtle.digest
    );
  }

  private async createPair_(): Promise<RedirectVerifierPairDef | null> {
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
      const verifier = btoa(bytesToString(new Uint8Array(buffer)));

      return {key, verifier};
    } catch (reason) {
      // Ignore failures. A failure to create a redirect verifier is often
      // recoverable.
      return null;
    }
  }
}

function setInternalParam(
  paymentRequest: PaymentDataRequest,
  param: string,
  value: unknown
): void {
  paymentRequest['i'] = Object.assign(paymentRequest['i'] || {}, {
    [param]: value,
  });
}
