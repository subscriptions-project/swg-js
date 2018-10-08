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
import {PublicErrorCode} from './pay_frame_helper.js';
import {getUpiPaymentMethod} from './validator.js';

class UpiHandler {
  constructor() {}

  /**
   * Returns upi payment method object if it exists in allowed payment methods
   * or null if it doesn't
   *
   * @param {!IsReadyToPayRequest|!PaymentDataRequest} request
   * @return {boolean}
   */
  isUpiRequest(request) {
    return !!getUpiPaymentMethod(request);
  }

  /**
   * Returns upi payment method object if it exists in allowed payment methods
   * or null if it doesn't
   *
   * @param {!IsReadyToPayRequest|!PaymentDataRequest} request
   * @return {!Promise} The promise will contain the boolean result and error
   *     message when possible.
   */
  isReadyToPay(request) {
    // Always return true for UPI if api version is 2 and chrome supports
    // payment request
    if (getUpiPaymentMethod(request)) {
      if (request.existingPaymentMethodRequired) {
        return Promise.resolve({'result': true, 'paymentMethodPresent': true});
      } else {
        return Promise.resolve({'result': true});
      }
    }
    throw new Error('No Upi payment method found in handler');
  }

  /**
   * Request payment data when payment method is UPI
   *
   * @param {!PaymentDataRequest} paymentDataRequest Provides necessary
   *     information to support a payment.
   * @param {!Object} upiPaymentMethod UPI paymentmethod in
   *     allowedPaymentMethods array.
   * @param {!Function} onResultCallback Function to call when everything is
   *     done.
   */
  loadPaymentData(paymentDataRequest, upiPaymentMethod, onResultCallback) {
    const parameters = upiPaymentMethod['parameters'];
    const transactionInfo = paymentDataRequest['transactionInfo'];
    const supportedInstruments = null ?
        [{
          // This is the url for Tez teamfood release.
          'supportedMethods': ['https://pwp-server.appspot.com/pay-teamfood'],
          'data': {
            'pa': 'redbus@axisbank',
            'pn': parameters['payeeName'],
            'tr': parameters['transactionReferenceId'],
            'url': parameters['referenceUrl'],
            'mc': '4131',
            'tn': 'Purchase in Merchant',
          },
        }] :
        [{
          'supportedMethods': ['https://tez.google.com/pay'],
          'data': {
            'pa': parameters['payeeVpa'],
            'pn': parameters['payeeName'],
            'tr': parameters['transactionReferenceId'],
            'url': parameters['referenceUrl'],
            'mc': parameters['mcc'],
            'tn': transactionInfo['transactionNote'],
          },
        }];

    if (parameters['transactionId']) {
      supportedInstruments[0]['data']['tid'] = parameters['transactionId'];
    }

    const details = {
      'total': {
        'label': 'Total',
        'amount': {
          'currency': transactionInfo['currencyCode'],
          'value': transactionInfo['totalPrice'],
        },
      },
      'displayItems': [{
        'label': 'Original Amount',
        'amount': {
          'currency': transactionInfo['currencyCode'],
          'value': transactionInfo['totalPrice'],
        },
      }],
    };

    let request = new PaymentRequest(supportedInstruments, details);

    onResultCallback(
        this.checkCanMakePayment_(request)
            .then(result => {
              if (result) {
                return this.showUi_(request);
              } else {
                return this.redirectToGooglePlay_();
              }
            })
            .then(paymentData => {
              return this.processData_(
                  paymentData, paymentDataRequest, upiPaymentMethod);
            })
            .catch(error => {
              error['statusCode'] = Constants.ResponseStatus.CANCELED;
              return Promise.reject(error);
            }));
  }

  /**
   * Show the Tez payment request UI.
   *
   * @private
   * @param {!PaymentRequest} request The payment request object.
   * @return {!Promise<!PaymentData>} A promise containing payment response.
   */
  showUi_(request) {
    return request.show().then(paymentResponse => {
      paymentResponse.complete('success');
      return paymentResponse.details;
    });
  }

