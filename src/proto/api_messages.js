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

import {
    AnalyticsContext,
    AnalyticsEvent,
    AnalyticsEventMeta,
    AnalyticsRequest,
    EventOriginator,
    EventParams,
    LinkRequest,
    SkuSelected,
    SmartBoxMessage,
    SubscribeRequest,
    ViewSubscriptionsRequest,
    Message,
  } from './messages';


const PROTO_MAP = {
    'AnalyticsContext': AnalyticsContext,
    'AnalyticsEventMeta': AnalyticsEventMeta,
    'AnalyticsEvent': AnalyticsEvent,
    'EventOriginator': EventOriginator,
    'AnalyticsRequest': AnalyticsRequest,
    'EventParams': EventParams,
    'LinkRequest': LinkRequest,
    'SkuSelected': SkuSelected,
    'SmartBoxMessage': SmartBoxMessage,
    'SubscribeRequest': SubscribeRequest,
    'ViewSubscriptionsRequest': ViewSubscriptionsRequest,
  };

  /**
   * Utility to deserialize a buffer
   * @param {!Array} data
   * @return {!Message}
   */
  function deserialize(data) {
    /** {?string} */
    const key = data ? data[0] : null;
    if (key) {
      const ctor = PROTO_MAP[key];
      if (ctor) {
        return new ctor(data);
      }
    }
    throw new Error('Deserialization failed for ' + data);
  }

  /**
   * @param {function(new: T)} messageType
   * @return {string}
   * @template T
   */
  function getLabel(messageType) {
    const message = /** @type {!Message} */ (new messageType());
    return message.getJspbMessageId();
  }

export {
  deserialize,
  getLabel,
}
