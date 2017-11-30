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
} from '../utils/dom';
import {
  friendlyIframeAttributes,
  topFriendlyIframeStyles,
  topFriendlyIframeImportantStyles,
} from '../utils/style';
import {FriendlyIframe} from './friendly-iframe';


/**
 * The class for the top level dialog.
 */
export class Dialog {

  /**
   * @param {!Document} doc
   */
  constructor(doc) {
    /** @private @const {!Document} */
    this.doc_ = doc;

    const mergedAttrs = Object.assign(
        {}, friendlyIframeAttributes, {'class': 'swg-dialog'});

    /** @private @const {!FriendlyIframe} */
    this.iframe_ =
        new FriendlyIframe(doc, mergedAttrs);
    // Resets and set all important styles to default values.
    this.iframe_.setImportantStyles(topFriendlyIframeImportantStyles);
    this.iframe_.setStyles(topFriendlyIframeStyles);

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
    iframe.injectFontsLink();

    this.container_ =
        createElement(iframeDoc, 'div', {'class': 'swg-container'});
    iframe.getBody().appendChild(this.container_);
    return this;
  }

  /**
  * Closes the dialog.
  */
  close() {
    this.doc_.body.removeChild(this.iframe_.getElement());
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
}
