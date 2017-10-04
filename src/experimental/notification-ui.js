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


import {
  isSubscriber,
} from './subscriptions-ui-util';
import {setImportantStyles} from '../utils/style';

/**
 * The pop-up element name to be used.
 * @const {string}
 */
const NOTIFICATION_TAG = 'swg-notification';

/**
 * The default height of the pop-up.
 * @const {number}
 */
const CONTAINER_HEIGHT = 60;


/**
 * Builds notification container for existing subscribers. Either the current
 * subscription is healthy or there could be payment issues. For healthy
 * account, user can view the subscription details by clicking on a link.
 * @param {!Window} win The main containing window object.
 * @return {!Promise}
 */


/**
 * The class for SwG notification view.
 */
export class NotificationUi {

  constructor(win, response) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!SubscriptionResponse} */
    this.subscription_ = response;

    /** @private {?Element} */
    this.notificationContainer_ =
        this.document_.createElement(NOTIFICATION_TAG);
  }

  /*
   * Starts the subscriptions flow.
   */
  start() {
    if (isSubscriber(this.subscription_)) {
      this.openView_();
    } else {
      throw new Error('Should not reach here!');
    }
  }

  /**
   * @private
   */
  openView_() {
    setImportantStyles(this.notificationContainer_, {
      'visibility': 'hidden',
      'height': `${CONTAINER_HEIGHT}`,
      'opacity': 0,
    });
    this.document_.body.appendChild(this.notificationContainer_);
    setImportantStyles(this.notificationContainer_, {
      'visibility': 'visible',
      'opacity': 1,
    });
    this.show_();
  }

  /**
   * Displays the element in the UI. Element is hidden when created,
   * and should now be displayed when element is attached to the DOM.
   * @private
   */
  show_() {
    this.notificationContainer_.style
        .setProperty('display', 'inline', 'important');
  }
}
