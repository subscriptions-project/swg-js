/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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

/**
 * Builds the error view to be injected in parent element
 * <iframe class="swg-dialog"> element. Provides methods to show/hide the view.
 */
export class ErrorView {
  /**
   * @param {!Document} doc
   * @param {function()} onRetryCallback
   */
  constructor(doc, onRetryCallback) {
    /** @private @const {!Document} */
    this.doc_ = doc;

    /** @private {function()} */
    this.onRetry_ = onRetryCallback;

    /** @private @const {!Element} */
    this.errorContainer_ = createElement(this.doc_, 'swg-error-container', {});

    /** @private @const {!Element} */
    this.errorMsg_ = createElement(
      this.doc_,
      'swg-error-msg',
      {},
      'Something went wrong.'
    );
    this.errorContainer_.appendChild(this.errorMsg_);

    /** @private @const {!Element} */
    this.retryButton_ = createElement(
      this.doc_,
      'swg-error-retry-button',
      {},
      'Try again'
    );
    this.retryButton_.addEventListener('click', () => {
      if (typeof this.onRetry_ === 'function') {
        this.onRetry_();
      }
    });
    this.errorContainer_.appendChild(this.retryButton_);

    this.errorContainer_.style.setProperty('display', 'none', 'important');
  }

  /**
   * Gets the populated error view container.
   * @return {!Element}
   */
  getElement() {
    return this.errorContainer_;
  }

  /**
   * Shows the error view within the container element.
   */
  show() {
    this.errorContainer_.style.removeProperty('display');
  }

  /**
   * Hides the error view within the container element.
   */
  hide() {
    this.errorContainer_.style.setProperty('display', 'none', 'important');
  }
}
