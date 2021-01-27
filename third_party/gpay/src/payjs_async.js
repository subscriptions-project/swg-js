/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
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

import {Constants} from './constants.js';
import {PaymentsClientDelegateInterface} from './payments_client_delegate_interface.js';
import {PaymentsRequestDelegate} from './payments_request_delegate.js';
import {PaymentsWebActivityDelegate} from './payments_web_activity_delegate.js';
import {UpiHandler} from './upi_handler.js';
import {ActivityPorts} from 'web-activities/activity-ports';
import {
  BuyFlowActivityMode,
  BuyFlowMode,
  PayFrameHelper,
  PostMessageEventType,
  PublicErrorCode,
} from './pay_frame_helper.js';
import {
  apiV2DoesMerchantSupportSpecifiedCardType,
  chromeSupportsPaymentHandler,
  chromeSupportsPaymentRequest,
  doesMerchantSupportOnlyTokenizedCards,
  getUpiPaymentMethod,
  validatePaymentOptions,
  validateIsReadyToPayRequest,
  validatePaymentDataRequest,
  validateSecureContext,
} from './validator.js';

import {createGoogleTransactionId} from './utils.js';

const TRUSTED_DOMAINS = [
  'actions.google.com',
  'amp-actions.sandbox.google.com',
  'amp-actions-staging.sandbox.google.com',
  'amp-actions-autopush.sandbox.google.com',
  'payments.developers.google.com',
  'payments.google.com',
];

/**
 * The client for interacting with the Google Payment APIs.
 * <p>
 * The async refers to the fact that this client supports redirects
 * when using webactivties.
 * <p>
 * If you are using this be sure that this is what you want.
 * <p>
 * In almost all cases PaymentsClient is the better client to use because
 * it exposes a promises based api which is easier to deal with.
 * @final
 */
class PaymentsAsyncClient {
  /**
   * @param {!PaymentOptions} paymentOptions
   * @param {function(!Promise<!PaymentData>)} onPaymentResponse
   * @param {boolean=} useIframe
   * @param {!ActivityPorts=} activities Can be used to provide a shared
   *   activities manager. By default, the new manager is created.
   */
  constructor(paymentOptions, onPaymentResponse, useIframe, activities) {
    this.onPaymentResponse_ = onPaymentResponse;

    validatePaymentOptions(paymentOptions);

    /** @private {?number} */
    this.loadPaymentDataApiStartTimeMs_ = null;

    /** @private @const {string} */
    this.environment_ =
      paymentOptions.environment || Constants.Environment.TEST;
    if (!PaymentsAsyncClient.googleTransactionId_) {
      PaymentsAsyncClient.googleTransactionId_ =
        /** @type {string} */ (this.isInTrustedDomain_() &&
        paymentOptions['i'] &&
        paymentOptions['i']['googleTransactionId']
          ? paymentOptions['i']['googleTransactionId']
          : createGoogleTransactionId(this.environment_));
    }

    /** @private @const {!PaymentOptions} */
    this.paymentOptions_ = paymentOptions;

    /** @private @const {!PaymentsClientDelegateInterface} */
    this.webActivityDelegate_ = new PaymentsWebActivityDelegate(
      this.environment_,
      PaymentsAsyncClient.googleTransactionId_,
      useIframe,
      activities,
      paymentOptions['i'] && paymentOptions['i']['redirectKey']
    );

    /** @private {number} */
    this.buyFlowMode_ = BuyFlowMode.PAY_WITH_GOOGLE;

    const paymentRequestSupported = chromeSupportsPaymentRequest();
    // TODO: Remove the temporary hack that disable payments
    // request for inline flow.
    /** @private @const {?PaymentsClientDelegateInterface} */
    this.delegate_ =
      paymentRequestSupported && !useIframe
        ? new PaymentsRequestDelegate(this.environment_)
        : this.webActivityDelegate_;

    this.upiHandler_ = new UpiHandler();

    this.webActivityDelegate_.onResult(this.onResult_.bind(this));
    this.delegate_.onResult(this.onResult_.bind(this));

    // Load PayFrameHelper upon client construction.
    PayFrameHelper.load();

    // If web delegate is used anyway then this is overridden in the web
    // activity delegate when load payment data is called.
    if (chromeSupportsPaymentHandler()) {
      PayFrameHelper.setBuyFlowActivityMode(
        BuyFlowActivityMode.PAYMENT_HANDLER
      );
    } else if (paymentRequestSupported) {
      PayFrameHelper.setBuyFlowActivityMode(BuyFlowActivityMode.ANDROID_NATIVE);
    }

    PayFrameHelper.setGoogleTransactionId(
      PaymentsAsyncClient.googleTransactionId_
    );
    PayFrameHelper.postMessage({
      'eventType': PostMessageEventType.LOG_INITIALIZE_PAYMENTS_CLIENT,
      'clientLatencyStartMs': Date.now(),
    });

    window.addEventListener('message', event =>
      this.handleMessageEvent_(event)
    );
  }

