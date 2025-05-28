/**
 * Copyright 2023 The Subscribe with Google Authors. All Rights Reserved.
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
import {AudienceActionFlow} from './audience-action-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {
  BACK_TO_HOME_HTML,
  ERROR_HTML,
  LOADING_HTML,
  OPT_IN_CLOSE_BUTTON_HTML,
} from './audience-action-local-ui';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {EntitlementsManager} from './entitlements-manager';
import {InterventionResult} from '../api/available-intervention';
import {InterventionType} from '../api/intervention-type';
import {Message} from '../proto/api_messages';
import {PromptPreference} from './intervention';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';
import {addQueryParam} from '../utils/url';
import {createElement, removeElement} from '../utils/dom';
import {feUrl} from './services';
import {msg} from '../utils/i18n';
import {parseUrl} from '../utils/url';
import {serviceUrl} from './services';
import {setImportantStyles} from '../utils/style';
import {setStyle} from '../utils/style';

export interface AudienceActionLocalParams {
  action: InterventionType;
  configurationId: string;
  onCancel?: () => void;
  autoPromptType?: AutoPromptType;
  onResult?: (result: InterventionResult) => Promise<boolean> | boolean;
  isClosable?: boolean;
  monetizationFunction?: () => void;
  calledManually: boolean;
  shouldRenderPreview?: boolean;
}

interface AudienceActionConfig {
  publication?: {
    name?: string;
    revenueModel?: {
      subscriptions?: boolean;
      contributions?: boolean;
      premonetization?: boolean;
    };
  };
  optInParameters?: {
    title: string;
    body: string;
    promptPreference?: string;
    rawCodeSnippet?: string;
  };
}

interface CompleteAudienceActionResponse {
  updated?: boolean;
  alreadyCompleted?: boolean;
  swgUserToken?: string;
}

/**
 * An audience action local flow will show a dialog prompt to a reader, asking them
 * to complete an action for potentially free, additional metered entitlements.
 */
export class AudienceActionLocalFlow implements AudienceActionFlow {
  private readonly prompt_: HTMLElement;
  private readonly wrapper_: HTMLElement;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly doc_: Document;
  private readonly fetcher_: XhrFetcher;
  private readonly eventManager_: ClientEventManager;
  private readonly entitlementsManager_: EntitlementsManager;
  // Used for focus trap.
  private bottomSentinal_!: HTMLElement;

  constructor(
    private readonly deps_: Deps,
    private readonly params_: AudienceActionLocalParams
  ) {
    this.clientConfigManager_ = deps_.clientConfigManager();

    this.doc_ = deps_.doc().getRootNode();

    this.prompt_ = this.createPrompt_();

    this.wrapper_ = this.createWrapper_();

    this.fetcher_ = new XhrFetcher(deps_.win());

    this.eventManager_ = deps_.eventManager();

    this.entitlementsManager_ = deps_.entitlementsManager();
  }

