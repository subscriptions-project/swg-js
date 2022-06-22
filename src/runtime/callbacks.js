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
import {isCancelError} from '../utils/errors';
import {warn} from '../utils/log';

/** @enum {number} */
const CallbackId = {
  ENTITLEMENTS: 1,
  SUBSCRIBE_REQUEST: 2,
  PAYMENT_RESPONSE: 3,
  LOGIN_REQUEST: 4,
  LINK_PROGRESS: 5,
  LINK_COMPLETE: 6,
  FLOW_STARTED: 7,
  FLOW_CANCELED: 8,
  PAY_CONFIRM_OPENED: 9,
  OFFERS_FLOW_REQUEST: 10,
};

/**
 */
export class Callbacks {
  /**
   */
  constructor() {
    /** @private @const {!Object<CallbackId, function(*)>} */
    this.callbacks_ = {};
    /** @private @const {!Object<CallbackId, *>} */
    this.resultBuffer_ = {};
    /** @private {?Promise} */
    this.paymentResponsePromise_ = null;
  }

  /**
   * @param {function(!Promise<!../api/entitlements.Entitlements>)} callback
   */
  setOnEntitlementsResponse(callback) {
    this.setCallback_(CallbackId.ENTITLEMENTS, callback);
  }

  /**
   * @param {!Promise<!../api/entitlements.Entitlements>} promise
   */
  triggerEntitlementsResponse(promise) {
    return this.trigger_(
      CallbackId.ENTITLEMENTS,
      promise.then((res) => res.clone())
    );
  }

  /**
   * @return {boolean}
   */
  hasEntitlementsResponsePending() {
    return !!this.resultBuffer_[CallbackId.ENTITLEMENTS];
  }

  /**
   * @param {function(!../api/subscriptions.LoginRequest)} callback
   */
  setOnLoginRequest(callback) {
    this.setCallback_(CallbackId.LOGIN_REQUEST, callback);
  }

  /**
   * @param {!../api/subscriptions.LoginRequest} request
   * @return {boolean} Whether the callback has been found.
   */
  triggerLoginRequest(request) {
    return this.trigger_(CallbackId.LOGIN_REQUEST, request);
  }

  /**
   * @param {function()} callback
   */
  setOnLinkProgress(callback) {
    this.setCallback_(CallbackId.LINK_PROGRESS, callback);
  }

  /**
   * @return {boolean} Whether the callback has been found.
   */
  triggerLinkProgress() {
    return this.trigger_(CallbackId.LINK_PROGRESS, true);
  }

  /**
   */
  resetLinkProgress() {
    this.resetCallback_(CallbackId.LINK_PROGRESS);
  }

  /**
   * @param {function()} callback
   */
  setOnLinkComplete(callback) {
    this.setCallback_(CallbackId.LINK_COMPLETE, callback);
  }

  /**
   * @return {boolean} Whether the callback has been found.
   */
  triggerLinkComplete() {
    return this.trigger_(CallbackId.LINK_COMPLETE, true);
  }

  /**
   * @return {boolean}
   */
  hasLinkCompletePending() {
    return !!this.resultBuffer_[CallbackId.LINK_COMPLETE];
  }

  /**
   * @param {function(!../ui/activity-iframe-view.ActivityIframeView)} callback
   */
  setOnPayConfirmOpened(callback) {
    this.setCallback_(CallbackId.PAY_CONFIRM_OPENED, callback);
  }

  /**
   * @param {!../ui/activity-iframe-view.ActivityIframeView} activityIframeView
   * @return {boolean} Whether the callback has been found.
   */
  triggerPayConfirmOpened(activityIframeView) {
    return this.trigger_(CallbackId.PAY_CONFIRM_OPENED, activityIframeView);
  }

  /**
   * @param {function()} callback
   */
  setOnSubscribeRequest(callback) {
    this.setCallback_(CallbackId.SUBSCRIBE_REQUEST, callback);
  }

  /**
   * @return {boolean} Whether the callback has been found.
   */
  triggerSubscribeRequest() {
    return this.trigger_(CallbackId.SUBSCRIBE_REQUEST, true);
  }

  /**
   * @return {boolean}
   */
  hasSubscribeRequestCallback() {
    return !!this.callbacks_[CallbackId.SUBSCRIBE_REQUEST];
  }

  /**
   * @param {function()} callback
   */
  setOnOffersFlowRequest(callback) {
    this.setCallback_(CallbackId.OFFERS_FLOW_REQUEST, callback);
  }

