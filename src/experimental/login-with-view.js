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

import {createElement, injectFontsLink, injectStyleSheet} from '../utils/dom';
import {setImportantStyles} from '../utils/style';
import {IFRAME_CLASS} from './utils';
import {CSS as OFFERS_CSS} from
    '../../build/css/experimental/swg-popup-offer.css';

/** @const {string} */
const GOOGLE_FONTS_URL =
    'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';


/**
 * Login with View. User could be a subscriber through "Subscribe with Google"
 * service or with the publisher. Render options to login through either with
 * Google or with the publisher. Clicking on either button will launch a new
 * window to login.
 */
export class LoginWithView {

   /**
    * @param {!Window} win The parent window object.
    * @param {!PopupContext} context The Subscription container reference.
    * @param {!Element} offerContainer The offer container element <swg-popup>.
    */
  constructor(win, context, offerContainer) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @const @private {!PopupContext} */
    this.context_ = context;

    /** @private @const {!Element} */
    this.offerContainer_ = offerContainer;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!Element} */
    this.viewElement_ = createElement(this.document_, 'iframe', {
      'frameborder': 0,
      'top': '4px',  // Space for the top 4px high Google bar.
      'scrolling': 'no',
      'class': IFRAME_CLASS,
    });
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.viewElement_;
  }

  /**
   * Returns if document should fade for this view.
   * @return {boolean}
   */
  shouldFadeBody() {
    return true;
  }

  /**
   * Initializes the "Login with" view in the <swg-popup>.
   * @return {!Promise}
   */
  init() {
    const iframe = this.viewElement_;

    const readyPromise = new Promise(resolve => {
      iframe.onload = resolve;
    });
    this.offerContainer_.appendChild(this.viewElement_);

    return readyPromise.then(() => {
      const doc = iframe.contentDocument;
      injectFontsLink(doc, GOOGLE_FONTS_URL);
      injectStyleSheet(doc, OFFERS_CSS);

      setImportantStyles(doc.body, {
        'padding': 0,
        'margin': 0,
      });

      const container = createElement(this.document_, 'div', {});
      container.classList.add('swg-container');

      // TODO(dparikh): Implement with style.
      const button = createElement(this.document_, 'button', {
        'width': '200px',
      });
      button.textContent = 'Login with Google';
      container.appendChild(button);

      doc.body.appendChild(container);
    });
  }
 }
