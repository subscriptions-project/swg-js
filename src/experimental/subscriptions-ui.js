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

import {CSS as SWG_POPUP} from '../../build/css/experimental/swg-popup.css';
import {NotificationView} from './notification-view';
import {SubscriptionsFlow} from './subscriptions-flow';
import {isSubscriber} from './utils';

export class SubscriptionsUi {

  /**
   * @param {!Window} win The parent window.
   * @param {!SubscriptionMarkup} markup The markup object.
   * @param {!SubscriptionState} state The subscriptions object.
   */
  constructor(win, markup, state) {
    this.win = win;
    this.state_ = state;
    this.markup_ = markup;
    this.subFlow_ = new SubscriptionsFlow(win, markup, state);

    // TODO(dparikh): See if multiple CSS can be built and used based on the
    // current view. (Currently, injects one CSS for everything).
    this.injectCssToWindow_();
  }

  /**
   * @return {!Promise}
   */
  start() {
    if (isSubscriber(this.state_.activeSubscriptionResponse)) {
      return new NotificationView(this.win, this.state_).start();
    } else {
      return this.subFlow_.start();
    }
  }

  /**
   * Injects common CSS styles to the container window's <head> element.
   * @private
   */
  injectCssToWindow_() {
    const style = this.win.document.createElement('style');
    style.textContent = `${SWG_POPUP}`;
    this.win.document.head.appendChild(style);
  }
}
