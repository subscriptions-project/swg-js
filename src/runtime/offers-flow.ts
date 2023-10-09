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
  SubscribeResponse,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {AnalyticsEvent, EventParams} from '../proto/api_messages';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {DialogConfig} from '../components/dialog';
import {DialogManager} from '../components/dialog-manager';
import {
  OffersRequest,
  ProductType,
  SubscriptionFlows,
} from '../api/subscriptions';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from './pay-flow';
import {SubscriptionRequest} from '../api/subscriptions';
import {assert} from '../utils/log';
import {feArgs, feUrl} from './services';
import {parseQueryString} from '../utils/url';

function getEventParams(sku: string): EventParams {
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
  private activityIframeView_: ActivityIframeView | null = null;

  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly eventManager_: ClientEventManager;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly skus_?: string[];
  private readonly clientConfigPromise_?: Promise<ClientConfig>;
  private readonly activityIframeViewPromise_?: Promise<ActivityIframeView | null>;

  constructor(private readonly deps_: Deps, options?: OffersRequest) {
    this.win_ = deps_.win();
    this.activityPorts_ = deps_.activities();
    this.dialogManager_ = deps_.dialogManager();
    this.eventManager_ = deps_.eventManager();
    this.clientConfigManager_ = deps_.clientConfigManager();
    // Default to hiding close button.
    const isClosable = options?.isClosable ?? false;
    const feArgsObj: OffersRequest = deps_.activities().addDefaultArguments({
      'showNative': deps_.callbacks().hasSubscribeRequestCallback(),
      'productType': ProductType.SUBSCRIPTION,
      'list': options?.list || 'default',
      'skus': options?.skus || null,
      'isClosable': isClosable,
    });

    if (options?.oldSku) {
      feArgsObj['oldSku'] = options.oldSku;
      assert(feArgsObj['skus'], 'Need a sku list if old sku is provided!');

      // Remove old sku from offers if in list.
      let skuList = feArgsObj['skus']!;
      const oldSku = feArgsObj['oldSku'];
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
      const oldSku = feArgsObj['oldSku'];
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

    this.skus_ = feArgsObj['skus'] || [ALL_SKUS];

    this.clientConfigPromise_ = this.clientConfigManager_.getClientConfig();

    this.activityIframeViewPromise_ = this.createActivityIframeView_(feArgsObj);
  }

  private async createActivityIframeView_(
    args: OffersRequest
  ): Promise<ActivityIframeView | null> {
    const clientConfig = await this.clientConfigPromise_!;

    return new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      this.getUrl_(clientConfig, this.deps_.pageConfig()),
      args as {[key: string]: string},
      /* shouldFadeBody */ true
    );
  }

  private startPayFlow_(response: SkuSelectedResponse): void {
    const sku = response.getSku();
    if (sku) {
      const subscriptionRequest: SubscriptionRequest = {
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

  private handleLinkRequest_(response: AlreadySubscribedResponse): void {
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

  private startNativeFlow_(response: ViewSubscriptionsResponse): void {
    if (response.getNative()) {
      this.deps_.callbacks().triggerSubscribeRequest();
    }
  }

  /**
   * Starts the offers flow or alreadySubscribed flow.
   */
  async start(): Promise<void> {
    this.activityIframeView_ = await this.activityIframeViewPromise_!;
    if (!this.activityIframeView_) {
      return;
    }

    // So no error if skipped to payment screen.
    // Start/cancel events.
    // The second parameter is required by Propensity in AMP.
    this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.SHOW_OFFERS, {
      skus: this.skus_,
      source: 'SwG',
    });
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

    const clientConfig = await this.clientConfigPromise_!;
    return this.dialogManager_.openView(
      this.activityIframeView_,
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
  getDialogConfig_(
    clientConfig: ClientConfig,
    shouldAllowScroll: boolean
  ): DialogConfig {
    return clientConfig.useUpdatedOfferFlows
      ? {
          desktopConfig: {isCenterPositioned: true, supportsWideScreen: true},
          shouldDisableBodyScrolling: !shouldAllowScroll,
        }
      : {};
  }

  /**
   * Returns the full URL that should be used for the activity iFrame view.
   */
  private getUrl_(clientConfig: ClientConfig, pageConfig: PageConfig): string {
    if (!clientConfig.useUpdatedOfferFlows) {
      const offerCardParam = parseQueryString(this.win_.location.hash)[
        'swg.newoffercard'
      ];
      const params: {[key: string]: string} = offerCardParam
        ? {'useNewOfferCard': offerCardParam}
        : {};
      return feUrl('/offersiframe', params);
    }

    const params: {[key: string]: string} = {
      'publicationId': pageConfig.getPublicationId(),
    };

    if (this.clientConfigManager_.shouldForceLangInIframes()) {
      params['hl'] = this.clientConfigManager_.getLanguage();
    }

    if (clientConfig.uiPredicates?.purchaseUnavailableRegion) {
      params['purchaseUnavailableRegion'] = 'true';
    }

    return feUrl('/subscriptionoffersiframe', params);
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
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly eventManager_: ClientEventManager;
  private readonly activityIframeView_: ActivityIframeView;

  constructor(
    private readonly deps_: Deps,
    private readonly options_?: OffersRequest
  ) {
    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();

    this.eventManager_ = deps_.eventManager();

    this.activityIframeView_ = new ActivityIframeView(
      deps_.win(),
      this.activityPorts_,
      feUrl('/optionsiframe'),
      feArgs({
        'publicationId': deps_.pageConfig().getPublicationId(),
        'productId': deps_.pageConfig().getProductId(),
        'list': options_?.list || 'default',
        'skus': options_?.skus || null,
        'isClosable': true,
      }),
      /* shouldFadeBody */ false
    );
  }

  /**
   * Starts the offers flow or alreadySubscribed flow.
   */
  start(): Promise<void> {
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
        const data = result.data as {subscribe?: boolean};
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

  private maybeOpenOffersFlow_(response: SubscribeResponse): void {
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
 */
export class AbbrvOfferFlow {
  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly eventManager_: ClientEventManager;
  private readonly activityIframeView_: ActivityIframeView;

  constructor(
    private readonly deps_: Deps,
    private readonly options_: OffersRequest = {}
  ) {
    this.win_ = deps_.win();

    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();

    this.eventManager_ = deps_.eventManager();

    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/abbrvofferiframe'),
      feArgs({
        'publicationId': deps_.pageConfig().getPublicationId(),
        'productId': deps_.pageConfig().getProductId(),
        'showNative': deps_.callbacks().hasSubscribeRequestCallback(),
        'list': options_.list || 'default',
        'skus': options_.skus || null,
        'isClosable': true,
      }),
      /* shouldFadeBody */ false
    );
  }

  private handleLinkRequest_(response: AlreadySubscribedResponse): void {
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
   */
  start(): Promise<void> {
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
      const data = result.data as {native?: boolean; viewOffers?: boolean};
      if (data['viewOffers']) {
        if (this.options_.isClosable == undefined) {
          this.options_.isClosable = OFFERS_VIEW_CLOSABLE;
        }
        this.eventManager_.logSwgEvent(AnalyticsEvent.ACTION_VIEW_OFFERS, true);
        new OffersFlow(this.deps_, this.options_).start();
        return;
      }
      if (data['native']) {
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
