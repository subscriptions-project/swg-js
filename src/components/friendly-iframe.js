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
} from '../utils/dom';
import {
  googleFontsUrl,
  resetAllStyles,
  setStyles,
  setImportantStyles,
} from '../utils/style';


/**
 * The class for building friendly iframe.
 */
export class FriendlyIframe {

  /**
   * @param {!Document} doc
   * @param {!Object<string, string|number} attrs
   */
  constructor(doc, attrs) {

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ = createElement(doc, 'iframe', attrs);

    /** @private @const {!Promise} */
    this.ready_ = new Promise(resolve => {
      this.iframe_.onload = resolve;
    });
  }

  /**
   * When promise is resolved.
   * @return {!Promise}
   */
  whenReady() {
    return this.ready_;
  }

  /**
   * Gets the iframe element.
   * @return {!!HTMLIFrameElement}
   */
  getElement() {
    return this.iframe_;
  }

  /**
   * Gets the document object of the iframe element.
   * @return {!Document}
   */
  getDocument() {
    const doc = this.getElement().contentDocument ||
        this.getElement().contentWindow.document;

    if (!doc) {
      throw new Error('not loaded');
    }
    return doc;
  }

  /**
   * Gets the body of the iframe.
   * @return {!Element}
   */
  getBody() {
    return this.getDocument().body;
  }

  /**
   * Whether the iframe is connected.
   * @return {boolean}
   */
  isConnected() {
    if (!this.getElement().ownerDocument) {
      return false;
    }
    return this.getElement().ownerDocument.contains(this.iframe_);
  }

  /**
   * Injects the google fonts in the HEAD section of the iframe document.
   */
  injectFontsLink() {
    injectFontsLink(this.getDocument(), googleFontsUrl);
  }

  /**
   * Resets all the styles and sets the provided styles.
   * @param {!Object<string, string|number}
   */
  setImportantStyles(styles) {
    resetAllStyles(this.getElement());
    setImportantStyles(this.getElement(), styles);
  }

  /**
   * Sets provided styles (not !important) to an element, so that media query
   * can change the these styles on resize events.
   * @param {!Object<string, string|number} styles
   */
  setStyles(styles) {
    setStyles(this.getElement(), styles);
  }
}