  /**
   * Checks whether can make a payment with Tez on this device.
   *
   * @private
   * @param {!PaymentRequest} request The payment request object.
   * @return {!Promise<boolean>} a promise containing the result of whether can
   *     make payment.
   */
  checkCanMakePayment_(request) {
    // Checks canMakePayment cache, and use the cache result if it exists.
    const cacheResult =
        window.sessionStorage.getItem(Constants.UPI_CAN_MAKE_PAYMENT_CACHE_KEY);
    if (cacheResult) {
      return Promise.resolve(cacheResult === 'true');
    }

    // Feature detect canMakePayment().
    if (!request.canMakePayment) {
      return Promise.resolve(true);
    }

    let canMakePaymentPromise = request.canMakePayment();

    return canMakePaymentPromise.then(result => {
      // Store the result in cache if the result is true to avoid quota error
      // caused by querying multiple times with different data.
      // Doesn't store false because if we do so, user will be redirected to
      // Google Play again after installing Google Pay if Chrome is not closed.
      if (result) {
        window.sessionStorage.setItem(
            Constants.UPI_CAN_MAKE_PAYMENT_CACHE_KEY, result.toString());
      }
      return result;
    });
  }

  /**
   * Redirect user to Google Pay app in Google Play store
   *
   * @private
   * @returns {!Promise<!Object>} Rejected promise with error message
   */
  redirectToGooglePlay_() {
    window.location.replace(
        null ?
            'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user.teamfood ' :  // NOLINT
            'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user');  // NOLINT
    return Promise.reject(
        {'errorMessage': 'Cannot redirect to Tez page in Google Play.'});
  }

  /**
   * Convert Tez payment data to GPay payment data if payment succeeded, or
   * reject if payment failed
   *
   * @private
   * @param {!PaymentData} tezPaymentData The payment data object from Tez.
   * @param {!PaymentDataRequest} paymentDataRequest The payment data request.
   * @param {!Object} upiPaymentMethod UPI paymentmethod in
   * allowedPaymentMethods array
   * @returns {!Promise<PaymentData>} A promise containing payment data or
   *     error message.
   */
  processData_(tezPaymentData, paymentDataRequest, upiPaymentMethod) {
    const tezResponse = JSON.parse(tezPaymentData['tezResponse']);
    if (tezResponse['Status'] === 'FAILURE') {
      let error;
      switch (tezResponse['responseCode']) {
        case 'ZM':
          // payment failure due to invalid MPIN
          error = {
            'errorCode': PublicErrorCode.BUYER_ACCOUNT_ERROR,
            'errorMessage': 'Payment failure due to invalid MPIN.'
          };
          break;
        case 'Z9':
          // payment failure due to insufficient funds
          error = {
            'errorCode': PublicErrorCode.BUYER_ACCOUNT_ERROR,
            'errorMessage': 'Payment failure due to insufficient funds.'
          };
          break;
        case '91':
          // payment failure due to transaction timeout or connection issue
          error = {
            'errorCode': PublicErrorCode.INTERNAL_ERROR,
            'errorMessage':
                'Payment failure due to transaction timeout or connection' +
                ' issue.'
          };
          break;
        default:
          // payment failure due to user cancel or other issues
          error = {'errorMessage': 'Payment cancelled.'};
      }
      return Promise.reject(error);
    }

    const signedMessage = {
      'paymentMethodType': 'UPI',
      'payeeVpa': upiPaymentMethod['parameters']['payeeVpa'],
      'status': tezResponse['Status'],
      'transactionReferenceId':
          upiPaymentMethod['parameters']['transactionReferenceId'],
      'transactionId': upiPaymentMethod['parameters']['transactionId'] ?
          upiPaymentMethod['parameters']['transactionId'] :
          tezResponse['txnId'],
      'transactionInfo': paymentDataRequest['transactionInfo'],
    };

    let paymentData = {
      'apiVersion': paymentDataRequest['apiVersion'],
      'apiVersionMinor': paymentDataRequest['apiVersionMinor'],
      'paymentMethodData': {
        'type': upiPaymentMethod['type'],
        'tokenizationData': {
          'type': 'DIRECT',
          'token': {
            'protocolVersion': 'ECv1',
            // TODO: Verify that response comes from tez and
            // add signature and encrypt signed message here
            'signature': '',
            'signedMessage': signedMessage
          }
        }
      }
    };
    return Promise.resolve(paymentData);
  }
}

export {UpiHandler};
