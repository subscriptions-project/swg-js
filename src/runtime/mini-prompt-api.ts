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

import {ASSETS} from '../constants';
import {AnalyticsEvent} from '../proto/api_messages';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {assert, warn} from '../utils/log';
import {createElement} from '../utils/dom';
import {msg} from '../utils/i18n';
import {setStyle} from '../utils/style';

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
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly doc_: Doc;
  private readonly eventManager_: ClientEventManager;

  constructor(deps: Deps) {
    this.doc_ = deps.doc();

    this.clientConfigManager_ = deps.clientConfigManager();
    assert(
      this.clientConfigManager_,
      'MiniPromptApi requires an instance of ClientConfigManager.'
    );

    this.eventManager_ = deps.eventManager();
  }

  /**
   * Does the setup required for the mini prompt's display, including injecting
   * the mini prompt's css.
   */
  init(): void {
    const head = this.doc_.getHead();
    if (!head) {
      warn(
        'Unable to retrieve the head node of the current document, which is needed by MiniPromptApi.'
      );
      return;
    }

    const url = `${ASSETS}/swg-mini-prompt.css`;
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
   */
  create(options: {
    autoPromptType: AutoPromptType;
    clickCallback?: () => void;
  }): void {
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
      textContent = msg(SWG_I18N_STRINGS.CONTRIBUTION_TITLE_LANG_MAP, lang)!;
    } else if (options.autoPromptType === AutoPromptType.SUBSCRIPTION) {
      textContent = msg(SWG_I18N_STRINGS.SUBSCRIPTION_TITLE_LANG_MAP, lang)!;
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
      if (typeof options.clickCallback === 'function') {
        options.clickCallback();
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
   */
  private logImpression_(autoPromptType: AutoPromptType): void {
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
   */
  private logClick_(autoPromptType: AutoPromptType): void {
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
   */
  private logClose_(autoPromptType: AutoPromptType) {
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
