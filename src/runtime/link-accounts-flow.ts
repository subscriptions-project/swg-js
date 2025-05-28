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
import {ActivityPortDef, ActivityPorts} from '../components/activities';
import {
  AnalyticsEvent,
  LinkSaveTokenRequest,
  LinkingInfoResponse,
} from '../proto/api_messages';
import {Callbacks} from './callbacks';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {EntitlementsManager} from './entitlements-manager';
import {PageConfig} from '../model/page-config';
import {
  SaveSubscriptionRequest,
  SaveSubscriptionRequestCallback,
  SubscriptionFlows,
  WindowOpenMode,
} from '../api/subscriptions';
import {StorageKeys} from '../utils/constants';
import {acceptPortResultData} from '../utils/activity-utils';
import {createCancelError, isCancelError} from '../utils/errors';
import {feArgs, feOrigin, feUrl} from './services';

const LINK_REQUEST_ID = 'swg-link';

interface LinkSaveResponse {
  linked?: boolean;
  saveAndRefresh?: boolean;
  swgUserToken?: string;
  index?: number;
}

interface LinkConfirmResponse {
  linked?: boolean;
  success?: boolean;
  swgUserToken?: string;
}

type LinkCompleteResponse = LinkConfirmResponse & LinkSaveResponse;

/**
 * The flow to link an existing publisher account to an existing google account.
 */
export class LinkbackFlow {
  private readonly activityPorts_: ActivityPorts;
  private readonly pageConfig_: PageConfig;
  private readonly dialogManager_: DialogManager;

  constructor(private readonly deps_: Deps) {
    this.activityPorts_ = deps_.activities();

    this.pageConfig_ = deps_.pageConfig();

    this.dialogManager_ = deps_.dialogManager();
  }

  /**
   * Starts the Link account flow.
   */
  start(params: {ampReaderId?: string} = {}): Promise<void> {
    this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.LINK_ACCOUNT);
    const forceRedirect =
      this.deps_.config().windowOpenMode == WindowOpenMode.REDIRECT;
    const args = params.ampReaderId
      ? feArgs({
          'publicationId': this.pageConfig_.getPublicationId(),
          'ampReaderId': params.ampReaderId,
        })
      : feArgs({
          'publicationId': this.pageConfig_.getPublicationId(),
        });
    const opener = this.activityPorts_.open(
      LINK_REQUEST_ID,
      feUrl('/linkbackstart'),
      forceRedirect ? '_top' : '_blank',
      args,
      {}
    );
    this.deps_.eventManager().logSwgEvent(AnalyticsEvent.IMPRESSION_LINK);
    this.dialogManager_.popupOpened(opener && opener.targetWin);
    return Promise.resolve();
  }
}

/**
 * The class for Link accounts flow.
 */
export class LinkCompleteFlow {
  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly entitlementsManager_: EntitlementsManager;
  private readonly callbacks_: Callbacks;
  private readonly completePromise_: Promise<void>;

  private activityIframeView_: ActivityIframeView | null = null;
  private completeResolver_: (() => void) | null = null;

  static configurePending(deps: Deps): void {
    /**
     * Handler function.
     */
    async function handler(port: ActivityPortDef): Promise<void> {
      deps.entitlementsManager().blockNextNotification();
      deps.callbacks().triggerLinkProgress();
      deps.dialogManager().popupClosed();

      try {
        // Wait for account linking to complete.
        const response = (await acceptPortResultData(
          port,
          feOrigin(),
          /* requireOriginVerified */ false,
          /* requireSecureChannel */ false
        )) as LinkConfirmResponse;

        // Send events.
        deps
          .eventManager()
          .logSwgEvent(AnalyticsEvent.ACTION_LINK_CONTINUE, true);
        deps
          .eventManager()
          .logSwgEvent(AnalyticsEvent.EVENT_LINK_ACCOUNT_SUCCESS);

        // Start flow.
        const flow = new LinkCompleteFlow(deps, response);
        flow.start();
      } catch (reason) {
        deps.entitlementsManager().unblockNextNotification();
        if (isCancelError(reason as Error)) {
          deps
            .eventManager()
            .logSwgEvent(AnalyticsEvent.ACTION_LINK_CANCEL, true);
          deps.callbacks().triggerFlowCanceled(SubscriptionFlows.LINK_ACCOUNT);
        } else {
          // The user chose to continue but there was an error.
          deps
            .eventManager()
            .logSwgEvent(AnalyticsEvent.ACTION_LINK_CONTINUE, true);
        }
      }
    }

    deps.activities().onResult(LINK_REQUEST_ID, handler);
  }

  constructor(
    private readonly deps_: Deps,
    private readonly response_: LinkCompleteResponse
  ) {
    this.win_ = deps_.win();

    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();

    this.entitlementsManager_ = deps_.entitlementsManager();

    this.callbacks_ = deps_.callbacks();

    this.response_ ||= {};

    this.completePromise_ = new Promise<void>((resolve) => {
      this.completeResolver_ = resolve;
    });
  }

  /**
   * Starts the Link account flow.
   */
  async start(): Promise<void> {
    if (this.response_['saveAndRefresh']) {
      this.complete_(this.response_, !!this.response_['linked']);
      return Promise.resolve();
    }

    // Show confirmation.
    const index = this.response_['index'] || '0';
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/linkconfirmiframe', {}, 'u/' + index),
      feArgs({
        'productId': this.deps_.pageConfig().getProductId(),
        'publicationId': this.deps_.pageConfig().getPublicationId(),
      }),
      /* shouldFadeBody */ true
    );

