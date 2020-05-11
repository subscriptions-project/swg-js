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

/**
 * @fileoverview Externs for PaymentsClient.
 * @externs
 */

/**
 * An object-literal namespace
 */
google.payments = {};
google.payments.api = {};

/**
 * The client for interacting with the Google Pay APIs.
 * @param {!PaymentOptions=} paymentOptions
 * @param {boolean=} useIframe
 * @constructor
 * @see https://developers.google.com/pay/api/web/client-reference.
 */
google.payments.api.PaymentsClient = function(paymentOptions, useIframe) {};

/**
 * @param {!IsReadyToPayRequest} isReadyToPayRequest
 * @return {!Promise<?>}
 * @see https://developers.google.com/pay/api/web/client-reference#isReadyToPay
 */
google.payments.api.PaymentsClient.prototype.isReadyToPay = function(
  isReadyToPayRequest
) {};

/**
 * @param {!PaymentDataRequest} paymentDataRequest Provides necessary
 * @return {!Promise<!PaymentData>}
 * @see https://developers.google.com/pay/api/web/client-reference#loadPaymentData
 */
google.payments.api.PaymentsClient.prototype.loadPaymentData = function(
  paymentDataRequest
) {};

/**
 * @param {!PaymentDataRequest} paymentDataRequest
 * @see https://developers.google.com/pay/api/web/client-reference#prefetchPaymentData
 */
google.payments.api.PaymentsClient.prototype.prefetchPaymentData = function(
  paymentDataRequest
) {};

/**
 * Notifies Google that some offers may be available for the user if they choose
 * to pay with Google Pay. This can be called anywhere on the merchant site.
 * Google can choose to display a notification banner to inform user of the
 * offer.
 * @param {!PreNotificationOfferDetails} preNotificationOfferDetails
 */
google.payments.api.PaymentsClient.prototype.notifyAvailableOffers = function(
  preNotificationOfferDetails
) {};
