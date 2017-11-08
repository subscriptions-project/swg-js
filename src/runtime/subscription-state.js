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
  /**
   * @param  {!Window} win
   */
  constructor(win) {
    this.win = win;

    /** @type {boolean} */
    this.access_ = false;

    /**
     * @private {SubscriptionResponse} The response chosen by the
     * platform/publisher displayed to the user.
     */
    this.response_ = {access: false};

    /** @private {string} */
    this.serviceId_ = '';

    /** @type {boolean} */
    this.shouldRetry_ = true;
  }

  /** @return {boolean} */
  get accessGranted() {
    return this.access_;
  }

  /** @return {!SubscriptionResponse} */
  get activeSubscriptionResponse() {
    return this.response_;
  }

  /** @return {!string} */
  get activeServiceId() {
    return this.serviceId_;
  }

  /**
   * @return {boolean} Determines if the runtime should retry going through
   * subscription flow.
   */
  get shouldRetry() {
    return this.shouldRetry_;
  }

  /** @param {boolean} access */
  set accessGranted(access) {
    this.access_ = this.access_ || access;
  }

  /** @param {!SubscriptionResponse} response */
  set activeSubscriptionResponse(response) {
    this.response_ = response;
  }

  /** @param {!string} serviceId */
  set activeServiceId(serviceId) {
    this.serviceId_ = serviceId;
  }

  /** @param {boolean} retry */
  set shouldRetry(retry) {
    this.shouldRetry_ = retry;
  }
}