    this.completeAfterVerifyingResults_();

    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_GOOGLE_UPDATED, true);
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.IMPRESSION_GOOGLE_UPDATED, true);

    return this.dialogManager_.openView(this.activityIframeView_);
  }

  private async completeAfterVerifyingResults_() {
    try {
      const response = (await this.activityIframeView_!.acceptResultAndVerify(
        feOrigin(),
        /* requireOriginVerified */ true,
        /* requireSecureChannel */ true
      )) as LinkCompleteResponse;
      this.complete_(response, !!response['success']);
    } catch (reason) {
      // Rethrow async.
      this.win_.setTimeout(() => {
        throw reason;
      });
    }

    // The flow is complete.
    this.dialogManager_.completeView(this.activityIframeView_);
  }

  private complete_(response: LinkCompleteResponse, success: boolean): void {
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.ACTION_GOOGLE_UPDATED_CLOSE, true);
    const userToken = response['swgUserToken'];
    if (userToken) {
      this.deps_.storage().set(StorageKeys.USER_TOKEN, userToken, true);
    }
    this.callbacks_.triggerLinkComplete();
    this.callbacks_.resetLinkProgress();
    this.entitlementsManager_.setToastShown(true);
    this.entitlementsManager_.unblockNextNotification();
    this.entitlementsManager_.reset(success);
    this.completeResolver_!();
  }

  whenComplete(): Promise<void> {
    return this.completePromise_;
  }
}

/**
 * The flow to save subscription information from an existing publisher account
 * to an existing google account.  The accounts may or may not already be
 * linked.
 */
export class LinkSaveFlow {
  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;

  private requestPromise_: Promise<SaveSubscriptionRequest | void> | null =
    null;
  private activityIframeView_: ActivityIframeView | null = null;

  /** Visible for testing. */
  openPromise: Promise<void> | null = null;

  constructor(
    private readonly deps_: Deps,
    private readonly callback_: SaveSubscriptionRequestCallback
  ) {
    this.win_ = deps_.win();

    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();
  }

  /**
   * Visible for testing.
   */
  getRequestPromise(): Promise<SaveSubscriptionRequest | void> | null {
    return this.requestPromise_;
  }

  private complete_(): void {
    this.dialogManager_.completeView(this.activityIframeView_);
  }

  private async handleLinkSaveResponse_(
    result: LinkSaveResponse
  ): Promise<boolean> {
    // This flow is complete.
    this.complete_();

    // Handle linking failure.
    if (!result['linked']) {
      throw createCancelError('not linked');
    }

    // Start link confirmation flow.
    this.dialogManager_.popupClosed();
    this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.LINK_ACCOUNT);
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_SAVE_SUBSCRIPTION_SUCCESS);
    const flow = new LinkCompleteFlow(this.deps_, result);
    await flow.start();

    this.deps_.callbacks().triggerLinkProgress();

    await flow.whenComplete();

    return true;
  }

  private async sendLinkSaveToken_(
    response: LinkingInfoResponse
  ): Promise<SaveSubscriptionRequest | void> {
    if (!response || !response.getRequested()) {
      return;
    }

    try {
      const request = await this.callback_();
      const saveRequest = new LinkSaveTokenRequest();
      if (request?.token) {
        if (request.authCode) {
          throw new Error('Both authCode and token are available');
        } else {
          saveRequest.setToken(request.token);
        }
      } else if (request?.authCode) {
        saveRequest.setAuthCode(request.authCode);
      } else {
        throw new Error('Neither token or authCode is available');
      }
      this.activityIframeView_!.execute(saveRequest);
      return request;
    } catch (reason) {
      // The flow is complete.
      this.complete_();
      throw reason;
    }
  }

  /**
   * Starts the save subscription.
   */
  async start(): Promise<boolean> {
    const iframeArgs = this.activityPorts_.addDefaultArguments({
      'isClosable': true,
    });
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/linksaveiframe'),
      iframeArgs,
      /* shouldFadeBody */ false,
      /* hasLoadingIndicator */ true
    );
    this.activityIframeView_.on(LinkingInfoResponse, (response) => {
      this.requestPromise_ = this.sendLinkSaveToken_(response);
    });

    this.openPromise = this.dialogManager_.openView(
      this.activityIframeView_,
      /* hidden */ true
    );

    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.IMPRESSION_SAVE_SUBSCR_TO_GOOGLE);

    try {
      const result = (await this.activityIframeView_.acceptResultAndVerify(
        feOrigin(),
        /* requireOriginVerified */ true,
        /* requireSecureChannel */ true
      )) as LinkSaveResponse;

      return await this.handleLinkSaveResponse_(result);
    } catch (reason) {
      // In case this flow wasn't complete, complete it here.
      this.complete_();

      // Handle cancellation from user, link confirm start or completion here.
      if (isCancelError(reason as Error)) {
        this.deps_
          .eventManager()
          .logSwgEvent(
            AnalyticsEvent.ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL,
            true
          );
        this.deps_
          .callbacks()
          .triggerFlowCanceled(SubscriptionFlows.LINK_ACCOUNT);
        return false;
      }

      throw reason;
    }
  }
}
