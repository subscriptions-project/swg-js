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


/**
 * Loading indicator class. Builds the loading indicator icon for the
 * <swg-popup> element. Provides methods to show/hide loading indicator based
 * on the state of the <swg-popup> element.
 */
export class LoadingUi {

  constructor(win, doc, offerContainer) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = doc;

    /** @private @const {!Element} */
    this.offerContainer_ = offerContainer;

    /** @private @const {Element} */
    this.loadingContainer_ = this.document_.createElement('div');
  }

  /*
   * Initializes the element and checks the container state.
   * TODO(dparikh): Add container state check.
   */
  init() {
    // Build the animated loading indicator.
    this.buildLoadingIndicator_();
    this.show();
  }

  /*
   * Shows the loading indicator only when there is no other container element
   * within the <swg-popup> element.
   * TODO(dparikh): Check the container state.
   */
  show() {
    this.loadingContainer_.style
        .setProperty('display', 'inline-block', 'important');
  }

  /*
   * Hides the loading indicator when there is other container element within
   * the <swg-popup> element.
   */
  hide() {
    this.loadingContainer_.style.setProperty('display', 'none', 'important');
  }

  /*
   * Builds the loading indicator in the Dom.
   */
  buildLoadingIndicator_() {
    const loadingContainer = this.loadingContainer_;
    loadingContainer.classList.add('swg-loading');
    loadingContainer.setAttribute('id', 'swg-loading');
    const containerStyle = loadingContainer.style;
    containerStyle.setProperty('position', 'absolute', 'important');
    containerStyle.setProperty('display', 'none', 'important');
    containerStyle.setProperty('top', 'calc(50% - 16px)', 'important');
    containerStyle.setProperty('left', '50%', 'important');
    containerStyle.setProperty('z-index', '1000', 'important');
    this.offerContainer_.appendChild(loadingContainer);

    const gColors = ['#4285F4', '#0F9D58', '#F4B400', '#DB4437'];
    const animDelay = ['0', '0.09s', '.18s', '.27s'];
    for (let i = 0; i < 4; i++) {
      const loadingBar = this.document_.createElement('div');
      loadingBar.classList.add('loading-bar');
      const barStyle = loadingBar.style;
      barStyle.setProperty('display', 'inline-block', 'important');
      barStyle.setProperty('width', '5px', 'important');
      barStyle.setProperty('height', '20px', 'important');
      barStyle.setProperty('border-radius', '5px', 'important');
      barStyle.setProperty('margin-right', '4px', 'important');
      barStyle.setProperty('pointer-events', 'none', 'important');
      barStyle.setProperty(
          'animation', 'loading 1s ease-in-out infinite', 'important');

      barStyle.setProperty('background-color', gColors[i], 'important');
      barStyle.setProperty('animation-delay', animDelay[i], 'important');
      loadingContainer.appendChild(loadingBar);
    }
  }
}
