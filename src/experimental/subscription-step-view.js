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
 * Subscription step view base class. Renders the content in the parent <swg-popup>
 * element. Hides the loading indicator once rendered.
 */
export class SubscriptionStepView {

  /**
   * @param {!Window} win The parent window object.
   * @param {!Element} context The Subscription container reference.
   * @param {!Element} offerContainer The offer container element <swg-popup>.
   */
  constructor(win, context, offerContainer) {

     /** @private @const {!Window} */
    this.win_ = win;

    /** @const @private {!PopupContext} */
    this.context_ = context;

     /** @private @const {!Element} */
    this.document_ = win.document;

     /** @private @const {!Element} */
    this.offerContainer_ = offerContainer;

    /** @private @const {!Element} */
    this.viewElement_ = this.document_.createElement('iframe');

    /** @private @const {function()} */
    this.ref_ = this.boundResizeListener_.bind(this);
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.viewElement_;
  }

  /**
   * Initializes the view element in the <swg-popup>.
   * @return {!Promise}
   */
  init() {
    return this.buildView_().then(() => this.show());
  }

  /*
   * Shows the view element within the <swg-popup> element.
   */
  show() {
    this.viewElement_.style.removeProperty('display');
  }

  /*
   * Hides the view element within the <swg-popup> element.
   */
  hide() {
    this.viewElement_.style
        .setProperty('display', 'none', 'important');
  }

  /*
   * Builds the  view element within the <swg-popup> element.
   * @param {string} Source doc for iframe.
   * @return {!Promise}
   * @private
   */
  buildView_(sourceDoc) {
    const iframe = this.viewElement_;
    iframe.srcdoc = sourceDoc;
    iframe.setAttribute('frameborder', 0);
    iframe.setAttribute('scrolling', 'no');

    // It's important to add `onload` callback before appending to DOM, otherwise
    // onload could arrive immediately.
    const readyPromise = new Promise(resolve => {
      iframe.onload = resolve;
    });
    this.offerContainer_.appendChild(iframe);

    return readyPromise.then(() => {
      setImportantStyles(iframe, {
        'opacity': 1,
        'border': 'none',
        'width': '100%',
        'background-color': '#fff',
      });

      iframe.contentWindow.addEventListener('resize', this.ref_);
    });
  }

  /**
   * Listens for the iframe content resize to notify the parent container.
   * The event listener is removed after reading the correct height.
   * @param {!Event} event
   * @private
   */
  boundResizeListener_(event) {
    const iframe = this.viewElement_;
    const height = iframe.contentDocument.body.scrollHeight;
    this.context_.resizeView(this, height);
    event.currentTarget.removeEventListener(event.type, this.ref_);
  }
 }
