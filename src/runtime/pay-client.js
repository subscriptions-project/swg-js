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
import {ProductType} from '../api/subscriptions';
import {Xhr} from '../utils/xhr';
import {bytesToString, stringToBytes} from '../utils/bytes';
import {createCancelError} from '../utils/errors';
import {feArgs, feCached} from './services';
import {isExperimentOn} from './experiments';

const PAY_REQUEST_ID = 'swg-pay';
const GPAY_ACTIVITY_REQUEST = 'GPAY';
const REDIRECT_STORAGE_KEY = 'subscribe.google.com:rk';

/**
 * @typedef {{
 *   forceRedirect: (boolean|undefined),
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
function payOrigin() {
  return PAY_ORIGIN['$payEnvironment$'];
}

/** @return {string} */
function payUrl() {
  return feCached(PAY_ORIGIN['$payEnvironment$'] + '/gp/p/ui/pay');
}

/** @return {string} */
function payDecryptUrl() {
  return PAY_ORIGIN['$payEnvironment$'] + '/gp/p/apis/buyflow/process';
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

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @const @private {!PayClientBindingDef} */
    this.binding_ = isExperimentOn(this.win_, ExperimentFlags.GPAY_API)
      ? new PayClientBindingPayjs(
          this.win_,
          this.activityPorts_,
          deps.analytics(),
          deps.eventManager()
        )
      : new PayClientBindingSwg(
          this.win_,
          this.activityPorts_,
          this.dialogManager_,
          deps.analytics(),
          deps.eventManager()
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
    pre.preconnect('https://www.gstatic.com/');
    pre.preconnect('https://fonts.googleapis.com/');
    pre.preconnect('https://www.google.com/');
  }

  /**
   * @return {string}
   */
  getType() {
    // TODO(dvoytenko, #406): remove once GPay API is launched.
    return this.binding_.getType();
  }

  /**
   * @param {!Object} paymentRequest
   * @param {!PayOptionsDef=} options
   * @return {!Promise}
   */
  start(paymentRequest, options = {}) {
    return this.binding_.start(paymentRequest, options);
  }

  /**
   * @param {function(!Promise<!Object>)} callback
   */
  onResponse(callback) {
    this.binding_.onResponse(callback);
  }
}

/**
 * TODO(dvoytenko, #406): remove delegated class once GPay launches.
 * @interface
 */
class PayClientBindingDef {
  /**
   * @return {string}
   */
  getType() {}

  /**
   * @param {!Object} unusedPaymentRequest
   * @param {!PayOptionsDef} unusedOptions
   * @return {!Promise}
   */
  start(unusedPaymentRequest, unusedOptions) {}

  /**
   * @param {function(!Promise<!Object>)} unusedCallback
   */
  onResponse(unusedCallback) {}
}

/**
 * @implements {PayClientBindingDef}
 */
class PayClientBindingSwg {
  /**
   * @param {!Window} win
   * @param {!../components/activities.ActivityPorts} activityPorts
   * @param {!../components/dialog-manager.DialogManager} dialogManager
   * @param {!./analytics-service.AnalyticsService} analyticsService
   * @param {!./client-event-manager.ClientEventManager} eventManager
   */
  constructor(
    win,
    activityPorts,
    dialogManager,
    analyticsService,
    eventManager
  ) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = activityPorts;
    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = dialogManager;
    /** @private @const {!./analytics-service.AnalyticsService} */
    this.analytics_ = analyticsService;

