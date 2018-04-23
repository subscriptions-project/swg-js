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
 * The button stylesheet can be found in the `/assets/swg-button.css`.
 * It's produced by the `assets:swg-button` gulp task and deployed to
 * `https://news.google.com/swg/js/v1/swg-button.css`.
 */
export class ButtonApi {

  /**
   * @param {!../model/doc.Doc} doc
   */
  constructor(doc) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = doc;
  }

  /**
   */
  init() {
    const head = this.doc_.getHead();
    if (!head) {
      return;
    }

    const url = 'https://news.google.com/swg/js/v1/swg-button.css';
    const existing = head.querySelector(`link[href="${url}"]`)
    if (existing) {
      return;
    }

    // <link rel="stylesheet" href="..." type="text/css">
    head.appendChild(createElement(this.doc_.getWin().document, 'link', {
      'rel': 'stylesheet',
      'type': 'text/css',
      'href': url,
    }));
  }

  /**
   * @param {!Object|function()} optionsOrCallback
   * @param {function()=} opt_callback
   * @return {!Element}
   */
  create(optionsOrCallback, opt_callback) {
    const button = createElement(this.doc_.getWin().document, 'button');
    return this.attach(button, optionsOrCallback, opt_callback);
  }

  /**
   * @param {!Element} button
   * @param {!Object|function()} optionsOrCallback
   * @param {function()=} opt_callback
   * @return {!Element}
   */
  attach(button, optionsOrCallback, opt_callback) {
    const options =
        typeof optionsOrCallback != 'function' ?
        optionsOrCallback : null;
    const callback = (typeof optionsOrCallback == 'function' ?
        optionsOrCallback : null) || opt_callback;
    let theme = options && options['theme'];
    if (theme !== 'light' && theme !== 'dark') {
      theme = 'light';
    }
    button.classList.add(`swg-button-${theme}`);
    button.setAttribute('role', 'button');
    // TODO(dvoytenko): i18n.
    button.setAttribute('title', 'Subscribe with Google');
    button.addEventListener('click', callback);
    return button;
  }
}
