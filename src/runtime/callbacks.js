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


/** @enum {number} */
const CallbackId = {
  ENTITLEMENTS: 1,
  SUBSCRIBE: 2,
  LOGIN_REQUEST: 3,
  LINK_PROGRESS: 4,
  LINK_COMPLETE: 5,
};


/**
 */
export class Callbacks {

  /**
   */
  constructor() {
    /** @private @const {!Object<number, function(!Promise)>} */
    this.callbacks_ = {};
    /** @private @const {!Object<number, !Promise>} */
    this.resultBuffer_ = {};
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
        promise.then(res => res.clone()));
  }

  /**
   * @param {function()} callback
   */
  setOnLoginRequest(callback) {
    this.setCallback_(CallbackId.LOGIN_REQUEST, callback);
  }

  /**
   * @return {boolean} Whether the callback has been found.
   */
  triggerLoginRequest() {
    return this.trigger_(CallbackId.LOGIN_REQUEST, Promise.resolve());
  }

  /**
   * @param {function(!Promise)} callback
   */
  setOnLinkProgress(callback) {
    this.setCallback_(CallbackId.LINK_PROGRESS, callback);
  }

  /**
   * @param {!Promise} promise
   * @return {boolean} Whether the callback has been found.
   */
  triggerLinkProgress(promise) {
    return this.trigger_(CallbackId.LINK_PROGRESS, promise);
  }

  /**
   * @return {boolean}
   */
  hasLinkProgressPending() {
    return !!this.resultBuffer_[CallbackId.LINK_PROGRESS];
  }

  /**
   * @param {function(!Promise)} callback
   */
  setOnLinkComplete(callback) {
    this.setCallback_(CallbackId.LINK_COMPLETE, callback);
  }

  /**
   * @param {!Promise} promise
   * @return {boolean} Whether the callback has been found.
   */
  triggerLinkComplete(promise) {
    return this.trigger_(CallbackId.LINK_COMPLETE, promise);
  }

  /**
   * @return {boolean}
   */
  hasLinkCompletePending() {
    return !!this.resultBuffer_[CallbackId.LINK_COMPLETE];
  }

  /**
   * @param {function(!Promise<!../api/subscribe-response.SubscribeResponse>)} callback
   */
  setOnSubscribeResponse(callback) {
    this.setCallback_(CallbackId.SUBSCRIBE, callback);
  }

  /**
   * @param {!Promise<!../api/subscribe-response.SubscribeResponse>} responsePromise
   * @return {boolean} Whether the callback has been found.
   */
  triggerSubscribeResponse(responsePromise) {
    return this.trigger_(
        CallbackId.SUBSCRIBE,
        responsePromise.then(res => res.clone()));
  }

  /**
   * @return {boolean}
   */
  hasSubscribeResponsePending() {
    return !!this.resultBuffer_[CallbackId.SUBSCRIBE];
  }

  /**
   * @param {!CallbackId} id
   * @param {function(!Promise)} callback
   * @private
   */
  setCallback_(id, callback) {
    this.callbacks_[id] = callback;
    // If result already exist, execute the callback right away.
    if (id in this.resultBuffer_) {
      this.executeCallback_(callback, this.resultBuffer_[id]);
    }
  }

  /**
   * @param {!CallbackId} id
   * @param {!Promise} data
   * @return {boolean}
   * @private
   */
  trigger_(id, data) {
    this.resultBuffer_[id] = data;
    const callback = this.callbacks_[id];
    if (callback) {
      this.executeCallback_(callback, data);
    }
    return !!callback;
  }

  /**
   * @param {function(!Promise)} callback
   * @param {!Promise} data
   * @private
   */
  executeCallback_(callback, data) {
    // Always execute callbacks in a microtask.
    Promise.resolve().then(() => {
      callback(data);
    });
  }
}
