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

import {ASSETS} from '../constants';
import {AnalyticsEvent} from '../proto/api_messages';
import {ButtonOptions, SmartButtonOptions} from '../api/subscriptions';
import {ConfiguredRuntime} from './runtime';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {SmartSubscriptionButtonApi, Theme} from './smart-button-api';
import {createElement} from '../utils/dom';
import {msg} from '../utils/i18n';

/**
 * Properties:
 * - lang: Sets the button SVG and title. Default is "en".
 * - theme: "light" or "dark". Default is "light".
 */
export interface ButtonParams {
  options: SmartButtonOptions | ButtonOptions;
  clickFun: (event?: Event) => void;
}

export enum ButtonAttributeValues {
  SUBSCRIPTION = 'subscription',
  CONTRIBUTION = 'contribution',
}

const BUTTON_INNER_HTML = `<div class="swg-button-v2-icon-$theme$"></div>$textContent$`;

/**
 * The button stylesheet can be found in the `/assets/swg-button.css`.
 * It's produced by the `gulp assets` task and deployed to
 * `https://news.google.com/swg/js/v1/swg-button.css`.
 */
export class ButtonApi {
  constructor(
    private readonly doc_: Doc,
    private readonly configuredRuntimePromise_: Promise<ConfiguredRuntime>
  ) {}

  /**
   */
  init() {
    const head = this.doc_.getHead();
    if (!head) {
      return;
    }

    const url = `${ASSETS}/swg-button.css`;
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

  create(
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): Element {
    const button = createElement(this.doc_.getWin().document, 'button', {});
    return this.attach(button, optionsOrCallback, callback);
  }

  /**
   * Attaches the Classic 'Subscribe With Google' button.
   */
  attach(
    button: HTMLElement,
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): Element {
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
      msg(SWG_I18N_STRINGS.SUBSCRIPTION_TITLE_LANG_MAP, button)!
    );
    this.logSwgEvent_(AnalyticsEvent.IMPRESSION_SWG_BUTTON);

    return button;
  }

  /**
   * Attaches the new subscribe button, for subscription product types.
   */
  attachSubscribeButton(
    button: HTMLElement,
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): Element {
    const options: ButtonOptions = this.setupButtonAndGetParams_(
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
    if (!options['enable']) {
      button.setAttribute('disabled', 'disabled');
    }
    button./*OK*/ innerHTML = BUTTON_INNER_HTML.replace(
      '$theme$',
      theme!
    ).replace(
      '$textContent$',
      msg(SWG_I18N_STRINGS.SUBSCRIPTION_TITLE_LANG_MAP, button)!
    );
    this.logSwgEvent_(AnalyticsEvent.IMPRESSION_SHOW_OFFERS_SWG_BUTTON);

    return button;
  }

  /**
   * Attaches the new contribute button, for contribution product types.
   */
  attachContributeButton(
    button: HTMLElement,
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): Element {
    const options: ButtonOptions = this.setupButtonAndGetParams_(
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
    if (!options['enable']) {
      button.setAttribute('disabled', 'disabled');
    }
    button./*OK*/ innerHTML = BUTTON_INNER_HTML.replace(
      '$theme$',
      theme!
    ).replace(
      '$textContent$',
      msg(SWG_I18N_STRINGS.CONTRIBUTION_TITLE_LANG_MAP, button)!
    );
    this.logSwgEvent_(AnalyticsEvent.IMPRESSION_SHOW_CONTRIBUTIONS_SWG_BUTTON);

    return button;
  }

  /**
   * Attaches all buttons with the specified attribute set to any of the
   * attribute values.
   */
  attachButtonsWithAttribute(
    attribute: string,
    attributeValues: string[],
    options: ButtonOptions,
    attributeValueToCallback: {[key: string]: () => void}
  ) {
    for (const attributeValue of attributeValues) {
      const elements: HTMLElement[] = Array.from(
        this.doc_
          .getRootNode()
          .querySelectorAll(`[${attribute}="${attributeValue}"]`)
      );
      for (const element of elements) {
        if (attributeValue === ButtonAttributeValues.SUBSCRIPTION) {
          this.attachSubscribeButton(
            element,
            options,
            attributeValueToCallback[attributeValue]
          );
        } else if (attributeValue === ButtonAttributeValues.CONTRIBUTION) {
          this.attachContributeButton(
            element,
            options,
            attributeValueToCallback[attributeValue]
          );
        }
      }
    }
  }

  async logSwgEvent_(eventType: AnalyticsEvent, isFromUserAction?: boolean) {
    const configuredRuntime = await this.configuredRuntimePromise_;
    configuredRuntime.eventManager().logSwgEvent(eventType, isFromUserAction);
  }

  private getOptions_(
    optionsOrCallback: ButtonOptions | SmartButtonOptions | (() => void)
  ): ButtonOptions | SmartButtonOptions {
    const options =
      optionsOrCallback && typeof optionsOrCallback != 'function'
        ? optionsOrCallback
        : {'theme': Theme.LIGHT};

    const theme = options['theme'];
    if (theme !== Theme.LIGHT && theme !== Theme.DARK) {
      options['theme'] = Theme.LIGHT;
    }
    return options;
  }

  private getCallback_(
    optionsOrCallback: SmartButtonOptions | ButtonOptions | (() => void),
    callback?: () => void
  ): (() => void) | ((event?: Event) => boolean) {
    return (
      (typeof optionsOrCallback === 'function' ? optionsOrCallback : null) ||
      callback!
    );
  }

  setupButtonAndGetParams_(
    button: Element,
    clickEvent: AnalyticsEvent,
    optionsOrCallback: SmartButtonOptions | ButtonOptions | (() => void),
    callbackFun?: () => void
  ): ButtonParams {
    const options = this.getOptions_(optionsOrCallback);
    const callback = this.getCallback_(optionsOrCallback, callbackFun);
    const clickFun = (event?: Event) => {
      this.logSwgEvent_(clickEvent, true);
      if (typeof callback === 'function') {
        callback(event);
      }
    };
    button.addEventListener('click', clickFun);
    return {options, clickFun};
  }

  attachSmartButton(
    deps: Deps,
    button: Element,
    optionsOrCallback: SmartButtonOptions | (() => void),
    callback?: () => void
  ): Element {
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
