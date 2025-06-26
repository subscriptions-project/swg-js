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
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {
  CompleteAudienceActionResponse,
  SkuSelectedResponse,
  SurveyDataTransferRequest,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {Intervention} from './intervention';
import {InterventionType} from '../api/intervention-type';
import {ProductType, SubscriptionFlows} from '../api/subscriptions';
import {Storage} from './storage';
import {StorageKeys} from '../utils/constants';
import {assert} from '../utils/log';
import {feArgs, feUrl} from './services';
import {
  getContributionsUrl,
  getSubscriptionUrl,
  showAlreadyOptedInToast,
  startContributionPayFlow,
  startNativeFlow,
  startSubscriptionPayFlow,
} from '../utils/cta-utils';
import {handleSurveyDataTransferRequest} from '../utils/survey-utils';
import {setImportantStyles} from '../utils/style';

const INLINE_CTA_ATTRIUBUTE_QUERY = 'div[rrm-inline-cta]';
const INLINE_CTA_ATTRIUBUTE = 'rrm-inline-cta';
const DEFAULT_PRODUCT_TYPE = ProductType.UI_CONTRIBUTION;
// The value logged when the offers screen shows all available SKUs.
const ALL_SKUS = '*';
export class InlineCtaApi {
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
    if (this.clientConfigManager_.shouldForceLangInIframes()) {
      iframeParams['hl'] = this.clientConfigManager_.getLanguage();
    }
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
      showAlreadyOptedInToast(
        actionType,
        this.clientConfigManager_.getLanguage(),
        this.deps_
      );
    }
    const now = Date.now().toString();
    this.storage_.set(StorageKeys.READ_TIME, now, /*useLocalStorage=*/ false);
    this.entitlementsManager_.getEntitlements();
  }

  private clearInlineCta_(div: HTMLElement) {
    if (div.firstChild) {
      div.removeChild(div.firstChild);
    }
  }

  private async renderInlineCtaWithAttribute_(
    div: HTMLElement,
    actions: Intervention[],
    clientConfig: ClientConfig
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
    // return if action is not inline CTA supported type.
    if (
      action.type === InterventionType.TYPE_REWARDED_AD ||
      action.type === InterventionType.TYPE_BYO_CTA
    ) {
      return;
    }
    const urlPrefix = ActionToIframeMapping[action.type];
    const fetchUrl =
      action.type === InterventionType.TYPE_SUBSCRIPTION
        ? getSubscriptionUrl(
            clientConfig,
            this.clientConfigManager_,
            this.deps_.pageConfig(),
            this.win_.location.hash,
            /* isInlineCta */ true
          )
        : action.type === InterventionType.TYPE_CONTRIBUTION
        ? getContributionsUrl(
            clientConfig,
            this.clientConfigManager_,
            this.deps_.pageConfig(),
            /* isInlineCta */ true
          )
        : this.getUrl_(urlPrefix, configId);
    const fetchArgs =
      action.type === InterventionType.TYPE_SUBSCRIPTION
        ? (this.activityPorts_.addDefaultArguments({
            'showNative': this.deps_.callbacks().hasSubscribeRequestCallback(),
            'productType': ProductType.SUBSCRIPTION,
            'list': 'default',
            'skus': null,
            'isClosable': false,
          }) as {[key: string]: string})
        : action.type === InterventionType.TYPE_CONTRIBUTION
        ? feArgs({
            'productId': this.deps_.pageConfig().getProductId(),
            'publicationId': this.deps_.pageConfig().getPublicationId(),
            'productType': ProductType.UI_CONTRIBUTION,
            'list': 'default',
            'skus': null,
            'isClosable': false,
            'supportsEventManager': true,
          })
        : feArgs({
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

    if (action.type === InterventionType.TYPE_SUBSCRIPTION) {
      this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.SHOW_OFFERS, {
        skus: [ALL_SKUS],
        source: 'SwG',
      });
      activityIframeView.onCancel(() => {
        this.deps_
          .callbacks()
          .triggerFlowCanceled(SubscriptionFlows.SHOW_OFFERS);
      });
      activityIframeView.on(SkuSelectedResponse, (response) =>
        startSubscriptionPayFlow(
          this.deps_,
          response,
          /* isInlineCta */ true,
          configId
        )
      );
      activityIframeView.on(ViewSubscriptionsResponse, (response) =>
        startNativeFlow(this.deps_, response)
      );
    } else if (action.type === InterventionType.TYPE_CONTRIBUTION) {
      this.deps_
        .callbacks()
        .triggerFlowStarted(SubscriptionFlows.SHOW_CONTRIBUTION_OPTIONS);
      activityIframeView.onCancel(() => {
        this.deps_
          .callbacks()
          .triggerFlowCanceled(SubscriptionFlows.SHOW_CONTRIBUTION_OPTIONS);
      });
      activityIframeView.on(SkuSelectedResponse, (response) =>
        startContributionPayFlow(
          this.deps_,
          response,
          /* isInlineCta */ true,
          configId
        )
      );
    } else {
      activityIframeView.on(CompleteAudienceActionResponse, (response) =>
        this.handleCompleteAudienceActionResponse_(response, action.type, div)
      );
      activityIframeView.on(SurveyDataTransferRequest, (request) =>
        handleSurveyDataTransferRequest(
          request,
          this.deps_,
          activityIframeView,
          configId
        )
      );
    }

    div.appendChild(activityIframeView.getElement());

    await activityIframeView.init();
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
      this.renderInlineCtaWithAttribute_(element, actions, clientConfig);
    }
  }
}
