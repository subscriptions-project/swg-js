/**
 * Copyright 2025 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActionToIframeMapping, parseUrl} from '../utils/url';
import {ActivityIframeView} from '../ui/activity-iframe-view';
import {ActivityPorts} from '../components/activities';
import {ClientConfigManager} from './client-config-manager';
import {CompleteAudienceActionResponse} from '../proto/api_messages';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {Intervention} from './intervention';
import {ProductType} from '../api/subscriptions';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
import {assert} from '../utils/log';
import {feArgs, feUrl} from './services';
import {msg} from '../utils/i18n';
import {setImportantStyles} from '../utils/style';

const INLINE_CTA_ATTRIUBUTE_QUERY = 'div[rrm-inline-cta]';
const INLINE_CTA_ATTRIUBUTE = 'rrm-inline-cta';
const DEFAULT_PRODUCT_TYPE = ProductType.UI_CONTRIBUTION;

export class InlincCtaApi {
  private readonly doc_: Doc;
  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly entitlementsManager_: EntitlementsManager;
  private readonly storage_: Storage;
  constructor(private readonly deps_: Deps) {
    this.doc_ = deps_.doc();
    this.win_ = deps_.win();
    this.activityPorts_ = deps_.activities();
    this.entitlementsManager_ = deps_.entitlementsManager();
    this.clientConfigManager_ = deps_.clientConfigManager();
    this.storage_ = deps_.storage();
    assert(
      this.clientConfigManager_,
      'InlineCta requires an instance of ClientConfigManager.'
    );
  }

  private getUrl_(urlPrefix: string, configId: string): string {
    const iframeParams: {[key: string]: string} = {
      'origin': parseUrl(this.win_.location.href).origin,
      'configurationId': configId,
      'isClosable': 'true',
      'calledManually': 'false',
      'previewEnabled': 'false',
      'publicationId': this.deps_.pageConfig().getPublicationId(),
      'ctaMode': 'CTA_MODE_INLINE',
    };
    return feUrl(urlPrefix, iframeParams);
  }

  private handleCompleteAudienceActionResponse_(
    response: CompleteAudienceActionResponse,
    actionType: string,
    div: HTMLElement
  ): void {
    this.entitlementsManager_.clear();
    const userToken = response.getSwgUserToken();
    if (userToken) {
      this.storage_.set(StorageKeys.USER_TOKEN, userToken, true);
    }
    if (response.getAlreadyCompleted()) {
      this.clearInlineCta_(div);
      this.showAlreadyOptedInToast_(actionType);
    }
    const now = Date.now().toString();
    this.storage_.set(StorageKeys.READ_TIME, now, /*useLocalStorage=*/ false);
    this.entitlementsManager_.getEntitlements();
  }

  private showAlreadyOptedInToast_(actionType: string): void {
    let urlParams;
    switch (actionType) {
      case 'TYPE_REGISTRATION_WALL':
        // Show 'Signed in as abc@gmail.com' toast on the pub page.
        urlParams = {
          flavor: 'basic',
        };
        break;
      case 'TYPE_NEWSLETTER_SIGNUP':
        const lang = this.clientConfigManager_.getLanguage();
        const customText = msg(
          SWG_I18N_STRINGS.NEWSLETTER_ALREADY_SIGNED_UP_LANG_MAP,
          lang
        )!;
        urlParams = {
          flavor: 'custom',
          customText,
        };
        break;
      default:
        // Do not show toast for other types.
        return;
    }
    new Toast(this.deps_, feUrl('/toastiframe', urlParams)).open();
  }

  private clearInlineCta_(div: HTMLElement) {
    if (div.firstChild) {
      div.removeChild(div.firstChild);
    }
  }

  private async renderInlineCtaWithAttribute_(
    div: HTMLElement,
    actions: Intervention[]
  ) {
    // return if config id is not set in inline CTA code snippet.
    const configId = div.getAttribute(INLINE_CTA_ATTRIUBUTE);
    if (!configId) {
      return;
    }
    // return if no active action matches config id.
    const action = actions.find(
      (action) => action.configurationId === configId
    );
    if (!action) {
      return;
    }
    // return if no urlPrefix matches action type.
    const urlPrefix = ActionToIframeMapping[action.type] ?? '';
    if (!urlPrefix) {
      return;
    }
    const fetchUrl = this.getUrl_(urlPrefix, configId);
    const fetchArgs = feArgs({
      'supportsEventManager': true,
      'productType': DEFAULT_PRODUCT_TYPE,
    });

    const activityIframeView = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      fetchUrl,
      fetchArgs
    );
    setImportantStyles(activityIframeView.getElement(), {
      'width': '100%',
    });

    activityIframeView.on(CompleteAudienceActionResponse, (response) =>
      this.handleCompleteAudienceActionResponse_(response, action.type, div)
    );

    div.appendChild(activityIframeView.getElement());
    const port = await this.activityPorts_.openIframe(
      activityIframeView.getElement(),
      fetchUrl,
      fetchArgs
    );
    port.onResizeRequest((height) => {
      setImportantStyles(activityIframeView.getElement(), {
        'height': `${height}px`,
      });
    });

    await port.whenReady();
  }

  async attachInlineCtasWithAttribute(): Promise<void> {
    const elements: HTMLElement[] = Array.from(
      this.doc_.getWin().document.querySelectorAll(INLINE_CTA_ATTRIUBUTE_QUERY)
    );

    if (elements.length === 0) {
      return;
    }

    // Fetch entitlements and article actions from the server, so that we have
    // the information we need to determine whether and which CTA to show.
    const [clientConfig, entitlements, article] = await Promise.all([
      this.clientConfigManager_.getClientConfig(),
      this.entitlementsManager_.getEntitlements(),
      this.entitlementsManager_.getArticle(),
    ]);

    if (
      !clientConfig.uiPredicates?.canDisplayAutoPrompt ||
      !article ||
      !!entitlements.enablesThis()
    ) {
      return;
    }

    const actions = article.audienceActions?.actions;
    if (!actions || actions.length === 0) {
      return;
    }

    for (const element of elements) {
      this.renderInlineCtaWithAttribute_(element, actions);
    }
  }
}
