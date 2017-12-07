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

import {createElement} from '../utils/dom';


 /**
  * The class for google branding bar.
  */
export class GoogleBar {

    /**
     * @param {!Window} win
     */
  constructor(win) {

      /** @private @const {!Window} */
    this.win_ = win;

      /** @private @const {!HTMLDocument} */
    this.doc_ = win.document;

    /** @private {!Element} */
    this.gBar_ = createElement(this.doc_, 'div', {
      'class': 'swg-google-bar',
    }, this.buildChildren_());
  }

  /**
   * Builds the child elements.
   * @private
   * @return {!Array<!Node>}
   */
  buildChildren_() {
    const items = [];
    for (let i = 0; i < 4; i++) {
      const swgBar = createElement(this.doc_, 'div', {
        'class': 'swg-bar',
      });
      items.push(swgBar);
    }
    return items;
  }

  /**
   * Gets the Google bar container element.
   * @return {!Element}
   */
  getElement() {
    return this.gBar_;
  }
}
