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
 *
 * An audience action local flow will show a dialog prompt to a reader, asking them
 * to complete an action for potentially free, additional metered entitlements.
 */

import {AudienceActionFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions'; // @ts-ignore
import {ClientConfigManager} from './client-config-manager';
import {Deps} from './deps';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Toast} from '../ui/toast';
import {createElement} from '../utils/dom';
import {feUrl} from './services';
import {msg} from '../utils/i18n';
import {setImportantStyles} from '../utils/style';

// Helper for syntax highlighting.
const html = String.raw;
const css = String.raw;

const INVALID_CSS = css`
  .prompt {
    width: 600px;
    height: 200px;
    background: white;
    pointer-events: auto !important;
    text-align: center;
  }
`;

const INVALID_HTML = html`
  <style>
    ${INVALID_CSS}
  </style>
  <div class="prompt">
    Invalid prompt.
    <div></div>
  </div>
`;

export interface AudienceActionLocalParams {
  action: string;
  configurationId?: string;
  onCancel?: () => void;
  autoPromptType?: AutoPromptType;
  onResult?: (result: {}) => Promise<boolean> | boolean;
  isClosable?: boolean;
  monetizationFunction?: () => void;
}

/**
 * The flow to initiate and manage handling an audience action.
 */
export class AudienceActionLocalFlow implements AudienceActionFlow {
  private readonly prompt_: Promise<HTMLElement>;
  private readonly wrapper_: Promise<HTMLElement>;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly doc_: Document;

  constructor(
    private readonly deps_: Deps // private readonly params_: AudienceActionLocalParams
  ) {
    this.clientConfigManager_ = deps_.clientConfigManager();

    this.doc_ = this.deps_.doc().getRootNode();

    this.prompt_ = this.createPrompt_();

    this.wrapper_ = this.prompt_.then(this.createWrapper_.bind(this));
  }

  async createPrompt_(): Promise<HTMLElement> {
    const prompt = await this.renderDefault();
    setImportantStyles(prompt, {
      'position': 'fixed',
      'left': '50%',
      'bottom': '20px',
      'transform': 'translateX(-50%)',
      'margin': '0 auto',
    });
    return prompt;
  }

  async createWrapper_(prompt: HTMLElement): Promise<HTMLElement> {
    const wrapper = createElement(this.doc_, 'div', {
      'class': 'audience-action-local-wrapper',
    });

    setImportantStyles(wrapper, {
      'all': 'unset',
      'background-color': 'rgba(32, 33, 36, 0.6)',
      'border': 'none',
      'bottom': '0',
      'height': '100%',
      'left': '0',
      'opacity': '0',
      'pointer-events': 'none',
      'position': 'fixed',
      'right': '0',
      'transition': 'opacity 0.5s',
      'top': '0',
      'width': '100%',
      'z-index': '2147483646',
    });

    const shadow = wrapper.attachShadow({mode: 'open'});

    shadow.appendChild(prompt);

    return wrapper;
  }

  async renderDefault() {
    const prompt = createElement(this.doc_, 'div', {});
    prompt./*OK*/ innerHTML = INVALID_HTML;
    return prompt;
  }

  async start() {
    const wrapper = await this.wrapper_;
    this.doc_.body.appendChild(wrapper);
    wrapper.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(wrapper, {'opacity': '1.0'});
  }

  showNoEntitlementFoundToast() {
    const language = this.clientConfigManager_.getLanguage();
    const customText = msg(
      SWG_I18N_STRINGS['NO_MEMBERSHIP_FOUND_LANG_MAP'],
      language
    )!;
    new Toast(
      this.deps_,
      feUrl('/toastiframe', {
        flavor: 'custom',
        customText,
      })
    ).open();
  }
}
