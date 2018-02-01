/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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
 * @fileOverview Provides a single place to store all the subscription related
 * data.
 */
export class SubscriptionState {
  constructor(win) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private {boolean} */
    this.accessGranted_ = false;

    /** @private {SubscriptionResponse} */
    this.activeResponse_ = {'entitled': false};

    /** @private {string} */
    this.serviceId_ = '';

    /** @private {boolean} */
    this.shouldRetry_ = true;
  }

  /** @return {boolean} */
  get accessGranted() {
    return this.accessGranted_;
  }

  /** @param {boolean} access */
  set accessGranted(access) {
    assert(this.accessGranted_ && !access,
        'Access should generally not be revoked once set.');
    this.accessGranted_ = access;
  }

  /** @return {!SubscriptionResponse} */
  get activeResponse() {
    return this.activeResponse_;
  }

  /** @param {!SubscriptionResponse} response */
  set activeResponse(response) {
    this.activeResponse_ = response;
  }

  /** @return {!string} */
  get activeServiceId() {
    return this.serviceId_;
  }

  /** @param {!string} serviceId */
  set activeServiceId(serviceId) {
    this.serviceId_ = serviceId;
  }

  /**
   * @return {boolean} Determines if the runtime should retry going through
   * subscription flow.
   */
  get shouldRetry() {
    return this.shouldRetry_;
  }

  /** @param {boolean} retry */
  set shouldRetry(retry) {
    this.shouldRetry_ = retry;
  }

  /**
   * Checks if the subscription response provides subscriber level access.
   *
   * If a subscription response is provided, it is used for checks. If not, the
   * active response (which defaults to no access) is used.
   * @param {!SubscriptionResponse=} opt_response
   * @return {boolean}
   */
  isSubscriber(opt_response) {
    // TODO(avimehta, #21): Remove the check for 'entitled' before launch.
    const response = opt_response || this.activeResponse_;
    return response['entitled'] ||
        !!(response['subscriber'] && response['subscriber']['types'] &&
         response['subscriber']['types'].length > 0);
  }

  /**
   * Checks if the subscription response provides metered access.
   *
   * If a subscription response is provided, it is used for checks. If not, the
   * active response (which defaults to no metering) is used.
   * @param {!SubscriptionResponse=} opt_response
   * @return {boolean}
   */
  isMeteredUser(opt_response) {
    const response = opt_response || this.activeResponse_;
    return !!(response['metering'] && response['metering']['quotaLeft'] > 0);
  }
}