  /**
   * Check whether the user can make payments using the Payment API.
   *
   * @param {!IsReadyToPayRequest} isReadyToPayRequest
   * @return {!Promise} The promise will contain the boolean result and error
   *     message when possible.
   * @export
   */
  isReadyToPay(isReadyToPayRequest) {
    // Merge with paymentOptions, preferring values from isReadyToPayRequest
    if (isReadyToPayRequest) {
      isReadyToPayRequest = Object.assign(
        {},
        this.paymentOptions_,
        isReadyToPayRequest
      );
    }
    const startTimeMs = Date.now();
    /** @type {?string} */
    const errorMessage =
      validateSecureContext() ||
      validateIsReadyToPayRequest(isReadyToPayRequest);
    if (errorMessage) {
      return new Promise((resolve, reject) => {
        PaymentsAsyncClient.logDevErrorToConsole_('isReadyToPay', errorMessage);
        PayFrameHelper.postMessage({
          'eventType': PostMessageEventType.LOG_IS_READY_TO_PAY_API,
          'error': PublicErrorCode.DEVELOPER_ERROR,
        });
        reject({
          'statusCode': Constants.ResponseStatus.DEVELOPER_ERROR,
          'statusMessage': errorMessage,
        });
      });
    }

    const isReadyToPayPromise = this.isReadyToPay_(isReadyToPayRequest);

    isReadyToPayPromise.then(response => {
      PayFrameHelper.postMessage({
        'eventType': PostMessageEventType.LOG_IS_READY_TO_PAY_API,
        'clientLatencyStartMs': startTimeMs,
        'isReadyToPayApiResponse': response,
      });
      return response;
    });
    return isReadyToPayPromise;
  }

  /**
   * Actual implementation of isReadyToPay in a private method so that
   * we can add callbacks to the promise to measure latencies.
   *
   * @param {!IsReadyToPayRequest} isReadyToPayRequest
   * @return {!Promise} The promise will contain the boolean result and error
   *     message when possible.
   * @private
   */
  isReadyToPay_(isReadyToPayRequest) {
    if (this.upiHandler_.isUpiRequest(isReadyToPayRequest)) {
      return this.upiHandler_.isReadyToPay(isReadyToPayRequest);
    }
    if (
      chromeSupportsPaymentRequest() &&
      !isNativeDisabledInRequest(isReadyToPayRequest)
    ) {
      if (isReadyToPayRequest.apiVersion >= 2) {
        return this.isReadyToPayApiV2ForChromePaymentRequest_(
          isReadyToPayRequest
        );
      } else {
        // This is the apiVersion 1 branch.
        // If the merchant supports only Tokenized cards then just rely on
        // delegate to give us the result.
        // This will need to change once b/78519188 is fixed.
        const webPromise = this.webActivityDelegate_.isReadyToPay(
          isReadyToPayRequest
        );
        const nativePromise = this.delegate_.isReadyToPay(isReadyToPayRequest);
        if (
          doesMerchantSupportOnlyTokenizedCards(isReadyToPayRequest) &&
          !chromeSupportsPaymentHandler()
        ) {
          return nativePromise;
        }
        // Return webIsReadyToPay only if delegateIsReadyToPay has been
        // executed.
        return nativePromise.then(() => webPromise);
      }
    }
    const webPromise = this.webActivityDelegate_.isReadyToPay(
      isReadyToPayRequest
    );
    return webPromise;
  }

