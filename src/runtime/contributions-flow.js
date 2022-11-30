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
import {
  AlreadySubscribedResponse,
  EntitlementsResponse,
  SkuSelectedResponse,
} from '../proto/api_messages';
import {PayStartFlow} from './pay-flow';
import {ProductType, SubscriptionFlows} from '../api/subscriptions';
import {feArgs, feUrl} from './services';

/**
 * The class for Contributions flow.
 */
export class ContributionsFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.OffersRequest|undefined} options
   */
  constructor(deps, options) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!../api/subscriptions.OffersRequest|undefined} */
    this.options_ = options;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!./client-config-manager.ClientConfigManager} */
    this.clientConfigManager_ = deps.clientConfigManager();

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!Promise<?ActivityIframeView>} */
    this.activityIframeViewPromise_ = this.getActivityIframeView_();
  }

  /**
   * @return {!Promise<?ActivityIframeView>}
   */
  async getActivityIframeView_() {
    // Default to showing close button.
    const isClosable = this.options_?.isClosable ?? true;

    const clientConfig = await this.clientConfigManager_.getClientConfig();
    if (!this.shouldShow_(clientConfig)) {
      return null;
    }

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
      /* shouldFadeBody */ true
    );
  }

  /**
   * @param {AlreadySubscribedResponse} response
   */
  handleLinkRequest_(response) {
    if (response.getSubscriberOrMember()) {
      this.deps_.callbacks().triggerLoginRequest({
        linkRequested: !!response.getLinkRequested(),
      });
    }
  }

  /**
   * @param {SkuSelectedResponse} response
   */
  startPayFlow_(response) {
    const sku = response.getSku();
    const isOneTime = response.getOneTime();
    if (sku) {
      const /** @type {../api/subscriptions.SubscriptionRequest} */ contributionRequest =
          {
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
   * @return {!Promise}
   */
  async start() {
    const activityIframeView = await this.activityIframeViewPromise_;
    if (!activityIframeView) {
      return Promise.resolve();
    }

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
   * @param {!../model/client-config.ClientConfig} clientConfig
   * @param {boolean} shouldAllowScroll
   * @return {!../components/dialog.DialogConfig}
   */
  getDialogConfig_(clientConfig, shouldAllowScroll) {
    return clientConfig.useUpdatedOfferFlows && !shouldAllowScroll
      ? {shouldDisableBodyScrolling: true}
      : {};
  }

  /**
   * Returns whether this flow is configured as enabled, not showing
   * even on explicit start when flag is configured false.
   *
   * @param {!../model/client-config.ClientConfig} clientConfig
   * @return {boolean}
   */
  shouldShow_(clientConfig) {
    return clientConfig.uiPredicates?.canDisplayAutoPrompt !== false;
  }

  /**
   * Gets the complete URL that should be used for the activity iFrame view.
   * @param {!../model/client-config.ClientConfig} clientConfig
   * @param {!../model/page-config.PageConfig} pageConfig
   * @return {string}
   */
  getUrl_(clientConfig, pageConfig) {
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
  async showNoEntitlementFoundToast() {
    const activityIframeView = await this.activityIframeViewPromise_;
    activityIframeView.execute(new EntitlementsResponse());
  }
}
