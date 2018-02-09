/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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
import {FriendlyIframe} from '../components/friendly-iframe';
import {
  googleFontsUrl,
  setStyles,
  setImportantStyles,
  topFriendlyIframePositionStyles,
} from '../utils/style';
import {CSS as TOAST_CSS} from '../../build/css/ui/toast.css';

/** @const {!Object<string, string|number>} */
export const toastImportantStyles = {
  'height': '60px',
  'position': 'fixed',
  'bottom': 0,
  'color': 'rgb(255, 255, 255)',
  'font-size': '15px',
  'padding': '20px 8px 0',
  'z-index': '2147483647',
  'border': 'none',
  'box-shadow': 'gray 3px 3px, rgb(0, 0, 0) 0 0 1.4em',
  'background-color': 'rgb(51, 51, 51)',
  'box-sizing': 'border-box',
  'font-family': 'Google sans, sans-serif',
  'animation': 'swg-notify 1s ease-out normal backwards, '
      + 'swg-notify-hide 1s ease-out 7s normal forwards',
};

/** @typedef {{
 *    text: string,
 *    action: ({label: string, handler: function()}|undefined)
 *  }}
 */
export let ToastSpecDef;


/**
 * The class Notification toast.
 */
export class Toast {

  /**
   * @param {!Window} win
   * @param {!ToastSpecDef} spec
   */
  constructor(win, spec) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!HTMLDocument} */
    this.doc_ = win.document;

    /** @private @const {!ToastSpecDef} */
    this.spec_ = spec;

    /** @private @const {!FriendlyIframe} */
    this.iframe_ = new FriendlyIframe(this.doc_, {'class': 'swg-toast'});

    /** @private {?Element} */
    this.container_ = null;

    setImportantStyles(this.iframe_.getElement(), toastImportantStyles);
    setStyles(this.iframe_.getElement(), topFriendlyIframePositionStyles);
  }

  /**
   * Gets the attached iframe instance.
   * @return {!FriendlyIframe}
   */
  getIframe() {
    return this.iframe_;
  }

  /**
   * Gets the Iframe element.
   * @return {!HTMLIFrameElement}
   */
  getElement() {
    return this.iframe_.getElement();
  }

  /**
   * Opens the notification toast.
   * @return {!Promise}
   */
  open() {
    const iframe = this.iframe_;
    if (iframe.isConnected()) {
      throw new Error('Already opened');
    }
    this.doc_.body.appendChild(iframe.getElement());  // Fires onload.

    return iframe.whenReady().then(() => this.buildIframe_());
  }

  /**
   * Closes the toast.
   */
  close() {
    this.doc_.body.removeChild(this.iframe_.getElement());
  }

  /**
   * Builds the iframe with content and the styling after iframe is loaded.
   * @private
   * @return {!Toast}
   */
  buildIframe_() {
    const iframe = this.iframe_;
    const iframeDoc = iframe.getDocument();
    const iframeBody = iframe.getBody();

    // Inject Google fonts in <HEAD> section of the iframe.
    injectFontsLink(iframeDoc, googleFontsUrl);
    injectStyleSheet(iframeDoc, TOAST_CSS);

    this.addItems_(iframeDoc, iframeBody);

    return this;
  }

  /**
   * Adds label and detail button.
   * @param {!Document} iframeDoc
   * @param {?Element} iframeBody
   * @private
   */
  addItems_(iframeDoc, iframeBody) {
    const childElements = [];

    const label = createElement(iframeDoc, 'div', {
      'class': 'swg-label',
    }, this.spec_.text);
    childElements.push(label);

    if (this.spec_.action && this.spec_.action.label) {
      const linkButton = createElement(iframeDoc, 'button', {
        'class': 'swg-detail',
        'aria-label': 'Details',
      }, this.spec_.action.label);
      linkButton.addEventListener('click', this.spec_.action.handler);
      childElements.push(linkButton);
    }

    // Create container element and add 'label' and/or 'linkButton' to it.
    this.container_ = createElement(iframeDoc, 'div', {
      'class': 'swg-toast-container',
    }, childElements);

    iframeBody.appendChild(this.container_);
  }
}