  /**
   * Handle is ready to pay for api v2.
   *
   * @param {!IsReadyToPayRequest} isReadyToPayRequest
   * @return {!Promise} The promise will contain the boolean result and error
   *     message when possible.
   * @private
   */
  isReadyToPayApiV2ForChromePaymentRequest_(isReadyToPayRequest) {
    let defaultPromise = Promise.resolve({'result': false});
    if (isReadyToPayRequest.existingPaymentMethodRequired) {
      defaultPromise = Promise.resolve({
        'result': false,
        'paymentMethodPresent': false,
      });
    }

    let nativePromise = defaultPromise;
    if (
      apiV2DoesMerchantSupportSpecifiedCardType(
        isReadyToPayRequest,
        Constants.AuthMethod.CRYPTOGRAM_3DS
      )
    ) {
      // If the merchant supports tokenized cards.
      // Make a separate call to gms core to check if the user isReadyToPay
      // with just tokenized cards. We can't pass in PAN_ONLY here
      // because gms core always returns true for PAN_ONLY.
      // Leave other payment methods as is.
      const nativeRtpRequest /** @type {!IsReadyToPayRequest} */ = JSON.parse(
        JSON.stringify(isReadyToPayRequest)
      );
      for (let i = 0; i < nativeRtpRequest.allowedPaymentMethods.length; i++) {
        if (
          nativeRtpRequest.allowedPaymentMethods[i].type ==
          Constants.PaymentMethod.CARD
        ) {
          nativeRtpRequest.allowedPaymentMethods[i].parameters[
            'allowedAuthMethods'
          ] = [Constants.AuthMethod.CRYPTOGRAM_3DS];
        }
      }

      nativePromise = this.delegate_.isReadyToPay(nativeRtpRequest);
    }

    let webPromise = defaultPromise;
    if (
      apiV2DoesMerchantSupportSpecifiedCardType(
        isReadyToPayRequest,
        Constants.AuthMethod.PAN_ONLY
      )
    ) {
      webPromise = this.webActivityDelegate_.isReadyToPay(isReadyToPayRequest);
    }

    // Update session storage with payment handler canMakePayment result but
    // rely on web delegate for actual response
    if (chromeSupportsPaymentHandler()) {
      return nativePromise.then(() => webPromise);
    }

    return nativePromise.then(nativeResult => {
      if ((nativeResult && nativeResult['result']) == true) {
        return nativeResult;
      }
      return webPromise;
    });
  }

  /**
   * Prefetch paymentData to speed up loadPaymentData call. Note the provided
   * paymentDataRequest should exactly be the same as provided in
   * loadPaymentData to make the loadPaymentData call fast since current
   * web flow prefetching is based on the full request parameters.
   *
   * @param {!PaymentDataRequest} paymentDataRequest Provides necessary
   *     information to support a payment.
   * @export
   */
  prefetchPaymentData(paymentDataRequest) {
    /** @type {?string} */
    const errorMessage =
      validateSecureContext() || validatePaymentDataRequest(paymentDataRequest);
    if (errorMessage) {
      PaymentsAsyncClient.logDevErrorToConsole_(
        'prefetchPaymentData',
        errorMessage
      );
      return;
    }
    this.assignInternalParams_(paymentDataRequest);
    if (
      chromeSupportsPaymentRequest() &&
      !isNativeDisabledInRequest(paymentDataRequest)
    ) {
      this.delegate_.prefetchPaymentData(paymentDataRequest);
    } else {
      // For non chrome supports always use the hosting page.
      this.webActivityDelegate_.prefetchPaymentData(paymentDataRequest);
    }
  }

  /**
   * Request PaymentData, which contains necessary infomartion to complete a
   * payment.
   *
   * @param {!PaymentDataRequest} paymentDataRequest Provides necessary
   *     information to support a payment.
   * @export
   */
  loadPaymentData(paymentDataRequest) {
    PayFrameHelper.postMessage({
      'eventType': PostMessageEventType.LOG_BUTTON_CLICK,
    });
    const errorMessage =
      validateSecureContext() || validatePaymentDataRequest(paymentDataRequest);
    this.buyFlowMode_ =
      paymentDataRequest && paymentDataRequest.swg
        ? BuyFlowMode.SUBSCRIBE_WITH_GOOGLE
        : BuyFlowMode.PAY_WITH_GOOGLE;
    if (errorMessage) {
      this.onPaymentResponse_(
        new Promise((resolve, reject) => {
          PayFrameHelper.postMessage({
            'eventType': PostMessageEventType.LOG_LOAD_PAYMENT_DATA_API,
            'error': PublicErrorCode.DEVELOPER_ERROR,
            'buyFlowMode': this.buyFlowMode_,
          });
          PaymentsAsyncClient.logDevErrorToConsole_(
            'loadPaymentData',
            errorMessage
          );
          reject({
            'statusCode': Constants.ResponseStatus.DEVELOPER_ERROR,
            'statusMessage': errorMessage,
          });
        })
      );
      return;
    }

    // Handler for UPI PaymentMethod
    // Currently we don't support UPI along with other payment methods, if
    // UPI is in payment methods then we assume it is UPI only.
    const upiPaymentMethod = getUpiPaymentMethod(paymentDataRequest);
    if (upiPaymentMethod) {
      this.upiHandler_.loadPaymentData(
        paymentDataRequest,
        upiPaymentMethod,
        this.onResult_.bind(this)
      );
      return;
    }

    this.loadPaymentDataApiStartTimeMs_ = Date.now();
    this.assignInternalParams_(paymentDataRequest);
    // We want to fall back to the web delegate if payment handler is supported
    // and isReadyToPay bit is not explicitly set to true (fallback to web if
    // isReadyToPay wasn't called for PH)
    if (
      chromeSupportsPaymentHandler() ||
      isNativeDisabledInRequest(paymentDataRequest)
    ) {
      this.webActivityDelegate_.loadPaymentData(paymentDataRequest);
    } else {
      this.delegate_.loadPaymentData(paymentDataRequest);
    }
  }

