/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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

import './material-web-components';
import {
  AddPreferredSourceStatus,
  AnalyticsEvent,
  EventParams,
} from '../proto/api_messages';
import {Deps} from '../runtime/deps';
import {GOOGLE_G_LOGO_URL} from '../utils/assets';
import {I18N_STRINGS} from '../i18n/strings';
import {PreferredSourceButtonOptions} from '../api/preferred-source';
import {createElement} from '../utils/dom';
import {getButtonStyles} from './add-preferred-source-button-templates';
import {getCanonicalUrl} from '../utils/url';
import {msg} from '../utils/i18n';

export class AddPreferredSourceButton {
  private shadow_: ShadowRoot | null = null;
  private buttonEl_: HTMLElement | null = null;
  private textEl_: HTMLSpanElement | null = null;
  private currentStatus_?: AddPreferredSourceStatus;
  private clickHandler_?: () => Promise<boolean>;

  constructor(
    private readonly deps_: Deps,
    private readonly container_: Element,
    private readonly options_: PreferredSourceButtonOptions = {}
  ) {}

  /**
   * Attaches the shadow root and renders the native Material 3 button.
   */
  attach(clickHandler: () => Promise<boolean>): void {
    const doc = this.container_.ownerDocument || document;
    const shadow = this.container_.attachShadow({mode: 'closed'});
    this.shadow_ = shadow;

    const lang = this.options_.lang || 'en';
    const initialText = msg(I18N_STRINGS.ADD_PREFERRED_SOURCE_BUTTON, lang);

    // 1. Configure a11y live region on host container
    this.container_.setAttribute('aria-live', 'polite');

    // 2. Inject encapsulated Stylesheet
    const styleEl = createElement(
      doc,
      'style',
      {},
      getButtonStyles(this.options_.theme)
    );
    shadow.appendChild(styleEl);

    // 3. Build custom <publisher-md-outlined-button> element
    this.buttonEl_ = createElement(doc, 'publisher-md-outlined-button', {});

    // 4. Build Google G logo and text inside button
    const logoEl = createElement(doc, 'img', {
      'class': 'publisher-logo',
      'slot': 'icon',
      'src': GOOGLE_G_LOGO_URL,
      'alt': '',
      'aria-hidden': 'true',
      'width': '22',
      'height': '22',
      'loading': 'eager',
      'decoding': 'async',
    });
    this.buttonEl_.appendChild(logoEl);

    this.textEl_ = createElement(
      doc,
      'span',
      {'class': 'publisher-btn-text'},
      initialText
    );
    this.buttonEl_.appendChild(this.textEl_);

    shadow.appendChild(this.buttonEl_);

    // 5. Log impression event
    this.logAnalyticsEvent_(
      AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON
    );

    this.clickHandler_ = clickHandler;

    // 6. Attach click handler
    this.buttonEl_.addEventListener('click', (e: Event) => {
      this.handleClick(e);
    });

    this.updateStatus(this.currentStatus_);
  }

  /**
   * Handles button click events, enforcing trusted events and state checks.
   */
  async handleClick(
    e?: Event | {isTrusted?: boolean; preventDefault?: () => void}
  ): Promise<void> {
    if (!e?.isTrusted) {
      return;
    }
    e.preventDefault?.();
    if (
      this.buttonEl_?.getAttribute('aria-disabled') === 'true' ||
      this.buttonEl_?.hasAttribute('soft-disabled') ||
      this.buttonEl_?.hasAttribute('disabled')
    ) {
      return;
    }
    this.logAnalyticsEvent_(
      AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCES_BUTTON_CLICK
    );
    await this.clickHandler_?.();
  }

  /**
   * Updates the button state based on the consent flow response status.
   */
  updateStatus(status?: AddPreferredSourceStatus): void {
    if (status === undefined) {
      return;
    }
    this.currentStatus_ = status;
    if (!this.buttonEl_ || !this.textEl_) {
      return;
    }

    const lang = this.options_.lang || 'en';

    if (
      status === AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS ||
      status ===
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED
    ) {
      const addedText = msg(
        I18N_STRINGS.ADDED_TO_PREFERRED_SOURCES_BUTTON,
        lang
      );
      this.textEl_.textContent = addedText;
      this.buttonEl_.setAttribute('aria-label', addedText);
      this.buttonEl_.setAttribute('aria-disabled', 'true');
      this.buttonEl_.setAttribute('soft-disabled', '');
      (this.buttonEl_ as {softDisabled?: boolean}).softDisabled = true;
    } else if (
      status === AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE
    ) {
      this.buttonEl_.setAttribute('aria-disabled', 'true');
      this.buttonEl_.setAttribute('soft-disabled', '');
      (this.buttonEl_ as {softDisabled?: boolean}).softDisabled = true;
    }
  }

  /**
   * Retrieves the ShadowRoot for testing verification.
   */
  getShadowRoot(): ShadowRoot | null {
    return this.shadow_;
  }

  private logAnalyticsEvent_(eventType: AnalyticsEvent): void {
    try {
      const canonicalUrl = getCanonicalUrl(this.deps_.doc());
      const params = new EventParams();
      if (canonicalUrl) {
        params.setCanonicalUrl(canonicalUrl);
      }
      this.deps_
        .eventManager()
        .logSwgEvent(
          eventType,
          eventType ===
            AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCES_BUTTON_CLICK,
          params
        );
    } catch (e) {
      void e;
    }
  }
}
