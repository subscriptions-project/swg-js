/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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

import * as EventApi from '../api/swg-client-event-manager-api';

/** @implements {EventApi.SwgClientEventManagerApi}*/
export class SwgClientEventManager {
  constructor() {
  }

  /**
   * Ensures the callback function is notified anytime one of the passed
   * events occurs unless a filterer returns false.
   * @param {!function(!EventApi.SwgClientEvent)} unusedCallback
   * @overrides
   */
  registerEventListener(unusedCallback) {
  }

  /**
   * Register a filterer for events if you need to potentially cancel an event
   * before the listeners are called.  A filterer should return
   * FilterResult.STOP_EXECUTING to cancel an event.
   * @param {!function(!EventApi.SwgClientEvent):!EventApi.FilterResult} unusedCallback
   * @overrides
   */
  registerEventFilterer(unusedCallback) {
  }

  /**
   * Call this function to log an event.  The registered listeners will be
   * invoked unless the event is filtered.  Returns false if the event was
   * filtered and throws an error if the event is invalid.
   * @param {!EventApi.SwgClientEvent} event
   * @returns {!Promise}
   * @overrides
   */
  logEvent(event) {
    //TODO(mborof) the API must be used somewhere or presubmit fails.
    //  remove this line once all code is implemented
    if (event === EventApi.FilterResult.CANCEL_EVENT) {
      return Promise.resolve();
    }
    return Promise.resolve();
  }
}
