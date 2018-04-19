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
import {SubscriptionFlows} from '../api/subscriptions';
import {acceptPortResult} from '../utils/activity-utils';
import {feArgs, feOrigin, feUrl} from './services';
import {isCancelError} from '../utils/errors';

const LINK_REQUEST_ID = 'swg-link';


/**
 * The flow to initiate linkback flow.
 */
export class LinkbackFlow {

  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = deps.pageConfig();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();
  }

  /**
   * Starts the Link account flow.
   * @return {!Promise}
   */
  start() {
    this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.LINK_ACCOUNT);
    const opener = this.activityPorts_.open(
        LINK_REQUEST_ID,
        feUrl('/linkbackstart'),
        '_blank',
        feArgs({
          'publicationId': this.pageConfig_.getPublicationId(),
        }), {});
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
    function handler(port) {
      deps.entitlementsManager().blockNextNotification();
      deps.callbacks().triggerLinkProgress();
      deps.dialogManager().popupClosed();
      const promise = acceptPortResult(
          port,
          feOrigin(),
          /* requireOriginVerified */ false,
          /* requireSecureChannel */ false);
      return promise.then(response => {
        const flow = new LinkCompleteFlow(deps, response);
        flow.start();
      }, reason => {
        if (isCancelError(reason)) {
          deps.callbacks().triggerFlowCanceled(SubscriptionFlows.LINK_ACCOUNT);
        }
      });
    };
    deps.activities().onResult(LINK_REQUEST_ID, handler);
  }

  /**
   * @param {!./deps.DepsDef} deps
   * @param {?Object} response
   */
  constructor(deps, response) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!./entitlements-manager.EntitlementsManager} */
    this.entitlementsManager_ = deps.entitlementsManager();

    /** @private @const {!./callbacks.Callbacks} */
    this.callbacks_ = deps.callbacks();

    const index = response && response['index'] || '0';
    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ =
        new ActivityIframeView(
            this.win_,
            this.activityPorts_,
            feUrl('/linkconfirmiframe', '/u/' + index),
            feArgs({
              'productId': deps.pageConfig().getProductId(),
              'publicationId': deps.pageConfig().getPublicationId(),
            }),
            /* shouldFadeBody */ true);

    /** @private {?function()} */
    this.completeResolver_ = null;

    /** @private @const {!Promise} */
    this.completePromise_ = new Promise(resolve => {
      this.completeResolver_ = resolve;
    });
  }

  /**
   * Starts the Link account flow.
   * @return {!Promise}
   */
  start() {
    const promise = this.activityIframeView_.port().then(port => {
      return acceptPortResult(
          port,
          feOrigin(),
          /* requireOriginVerified */ true,
          /* requireSecureChannel */ true);
    });
    promise.then(response => {
      this.complete_(response);
    }).catch(reason => {
      // Rethrow async.
      setTimeout(() => {
        throw reason;
      });
    }).then(() => {
      // The flow is complete.
      this.dialogManager_.completeView(this.activityIframeView_);
    });
    return this.dialogManager_.openView(this.activityIframeView_);
  }

  /**
   * @param {?Object} response
   * @private
   */
  complete_(response) {
    this.callbacks_.triggerLinkComplete();
    this.callbacks_.resetLinkProgress();
    this.entitlementsManager_.setToastShown(true);
    this.entitlementsManager_.unblockNextNotification();
    this.entitlementsManager_.reset(response && response['success'] || false);
    this.completeResolver_();
  }

  /** @return {!Promise} */
  whenComplete() {
    return this.completePromise_;
  }
}

/**
 * The flow to save subscription information.
 */
export class LinkSaveFlow {

  /**
   * @param {!./deps.DepsDef} deps
   * @param {!../api/subscriptions.SaveSubscriptionRequest} saveSubscriptionRequest
   */
  constructor(deps, saveSubscriptionRequest) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** TODO(sohanirao): Default request only for test */
    /** @type {!../api/subscriptions.SaveSubscriptionRequest} */
    const defaultRequest = {token: 'test'};

    /** @private {!../api/subscriptions.SaveSubscriptionRequest} */
    this.saveSubscriptionRequest_ = saveSubscriptionRequest || defaultRequest;

    /** @private {?ActivityIframeView} */
    this.activityIframeView_ = null;
  }

  /**
   * Starts the save subscription
   * @return {!Promise}
   */
  start() {
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/linksaveiframe'),
      feArgs({
        'publicationId': this.deps_.pageConfig().getPublicationId(),
        'token': this.saveSubscriptionRequest_['token'],
        'isClosable': true,
      }),
      /* shouldFadeBody */ false
    );
    /** {!Promise<boolean>} */
    return this.dialogManager_.openView(this.activityIframeView_).then(() => {
      return this.activityIframeView_.port().then(port => {
        return acceptPortResult(
            port,
            feOrigin(),
            /* requireOriginVerified */ true,
            /* requireSecureChannel */ true);
      }).then(result => {
        return result['linked'];
      }).catch(() => {
        return false;
      }).then(result => {
        // The flow is complete.
        this.dialogManager_.completeView(this.activityIframeView_);
        return result;
      });
    });
  }
}
