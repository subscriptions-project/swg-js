/**
 * @license
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
 * The result code used for `ActivityResult`.
 * @enum {string}
 */
export const ActivityResultCode = {
  OK: 'ok',
  CANCELED: 'canceled',
  FAILED: 'failed',
};


/**
 * The result of an activity. The activity implementation returns this object
 * for a successful result, a cancelation or a failure.
 * @struct
 */
export class ActivityResult {
  /**
   * @param {!ActivityResultCode} code
   * @param {*} data
   */
  constructor(code, data) {
    /** @const {!ActivityResultCode} */
    this.code = code;
    /** @const {*} */
    this.data = code == ActivityResultCode.OK ? data : null;
    /** @const {boolean} */
    this.ok = code == ActivityResultCode.OK;
    /** @const {?Error} */
    this.error = code == ActivityResultCode.FAILED ?
        new Error(String(data) || '') :
        null;
  }
}


/**
 * Activity client-side binding. The port provides limited ways to communicate
 * with the activity and receive signals and results from it. Not every type
 * of activity exposes a port.
 *
 * @interface
 */
export class ActivityPortDef {

  /**
   * Disconnect the activity binding and cleanup listeners.
   */
  disconnect() {}
}


/**
 * Activity implementation. The host provides interfaces, callbacks and
 * signals for the activity's implementation to communicate with the client
 * and return the results.
 *
 * @interface
 */
export class ActivityHostDef {

  /**
   * Disconnect the activity implementation and cleanup listeners.
   */
  disconnect() {}

  /**
   * The client's origin. The connection to the client must first succeed
   * before the origin can be known with certainty.
   * @return {string}
   */
  getTargetOrigin() {}

  /**
   * The arguments the activity was started with. The connection to the client
   * must first succeed before the origin can be known with certainty.
   * @return {?Object}
   */
  getArgs() {}

  /**
   * Signals to the opener that the host is ready to be interacted with.
   */
  ready() {}

  /**
   * Signals to the activity client the result of the activity.
   * @param {*} unusedData
   */
  result(unusedData) {}

  /**
   * Signals to the activity client that the activity has been canceled by the
   * user.
   */
  cancel() {}

  /**
   * Signals to the activity client that the activity has unrecoverably failed.
   * @param {!Error} unusedReason
   */
  failed(unusedReason) {}

  /**
   * Set the size container. This element will be used to measure the
   * size needed by the iframe. Not required for non-iframe hosts. The
   * needed height is calculated as `sizeContainer.scrollHeight`.
   * @param {!Element} unusedElement
   */
  setSizeContainer(unusedElement) {}

  /**
   * Signals to the activity client that the activity's size needs might have
   * changed. Not required for non-iframe hosts.
   */
  resized() {}

  /**
   * The callback the activity implementation can implement to react to changes
   * in size. Normally, this callback is called in reaction to the `resized()`
   * method.
   * @param {function(number, number, boolean)} unusedCallback
   */
  onResizeComplete(unusedCallback) {}
}
