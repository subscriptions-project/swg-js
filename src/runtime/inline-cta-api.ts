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
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {Intervention} from './intervention';
import {ProductType} from '../api/subscriptions';
import {assert} from '../utils/log';
import {feArgs, feUrl} from './services';
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
  constructor(private readonly deps_: Deps) {
    this.doc_ = deps_.doc();
    this.win_ = deps_.win();
    this.activityPorts_ = deps_.activities();
    this.entitlementsManager_ = deps_.entitlementsManager();
    this.clientConfigManager_ = deps_.clientConfigManager();
    assert(
      this.clientConfigManager_,
      'InlineCta requires an instance of ClientConfigManager.'
    );
  }

  private actionToUrlPrefix_(
    configId: string,
    actions: Intervention[]
  ): string {
    for (const action of actions) {
      if (action.configurationId === configId) {
        return ActionToIframeMapping[action.type] ?? '';
      }
    }
    return '';
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

  private async renderInlineCtaWithAttribute_(
    div: HTMLElement,
    actions: Intervention[]
  ) {
    const configId = div.getAttribute(INLINE_CTA_ATTRIUBUTE);
    if (!configId) {
      return;
    }
    const urlPrefix = this.actionToUrlPrefix_(configId, actions);
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
