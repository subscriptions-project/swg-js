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

import {FilterResult} from '../api/client-event-manager-api';

/** @implements {../api/client-event-manager-api.ClientEventManagerApi}*/
export class ClientEventManager {
  constructor() {
  }

  /**
   * @overrides
   */
  registerEventListener(unusedCallback) {
  }

  /**
   * @overrides
   */
  registerEventFilterer(unusedCallback) {
  }

  /**
   * @overrides
   */
  logEvent(event) {
    //TODO(mborof): the API must be used somewhere or presubmit fails.
    //              Remove this line once all code is implemented
    if (event === FilterResult.CANCEL_EVENT) {
      return;
    }
    return;
  }
}
