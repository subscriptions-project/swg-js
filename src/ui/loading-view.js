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

/**
 * Display configration options for the loading view.
 *
 * Properties:
 * - additionalClasses: List of CSS classes to apply to the loading container.
 *
 * @typedef {{
 *   additionalClasses: (!Array<string>|undefined),
 * }}
 */
export let LoadingViewConfig;

/**
 * Loading indicator class. Builds the loading indicator view to be injected in
 * parent element <iframe class="swg-dialog"> element. Provides methods to
 * show/hide loading indicator.
 */
export class LoadingView {
  /**
   * @param {!Document} doc
   * @param {!LoadingViewConfig=} config
   */
  constructor(doc, config = {}) {
    /** @private @const {!Document} */
    this.doc_ = doc;

    /** @private @const {!Element} */
    this.loadingContainer_ = createElement(
      this.doc_,
      'swg-loading-container',
      {}
    );
    if (config.additionalClasses) {
      config.additionalClasses.forEach((additionalClass) => {
        this.loadingContainer_.classList.add(additionalClass);
      });
    }

    /** @private @const {!Element} */
    this.loading_ = createElement(this.doc_, 'swg-loading', {});
    this.loadingContainer_.appendChild(this.loading_);

    this.loadingContainer_.style.setProperty('display', 'none', 'important');

    // Build the animated loading indicator.
    this.buildLoadingIndicator_();
  }

  /**
   * Gets the populated loading container.
   * @return {!Element}
   */
  getElement() {
    return this.loadingContainer_;
  }

  /**
   * Shows the loading indicator within the container element.
   */
  show() {
    this.loadingContainer_.style.removeProperty('display');
  }

  /**
   * Hides the loading indicator within the container element.
   */
  hide() {
    this.loadingContainer_.style.setProperty('display', 'none', 'important');
  }

  /**
   * Populates the loading indivicator. The populated element
   * can be added in any view, when required.
   * @private
   */
  buildLoadingIndicator_() {
    const loadingContainer = this.loading_;

    const loadingIndicatorTopContainer = createElement(
      this.doc_,
      'swg-loading-animate',
      {}
    );
    loadingContainer.appendChild(loadingIndicatorTopContainer);

    const loadingIndicatorChildContainer = createElement(
      this.doc_,
      'swg-loading-image',
      {}
    );
    loadingIndicatorTopContainer.appendChild(loadingIndicatorChildContainer);
  }
}
