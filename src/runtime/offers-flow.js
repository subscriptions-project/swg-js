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
  SubscribeResponse,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {AnalyticsEvent, EventParams} from '../proto/api_messages';
import {PayStartFlow} from './pay-flow';
import {ProductType, SubscriptionFlows} from '../api/subscriptions';
import {assert} from '../utils/log';
import {feArgs, feUrl} from './services';

/**
 * @param {string} sku
 * @return {!EventParams}
 */
function getEventParams(sku) {
  return new EventParams([, , , , sku]);
}

/**
 * Offers view is closable when request was originated from 'AbbrvOfferFlow'
 * or from 'SubscribeOptionFlow'.
 */
const OFFERS_VIEW_CLOSABLE = true;

// The value logged when the offers screen shows all available SKUs.
const ALL_SKUS = '*';

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

    /** @private @const {!./client-config-manager.ClientConfigManager} */
    this.clientConfigManager_ = deps.clientConfigManager();

    this.activityIframeView_ = null;

    // Default to hiding close button.
    const isClosable = options?.isClosable ?? false;

    const feArgsObj = deps.activities().addDefaultArguments({
      'showNative': deps.callbacks().hasSubscribeRequestCallback(),
      'productType': ProductType.SUBSCRIPTION,
      'list': (options && options.list) || 'default',
      'skus': (options && options.skus) || null,
      'isClosable': isClosable,
    });

    if (options && options.oldSku) {
      feArgsObj['oldSku'] = options.oldSku;
      assert(feArgsObj['skus'], 'Need a sku list if old sku is provided!');

      // Remove old sku from offers if in list.
      let skuList = feArgsObj['skus'];
      const /** @type {string} */ oldSku = feArgsObj['oldSku'];
      skuList = skuList.filter((sku) => sku !== oldSku);

      assert(
        skuList.length > 0,
        'Sku list only contained offer user already has'
      );
      feArgsObj['skus'] = skuList;
    }

    // Redirect to payments if only one upgrade option is passed.
    if (feArgsObj['skus'] && feArgsObj['skus'].length === 1) {
      const sku = feArgsObj['skus'][0];
      const /** @type {string|undefined} */ oldSku = feArgsObj['oldSku'];
      // Update subscription triggers experimental flag if oldSku is passed,
      // so we need to check for oldSku to decide if it needs to be sent.
      // Otherwise we might accidentally block a regular subscription request.
      if (oldSku) {
        const skuSelectedResponse = new SkuSelectedResponse();
        skuSelectedResponse.setSku(sku);
        skuSelectedResponse.setOldSku(oldSku);
        this.startPayFlow_(skuSelectedResponse);
        return;
      }
    }

    /** @private  @const {!Array<!string>} */
    this.skus_ = feArgsObj['skus'] || [ALL_SKUS];

    /** @private @const {!Promise<!ActivityIframeView>} */
    const clientConfigPromise = this.clientConfigManager_.getClientConfig();
    this.activityIframeViewPromise_ = Promise.all([
      this.shouldShow_(clientConfigPromise),
      this.getUrl_(clientConfigPromise)
    ]).then(([enabled, url]) => {
      return enabled ? new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl(url),
        feArgsObj,
        /* shouldFadeBody */ true
      ) : null;
    });
  }

  /**
   * @param {SkuSelectedResponse} response
   * @private
   */
  startPayFlow_(response) {
    const sku = response.getSku();
    if (sku) {
      const /** @type {../api/subscriptions.SubscriptionRequest} */ subscriptionRequest =
          {
            'skuId': sku,
          };
      const oldSku = response.getOldSku();
      if (oldSku) {
        subscriptionRequest['oldSku'] = oldSku;
        this.deps_.analytics().setSku(oldSku);
      }
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.ACTION_OFFER_SELECTED,
        true,
        getEventParams(sku)
      );
      new PayStartFlow(this.deps_, subscriptionRequest).start();
    }
  }

  /**
   * @param {AlreadySubscribedResponse} response
   * @private
   */
  handleLinkRequest_(response) {
    if (response.getSubscriberOrMember()) {
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.ACTION_ALREADY_SUBSCRIBED,
        true
      );
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
    if (this.activityIframeViewPromise_) {
      return this.activityIframeViewPromise_.then((activityIframeView) => {
        if (!activityIframeView) {
          return Promise.resolve();
        }

        // So no error if skipped to payment screen.
        // Start/cancel events.
        // The second parameter is required by Propensity in AMP.
        this.deps_
          .callbacks()
          .triggerFlowStarted(SubscriptionFlows.SHOW_OFFERS, {
            skus: this.skus_,
            source: 'SwG',
          });
        activityIframeView.onCancel(() => {
          this.deps_
            .callbacks()
            .triggerFlowCanceled(SubscriptionFlows.SHOW_OFFERS);
        });
        activityIframeView.on(
          SkuSelectedResponse,
          this.startPayFlow_.bind(this)
        );
        activityIframeView.on(
          AlreadySubscribedResponse,
          this.handleLinkRequest_.bind(this)
        );
        activityIframeView.on(
          ViewSubscriptionsResponse,
          this.startNativeFlow_.bind(this)
        );
        this.activityIframeView_ = activityIframeView;
        return this.dialogManager_.openView(this.activityIframeView_);
      });
    }
    return Promise.resolve();
  }

  shouldShow_(clientConfigPromise) {
    return clientConfigPromise.then(clientConfig => 
      Promise.resolve(
        !clientConfig.uiPredicates ||
        clientConfig.uiPredicates.canDisplayAutoPrompt)
    );        
  }

  /**
   * Gets the URL that should be used for the activity iFrame view.
   * @param {!Promise<../model/client-config.ClientConfig>} clientConfigPromise
   * @return {!Promise<string>}
   */
  getUrl_(clientConfigPromise) {
    return clientConfigPromise.then((clientConfig) => {
      if (clientConfig.useUpdatedOfferFlows) {
        return '/subscriptionoffersiframe';
      } else {
        return '/offersiframe';
      }
    });
  }

  /**
   * Shows "no subscription found" on activity iFrame view.
   */
  showNoEntitlementFoundToast() {
    if (this.activityIframeView_) {
      this.activityIframeView_.execute(new EntitlementsResponse());
    }
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

    /** @private @const {!../runtime/client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();

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
      (result) => {
        const data = result.data;
        const response = new SubscribeResponse();
        if (data['subscribe']) {
          response.setSubscribe(true);
        }
        this.maybeOpenOffersFlow_(response);
      },
      (reason) => {
        this.dialogManager_.completeView(this.activityIframeView_);
        throw reason;
      }
    );
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS
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
      this.eventManager_.logSwgEvent(AnalyticsEvent.ACTION_VIEW_OFFERS, true);
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

    /** @private @const {!../runtime/client-event-manager.ClientEventManager} */
    this.eventManager_ = deps.eventManager();

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
      this.eventManager_.logSwgEvent(
        AnalyticsEvent.ACTION_ALREADY_SUBSCRIBED,
        true
      );
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
    this.activityIframeView_.acceptResult().then((result) => {
      if (result.data['viewOffers']) {
        const options = this.options_ || {};
        if (options.isClosable == undefined) {
          options.isClosable = OFFERS_VIEW_CLOSABLE;
        }
        this.eventManager_.logSwgEvent(AnalyticsEvent.ACTION_VIEW_OFFERS, true);
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

    this.eventManager_.logSwgEvent(
      AnalyticsEvent.IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED
    );

    return this.dialogManager_.openView(this.activityIframeView_);
  }
}