    /** @private @const {!./client-event-manager.ClientEventManager} */
    this.eventManager_ = eventManager;
  }

  /** @override */
  getType() {
    return 'SWG';
  }

  /** @override */
  start(paymentRequest, options) {
    if (options.forceRedirect) {
      // This resolves an issue with logging where the page redirects before
      // logs get sent to the server.  Ultimately we need a logging promise to
      // resolve prior to redirecting but that is not possible right now.
      return this.eventManager_.getReadyPromise().then(() => {
        this.analytics_.getLoggingPromise().then(() => {
          this.start_(paymentRequest, options);
        });
      });
    } else {
      this.start_(paymentRequest, options);
      return Promise.resolve(true);
    }
  }

  /**
   * @param {!Object} paymentRequest
   * @param {!PayOptionsDef} options
   */
  start_(paymentRequest, options) {
    const opener = this.activityPorts_.open(
      GPAY_ACTIVITY_REQUEST,
      payUrl(),
      options.forceRedirect ? '_top' : '_blank',
      feArgs(paymentRequest),
      {}
    );
    this.dialogManager_.popupOpened((opener && opener.targetWin) || null);
  }

  /** @override */
  onResponse(callback) {
    const responseCallback = port => {
      this.dialogManager_.popupClosed();
      callback(this.validatePayResponse_(port));
    };
    this.activityPorts_.onResult(GPAY_ACTIVITY_REQUEST, responseCallback);
    this.activityPorts_.onResult(PAY_REQUEST_ID, responseCallback);
  }

  /**
   * @param {!../components/activities.ActivityPortDef} port
   * @return {!Promise<!Object>}
   * @private
   */
  validatePayResponse_(port) {
    // Do not require security immediately: it will be checked below.
    return port.acceptResult().then(result => {
      if (result.origin != payOrigin()) {
        throw new Error('channel mismatch');
      }
      const data = /** @type {!Object} */ (result.data);
      if (data['redirectEncryptedCallbackData']) {
        // Data is supplied as an encrypted blob.
        const xhr = new Xhr(this.win_);
        const url = payDecryptUrl();
        const init = /** @type {!../utils/xhr.FetchInitDef} */ ({
          method: 'post',
          headers: {'Accept': 'text/plain, application/json'},
          credentials: 'include',
          body: data['redirectEncryptedCallbackData'],
          mode: 'cors',
        });
        return xhr
          .fetch(url, init)
          .then(response => response.json())
          .then(response => {
            const dataClone = Object.assign({}, data);
            delete dataClone['redirectEncryptedCallbackData'];
            return Object.assign(dataClone, response);
          });
      }
      // Data is supplied directly: must be a verified and secure channel.
      if (result.originVerified && result.secureChannel) {
        return data;
      }
      throw new Error('channel mismatch');
    });
  }
}

/**
 * Binding based on the https://github.com/google/payjs.
 * @implements {PayClientBindingDef}
 * @package Visible for testing only.
 */
export class PayClientBindingPayjs {
  /**
   * @param {!Window} win
   * @param {!../components/activities.ActivityPorts} activityPorts
   * @param {!./analytics-service.AnalyticsService} analyticsService
   * @param {!./client-event-manager.ClientEventManager} eventManager
   */
  constructor(win, activityPorts, analyticsService, eventManager) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = activityPorts;

    /** @private {?function(!Promise<!Object>)} */
    this.responseCallback_ = null;

    /** @private {?Object} */
    this.request_ = null;

    /** @private {?Promise<!Object>} */
    this.response_ = null;

    /** @private @const {!./analytics-service.AnalyticsService} */
    this.analytics_ = analyticsService;

    /** @private @const {!RedirectVerifierHelper} */
    this.redirectVerifierHelper_ = new RedirectVerifierHelper(this.win_);

    /** @private @const {!PaymentsAsyncClient} */
    this.client_ = this.createClient_(
      {
        environment: '$payEnvironment$',
        'i': {
          'redirectKey': this.redirectVerifierHelper_.restoreKey(),
        },
      },
      analyticsService.getTransactionId(),
      this.handleResponse_.bind(this)
    );

    // Prepare new verifier pair.
    this.redirectVerifierHelper_.prepare();

