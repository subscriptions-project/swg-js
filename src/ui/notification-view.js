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
import {CSS as OFFERS_CSS} from
    '../../build/css/experimental/swg-popup-offer.css';

/**
* The default height of the pop-up.
* @const {number}
*/
export const CONTAINER_HEIGHT = 60;

/** @const {string} */
export const DEFAULT_SUBSCRIPTION_URL = 'https://play.google.com/store/account';

// TODO(dparikh): Consider moving this to a constants file and reuse.
/** @const {string} */
export const GOOGLE_FONTS_URL =
     'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';

/** @const @enum {string} */
export const IFRAME_STYLES = {
  'height': `${CONTAINER_HEIGHT}px`,
  'position': 'fixed',
  'bottom': '0px',
  'color': 'rgb(255, 255, 255)',
  'font-size': '15px',
  'padding': '20px 8px 0px',
  'z-index': '2147483647',
  'border': 'none',
  'box-shadow': 'gray 3px 3px, rgb(0, 0, 0) 0px 0px 1.4em',
  'background-color': 'rgb(51, 51, 51)',
  'box-sizing': 'border-box',
  'min-height': '60px',
  'animation': 'swg-notify 1s ease-out normal backwards,' +
      ' swg-notify-hide 1s ease-out 7s normal forwards',
  'font-family': 'Roboto',
};

/** @const @enum {string} */
export const IFRAME_ATTRIBUTES = {
  'frameborder': 0,
  'scrolling': 'no',
  'src': 'about:blank',
};

/** @const {string} */
export const NOTIFICATION_LABEL = 'Access via Google Subscriptions';

/** @const {string} */
export const NOTIFICATION_LABEL_CLASS = 'swg-label';

/** @const {string} */
export const NOTIFICATION_DETAIL_CLASS = 'swg-detail';

/** @const {string} */
export const NOTIFICATION_DETAIL_LABEL = 'Details';

/** @const {string} */
export const NOTIFICATION_DETAIL_ARIA_LABEL = 'Account details';


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

  /**
   * Gets the container.
   * @return {!Element}
   */
  get notificationContainer() {
    return this.notificationContainer_;
  }

  /*
   * Starts the subscriptions flow and returns a promise that resolves when the
   * flow is complete.
   *
   * @return {!Promise}
   */
  start() {
    return this.openView_();
    // TODO(dparikh): Set a flag in session storage to not render this again.
    this.state_.shouldRetry = false;
  }

  /**
   * Builds and opens the notification bar.
   * @private
   * @return {!Promise}
   */
  openView_() {
    const doc = this.document_;
    this.notificationContainer_ =
        createElement(doc, 'iframe', IFRAME_ATTRIBUTES);
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

      // Not important so as to allow resize.
      setStyles(iframe, {
        'width': '100%',
        'left': 0,
      });

      this.addItems_(iframeDoc, iframeBody);
      return iframeBody;
    });
  }

  /**
   * Adds label and detail button.
   * @param {!Document} iframeDoc
   * @param {!Element} iframeBody
   */
  addItems_(iframeDoc, iframeBody) {
    const label = createElement(iframeDoc, 'div', {
      'class': NOTIFICATION_LABEL_CLASS,
    });
    label.textContent = NOTIFICATION_LABEL;
    iframeBody.appendChild(label);

    const linkButton = createElement(iframeDoc, 'button', {
      'class': NOTIFICATION_DETAIL_CLASS,
      'aria-label': NOTIFICATION_DETAIL_ARIA_LABEL,
    });
    linkButton.textContent = NOTIFICATION_DETAIL_LABEL;
    iframeBody.appendChild(linkButton);

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
