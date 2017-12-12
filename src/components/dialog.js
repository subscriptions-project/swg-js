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
  setStyles,
  setImportantStyles,
  topFriendlyIframePositionStyles,
} from '../utils/style';
import {FriendlyIframe} from './friendly-iframe';


/**
 * Default iframe important styles.
 * Note: The iframe responsiveness media query style is injected in the
 * publisher's page since style attribute can not include media query.
 * @const {!Object<string, string|number>}
 */
const rootElementImportantStyles = {
  'min-height': '50px',
  'opacity': 1,
  'border': 'none',
  'display': 'block',
  'background-color': 'rgb(255, 255, 255)',
  'font-family': 'Roboto, sans-serif',
  'position': 'fixed',
  'z-index': '2147483647',
  'box-shadow': 'gray 0px 3px, gray 0px 0px 22px',
  'box-sizing': 'border-box',
};

/**
 * Position of the dialog.
 * @const @enum {string}
 */
const PositionAt = {
  BOTTOM: 'BOTTOM',
  TOP: 'TOP',
  FLOAT: 'FLOAT',
  FULL: 'FULL',
};


/**
 * The class for the top level dialog.
 * @final
 */
export class Dialog {

  /**
   * Create a dialog with optionally provided window and override important
   * styles and position styles.
   * @param {!Window} win
   * @param {!Object<string, string|number>=} importantStyles
   * @param {!Object<string, string|number>=} styles
   */
  constructor(win, importantStyles = {}, styles = {}) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Document} */
    this.doc_ = this.win_.document;

    /** @private @const {!FriendlyIframe} */
    this.iframe_ = new FriendlyIframe(this.doc_, {'class': 'swg-dialog'});

    const modifiedImportantStyles =
        Object.assign({}, rootElementImportantStyles, importantStyles);
    setImportantStyles(
        this.iframe_.getElement(), modifiedImportantStyles);

    const modifiedStyles =
        Object.assign({}, topFriendlyIframePositionStyles, styles);
    setStyles(this.iframe_.getElement(), modifiedStyles);

    /** @private {?Element} */
    this.container_ = null;  // Depends on constructed document inside iframe.
  }

  /**
   * Opens the dialog and builds the iframe container.
   * @return {!Promise}
   */
  open() {
    const iframe = this.iframe_;
    if (iframe.isConnected()) {
      throw new Error('already opened');
    }
    this.doc_.body.appendChild(iframe.getElement());  // Fires onload.

    return iframe.whenReady().then(() => this.buildIframe_());
  }

  /**
   * Build the iframe with the styling after iframe is loaded.
   * @private
   * @return {!Dialog}
   */
  buildIframe_() {
    const iframe = this.iframe_;
    const iframeDoc = this.iframe_.getDocument();

    // Inject Google fonts in <HEAD> section of the iframe.
    injectFontsLink(iframe.getDocument(), googleFontsUrl);

    this.container_ =
        createElement(iframeDoc, 'div', {'class': 'swg-container'});
    iframe.getBody().appendChild(this.container_);
    this.setPosition_();
    this.updatePaddingToHtml_();
    return this;
  }

  /**
   * Closes the dialog.
   */
  close() {
    this.doc_.body.removeChild(this.iframe_.getElement());
    this.removePaddingToHtml_();
  }

  /**
   * Gets the container within the dialog.
   * @return {!Element}
   */
  getContainer() {
    if (!this.container_) {
      throw new Error('not opened yet');
    }
    return this.container_;
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
   * Gets the element's height.
   * @return {number}
   * @private
   */
  getHeight_() {
    return this.getElement().offsetHeight;
  }

  /**
   * Sets the position of the dialog. Currently 'BOTTOM' is set by default.
   * @return {string}
   */
  setPosition_() {
    setImportantStyles(this.getElement(), this.getPositionStyle_());
  }

  /**
   * Add the padding to the containing page so as to not hide the content
   * behind the popup, if rendered at the bottom.
   * @private
   */
  updatePaddingToHtml_() {
    if (this.inferPosition_() == PositionAt.BOTTOM) {
      const bottomPadding = this.getHeight_() + 20;  // Add some extra padding.
      const htmlElement = this.doc_.documentElement;

      // TODO(dparikh): Read the existing padding with the unit value
      // (em, ex, %, px, cm, mm, in, pt, pc), and if available then append the
      // padding after converting the units.
      setImportantStyles(htmlElement, {
        'padding-bottom': `${bottomPadding}px`,
      });
    }
  }

  /**
   * Removes previouly added bottom padding from the document.
   * @private`
   */
  removePaddingToHtml_() {
    this.doc_.documentElement.style.removeProperty('padding-bottom');
  }


  /**
   * Calculates the position of the dialog. Currently dialog is positioned at
   * the bottom only. This could change in future to adjust the dialog position
   * based on the screen size.
   * @return {string}
   * @private
   */
  inferPosition_() {
    return PositionAt.BOTTOM;
  }

  /**
   * Returns the styles required to postion the dialog.
   * @return {!Object<string, string|number>}
   * @private
   */
  getPositionStyle_() {
    const dialogPosition = this.inferPosition_();
    switch (dialogPosition) {
      case PositionAt.BOTTOM:
        return {'bottom': 0};
      case PositionAt.TOP:
        return {'top': 0};
      case PositionAt.FLOAT:
        return {
          'position': 'fixed',
          'top': '50%',
          'left': '50%',
          'transform': 'translate(-50%, -50%)',
        };
      case PositionAt.FULL:
        return {
          'position': 'fixed',
          'height': '100%',
          'top': 0,
          'bottom': 0,
        };
      default:
        return {'bottom': 0};
    }
  }
}