    /** @private @const {!./client-event-manager.ClientEventManager} */
    this.eventManager_ = eventManager;
  }

  /**
   * @param {!Object} options
   * @param {string} googleTransactionId
   * @param {function(!Promise<!Object>)} handler
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

  /** @override */
  getType() {
    return 'PAYJS';
  }

  /** @override */
  start(paymentRequest, options) {
    this.request_ = paymentRequest;

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
      this.win_ != this.top_()
    );
    let resolver = null;
    const promise = new Promise(resolve => (resolver = resolve));
    // Notice that the callback for verifier may execute asynchronously.
    this.redirectVerifierHelper_.useVerifier(verifier => {
      if (verifier) {
        setInternalParam(paymentRequest, 'redirectVerifier', verifier);
      }
      if (options.forceRedirect) {
        const client = this.client_;
        this.eventManager_.getReadyPromise().then(() => {
          this.analytics_.getLoggingPromise().then(() => {
            client.loadPaymentData(paymentRequest);
            resolver(true);
          });
        });
      } else {
        this.client_.loadPaymentData(paymentRequest);
        resolver(true);
      }
    });
    return promise;
  }

  /** @override */
  onResponse(callback) {
    this.responseCallback_ = callback;
    const response = this.response_;
    if (response) {
      Promise.resolve().then(() => {
        if (response) {
          callback(this.convertResponse_(response, this.request_));
        }
      });
    }
  }

  /**
   * @param {!Promise<!Object>} responsePromise
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
   * @param {!Promise<!Object>} response
   * @param {?Object} request
   * @return {!Promise<!Object>}
   * @private
   */
  convertResponse_(response, request) {
    return response
      .then(
        // Temporary client side solution to remember the
        // input params. TODO: Remove this once server-side
        // input preservation is done and is part of the response.
        res => {
          if (request) {
            res['paymentRequest'] = request;
          }
          return res;
        }
      )
      .catch(reason => {
        if (typeof reason == 'object' && reason['statusCode'] == 'CANCELED') {
          const error = createCancelError(this.win_);
          if (this.request_) {
            error['productType'] = /** @type {!Object} */ (this.request_)['i'][
              'productType'
            ];
          } else {
            error['productType'] = ProductType.SUBSCRIPTION;
          }
          return Promise.reject(error);
        }
        return Promise.reject(reason);
      });
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

    /** @private {boolean} */
    this.pairCreated_ = false;

    /** @private {?RedirectVerifierPairDef} */
    this.pair_ = null;

    /** @private {?Promise<?RedirectVerifierPairDef>} */
    this.pairPromise_ = null;
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
    this.getOrCreatePair_(pair => {
      if (pair) {
        try {
          this.win_.localStorage.setItem(REDIRECT_STORAGE_KEY, pair.key);
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
          this.win_.localStorage.getItem(REDIRECT_STORAGE_KEY)) ||
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
  getOrCreatePair_(callback) {
    this.createPair_();
    if (this.pairCreated_) {
      // Already created.
      callback(this.pair_);
    } else if (this.pairPromise_) {
      // Otherwise wait for it to be created.
      this.pairPromise_.then(pair => callback(pair));
    }
    return this.pairPromise_;
  }

  /**
   * @private
   */
  createPair_() {
    // Either already created or already started.
    if (this.pairCreated_ || this.pairPromise_) {
      return;
    }

    // Check that the platform can fully support verification. That means
    // that it's expected to implement the following APIs:
    // a. Local storage (localStorage);
    // b. WebCrypto (crypto.subtle);
    // c. Crypto random (crypto.getRandomValues);
    // d. SHA284 (crypto.subtle.digest).
    const crypto = this.win_.crypto;
    if (
      this.win_.localStorage &&
      crypto &&
      crypto.getRandomValues &&
      crypto.subtle &&
      crypto.subtle.digest
    ) {
      this.pairPromise_ = new Promise((resolve, reject) => {
        // 1. Use crypto random to create a 128-bit (16 byte) redirect key.
        const keyBytes = new Uint8Array(16);
        crypto.getRandomValues(keyBytes);

        // 2. Encode key as base64.
        const key = btoa(bytesToString(keyBytes));

        // 3. Create a hash.
        crypto.subtle.digest({name: 'SHA-384'}, stringToBytes(key)).then(
          buffer => {
            const verifier = btoa(
              bytesToString(
                new Uint8Array(/** @type {!ArrayBuffer} */ (buffer))
              )
            );
            resolve({key, verifier});
          },
          reason => {
            reject(reason);
          }
        );
      })
        .catch(() => {
          // Ignore failures. A failure to create a redirect verifier is often
          // recoverable.
          return null;
        })
        .then(pair => {
          this.pairCreated_ = true;
          this.pair_ = pair;
          return pair;
        });
    } else {
      // Not supported.
      this.pairCreated_ = true;
      this.pair_ = null;
    }
  }
}

/**
 * @param {!Object} paymentRequest
 * @param {string} param
 * @param {*} value
 */
function setInternalParam(paymentRequest, param, value) {
  paymentRequest['i'] = Object.assign(paymentRequest['i'] || {}, {
    [param]: value,
  });
}

// TODO(dvoytenko, #406): Remove once GPay API is supported.
export function getPayjsBindingForTesting() {
  return PayClientBindingPayjs;
}
