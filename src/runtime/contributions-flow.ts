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

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {ActivityPorts} from '../components/activities';
import {
  AlreadySubscribedResponse,
  EntitlementsResponse,
  SkuSelectedResponse,
} from '../proto/api_messages';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {Deps} from './deps';
import {DialogConfig} from '../components/dialog';
import {DialogManager} from '../components/dialog-manager';
import {
  OffersRequest,
  ProductType,
  SubscriptionFlows,
  SubscriptionRequest,
} from '../api/subscriptions';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from './pay-flow';
import {feArgs, feUrl} from './services';

/**
 * The class for Contributions flow.
 */
export class ContributionsFlow {
  private readonly win_: Window;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly activityIframeViewPromise_: Promise<ActivityIframeView>;

  constructor(
    private readonly deps_: Deps,
    private readonly options_?: OffersRequest
  ) {
    this.win_ = deps_.win();

    this.clientConfigManager_ = deps_.clientConfigManager();

    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();

    this.activityIframeViewPromise_ = this.getActivityIframeView_();
  }

  private async getActivityIframeView_(): Promise<ActivityIframeView> {
    // Default to showing close button.
    const isClosable = this.options_?.isClosable ?? true;

    const clientConfig = await this.clientConfigManager_.getClientConfig();

    return new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      this.getUrl_(clientConfig, this.deps_.pageConfig()),
      feArgs({
        'productId': this.deps_.pageConfig().getProductId(),
        'publicationId': this.deps_.pageConfig().getPublicationId(),
        'productType': ProductType.UI_CONTRIBUTION,
        'list': this.options_?.list || 'default',
        'skus': this.options_?.skus || null,
        'isClosable': isClosable,
        'supportsEventManager': true,
      }),
      /* shouldFadeBody */ !this.options_?.shouldNotFadeBody
    );
  }

  private handleLinkRequest_(response: AlreadySubscribedResponse): void {
    if (response.getSubscriberOrMember()) {
      this.deps_.callbacks().triggerLoginRequest({
        linkRequested: !!response.getLinkRequested(),
      });
    }
  }

  private startPayFlow_(response: SkuSelectedResponse): void {
    const sku = response.getSku();
    const isOneTime = response.getOneTime();
    if (sku) {
      const contributionRequest: SubscriptionRequest = {
        'skuId': sku,
      };
      if (isOneTime) {
        contributionRequest['oneTime'] = isOneTime;
      }
      new PayStartFlow(
        this.deps_,
        contributionRequest,
        ProductType.UI_CONTRIBUTION
      ).start();
    }
  }

  /**
   * Starts the contributions flow or alreadyMember flow.
   */
  async start(): Promise<void> {
    const activityIframeView = await this.activityIframeViewPromise_;

    // Start/cancel events.
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_CONTRIBUTION_OPTIONS);
    activityIframeView.onCancel(() => {
      this.deps_
        .callbacks()
        .triggerFlowCanceled(SubscriptionFlows.SHOW_CONTRIBUTION_OPTIONS);
    });
    activityIframeView.on(
      AlreadySubscribedResponse,
      this.handleLinkRequest_.bind(this)
    );
    activityIframeView.on(SkuSelectedResponse, this.startPayFlow_.bind(this));

    const clientConfig = await this.clientConfigManager_.getClientConfig();
    return this.dialogManager_.openView(
      activityIframeView,
      /* hidden */ false,
      this.getDialogConfig_(
        clientConfig,
        this.clientConfigManager_.shouldAllowScroll()
      )
    );
  }

  /**
   * Gets display configuration options for the opened dialog. Uses the
   * responsive desktop design properties if the updated offer flows UI (for
   * SwG Basic) is enabled. Permits override to allow scrolling.
   */
  private getDialogConfig_(
    clientConfig: ClientConfig,
    shouldAllowScroll: boolean
  ): DialogConfig {
    return clientConfig.useUpdatedOfferFlows && !shouldAllowScroll
      ? {shouldDisableBodyScrolling: true}
      : {};
  }

  /**
   * Gets the complete URL that should be used for the activity iFrame view.
   */
  private getUrl_(clientConfig: ClientConfig, pageConfig: PageConfig): string {
    if (!clientConfig.useUpdatedOfferFlows) {
      return feUrl('/contributionsiframe');
    }

    if (this.clientConfigManager_.shouldForceLangInIframes()) {
      return feUrl('/contributionoffersiframe', {
        'hl': this.clientConfigManager_.getLanguage(),
        'publicationId': pageConfig.getPublicationId(),
      });
    }

    return feUrl('/contributionoffersiframe', {
      'publicationId': pageConfig.getPublicationId(),
    });
  }

  /**
   * Shows "no contribution found" on activity iFrame view.
   */
  async showNoEntitlementFoundToast(): Promise<void> {
    const activityIframeView = await this.activityIframeViewPromise_;
    activityIframeView!.execute(new EntitlementsResponse());
  }
}
