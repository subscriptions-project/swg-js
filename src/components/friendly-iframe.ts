/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

import {createElement} from '../utils/dom';
import {resetAllStyles} from '../utils/style';

const friendlyIframeAttributes = {
  'frameborder': '0',
  'scrolling': 'no',
  'src': 'about:blank',
};

/**
 * The class for building friendly iframe.
 */
export class FriendlyIframe {
  private iframe_: HTMLIFrameElement;
  private ready_: Promise<void>;

  constructor(doc: Document, attrs: {[s: string]: string}) {
    const mergedAttrs = Object.assign({}, friendlyIframeAttributes, attrs);

    this.iframe_ = createElement(doc, 'iframe', mergedAttrs);

    // Ensure that the new iframe does not inherit any CSS styles.
    resetAllStyles(this.iframe_);

    this.ready_ = new Promise((resolve) => {
      this.iframe_.onload = () => void resolve();
    });
  }

  /**
   * When promise is resolved.
   */
  whenReady(): Promise<void> {
    return this.ready_;
  }

  /**
   * Gets the iframe element.
   */
  getElement(): HTMLIFrameElement {
    return this.iframe_;
  }

  /**
   * Gets the document object of the iframe element.
   */
  getDocument(): Document {
    const doc =
      this.getElement().contentDocument ||
      this.getElement().contentWindow?.document;

    if (!doc) {
      throw new Error('not loaded');
    }
    return doc;
  }

  /**
   * Gets the body of the iframe.
   */
  getBody(): Element {
    return this.getDocument().body;
  }

  /**
   * Whether the iframe is connected.
   */
  isConnected(): boolean {
    return this.getElement().isConnected;
  }
}
