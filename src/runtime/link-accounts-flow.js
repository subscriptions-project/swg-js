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
import {ActivityIframeView} from '../ui/activity-iframe-view';

/**
 * @const {string}
 */
const linkFrontIframeUrl =
    '$frontend$/subscribewithgoogleclientui/linkfrontiframe';

/**
 * @const @enum {string}
 */
const activityArgs = {
  'publicationId': 'com.appspot.scenic-2017', // TODO(dparikh): Replace with actual PubId.
  'requestId': 'request1-complete',  // TODO(dparikh): Replace with actual requestId.
  'returnUrl': 'https://scenic-2017.appspot.com/complete',  // TODO(dparikh): Replace with actual returnUrl.
};

/**
 * The class for Link account flow.
 *
 */
export class LinkAccountsFlow {

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
    this.dialog_ = new Dialog(this.win_);

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      linkFrontIframeUrl,
      activityArgs);
  }

  /**
   * Starts the Link account flow.
   * @return {!Promise}
   */
  start() {
    return this.dialog_.open().then(() => {
      return this.dialog_.openView(this.activityIframeView_);
    });
  }
}
