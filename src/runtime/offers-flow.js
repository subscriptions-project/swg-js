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

import {Dialog} from '../components/dialog';


/**
 * The class for Offers flow.
 *
 */
export class OffersFlow {

  /**
   * @param {!Window} win
   * @param {!web-activities/activity-ports.ActivityPorts} activityPorts
   */
  constructor(win, activityPorts) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!HTMLDocument} */
    this.document_ = win.document;

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = activityPorts;

    /** @private @const {!Dialog} */
    this.dialog_ = new Dialog(this.document_);
  }

  /**
   * Starts the offers flow.
   * @return {!Promise}
   */
  start() {
    return this.dialog_.open().then(() => {
      // TODO add Offers iframe.
    });
  }

}
