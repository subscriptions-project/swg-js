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
  createElement,
  injectFontsLink,
  injectStyleSheet,
} from '../utils/dom';
import {
  setStyles,
  setImportantStyles,
} from '../utils/style';

/**
* The default height of the pop-up.
* @const {number}
*/
const CONTAINER_HEIGHT = 60;

/** @const {string} */
const DEFAULT_SUBSCRIPTION_URL = 'https://play.google.com/store/account';

import {CSS as OFFERS_CSS} from
    '../../build/css/experimental/swg-popup-offer.css';

/** @const {string} */
export const GOOGLE_FONTS_URL =
     'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';

export const IFRAME_STYLES = {
  'position': 'fixed',
  'bottom': 0,
  'color': '#fff',
  'font-size': '15px',
  'padding': '20px 8px 0',
  'z-index': '2147483647',
  'border': 'none',
  'box-shadow': '3px 3px gray, 0 0 1.4em #000',
  'background-color': '#333',
  'box-sizing': 'border-box',
  'min-height': '60px',
  'animation': 'swg-notify 1s ease-out normal backwards, ' +
      ' swg-notify-hide 1s ease-out 7s normal forwards',
  'font-family': 'Roboto sans-serif',
};


/**
 * The class for SwG notification view.
 */
export class NotificationView {

  /**
   * @param {!Window} win
   * @param {!SubscriptionState} state
   */
  constructor(win, state) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!SubscriptionState} */
    this.state_ = state;

    /** @private {Element} */
    this.notificationContainer_;
  }

  /*
   * Starts the subscriptions flow and returns a promise that resolves when the
   * flow is complete.
   *
   * @return {!Promise}
   */
  start() {
    this.openView_();
    // TODO(dparikh): Set a flag to session storage to not render this again.
    this.state_.shouldRetry = false;
    return Promise.resolve();
  }

  /**
   * @private
   */
  openView_() {
    const doc = this.document_;
    this.notificationContainer_ = createElement(doc, 'iframe', {
      'frameborder': 0,
      'scrolling': 'no',
      'src': 'about:blank',  // Required for certain browsers (IE10?).
    });
    const iframe = this.notificationContainer_;

    const readyPromise = new Promise(resolve => {
      iframe.onload = resolve;
    });
    doc.body.appendChild(iframe);  // Fires onload event.

    return readyPromise.then(() => {
      const iframeDoc = iframe.contentDocument;
      const iframeBody = iframeDoc.body;

      injectFontsLink(iframeDoc, GOOGLE_FONTS_URL);
      injectStyleSheet(iframeDoc, OFFERS_CSS);

      setImportantStyles(iframe, IFRAME_STYLES);
    });

    setImportantStyles(this.notificationContainer_, {
      'height': `${CONTAINER_HEIGHT}`,
    });
    // Not important so as to allow resize.
    setStyles(iframe, {
      'width': '100%',
      'left': 0,
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

    let subscriptionUrl = DEFAULT_SUBSCRIPTION_URL;
    const response = this.state_.activeResponse;
    if (response['subscriber'] && response['subscriber']['url']) {
      subscriptionUrl = response['subscriber']['url'];
    }
    linkButton.addEventListener('click', () => {
      this.win_.open(subscriptionUrl, '_blank');
    });
  }
}
