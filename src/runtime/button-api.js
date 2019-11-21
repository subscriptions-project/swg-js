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

import {AnalyticsEvent} from '../proto/api_messages';
import {createElement} from '../utils/dom';
import {msg} from '../utils/i18n';
import {SmartSubscriptionButtonApi, Theme} from './smart-button-api';

/**
 * The button title should match that of button's SVG.
 */
/** @type {!Object<string, string>} */
const TITLE_LANG_MAP = {
  'en': 'Subscribe with Google',
  'ar': 'Google اشترك مع',
  'de': 'Abonnieren mit Google',
  'es': 'Suscríbete con Google',
  'es-latam': 'Suscríbete con Google',
  'es-latn': 'Suscríbete con Google',
  'fr': "S'abonner avec Google",
  'hi': 'Google के ज़रिये सदस्यता',
  'id': 'Berlangganan dengan Google',
  'it': 'Abbonati con Google',
  'jp': 'Google で購読',
  'ko': 'Google 을 통한구독',
  'ms': 'Langgan dengan Google',
  'nl': 'Abonneren via Google',
  'no': 'Abonner med Google',
  'pl': 'Subskrybuj z Google',
  'pt': 'Subscrever com o Google',
  'pt-br': 'Assine com o Google',
  'ru': 'Подпиcka через Google',
  'se': 'Prenumerera med Google',
  'th': 'สมัครฟาน Google',
  'tr': 'Google ile Abone Ol',
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
   * @param {!Promise<!./runtime.ConfiguredRuntime>} configuredRuntimePromise
   */
  constructor(doc, configuredRuntimePromise) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = doc;

    /** @private @const {!Promise<!./runtime.ConfiguredRuntime>} */
    this.configuredRuntimePromise_ = configuredRuntimePromise;
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
    head.appendChild(
      createElement(this.doc_.getWin().document, 'link', {
        'rel': 'stylesheet',
        'type': 'text/css',
        'href': url,
      })
    );
  }

  /**
   * @param {!../api/subscriptions.ButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {!Element}
   */
  create(optionsOrCallback, callback) {
    const button = createElement(this.doc_.getWin().document, 'button', {});
    return this.attach(button, optionsOrCallback, callback);
  }

  /**
   * @param {!Element} button
   * @param {../api/subscriptions.ButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {!Element}
   */
  attach(button, optionsOrCallback, callback) {
    const options = this.setupButtonAndGetOptions_(
      button,
      optionsOrCallback,
      callback
    );

    const theme = options['theme'];
    button.classList.add(`swg-button-${theme}`);
    button.setAttribute('role', 'button');
    if (options['lang']) {
      button.setAttribute('lang', options['lang']);
    }
    button.setAttribute('title', msg(TITLE_LANG_MAP, button) || '');
    this.logSwgEvent_(AnalyticsEvent.IMPRESSION_SWG_BUTTON);

    return button;
  }

  /**
   * @param {!AnalyticsEvent} eventType
   * @param {boolean} isFromUserAction
   */
  logSwgEvent_(eventType, isFromUserAction) {
    this.configuredRuntimePromise_.then(configuredRuntime => {
      configuredRuntime.eventManager().logSwgEvent(eventType, isFromUserAction);
    });
  }

  /**
   *
   * @param {../api/subscriptions.ButtonOptions|../api/subscriptions.SmartButtonOptions|function()} optionsOrCallback
   * @return {!../api/subscriptions.ButtonOptions|!../api/subscriptions.SmartButtonOptions}
   * @private
   */
  getOptions_(optionsOrCallback) {
    const options =
      /** @type {!../api/subscriptions.ButtonOptions|!../api/subscriptions.SmartButtonOptions} */ (optionsOrCallback &&
      typeof optionsOrCallback != 'function'
        ? optionsOrCallback
        : {'theme': Theme.LIGHT});

    const theme = options['theme'];
    if (theme !== Theme.LIGHT && theme !== Theme.DARK) {
      options['theme'] = Theme.LIGHT;
    }
    return options;
  }

  /**
   *
   * @param {?../api/subscriptions.ButtonOptions|?../api/subscriptions.SmartButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {function()|function(Event):boolean}
   * @private
   */
  getCallback_(optionsOrCallback, callback) {
    return (
      /** @type {function()|function(Event):boolean} */ ((typeof optionsOrCallback ==
      'function'
        ? optionsOrCallback
        : null) || callback)
    );
  }

  /**
   * @param {!Element} button
   * @param {../api/subscriptions.SmartButtonOptions|function()|../api/subscriptions.ButtonOptions} optionsOrCallback
   * @param {function()=} callbackFun
   * @return {!../api/subscriptions.SmartButtonOptions|function()|../api/subscriptions.ButtonOptions}
   */
  setupButtonAndGetOptions_(button, optionsOrCallback, callbackFun) {
    const options = this.getOptions_(optionsOrCallback);
    const callback = this.getCallback_(optionsOrCallback, callbackFun);
    button.addEventListener('click', event => {
      this.logSwgEvent_(AnalyticsEvent.ACTION_SWG_BUTTON_CLICK, true);
      if (typeof callback === 'function') {
        callback(event);
      }
    });
    return options;
  }

  /**
   * @param {!./deps.DepsDef} deps
   * @param {!Element} button
   * @param {../api/subscriptions.SmartButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {!Element}
   */
  attachSmartButton(deps, button, optionsOrCallback, callback) {
    const options = this.setupButtonAndGetOptions_(
      button,
      optionsOrCallback,
      callback
    );
    // Add required CSS class, if missing.
    button.classList.add('swg-smart-button');
    return new SmartSubscriptionButtonApi(
      deps,
      button,
      options,
      function() {}
    ).start();
  }
}
