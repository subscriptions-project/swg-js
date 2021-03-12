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
  AnalyticsEvent,
  LinkSaveTokenRequest,
  LinkingInfoResponse,
} from '../proto/api_messages';
import {SubscriptionFlows, WindowOpenMode} from '../api/subscriptions';
import {acceptPortResultData} from '../utils/activity-utils';
import {createCancelError, isCancelError} from '../utils/errors';
import {feArgs, feOrigin, feUrl} from './services';

const LINK_REQUEST_ID = 'swg-link';

/**
 * The flow to link an existing publisher account to an existing google account.
 */
export class LinkbackFlow {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = deps.pageConfig();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();
  }

  /**
   * Starts the Link account flow.
   * @param {{ampReaderId: (string|undefined)}=} params
   * @return {!Promise}
   */
  start(params = {}) {
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
  /**
   * @param {!./deps.DepsDef} deps
   */
  static configurePending(deps) {
    /**
     * Handler function.
     * @param {!../components/activities.ActivityPortDef} port
     */
    function handler(port) {
      deps.entitlementsManager().blockNextNotification();
      deps.callbacks().triggerLinkProgress();
      deps.dialogManager().popupClosed();
      const promise = acceptPortResultData(
        port,
        feOrigin(),
        /* requireOriginVerified */ false,
        /* requireSecureChannel */ false
      );
      return promise.then(
        (response) => {
          deps
            .eventManager()
            .logSwgEvent(AnalyticsEvent.ACTION_LINK_CONTINUE, true);
          const flow = new LinkCompleteFlow(deps, response);
          flow.start();
        },
        (reason) => {
          if (isCancelError(reason)) {
            deps
              .eventManager()
              .logSwgEvent(AnalyticsEvent.ACTION_LINK_CANCEL, true);
            deps
              .callbacks()
              .triggerFlowCanceled(SubscriptionFlows.LINK_ACCOUNT);
          } else {
            // The user chose to continue but there was an error.
            deps
              .eventManager()
              .logSwgEvent(AnalyticsEvent.ACTION_LINK_CONTINUE, true);
          }
        }
      );
    }
    deps.activities().onResult(LINK_REQUEST_ID, handler);
  }

  /**
   * @param {!./deps.DepsDef} deps
   * @param {?Object} response
   */
  constructor(deps, response) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!./entitlements-manager.EntitlementsManager} */
    this.entitlementsManager_ = deps.entitlementsManager();

    /** @private @const {!./callbacks.Callbacks} */
    this.callbacks_ = deps.callbacks();

    const index = (response && response['index']) || '0';
    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/linkconfirmiframe', '/u/' + index),
      feArgs({
        'productId': deps.pageConfig().getProductId(),
        'publicationId': deps.pageConfig().getPublicationId(),
      }),
      /* shouldFadeBody */ true
    );

    /** @private {?function()} */
    this.completeResolver_ = null;

    /** @private @const {!Promise} */
    this.completePromise_ = new Promise((resolve) => {
      this.completeResolver_ = resolve;
    });
  }

  /**
   * Starts the Link account flow.
   * @return {!Promise}
   */
  start() {
    const promise = this.activityIframeView_.acceptResultAndVerify(
      feOrigin(),
      /* requireOriginVerified */ true,
      /* requireSecureChannel */ true
    );
    promise
      .then((response) => {
        this.complete_(response);
      })
      .catch((reason) => {
        // Rethrow async.
        setTimeout(() => {
          throw reason;
        });
      })
      .then(() => {
        // The flow is complete.
        this.dialogManager_.completeView(this.activityIframeView_);
      });
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_GOOGLE_UPDATED, true);
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.IMPRESSION_GOOGLE_UPDATED, true);
    return this.dialogManager_.openView(this.activityIframeView_);
  }

  /**
   * @param {?Object} response
   * @private
   */
  complete_(response) {
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.ACTION_GOOGLE_UPDATED_CLOSE, true);
    this.callbacks_.triggerLinkComplete();
    this.callbacks_.resetLinkProgress();
    this.entitlementsManager_.setToastShown(true);
    this.entitlementsManager_.unblockNextNotification();
    this.entitlementsManager_.reset((response && response['success']) || false);
    if (response && response['entitlements']) {
      this.entitlementsManager_.pushNextEntitlements(response['entitlements']);
    }
    this.completeResolver_();
  }

  /** @return {!Promise} */
  whenComplete() {
    return this.completePromise_;
  }
}