  /**
   * Log developer error to console.
   *
   * @param {string} apiName
   * @param {?string} errorMessage
   * @private
   */
  static logDevErrorToConsole_(apiName, errorMessage) {
    console.error('DEVELOPER_ERROR in ' + apiName + ' : ' + errorMessage);
  }

  /**
   * Return a <div> element containing a Google Pay payment button.
   *
   * @param {!ButtonOptions=} options
   * @return {!Element}
   * @export
   */
  createButton(options = {}) {
    const button = null;
    // Only log if button was created successfully
    const startTimeMs = Date.now();
    PayFrameHelper.postMessage({
      'eventType': PostMessageEventType.LOG_RENDER_BUTTON,
      'clientLatencyStartMs': startTimeMs,
    });
    return button;
  }

  /**
   * @param {!Event} e postMessage event from the AMP page.
   * @private
   */
  handleMessageEvent_(e) {
    if (this.isInTrustedDomain_()) {
      // Only handles the event right now if loaded in trusted domain.
      if (e.data['name'] === 'logPaymentData') {
        PayFrameHelper.postMessage(e.data['data']);
      }
    }
  }

  /**
   * @private
   * @return {boolean}
   */
  isInTrustedDomain_() {
    return TRUSTED_DOMAINS.indexOf(window.location.hostname) != -1;
  }

  /**
   * Called when load payment data result is returned. This triggers the payment
   * response callback passed to the client.
   *
   * @private
   */
  onResult_(response) {
    response
      .then(result => {
        PayFrameHelper.postMessage({
          'eventType': PostMessageEventType.LOG_LOAD_PAYMENT_DATA_API,
          'clientLatencyStartMs': this.loadPaymentDataApiStartTimeMs_,
          'buyFlowMode': this.buyFlowMode_,
        });
      })
      .catch(result => {
        if (result['errorCode']) {
          PayFrameHelper.postMessage({
            'eventType': PostMessageEventType.LOG_LOAD_PAYMENT_DATA_API,
            'error': /** @type {!PublicErrorCode} */ (result['errorCode']),
            'buyFlowMode': this.buyFlowMode_,
          });
        } else {
          // If user closes window we don't get a error code
          PayFrameHelper.postMessage({
            'eventType': PostMessageEventType.LOG_LOAD_PAYMENT_DATA_API,
            'error': PublicErrorCode.BUYER_CANCEL,
            'buyFlowMode': this.buyFlowMode_,
          });
        }
      });
    this.onPaymentResponse_(response);
  }

  /**
   * @param {!PaymentDataRequest} paymentDataRequest
   * @return {!PaymentDataRequest}
   * @private
   */
  assignInternalParams_(paymentDataRequest) {
    const internalParam = {
      'startTimeMs': Date.now(),
      'googleTransactionId': PaymentsAsyncClient.googleTransactionId_,
    };
    paymentDataRequest['i'] = paymentDataRequest['i']
      ? Object.assign(internalParam, paymentDataRequest['i'])
      : internalParam;
    return paymentDataRequest;
  }
}

/** @const {?string} */
PaymentsAsyncClient.googleTransactionId_;

/**
 * Whether the request specifies that the native support has to be disabled.
 *
 * @param {!IsReadyToPayRequest|!PaymentDataRequest} request
 * @return {boolean}
 */
function isNativeDisabledInRequest(request) {
  return (request['i'] && request['i']['disableNative']) === true;
}

export {PaymentsAsyncClient};
