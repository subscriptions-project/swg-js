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
import {msg} from '../utils/i18n';

/** @type {!Object<string, string>} */
const TITLE_LANG_MAP = {
  'en': 'Subscribe with Google',
  'ar': 'الاشتراك عبر Google',
  'de': 'Abonnieren mit Google',
  'es': 'Suscríbete con Google',
  'es-latam': 'Suscribirse con Google',
  'es-latn': 'Suscribirse con Google',
  'fr': 'S\'abonner avec Google',
  'hi': 'Google की सदस्यता लें',
  'id': 'Berlangganan dengan Google',
  'it': 'Abbonati con Google',
  'jp': 'Google で購読',
  'ko': 'Google 을(를) 통해 구독',
  'ms': 'Langgan dengan Google',
  'nl': 'Abonneren met Google',
  'no': 'Abonner med Google',
  'pl': 'Subskrybuj z Google',
  'pt': 'Subscrever com o Google',
  'pt-br': 'Faça sua assinatura com Google',
  'ru': 'Подпишитесь через Google',
  'se': 'Prenumerera med Google',
  'th': 'สมัครรับข้อมูลด้วย Google',
  'tr': 'Google ile abone olun',
  'uk': 'Підписатися через Google',
  'zh-tw': '透過 Google 訂閱',
};


/**
 * The button stylesheet can be found in the `/assets/swg-button.css`.
 * It's produced by the `gulp assets` task and deployed to
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

    const url = '$assets$/swg-button.css';
    const existing = head.querySelector(`link[href="${url}"]`);
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
    const button = createElement(this.doc_.getWin().document, 'button', {});
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
    const callback = /** @type {function()} */ (
        (typeof optionsOrCallback == 'function' ? optionsOrCallback : null) ||
            opt_callback);
    let theme = options && options['theme'];
    if (theme !== 'light' && theme !== 'dark') {
      theme = 'light';
    }
    button.classList.add(`swg-button-${theme}`);
    button.setAttribute('role', 'button');
    if (options && options['lang']) {
      button.setAttribute('lang', options['lang']);
    }
    button.setAttribute('title', msg(TITLE_LANG_MAP, button) || '');
    button.addEventListener('click', callback);
    return button;
  }
}