/**
 * The flow to save subscription information from an existing publisher account
 * to an existing google account.  The accounts may or may not already be
 * linked.
 */
export class LinkSaveFlow {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.SaveSubscriptionRequestCallback} callback
   */
  constructor(deps, callback) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private {!../api/subscriptions.SaveSubscriptionRequestCallback} */
    this.callback_ = callback;

    /** @private {?Promise<!../api/subscriptions.SaveSubscriptionRequest>} */
    this.requestPromise_ = null;

    /** @private {?Promise} */
    this.openPromise_ = null;

    /** @private {?ActivityIframeView} */
    this.activityIframeView_ = null;
  }

  /**
   * @return {?Promise<!../api/subscriptions.SaveSubscriptionRequest>}
   * @package Visible for testing.
   */
  getRequestPromise() {
    return this.requestPromise_;
  }

  /**
   * @private
   */
  complete_() {
    this.dialogManager_.completeView(this.activityIframeView_);
  }

  /**
   * @param {!Object} result
   * @return {!Promise<boolean>}
   * @private
   */
  handleLinkSaveResponse_(result) {
    // This flow is complete
    this.complete_();
    let startPromise;
    let linkConfirm = null;
    if (result['linked']) {
      // When linking succeeds, start link confirmation flow
      this.dialogManager_.popupClosed();
      this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.LINK_ACCOUNT);
      linkConfirm = new LinkCompleteFlow(this.deps_, result);
      startPromise = linkConfirm.start();
    } else {
      startPromise = Promise.reject(createCancelError(this.win_, 'not linked'));
    }
    const completePromise = startPromise.then(() => {
      this.deps_.callbacks().triggerLinkProgress();
      return linkConfirm.whenComplete();
    });

    return completePromise.then(() => {
      return true;
    });
  }

  /**
   * @param {LinkingInfoResponse} response
   * @private
   */
  sendLinkSaveToken_(response) {
    if (!response || !response.getRequested()) {
      return;
    }
    this.requestPromise_ = new Promise((resolve) => resolve(this.callback_()))
      .then((request) => {
        const saveRequest = new LinkSaveTokenRequest();
        if (request && request.token) {
          if (request.authCode) {
            throw new Error('Both authCode and token are available');
          } else {
            saveRequest.setToken(request.token);
          }
        } else if (request && request.authCode) {
          saveRequest.setAuthCode(request.authCode);
        } else {
          throw new Error('Neither token or authCode is available');
        }
        this.activityIframeView_.execute(saveRequest);
        return request;
      })
      .catch((reason) => {
        // The flow is complete.
        this.complete_();
        throw reason;
      });
  }

  /**
   * @return {?Promise}
   */
  /**
   * Starts the save subscription
   * @return {!Promise}
   */
  start() {
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
    this.activityIframeView_.on(
      LinkingInfoResponse,
      this.sendLinkSaveToken_.bind(this)
    );

    this.openPromise_ = this.dialogManager_.openView(
      this.activityIframeView_,
      /* hidden */ true
    );
    this.deps_
      .eventManager()
      .logSwgEvent(AnalyticsEvent.IMPRESSION_SAVE_SUBSCR_TO_GOOGLE);
    /** {!Promise<boolean>} */
    return this.activityIframeView_
      .acceptResultAndVerify(
        feOrigin(),
        /* requireOriginVerified */ true,
        /* requireSecureChannel */ true
      )
      .then((result) => {
        return this.handleLinkSaveResponse_(result);
      })
      .catch((reason) => {
        // In case this flow wasn't complete, complete it here
        this.complete_();
        // Handle cancellation from user, link confirm start or completion here
        if (isCancelError(reason)) {
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
      });
  }
}
