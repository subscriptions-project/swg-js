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

import {ActivityIframeHost} from './activity-iframe-host';
import {ActivityIframePort} from './activity-iframe-port';


/**
 * The page-level activities manager. This class is intended to be used as a
 * singleton. It can start activities as well as implement them.
 */
export class Activities {

  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const */
    this.win_ = win;
  }

  /**
   * Start an activity within the specified iframe.
   * @param {!HTMLIFrameElement} iframe
   * @param {string} url
   * @param {string} origin
   * @param {?Object=} opt_args
   * @return {!Promise<!ActivityIframePort>}
   */
  openIframe(iframe, url, origin, opt_args) {
    const port = new ActivityIframePort(iframe, url, origin, opt_args);
    return port.connect().then(() => port);
  }

  /**
   * Start activity implementation handler (host).
   * @return {!Promise<!./activity-types.ActivityHost>}
   */
  connectHost() {
    const host = new ActivityIframeHost(this.win_);
    return host.connect().then(() => host);
  }
}
