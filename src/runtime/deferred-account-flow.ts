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
import {AnalyticsEvent} from '../proto/api_messages';
import {
  DeferredAccountCreationRequest,
  DeferredAccountCreationResponse,
} from '../api/deferred-account-creation';
import {Deps} from './deps';
import {JwtHelper} from '../utils/jwt';
import {PayCompleteFlow} from './pay-flow';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {SubscriptionFlows} from '../api/subscriptions';
import {UserData} from '../api/user-data';
import {feArgs, feUrl} from './services';
import {isCancelError} from '../utils/errors';
import {ActivityPorts} from '../components/activities';
import {DialogManager} from '../components/dialog-manager';

/** Response from server. */
interface ConsentResponse {
  entitlements: string;
  idToken: string;
  productType: string;
  purchaseDataList: {
    data: string;
    signature: string;
  }[];
  purchaseData: {
    data: string;
    signature: string;
  };
}

/**
 * The flow to initiate deferred account process.
 * See `Subscriptions.completeDeferredAccountCreation` API.
 */
export class DeferredAccountFlow {
  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly options_: DeferredAccountCreationRequest;

  private activityIframeView_: ActivityIframeView | null = null;

  /** Visible for testing. */
  openPromise: Promise<void> | null = null;

  constructor(
    private readonly deps_: Deps,
    options: DeferredAccountCreationRequest | null
  ) {
    this.win_ = deps_.win();

    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();

    const defaultOptions: DeferredAccountCreationRequest = {
      entitlements: null,
      consent: true,
    };
    this.options_ = Object.assign(defaultOptions, options || {});
  }

  /**
   * Starts the deferred account flow.
   */
  async start(): Promise<DeferredAccountCreationResponse> {
    const entitlements = this.options_.entitlements;

    // For now, entitlements are required to be present and have the Google
    // token. This is strictly not required for the implementation. But it's
    // preferrable API-wise at this time.
    if (!entitlements || !entitlements.getEntitlementForSource('google')) {
      throw new Error('No entitlements with "google" source');
    }

    // Start/cancel events.
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.COMPLETE_DEFERRED_ACCOUNT_CREATION);

    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/recoveriframe'),
      feArgs({
        'publicationId': this.deps_.pageConfig().getPublicationId(),
        'productId': this.deps_.pageConfig().getProductId(),
        'entitlements': entitlements.raw || null,
        'consent': this.options_.consent,
      }),
      /* shouldFadeBody */ true
    );

    this.openPromise = this.dialogManager_.openView(this.activityIframeView_);

    try {
      const result = await this.activityIframeView_.acceptResult();
      // The consent part is complete.
      return this.handleConsentResponse_(result.data as ConsentResponse);
    } catch (reason) {
      if (isCancelError(reason as Error)) {
        this.deps_
          .callbacks()
          .triggerFlowCanceled(
            SubscriptionFlows.COMPLETE_DEFERRED_ACCOUNT_CREATION
          );
      } else {
        this.dialogManager_.completeView(this.activityIframeView_);
      }
      throw reason;
    }
  }

  private handleConsentResponse_(
    data: ConsentResponse
  ): DeferredAccountCreationResponse {
    this.deps_.entitlementsManager().blockNextNotification();

    // Parse the response.
    const entitlementsJwt = data['entitlements'];
    const idToken = data['idToken'];
    const productType = data['productType'];
    const entitlements = this.deps_
      .entitlementsManager()
      .parseEntitlements({'signedEntitlements': entitlementsJwt});
    const userData = new UserData(
      idToken,
      new JwtHelper().decode(idToken) as {[key: string]: string}
    );
    const purchaseDataList = data['purchaseDataList']
      ? data['purchaseDataList'].map(
          (pd) => new PurchaseData(pd['data'], pd['signature'])
        )
      : [
          // TODO(dvoytenko): cleanup/deprecate.
          new PurchaseData(
            data['purchaseData']['data'],
            data['purchaseData']['signature']
          ),
        ];

    // For now, we'll use the `PayCompleteFlow` as a "creating account" flow.
    // But this can be eventually implemented by the same iframe.
    const creatingFlow = new PayCompleteFlow(this.deps_);
    const completeHandler = creatingFlow.complete.bind(creatingFlow);

    const response = new DeferredAccountCreationResponse(
      entitlements,
      userData,
      purchaseDataList,
      completeHandler
    );

    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.ACTION_NEW_DEFERRED_ACCOUNT, true);

    // Start the "sync" flow.
    const dummyCompleteHandler = Promise.resolve.bind(Promise);
    creatingFlow.start(
      new SubscribeResponse(
        '', // raw field doesn't matter in this case
        purchaseDataList[0],
        userData,
        entitlements,
        productType,
        dummyCompleteHandler // completeHandler doesn't matter in this case
      )
    );
    return response;
  }
}
