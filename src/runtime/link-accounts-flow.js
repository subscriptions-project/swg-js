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
import {SubscriptionFlows, WindowOpenMode} from '../api/subscriptions';
import {acceptPortResultData} from '../utils/activity-utils';
import {feArgs, feOrigin, feUrl} from './services';
import {isCancelError, createCancelError} from '../utils/errors';

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
    const forceRedirect =
        this.deps_.config().windowOpenMode == WindowOpenMode.REDIRECT;
    const opener = this.activityPorts_.open(
        LINK_REQUEST_ID,
        feUrl('/linkbackstart'),
        forceRedirect ? '_top' : '_blank',
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
    /**
     * Handler function.
     * @param {!web-activities/activity-ports.ActivityPort} port
     */
    function handler(port) {
      deps.entitlementsManager().blockNextNotification();
      deps.callbacks().triggerLinkProgress();
      deps.dialogManager().popupClosed();
      const promise = acceptPortResultData(
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
      return acceptPortResultData(
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
 * The flow to save subscription information.
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

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private {!../api/subscriptions.SaveSubscriptionRequestCallback} */
    this.callback_ = callback;

    /** @private {?Promise<!../api/subscriptions.SaveSubscriptionRequest>} */
    this.requestPromise_ = null;

    /** @private {?Promise} */
    this.linkedPromise_ = null;

    /** @private {?Promise} */
    this.confirmPromise_ = null;

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
   * @return {?Promise}
   */
  whenLinked() {
    return this.linkedPromise_;
  }

  /**
   * @return {?Promise<boolean>}
   */
  whenConfirmed() {
    return this.confirmPromise_;
  }

  /**
   * @return {?Promise}
   */
  /**
   * Starts the save subscription
   * @return {!Promise}
   */
  start() {
    const iframeArgs = {
      'publicationId': this.deps_.pageConfig().getPublicationId(),
      'isClosable': true,
    };

    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/linksaveiframe'),
        feArgs(iframeArgs),
        /* shouldFadeBody */ false,
        /* hasLoadingIndicator */ true
    );
    this.activityIframeView_.onMessage(data => {
      console.log('message received ', data);
      if (data['getLinkingInfo']) {
        this.requestPromise_ = new Promise(resolve => {
          resolve(this.callback_());
        }).then(request => {
          console.log('request recieved ', request);
          let saveRequest;
          if (request && request.token) {
            if (request.authCode) {
              throw new Error('Both authCode and token are available');
            } else {
              saveRequest = {'token': request.token};
            }
          } else if (request && request.authCode) {
            saveRequest = {'authCode': request.authCode};
          } else {
            throw new Error('Neither token or authCode is available');
          }
          this.activityIframeView_.message(saveRequest);
        }).catch(reason => {
          // The flow is complete.
          this.dialogManager_.completeView(this.activityIframeView_);
          throw reason;
        });
      }
    });
    
    this.linkedPromise_ = this.activityIframeView_.port().then(port => {
        console.log('port resolved');
        return acceptPortResultData(
            port,
            feOrigin(),
            /* requireOriginVerified */ true,
            /* requireSecureChannel */ true);
      });
    
    let linkConfirm = null;
    this.confirmPromise_ = this.linkedPromise_.then(result => {
        this.dialogManager_.completeView(this.activityIframeView_);
        if (result['linked']) {
          this.dialogManager_.popupClosed();
          this.deps_.callbacks().triggerFlowStarted(SubscriptionFlows.LINK_ACCOUNT);
          linkConfirm = new LinkCompleteFlow(this.deps_, result);
          return linkConfirm.start();
        }
        return Promise.reject(createCancelError(this.win_, 'not linked'));
      }).then(() => {
        console.log('link confirm started');
        this.deps_.callbacks().triggerLinkProgress();        
        return linkConfirm.whenComplete()
      }).then(() => {
          return true;
      }).catch(reason => {
        console.log('reason ', reason);
        if (isCancelError(reason)) {
          this.deps_.callbacks().triggerFlowCanceled(SubscriptionFlows.LINK_ACCOUNT);
          return false;
        }
        throw reason;  
      });
    
    /** {!Promise<boolean>} */
    return this.dialogManager_.openView(this.activityIframeView_,
        /* hidden */ true);
  }
}
