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
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {SmartSubscriptionButtonApi, Theme} from './smart-button-api';
import {createElement} from '../utils/dom';
import {msg} from '../utils/i18n';

/**
 * Properties:
 * - lang: Sets the button SVG and title. Default is "en".
 * - theme: "light" or "dark". Default is "light".
 *
 * @typedef {{
 *   options: (!../api/subscriptions.SmartButtonOptions|!../api/subscriptions.ButtonOptions),
 *   clickFun: !function(!Event=),
 * }} ButtonParams
 */
export let ButtonParams;

/** @enum {string} */
export const ButtonAttributeValues = {
  SUBSCRIPTION: 'subscription',
  CONTRIBUTION: 'contribution',
};

const BUTTON_INNER_HTML = `<img class="swg-button-v2-icon-$theme$"></div>$textContent$`;

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
   * Attaches the Classic 'Subscribe With Google' button.
   * @param {!Element} button
   * @param {../api/subscriptions.ButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {!Element}
   */
  attach(button, optionsOrCallback, callback) {
    const options = this.setupButtonAndGetParams_(
      button,
      AnalyticsEvent.ACTION_SWG_BUTTON_CLICK,
      optionsOrCallback,
      callback
    ).options;

    const theme = options['theme'];
    button.classList.add(`swg-button-${theme}`);
    button.setAttribute('role', 'button');
    if (options['lang']) {
      button.setAttribute('lang', options['lang']);
    }
    button.setAttribute(
      'title',
      msg(SWG_I18N_STRINGS.SUBSCRIPTION_TITLE_LANG_MAP, button) || ''
    );
    this.logSwgEvent_(AnalyticsEvent.IMPRESSION_SWG_BUTTON);

    return button;
  }

  /**
   * Attaches the new subscribe button, for subscription product types.
   * @param {!Element} button
   * @param {../api/subscriptions.ButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {!Element}
   */
  attachSubscribeButton(button, optionsOrCallback, callback) {
    const options = this.setupButtonAndGetParams_(
      button,
      AnalyticsEvent.ACTION_SWG_BUTTON_SHOW_OFFERS_CLICK,
      optionsOrCallback,
      callback
    ).options;

    const theme = options['theme'];
    button.classList.add(`swg-button-v2-${theme}`);
    button.setAttribute('role', 'button');
    if (options['lang']) {
      button.setAttribute('lang', options['lang']);
    }
    button./*OK*/ innerHTML = BUTTON_INNER_HTML.replace(
      '$theme$',
      theme
    ).replace(
      '$textContent$',
      msg(SWG_I18N_STRINGS.SUBSCRIPTION_TITLE_LANG_MAP, button) || ''
    );
    this.logSwgEvent_(AnalyticsEvent.IMPRESSION_SHOW_OFFERS_SWG_BUTTON);

    return button;
  }

  /**
   * Attaches the new contribute button, for contribution product types.
   * @param {!Element} button
   * @param {../api/subscriptions.ButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {!Element}
   */
  attachContributeButton(button, optionsOrCallback, callback) {
    const options = this.setupButtonAndGetParams_(
      button,
      AnalyticsEvent.ACTION_SWG_BUTTON_SHOW_CONTRIBUTIONS_CLICK,
      optionsOrCallback,
      callback
    ).options;

    const theme = options['theme'];
    button.classList.add(`swg-button-v2-${theme}`);
    button.setAttribute('role', 'button');
    if (options['lang']) {
      button.setAttribute('lang', options['lang']);
    }
    button./*OK*/ innerHTML = BUTTON_INNER_HTML.replace(
      '$theme$',
      theme
    ).replace(
      '$textContent$',
      msg(SWG_I18N_STRINGS.CONTRIBUTION_TITLE_LANG_MAP, button) || ''
    );
    this.logSwgEvent_(AnalyticsEvent.IMPRESSION_SHOW_CONTRIBUTIONS_SWG_BUTTON);

    return button;
  }

  /**
   * Attaches all buttons with the specified attribute set to any of the
   * attribute values.
   * @param {string} attribute
   * @param {!Array<string>} attributeValues
   * @param {../api/subscriptions.ButtonOptions} options
   * @param {!Object<string, function()>} attributeValueToCallback
   */
  attachButtonsWithAttribute(
    attribute,
    attributeValues,
    options,
    attributeValueToCallback
  ) {
    attributeValues.forEach((attributeValue) => {
      const elements = this.doc_
        .getRootNode()
        .querySelectorAll(`button[${attribute}="${attributeValue}"]`);
      for (let i = 0; i < elements.length; i++) {
        if (attributeValue === ButtonAttributeValues.SUBSCRIPTION) {
          this.attachSubscribeButton(
            elements[i],
            options,
            attributeValueToCallback[attributeValue]
          );
        } else if (attributeValue === ButtonAttributeValues.CONTRIBUTION) {
          this.attachContributeButton(
            elements[i],
            options,
            attributeValueToCallback[attributeValue]
          );
        }
      }
    });
  }

  /**
   * @param {!AnalyticsEvent} eventType
   * @param {boolean=} isFromUserAction
   */
  logSwgEvent_(eventType, isFromUserAction) {
    this.configuredRuntimePromise_.then((configuredRuntime) => {
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
    const options = /** @type {!../api/subscriptions.ButtonOptions|!../api/subscriptions.SmartButtonOptions} */ (optionsOrCallback &&
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
    return /** @type {function()|function(Event):boolean} */ ((typeof optionsOrCallback ==
    'function'
      ? optionsOrCallback
      : null) || callback);
  }

  /**
   * @param {!Element} button
   * @param {AnalyticsEvent} clickEvent
   * @param {../api/subscriptions.SmartButtonOptions|function()|../api/subscriptions.ButtonOptions} optionsOrCallback
   * @param {function()=} callbackFun
   * @return {ButtonParams}
   */
  setupButtonAndGetParams_(button, clickEvent, optionsOrCallback, callbackFun) {
    const options = this.getOptions_(optionsOrCallback);
    const callback = this.getCallback_(optionsOrCallback, callbackFun);
    const clickFun = (event) => {
      this.logSwgEvent_(clickEvent, true);
      if (typeof callback === 'function') {
        callback(event);
      }
    };
    button.addEventListener('click', clickFun);
    return {options, clickFun};
  }

  /**
   * @param {!./deps.DepsDef} deps
   * @param {!Element} button
   * @param {../api/subscriptions.SmartButtonOptions|function()} optionsOrCallback
   * @param {function()=} callback
   * @return {!Element}
   */
  attachSmartButton(deps, button, optionsOrCallback, callback) {
    const params = this.setupButtonAndGetParams_(
      button,
      AnalyticsEvent.ACTION_SWG_BUTTON_CLICK,
      optionsOrCallback,
      callback
    );
    // Add required CSS class, if missing.
    button.classList.add('swg-smart-button');
    return new SmartSubscriptionButtonApi(
      deps,
      button,
      params.options,
      params.clickFun
    ).start();
  }
}
