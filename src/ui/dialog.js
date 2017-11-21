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
import {setStyles,
  setImportantStyles,
} from '../utils/style';

import {CSS as OFFERS_CSS} from
    '../../build/css/experimental/swg-popup-offer.css';

/** @const {string} */
export const GOOGLE_FONTS_URL =
    'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';

/**
 * The default height of the pop-up.
 * @const {number}
 */
export const CONTAINER_HEIGHT = 50;


/**
 * Default iframe styles.
 * Note: The iframe responsiveness media query style is injected in the
 * publisher's page since style attribute can not include media query.
 * @const <!Object<string, string|number>
 */
export const IFRAME_STYLES = {
  'min-height': `${CONTAINER_HEIGHT}px`,
  'opacity': 1,
  'border': 'none',
  'display': 'block',
  'background-color': 'rgb(255, 255, 255)',
  'position': 'fixed',
  'bottom': '0px',
  'z-index': '2147483647',
  'box-shadow': 'gray 0px 3px, gray 0px 0px 1.4em',
  'box-sizing': 'border-box',
  'overflow': 'hidden',
  'animation': 'swg-expand 1s',
};


/**
 * Subscribe with Google, top level dialog.
 */
export class Dialog {

  /**
   * @param {!Window} win The parent window object.
   */
  constructor(win) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private {Element} */
    this.viewElement_;
  }

  /**
   * Returns the win.
   * @return {!Window}
   */
  get win() {
    return this.win_;
  }

  /**
   * Returns the view element.
   * @return {Element}
   */
  get viewElement() {
    return this.viewElement_;
  }

  /**
   * Initializes the iframe creation and adding Google bar, Close button.
   * @return {!Promise}
   */
  init(doc) {

    // Create a container iframe to host various views.
    this.viewElement_ = createElement(doc, 'iframe', {
      'id': 'swg-iframe',
      'frameborder': 0,
      'scrolling': 'no',
      'src': 'about:blank',  // Required for certain browsers (IE?).
    });
    const iframe = this.viewElement_;

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
      setStyles(iframe, {
        'width': '100%',
        'left': 0,
      });

      this.addCloseButton_(iframeDoc, iframeBody);
      this.addGoogleBar_(iframeDoc, iframeBody);
      return iframeBody;
    });
  }

  addCloseButton_(iframeDoc, iframeBody) {
    const closeButton = createElement(iframeDoc, 'div', {
      'class': 'swg-close-action',
      'role': 'button',
      'aria-label': 'Close',
    });

    iframeBody.appendChild(closeButton);
  }

  addGoogleBar_(iframeDoc, iframeBody) {
    const googleBar = createElement(iframeDoc, 'div', {
      'class': 'swg-google-bar',
    });

    for (let i = 0; i < 4; i++) {
      const swgBar = createElement(iframeDoc, 'div', {
        'class': 'swg-bar',
      });

      googleBar.appendChild(swgBar);
    }

    iframeBody.appendChild(googleBar);
  }
 }
