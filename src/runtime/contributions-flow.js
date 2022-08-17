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

    this.activityIframeView_ = null;

    // Default to showing close button.
    const isClosable = options?.isClosable ?? true;

    /** @private @const {!Promise<!ActivityIframeView>} */
    this.activityIframeViewPromise_ = this.clientConfigManager_
      .getClientConfig()
      .then((clientConfig) => {
        return this.shouldShow_(clientConfig)
          ? new ActivityIframeView(
              this.win_,
              this.activityPorts_,
              this.getUrl_(clientConfig, deps.pageConfig()),
              feArgs({
                'productId': deps.pageConfig().getProductId(),
                'publicationId': deps.pageConfig().getPublicationId(),
                'productType': ProductType.UI_CONTRIBUTION,
                'list': (options && options.list) || 'default',
                'skus': (options && options.skus) || null,
                'isClosable': isClosable,
                'supportsEventManager': true,
              }),
              /* shouldFadeBody */ true
            )
          : null;
      });
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
  start() {
    return this.activityIframeViewPromise_.then((activityIframeView) => {
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
      this.activityIframeView_ = activityIframeView;
      return this.clientConfigManager_
        .getClientConfig()
        .then((clientConfig) => {
          if (!this.activityIframeView_) {
            return;
          }
          return this.dialogManager_.openView(
            this.activityIframeView_,
            /* hidden */ false,
            this.getDialogConfig_(clientConfig, this.clientConfigManager_)
          );
        });
    });
  }

  /**
   *
   * @param {!../model/client-config.ClientConfig} clientConfig
   * @return {!../components/dialog.DialogConfig}
   */
  getDialogConfig_(clientConfig, clientConfigManager) {
    return clientConfig.useUpdatedOfferFlows &&
      !clientConfigManager.shouldAllowScroll()
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
  showNoEntitlementFoundToast() {
    if (this.activityIframeView_) {
      this.activityIframeView_.execute(new EntitlementsResponse());
    }
  }
}
