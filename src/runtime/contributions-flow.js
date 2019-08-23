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
import {PayStartFlow} from './pay-flow';
import {SubscriptionFlows, ProductType} from '../api/subscriptions';
import {feArgs, feUrl} from './services';
import {
  SkuSelectedResponse,
  AlreadySubscribedResponse,
} from '../proto/api_messages';
import {isExperimentOn} from './experiments';
import {ExperimentFlags} from './experiment-flags';

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

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    const isClosable = (options && options.isClosable) || true;

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/contributionsiframe'),
      feArgs({
        'productId': deps.pageConfig().getProductId(),
        'publicationId': deps.pageConfig().getPublicationId(),
        'productType': ProductType.UI_CONTRIBUTION,
        'list': (options && options.list) || 'default',
        'skus': (options && options.skus) || null,
        'isClosable': isClosable,
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
    if (sku) {
      new PayStartFlow(this.deps_, sku, ProductType.UI_CONTRIBUTION).start();
    }
  }

  /**
   * Starts the contributions flow or alreadyMember flow.
   * @return {!Promise}
   */
  start() {
    // Start/cancel events.
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_CONTRIBUTION_OPTIONS);
    this.activityIframeView_.onCancel(() => {
      this.deps_
        .callbacks()
        .triggerFlowCanceled(SubscriptionFlows.SHOW_CONTRIBUTION_OPTIONS);
    });
    if (isExperimentOn(this.deps_.win(), ExperimentFlags.HEJIRA)) {
      this.activityIframeView_.on(
        AlreadySubscribedResponse,
        this.handleLinkRequest_.bind(this)
      );
      this.activityIframeView_.on(
        SkuSelectedResponse,
        this.startPayFlow_.bind(this)
      );
    } else {
      // If result is due to OfferSelection, redirect to payments.
      this.activityIframeView_.onMessageDeprecated(result => {
        if (result['alreadyMember']) {
          const alreadySubscribedResponse = new AlreadySubscribedResponse();
          alreadySubscribedResponse.setLinkRequested(result['linkRequested']);
          alreadySubscribedResponse.setSubscriberOrMember(true);
          this.handleLinkRequest_(alreadySubscribedResponse);
          return;
        }
        if (result['sku']) {
          const skuSelectedResponse = new SkuSelectedResponse();
          skuSelectedResponse.setSku(result['sku']);
          this.startPayFlow_(skuSelectedResponse);
          return;
        }
      });
    }

    return this.dialogManager_.openView(this.activityIframeView_);
  }
}
