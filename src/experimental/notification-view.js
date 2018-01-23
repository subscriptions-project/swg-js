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

/** @const {string} */
const DEFAULT_SUBSCRIPTION_URL = 'https://play.google.com/store/account';


/**
 * The class for SwG notification view.
 */
export class NotificationView {

  constructor(win) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private {?Element} */
    this.notificationContainer_ =
        this.document_.createElement(NOTIFICATION_TAG);
  }

  /*
   * Starts the subscriptions flow and returns a promise that resolves when the
   * flow is complete.
   *
   * @return {!Promise}
   */
  start() {
    this.openView_();
    return Promise.resolve();
  }

  /**
   * @private
   */
  openView_() {
    setImportantStyles(this.notificationContainer_, {
      'height': `${CONTAINER_HEIGHT}`,
    });
    this.document_.body.appendChild(this.notificationContainer_);

    this.addItems_();
  }

  /**
   * Adds label and detail button.
   * @private
   */
  addItems_() {
    const label = this.document_.createElement('div');
    label.textContent = 'Access via Google Subscriptions';
    label.setAttribute('class', 'swg-label');
    this.notificationContainer_.appendChild(label);

    const linkButton = this.document_.createElement('button');
    linkButton.textContent = 'Details';
    linkButton.setAttribute('class', 'swg-detail');
    this.notificationContainer_.appendChild(linkButton);

    const subscriptionUrl = DEFAULT_SUBSCRIPTION_URL;
    linkButton.addEventListener('click', () => {
      this.win_.open(subscriptionUrl, '_blank');
    });
  }
}
