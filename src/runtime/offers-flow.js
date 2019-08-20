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
import {AnalyticsEvent} from '../proto/api_messages';
import {feArgs, feUrl} from './services';
import {
  SkuSelectedResponse,
  AlreadySubscribedResponse,
  ViewSubscriptionsResponse,
  SubscribeResponse,
} from '../proto/api_messages';

/**
 * Offers view is closable when request was originated from 'AbbrvOfferFlow'
 * or from 'SubscribeOptionFlow'.
 */
const OFFERS_VIEW_CLOSABLE = true;

/**
 * The class for Offers flow.
 */
export class OffersFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.OffersRequest|undefined} options
   */
  constructor(deps, options) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!../runtime/client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();

    let isClosable = options && options.isClosable;
    if (isClosable == undefined) {
      isClosable = false; // Default is to hide Close button.
    }

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/offersiframe'),
      feArgs({
        'productId': deps.pageConfig().getProductId(),
        'publicationId': deps.pageConfig().getPublicationId(),
        'showNative': deps.callbacks().hasSubscribeRequestCallback(),
        'productType': ProductType.SUBSCRIPTION,
        'list': (options && options.list) || 'default',
        'skus': (options && options.skus) || null,
        'isClosable': isClosable,
      }),
      /* shouldFadeBody */ true
    );
  }

  /**
   * @param {SkuSelectedResponse} response
   * @private
   */
  startPayFlow_(response) {
    const sku = response.getSku();
    if (sku) {
      new PayStartFlow(this.deps_, sku).start();
    }
  }

  /**
   * @param {AlreadySubscribedResponse} response
   * @private
   */
  handleLinkRequest_(response) {
    if (response.getSubscriberOrMember()) {
      this.deps_.callbacks().triggerLoginRequest({
        linkRequested: !!response.getLinkRequested(),
      });
    }
  }

  /**
   * @param {ViewSubscriptionsResponse} response
   * @private
   */
  startNativeFlow_(response) {
    if (response.getNative()) {
      this.deps_.callbacks().triggerSubscribeRequest();
    }
  }

  /**
   * Starts the offers flow or alreadySubscribed flow.
   * @return {!Promise}
   */
  start() {
    // Start/cancel events.
    this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.SHOW_OFFERS);
    this.activityIframeView_.onCancel(() => {
      this.deps_.callbacks().triggerFlowCanceled(SubscriptionFlows.SHOW_OFFERS);
    });

    this.activityIframeView_.on(
      SkuSelectedResponse,
      this.startPayFlow_.bind(this)
    );
    this.activityIframeView_.on(
      AlreadySubscribedResponse,
      this.handleLinkRequest_.bind(this)
    );
    this.activityIframeView_.on(
      ViewSubscriptionsResponse,
      this.startNativeFlow_.bind(this)
    );

    this.eventManager_.logSwgEvent(AnalyticsEvent.IMPRESSION_OFFERS);

    return this.dialogManager_.openView(this.activityIframeView_);
  }
}

/**
 * The class for subscribe option flow.
 */
export class SubscribeOptionFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.OffersRequest|undefined} options
   */
  constructor(deps, options) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!../api/subscriptions.OffersRequest|undefined} */
    this.options_ = options;

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      deps.win(),
      this.activityPorts_,
      feUrl('/optionsiframe'),
      feArgs({
        'publicationId': deps.pageConfig().getPublicationId(),
        'productId': deps.pageConfig().getProductId(),
        'list': (options && options.list) || 'default',
        'skus': (options && options.skus) || null,
        'isClosable': true,
      }),
      /* shouldFadeBody */ false
    );
  }

  /**
   * Starts the offers flow or alreadySubscribed flow.
   * @return {!Promise}
   */
  start() {
    // Start/cancel events.
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_SUBSCRIBE_OPTION);
    this.activityIframeView_.onCancel(() => {
      this.deps_
        .callbacks()
        .triggerFlowCanceled(SubscriptionFlows.SHOW_SUBSCRIBE_OPTION);
    });

    this.activityIframeView_.on(
      SubscribeResponse,
      this.maybeOpenOffersFlow_.bind(this)
    );
    this.activityIframeView_.acceptResult().then(
      result => {
        const data = result.data;
        const response = new SubscribeResponse();
        if (data['subsribe']) {
          response.setSubscribe(true);
        }
        this.maybeOpenOffersFlow_(response);
      },
      reason => {
        this.dialogManager_.completeView(this.activityIframeView_);
        throw reason;
      }
    );
    return this.dialogManager_.openView(this.activityIframeView_);
  }

  /**
   * @param {SubscribeResponse} response
   * @private
   */
  maybeOpenOffersFlow_(response) {
    if (response.getSubscribe()) {
      const options = this.options_ || {};
      if (options.isClosable == undefined) {
        options.isClosable = OFFERS_VIEW_CLOSABLE;
      }
      new OffersFlow(this.deps_, options).start();
    }
  }
}

/**
 * The class for Abbreviated Offer flow.
 *
 */
export class AbbrvOfferFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.OffersRequest=} options
   */
  constructor(deps, options = {}) {
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

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/abbrvofferiframe'),
      feArgs({
        'publicationId': deps.pageConfig().getPublicationId(),
        'productId': deps.pageConfig().getProductId(),
        'showNative': deps.callbacks().hasSubscribeRequestCallback(),
        'list': (options && options.list) || 'default',
        'skus': (options && options.skus) || null,
        'isClosable': true,
      }),
      /* shouldFadeBody */ false
    );
  }

  /**
   * @param {AlreadySubscribedResponse} response
   * @private
   */
  handleLinkRequest_(response) {
    if (response.getSubscriberOrMember()) {
      this.deps_.callbacks().triggerLoginRequest({
        linkRequested: !!response.getLinkRequested(),
      });
    }
  }

  /**
   * Starts the offers flow
   * @return {!Promise}
   */
  start() {
    // Start/cancel events.
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_ABBRV_OFFER);
    this.activityIframeView_.onCancel(() => {
      this.deps_
        .callbacks()
        .triggerFlowCanceled(SubscriptionFlows.SHOW_ABBRV_OFFER);
    });

    // If the user is already subscribed, trigger login flow
    this.activityIframeView_.on(
      AlreadySubscribedResponse,
      this.handleLinkRequest_.bind(this)
    );
    // If result is due to requesting offers, redirect to offers flow
    this.activityIframeView_.acceptResult().then(result => {
      if (result.data['viewOffers']) {
        const options = this.options_ || {};
        if (options.isClosable == undefined) {
          options.isClosable = OFFERS_VIEW_CLOSABLE;
        }
        new OffersFlow(this.deps_, options).start();
        return;
      }
      if (result.data['native']) {
        this.deps_.callbacks().triggerSubscribeRequest();
        // The flow is complete.
        this.dialogManager_.completeView(this.activityIframeView_);
        return;
      }
    });

    return this.dialogManager_.openView(this.activityIframeView_);
  }
}
