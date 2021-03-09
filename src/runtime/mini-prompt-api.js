/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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
import {AutoPromptType} from '../api/basic-subscriptions';
import {assert} from '../utils/log';
import {createElement} from '../utils/dom';
import {msg} from '../utils/i18n';
import {setStyle} from '../utils/style';

/** @type {!Object<string, string>} */
const SUBSCRIPTION_TITLE_LANG_MAP = {
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

// TODO(stellachui): Add translated contribution strings here or from strings.js
//   when we get them.
/** @type {!Object<string, string>} */
const CONTRIBUTION_TITLE_LANG_MAP = {
  'en': 'Contribute with Google',
};

const TITLE_CONTAINER_DIV_HTML = `
<div class="swg-mini-prompt-icon-$theme$"></div>
<h1 class="swg-mini-prompt-title-text-$theme$">$textContent$</h1>
`;

const CLOSE_CONTAINER_DIV_HTML = `
<div class="swg-mini-prompt-close-icon-$theme$"></div>
`;

/**
 * Class for handling the display (and logging) of the mini prompt.
 */
export class MiniPromptApi {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = deps.doc();

    /** @private @const {?./client-config-manager.ClientConfigManager} */
    this.clientConfigManager_ = deps.clientConfigManager();
    assert(
      this.clientConfigManager_,
      'MiniPromptApi requires an instance of ClientConfigManager.'
    );

    /** @private @const {!./client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();
  }

  /**
   * Does the setup required for the mini prompt's display, including injecting
   * the mini prompt's css.
   */
  init() {
    const head = this.doc_.getHead();
    if (!head) {
      return;
    }

    const url = '$assets$/swg-mini-prompt.css';
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
   * Creates the element and displays it on the page.
   * @param {{
   *   autoPromptType: (!AutoPromptType),
   *   callback: (function()|undefined),
   * }} options
   */
  create(options) {
    if (
      options.autoPromptType !== AutoPromptType.CONTRIBUTION &&
      options.autoPromptType !== AutoPromptType.SUBSCRIPTION
    ) {
      return;
    }

    const theme = this.clientConfigManager_.getTheme();
    const lang = this.clientConfigManager_.getLanguage();
    let textContent = '';
    if (options.autoPromptType === AutoPromptType.CONTRIBUTION) {
      textContent = msg(CONTRIBUTION_TITLE_LANG_MAP, lang) || '';
    } else if (options.autoPromptType === AutoPromptType.SUBSCRIPTION) {
      textContent = msg(SUBSCRIPTION_TITLE_LANG_MAP, lang) || '';
    }

    // Create all the elements for the mini prompt.
    /** @const {!Element} */
    const miniPromptDiv = createElement(this.doc_.getWin().document, 'div', {
      'role': 'dialog',
      'lang': lang,
    });
    miniPromptDiv.classList.add(`swg-mini-prompt-${theme}`);
    const titleContainerDiv = createElement(
      this.doc_.getWin().document,
      'div',
      {'role': 'button'}
    );
    titleContainerDiv.classList.add('swg-mini-prompt-title-container');
    titleContainerDiv./*OK*/ innerHTML = TITLE_CONTAINER_DIV_HTML.replace(
      /\$theme\$/g,
      theme
    ).replace('$textContent$', textContent);
    const closeContainerDiv = createElement(
      this.doc_.getWin().document,
      'div',
      {}
    );
    closeContainerDiv.classList.add('swg-mini-prompt-close-button-container');
    closeContainerDiv./*OK*/ innerHTML = CLOSE_CONTAINER_DIV_HTML.replace(
      '$theme$',
      theme
    );
    miniPromptDiv.appendChild(titleContainerDiv);
    miniPromptDiv.appendChild(closeContainerDiv);
    this.doc_.getWin().document.body.appendChild(miniPromptDiv);

    // Handle events and logging for the various sub-components.
    const clickFun = () => {
      this.logClick_(options.autoPromptType);
      if (typeof options.callback === 'function') {
        options.callback();
      }
      setStyle(miniPromptDiv, 'visibility', 'hidden');
    };
    titleContainerDiv.addEventListener('click', clickFun);

    const closeFun = () => {
      setStyle(miniPromptDiv, 'visibility', 'hidden');
      this.logClose_(options.autoPromptType);
    };
    closeContainerDiv.addEventListener('click', closeFun);

    this.logImpression_(options.autoPromptType);
  }

  /**
   * Logs an impression of the mini prompt.
   * @param {!AutoPromptType} autoPromptType
   */
  logImpression_(autoPromptType) {
    let event;
    if (autoPromptType === AutoPromptType.CONTRIBUTION) {
      event = AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT;
    } else if (autoPromptType === AutoPromptType.SUBSCRIPTION) {
      event = AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT;
    }

    if (event) {
      this.eventManager_.logSwgEvent(event, false);
    }
  }

  /**
   * Logs a click of the mini prompt.
   * @param {!AutoPromptType} autoPromptType
   */
  logClick_(autoPromptType) {
    let event;
    if (autoPromptType === AutoPromptType.CONTRIBUTION) {
      event = AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLICK;
    } else if (autoPromptType === AutoPromptType.SUBSCRIPTION) {
      event = AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK;
    }

    if (event) {
      this.eventManager_.logSwgEvent(event, true);
    }
  }

  /**
   * Logs a user initiated dismissal of the mini prompt.
   * @param {!AutoPromptType} autoPromptType
   */
  logClose_(autoPromptType) {
    let event;
    if (autoPromptType === AutoPromptType.CONTRIBUTION) {
      event = AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE;
    } else if (autoPromptType === AutoPromptType.SUBSCRIPTION) {
      event = AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE;
    }

    if (event) {
      this.eventManager_.logSwgEvent(event, true);
    }
  }
}
