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


/**
 * The loading element name to be used.
 * @const {string}
 */
const LOADING_TAG = 'swg-loading';


/**
 * Loading indicator class. Builds the loading indicator icon for the
 * <swg-popup> element. Provides methods to show/hide loading indicator based
 * on the state of the <swg-popup> element.
 */
export class LoadingView {

  constructor(win, container) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!Element} */
    this.container_ = container;

    /** @private @const {Element} */
    this.loadingContainer_ = this.document_.createElement(LOADING_TAG);
    this.loadingContainer_.style.setProperty('display', 'none', 'important');

    // Build the animated loading indicator.
    this.buildLoadingIndicator_();
  }

  /*
   * Shows the loading indicator only when there is no other container element
   * within the <swg-popup> element.
   * TODO(dparikh): Check the container state.
   */
  show() {
    this.loadingContainer_.style.removeProperty('display');
  }

  /*
   * Hides the loading indicator when there is other container element within
   * the <swg-popup> element.
   */
  hide() {
    this.loadingContainer_.style.setProperty('display', 'none', 'important');
  }

  /*
   * Builds the loading indicator <swg-loading> element in the Dom.
   */
  buildLoadingIndicator_() {
    const loadingContainer = this.loadingContainer_;
    this.container_.appendChild(loadingContainer);

    // Add 4 vertical bars animated at different rates, as defined in the
    // style.
    for (let i = 0; i < 4; i++) {
      const loadingBar = this.document_.createElement('swg-loading-bar');
      loadingContainer.appendChild(loadingBar);
    }
  }
}
