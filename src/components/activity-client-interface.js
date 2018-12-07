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

import {AnalyticsContext} from '../proto/api_messages';
import {ActivityIframePort} from 'web-activities/activity-ports';
import {ActivityMode, ActivityResult} from 'web-activities/activities';

/**
 * @typedef {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>} SerializedBuffer
 */
export class ActivityClientInterface{
  /**
   * @param {!HTMLIFrameElement} iframe
   * @param {!TrustedResourceUrl} url
   * @param {?Object=} opt_args
   */
  constructor(iframe, url, opt_args) {
    this.activityIframePort_ = new ActivityIframePort(iframe, url, opt_args);
    /** @private @const {!Object<string, function(!{SerializedBuffer})>} */
    this.callbackMap_ = {};
  }

  /**
   *
   * @param {string} pub_id
   * @param {?AnalyticsContext} context
   */
  start(pub_id, context) {
    this.message(
        {'pubId': pub_id, 'context': context.toArray()});
  }

  /**
   * @return {!ActivityMode}
   */
  getMode() {
    return this.activityIframePort_.getMode();
  }

  /**
   * Waits until the activity port is connected to the host.
   * @return {!Promise}
   */
  connect() {
    return this.activityIframePort_.connect();
  }

  disconnect() {
    return this.activityIframePort_.disconnect();
  }
  /**
   * @return {!Promise<!ActivityResult>}
   */
  acceptResult() {
    return this.activityIframePort_.acceptResult();
  }

  /**
   * @param {!Object} payload
   */
  message(payload) {
    this.activityIframePort_.message(payload);
  }

  /**
   * Registers a callback to receive messages from the host.
   * @param {function(!Object)} callback
   */
  onMessage(callback) {
    this.activityIframePort_.onMessage(callback);
  }

  messageChannel(opt_name) {
    return this.activityIframePort_.messageChannel(opt_name);
  }

  whenReady() {
    return this.activityIframePort_.whenReady();
  }

  onResizeRequest(callback) {
    this.activityIframePort_.onResizeRequest(callback);
  }

  resized() {
    this.activityIframePort_.resized();
  }

  /**
   *
   * @param {!SerializedBuffer} request
   */
  execute(request) {
    this.message({req: request});
  }

  /**
   * @param {string} responseType
   * @param {function(!{!SerializedBuffer})} callback
   */
  on(responseType, callback) {
    if (!this.callbackMap_[responseType]) {
      this.callbackMap_[responseType] = callback;
    }
    this.onMessage(data => {
      if (data == null || data[0] == null) {
        return;
      }
      const dataType = data[0];
      const cb = this.callbackMap_[dataType];
      cb(data);
    });
  }
}
