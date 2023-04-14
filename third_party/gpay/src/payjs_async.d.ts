/**
 * Copyright 2023 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActivityPorts} from 'web-activities/activity-ports';

/**
 * @fileoverview Type definitions for parts of `gpay` imported by Swgjs' TypeScript.
 */

/**
 * Internal parameters.
 */
interface InternalParameters {
  /** The origin of an amp page. This field should only be trusted if loaded in Google Viewer. */
  ampMerchantOrigin?: string | null;
  /** The google transaction id to keep track of the current transaction. */
  googleTransactionId?: string | null;
  /** The unix time for when an API method was called. */
  startTimeMs?: number | null;
  /** The obfuscated id of the user. */
  preferredAccountId?: string | null;
  /** The current user's Gaia session cookie index, a string (e.g. "0" or "5"). */
  userIndex?: string | null;
  /**
   * The flag to decide whether the PayJS container should be vertically centered
   * or loaded from the bottom.
   */
  renderContainerCenter?: boolean | null;
  /** The redirect verifier. Can only be used for a payment request. */
  redirectVerifier?: string | null;
  /** The redirect verifier. Can only be used for the payment client initialization. */
  redirectKey?: string | null;
  /** The UI renders differently based on the ProductType. */
  productType?: string | null;
}

/**
 * The payment data response object returned to the integrator.
 * This can have different contents depending upon the context in which the
 * buyflow is triggered.
 */
interface PaymentData {
  cardInfo?: CardInfo;
  paymentMethodToken?: object;
  shippingAddress?: UserAddress;
  /**
   * Temporary client side solution to remember the input params.
   * TODO: Remove this once server-side input preservation is done and is part of the response.
   */
  paymentRequest?: PaymentDataRequest;
}

/**
 * Represents errors thrown from payment data requests.
 */
export interface PaymentDataError {
  statusCode: string;
  statusMessage: string;
}

/**
 * Request object of loadPaymentData.
 */
interface PaymentDataRequest {
  /** The obfuscated merchant gaia id. */
  merchantId?: string;
  /** The allowedPaymentMethods can be 'CARD' or 'TOKENIZED_CARD'. */
  allowedPaymentMethods?: string[];
  apiVersion?: number;
  paymentMethodTokenizationParameters?: PaymentMethodTokenizationParameters;
  cardRequirements?: CardRequirements;
  phoneNumberRequired?: boolean;
  emailRequired?: boolean;
  merchantInfo?: MerchantInfo;
  shippingAddressRequired?: boolean;
  shippingAddressRequirements?: ShippingAddressRequirements;
  transactionInfo?: TransactionInfo;
  swg?: SwgParameters;
  i?: InternalParameters;
  forceRedirect?: boolean;
}

/**
 * Options for using the Payment APIs.
 */
interface PaymentOptions {
  /**
   * The environment to use. Current available environments are PRODUCTION or TEST.
   * If not set, defaults to environment PRODUCTION.
   */
  environment?: string;
  merchantInfo?: MerchantInfo;
  i?: InternalParameters;
}

/**
 * The client for interacting with the Google Payment APIs.
 *
 * The async refers to the fact that this client supports redirects
 * when using webactivties.
 *
 * If you are using this be sure that this is what you want.
 *
 * In almost all cases PaymentsClient is the better client to use because
 * it exposes a promises based api which is easier to deal with.
 */
class PaymentsAsyncClient {
  static googleTransactionId_?: string;

  /**
   * @param activities Can be used to provide a shared activities manager.
   *   By default, the new manager is created.
   */
  constructor(
    paymentOptions: PaymentOptions,
    onPaymentResponse: (paymentDataPromise: Promise<PaymentData>) => void,
    useIframe?: boolean,
    activities?: ActivityPorts
  );

  /**
   * Request PaymentData, which contains necessary infomartion to complete a
   * payment.
   *
   * @param paymentDataRequest Provides necessary information to support a payment.
   */
  loadPaymentData(paymentDataRequest: PaymentDataRequest): void;
}