  private createWrapper_(): HTMLElement {
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
      'pointer-events': 'auto',
      'position': 'fixed',
      'right': '0',
      'transition': 'opacity 0.5s',
      'top': '0',
      'width': '100%',
      'z-index': '2147483646',
    });

    if (!!this.params_.isClosable) {
      wrapper.onclick = this.close.bind(this);
    }

    const shadow = wrapper.attachShadow({mode: 'open'});

    const topSentinal = createElement(
      this.doc_,
      'audience-action-top-sentinal',
      {
        'tabindex': '0',
      }
    );
    topSentinal.addEventListener('focus', this.focusLast_.bind(this));

    this.bottomSentinal_ = createElement(
      this.doc_,
      'audience-action-bottom-sentinal',
      {
        'tabindex': '0',
      }
    );
    this.bottomSentinal_.addEventListener('focus', this.focusFirst_.bind(this));

    shadow.appendChild(topSentinal);
    shadow.appendChild(this.prompt_);
    shadow.appendChild(this.bottomSentinal_);

    return wrapper;
  }

  private createPrompt_(): HTMLElement {
    const prompt = createElement(this.doc_, 'div', {});
    setImportantStyles(prompt, {
      'height': '100%',
      'display': 'flex',
      'display-flex-direction': 'column',
      'pointer-events': 'none',
    });
    prompt.onclick = (e) => {
      e.stopPropagation();
    };
    return prompt;
  }

  private renderErrorView_() {
    this.prompt_./*OK*/ innerHTML = ERROR_HTML;
  }

  private renderLoadingView_() {
    this.prompt_./*OK*/ innerHTML = LOADING_HTML;
  }

  private async initPrompt_() {
    if (this.params_.action === InterventionType.TYPE_NEWSLETTER_SIGNUP) {
      await this.initNewsletterSignup_();
    } else {
      this.params_.onCancel?.();
      if (!this.params_.isClosable) {
        this.renderErrorView_();
        this.lock_();
      }
    }
  }

  private async initNewsletterSignup_() {
    this.renderLoadingView_();
    this.lock_();
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN
    );
    const config = await this.getConfig_();
    const codeSnippet = config?.optInParameters?.rawCodeSnippet;

    const validNewsletterSignupParams =
      codeSnippet &&
      config?.optInParameters?.promptPreference ===
        PromptPreference.PREFERENCE_PUBLISHER_PROVIDED_PROMPT;

    if (validNewsletterSignupParams) {
      this.renderOptInPrompt_(codeSnippet);
    } else {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CONFIG_ERROR
      );
      this.renderErrorView_();
    }
  }

  private renderOptInPrompt_(codeSnippet: string) {
    const optInPrompt = createElement(this.doc_, 'div', {});
    const closeHtml = this.getCloseButtonOrEmptyHtml_(OPT_IN_CLOSE_BUTTON_HTML);
    optInPrompt./*OK*/ innerHTML = closeHtml.concat(codeSnippet);
    const form = optInPrompt.querySelector('form');

    if (form && this.wrapper_) {
      setImportantStyles(optInPrompt, {
        'background-color': 'white',
        'border': 'none',
        'border-top-left-radius': '20px',
        'border-top-right-radius': '20px',
        'bottom': '0',
        'left': '50%',
        'max-height': '90%',
        'max-width': '100%',
        'pointer-events': 'auto',
        'position': 'fixed',
        'overflow': 'auto',
        'text-align': 'center',
        'transform': 'translate(-50%, 0)',
        'z-index': '2147483646',
      });
      optInPrompt.onclick = (e) => {
        e.stopPropagation();
      };
      this.wrapper_.shadowRoot?.removeChild(this.prompt_);
      this.wrapper_.shadowRoot?.appendChild(optInPrompt);
      this.focusOnOptinPrompt_();
      optInPrompt
        .querySelector('.opt-in-close-button')
        ?.addEventListener('click', this.closeOptInPrompt_.bind(this));
      form.addEventListener('submit', this.formSubmit_.bind(this));
    } else {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CODE_SNIPPET_ERROR
      );
      this.renderErrorView_();
    }
  }

  private focusOnOptinPrompt_() {
    // Move the bottomSentinal element after any focusable inputs.
    this.wrapper_.shadowRoot?.appendChild(this.bottomSentinal_);
    const focusable = this.getFocusableInput_();
    if (focusable.length > 0) {
      (this.getFocusableInput_()[0] as HTMLElement).focus();
    }
  }

  private async formSubmit_() {
    //TODO: chuyangwang - verify email being submitted.

    // Hide prompt before closing the prompt.
    setImportantStyles(this.wrapper_, {'opacity': '0'});
    // Wait for form submit request to send before closing the prompt.
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT
    );
    await this.complete_();

    await this.delay_(1000);
    // Close the prompt.
    this.unlock_();
  }

  private async delay_(time: number) {
    return new Promise((res) => this.deps_.win().setTimeout(res, time));
  }

  private closeOptInPrompt_() {
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE
    );

    if (this.params_.isClosable) {
      this.unlock_();
      this.params_.onCancel?.();
    }
  }

  private buildEndpointUrl_(endpoint: string, queryParams: string[][]): string {
    const publicationId = this.deps_.pageConfig().getPublicationId();
    const baseUrl = `/publication/${encodeURIComponent(
      publicationId
    )}/${endpoint}`;
    const url = queryParams.reduce(
      (url, [param, value]) => addQueryParam(url, param, value),
      serviceUrl(baseUrl)
    );
    return url;
  }

  private async getConfig_(): Promise<AudienceActionConfig> {
    const queryParams = [
      ['publicationId', this.deps_.pageConfig().getPublicationId()],
      // TODO: mhkawano - configurationId should not be optional
      ['configurationId', this.params_.configurationId!],
      ['origin', parseUrl(this.deps_.win().location.href).origin],
      ['previewEnabled', (!!this.params_.shouldRenderPreview).toString()],
    ];

    const url = this.buildEndpointUrl_('getactionconfigurationui', queryParams);
    return await this.fetcher_.fetchCredentialedJson(url);
  }

  private async complete_() {
    if (!!this.params_.shouldRenderPreview) {
      return;
    }
    const swgUserToken = await this.deps_
      .storage()
      .get(StorageKeys.USER_TOKEN, true);
    const queryParams = [
      // TODO: mhkawano - check and error out if swgUserToken is null
      ['sut', swgUserToken!],
      // TODO: mhkawano - configurationId should not be optional
      ['configurationId', this.params_.configurationId!],
      ['audienceActionType', this.params_.action],
    ];
    const url = this.buildEndpointUrl_('completeaudienceaction', queryParams);
    // Empty message send as part of the post.
    const emptyMessage: Message = {
      toArray: () => [],
      label: String,
    };
    const response = (await this.fetcher_.sendPost(
      url,
      emptyMessage
    )) as unknown as CompleteAudienceActionResponse;
    if (response.updated) {
      this.entitlementsManager_.clear();
      if (response.swgUserToken) {
        await this.deps_
          .storage()
          .set(StorageKeys.USER_TOKEN, response.swgUserToken, true);
      }
      const now = Date.now().toString();
      await this.deps_
        .storage()
        .set(StorageKeys.READ_TIME, now, /*useLocalStorage=*/ false);
      await this.entitlementsManager_.getEntitlements();
    }
    // TODO: mhkawano - else log error
  }

  private lock_() {
    this.doc_.documentElement.appendChild(this.wrapper_);
    setStyle(this.doc_.body, 'overflow', 'hidden');
    this.wrapper_.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(this.wrapper_, {'opacity': '1.0'});
  }

  private unlock_() {
    removeElement(this.wrapper_);
    setStyle(this.doc_.body, 'overflow', '');
  }

  private focusFirst_() {
    const focusable = this.getFocusable_();
    (focusable[1] as HTMLElement).focus();
  }

  private focusLast_() {
    const focusable = this.getFocusable_();
    (focusable[focusable.length - 2] as HTMLElement).focus();
  }

  private getFocusable_() {
    return this.wrapper_!.shadowRoot!.querySelectorAll(
      'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
    );
  }

  private getFocusableInput_() {
    return this.wrapper_!.shadowRoot!.querySelectorAll('input, textarea');
  }

  async start() {
    await this.initPrompt_();
  }

  private getCloseButtonOrEmptyHtml_(html: string) {
    const language = this.clientConfigManager_.getLanguage();
    if (!this.params_.isClosable) {
      if (this.params_.action === InterventionType.TYPE_NEWSLETTER_SIGNUP) {
        return '';
      }
      const backToHomeText = msg(
        SWG_I18N_STRINGS['BACK_TO_HOMEPAGE'],
        language
      )!;
      return BACK_TO_HOME_HTML.replace(
        '$BACK_TO_HOME_TEXT$',
        backToHomeText
      ).replace(
        '$BACK_TO_HOME_LINK$',
        parseUrl(this.deps_.win().location.href).origin
      );
    } else {
      const closeButtonDescription = msg(
        SWG_I18N_STRINGS['CLOSE_BUTTON_DESCRIPTION'],
        language
      )!;
      return html.replace('$CLOSE_BUTTON_DESCRIPTION$', closeButtonDescription);
    }
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

  close() {
    if (this.params_.action === InterventionType.TYPE_NEWSLETTER_SIGNUP) {
      this.closeOptInPrompt_();
    }
  }
}
