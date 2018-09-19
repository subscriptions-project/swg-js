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

import {Xhr} from '../utils/xhr';
import {feArgs, feCached} from './services';

const PAY_REQUEST_ID = 'swg-pay';

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
   * @param {!Window} win
   * @param {!web-activities/activity-ports.ActivityPorts} activityPorts
   */
  constructor(win, activityPorts) {
    // TODO(dvoytenko, #406): Support GPay API.
    this.binding_ = new PayClientBindingSwg(win, activityPorts);
  }

  /**
   * @param {!../utils/preconnect.Preconnect} pre
   */
  preconnect(pre) {
    pre.prefetch(payUrl());
    pre.prefetch(
        'https://payments.google.com/payments/v4/js/integrator.js?ss=md');
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
   * @return {?Window}  popup window, if any.
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
   * @return {?Window}  popup window, if any.
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
   * @param {!web-activities/activity-ports.ActivityPorts} activityPorts
   */
  constructor(win, activityPorts) {
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = activityPorts;
  }

  /** @override */
  getType() {
    return 'SWG';
  }

  /** @override */
  start(paymentRequest, options) {
    const opener = this.activityPorts_.open(
        PAY_REQUEST_ID,
        payUrl(),
        options.forceRedirect ? '_top' : '_blank',
        feArgs(paymentRequest),
        {});
    return opener && opener.targetWin || null;
  }

  /** @override */
  onResponse(callback) {
    this.activityPorts_.onResult(PAY_REQUEST_ID, port => {
      callback(this.validatePayResponse_(port));
    });
  }

  /**
   * @param {!web-activities/activity-ports.ActivityPort} port
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
        return xhr.fetch(url, init).then(response => response.json());
      }
      // Data is supplied directly: must be a verified and secure channel.
      if (result.originVerified && result.secureChannel) {
        return data;
      }
      throw new Error('channel mismatch');
    });
  }
}
