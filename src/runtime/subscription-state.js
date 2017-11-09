/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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
    this.activeResponse_ = {access: false};

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
   * Checks if current user is a subscriber.
   * @return {boolean}
   */
  isSubscriber() {
    // TODO(avimehta, #21): Remove the check for 'entitled' before launch.
    return this.activeResponse_['entitled'] ||
        (this.activeResponse_['subscriber'] &&
        this.activeResponse_['subscriber']['types'] &&
        this.activeResponse_['subscriber']['types'].length > 0);
  }

  /**
   * Checks if current user is metered.
   * @return {boolean}
   */
  isMeteredUser() {
    return !!(this.activeResponse_['metering'] &&
          this.activeResponse_['metering']['quotaLeft'] > 0);
  }
}
