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


/** @enum {number} */
const CallbackId = {
  LINK_COMPLETE: 1,
};


/**
 */
export class Callbacks {

  /**
   */
  constructor() {
    /** @private @const {!Object<number, function(*)>} */
    this.callbacks_ = {};
    /** @private @const {!Object<number, *>} */
    this.resultBuffer_ = {};
  }

  /**
   * @param {function()} callback
   */
  setOnLinkComplete(callback) {
    this.setCallback_(CallbackId.LINK_COMPLETE, callback);
  }

  /**
   */
  triggerLinkComplete() {
    this.trigger_(CallbackId.LINK_COMPLETE, /* data */ null);
  }

  /**
   * @param {!CallbackId} id
   * @param {function(*)} callback
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
   * @param {*} data
   * @private
   */
  trigger_(id, data) {
    this.resultBuffer_[id] = data;
    const callback = this.callbacks_[id];
    if (callback) {
      this.executeCallback_(callback, data);
    }
  }

  /**
   * @param {function(*)} callback
   * @param {*} data
   * @private
   */
  executeCallback_(callback, data) {
    // Always execute callbacks in a microtask.
    Promise.resolve().then(() => {
      callback(data);
    });
  }
}