  /**
   * @return {boolean} Whether the callback has been found.
   */
  triggerOffersFlowRequest() {
    return this.trigger_(CallbackId.OFFERS_FLOW_REQUEST, true);
  }

  /**
   * @return {boolean}
   */
  hasOffersFlowRequestCallback() {
    return !!this.callbacks_[CallbackId.OFFERS_FLOW_REQUEST];
  }

  /**
   * @param {function(!Promise<!../api/subscribe-response.SubscribeResponse>)} callback
   */
  setOnSubscribeResponse(callback) {
    warn(
      `[swg.js:setOnSubscribeResponse]: This method has been deprecated, please switch usages to 'setOnPaymentResponse'`
    );
    this.setCallback_(CallbackId.PAYMENT_RESPONSE, callback);
  }

  /**
   * @param {function(!Promise<!../api/subscribe-response.SubscribeResponse>)} callback
   */
  setOnContributionResponse(callback) {
    warn(
      `[swg.js:setOnContributionResponse]: This method has been deprecated, please switch usages to 'setOnPaymentResponse'`
    );
    this.setCallback_(CallbackId.PAYMENT_RESPONSE, callback);
  }

  /**
   * @param {function(!Promise<!../api/subscribe-response.SubscribeResponse>)} callback
   */
  setOnPaymentResponse(callback) {
    this.setCallback_(CallbackId.PAYMENT_RESPONSE, callback);
  }

  /**
   * @param {!Promise<!../api/subscribe-response.SubscribeResponse>} responsePromise
   * @return {boolean} Whether the callback has been found.
   */
  triggerPaymentResponse(responsePromise) {
    this.paymentResponsePromise_ = responsePromise.then(
      (res) => {
        this.trigger_(
          CallbackId.PAYMENT_RESPONSE,
          Promise.resolve(res.clone())
        );
      },
      (reason) => {
        if (isCancelError(reason)) {
          return;
        }
        throw reason;
      }
    );
    return !!this.callbacks_[CallbackId.PAYMENT_RESPONSE];
  }

  /**
   * @return {boolean}
   */
  hasPaymentResponsePending() {
    return !!this.resultBuffer_[CallbackId.PAYMENT_RESPONSE];
  }

  /**
   * @param {function({flow: string, data: !Object})} callback
   */
  setOnFlowStarted(callback) {
    this.setCallback_(CallbackId.FLOW_STARTED, callback);
  }

  /**
   * @param {string} flow
   * @param {!Object=} data
   * @return {boolean} Whether the callback has been found.
   */
  triggerFlowStarted(flow, data = {}) {
    return this.trigger_(CallbackId.FLOW_STARTED, {
      flow,
      data,
    });
  }

  /**
   * @param {function({flow: string, data: !Object})} callback
   */
  setOnFlowCanceled(callback) {
    this.setCallback_(CallbackId.FLOW_CANCELED, callback);
  }

  /**
   * @param {string} flow
   * @param {!Object=} data
   * @return {boolean} Whether the callback has been found.
   */
  triggerFlowCanceled(flow, data = {}) {
    return this.trigger_(CallbackId.FLOW_CANCELED, {
      flow,
      data,
    });
  }

  /**
   * @param {!CallbackId} id
   * @param {function(?)} callback
   * @private
   */
  setCallback_(id, callback) {
    if (this.callbacks_[id]) {
      warn(
        `[swg.js]: You have registered multiple callbacks for the same response.`
      );
    }
    this.callbacks_[id] = callback;
    // If result already exist, execute the callback right away.
    if (id in this.resultBuffer_) {
      this.executeCallback_(id, callback, this.resultBuffer_[id]);
    }
  }

  /**
   * @param {!CallbackId} id
   * @param {*} data
   * @return {boolean}
   * @private
   */
  trigger_(id, data) {
    this.resultBuffer_[id] = data;
    const callback = this.callbacks_[id];
    if (callback) {
      this.executeCallback_(id, callback, data);
    }
    return !!callback;
  }

  /**
   * @param {!CallbackId} id
   * @private
   */
  resetCallback_(id) {
    if (id in this.resultBuffer_) {
      delete this.resultBuffer_[id];
    }
  }

  /**
   * @param {!CallbackId} id
   * @param {function(*)} callback
   * @param {*} data
   * @private
   */
  executeCallback_(id, callback, data) {
    // Always execute callbacks in a microtask.
    Promise.resolve().then(() => {
      callback(data);
      this.resetCallback_(id);
    });
  }
}
