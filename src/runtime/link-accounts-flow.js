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
import {acceptPortResult} from '../utils/activity-utils';
import {getHostUrl} from '../utils/url';
import {parseUrl} from '../utils/url';

const LINK_FRONT_IFRAME_URL =
    '$frontend$/swglib/linkfrontiframe$frontendDebug$';

const LINKBACK_URL =
    '$frontend$/swglib/linkbackstart$frontendDebug$';

const LINK_CONFIRM_IFRAME_URL =
    '$frontend$/u/$index$/swglib/linkconfirmiframe$frontendDebug$';

const CONTINUE_LINK_REQUEST_ID = 'swg-link-continue';
const LINK_REQUEST_ID = 'swg-link';


/**
 * The flow to initiate linking process.
 */
export class LinkStartFlow {

  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        LINK_FRONT_IFRAME_URL,
        {
          'publicationId': deps.pageConfig().getPublicationId(),
          'requestId': CONTINUE_LINK_REQUEST_ID,
          'returnUrl': getHostUrl(this.win_.location.href),
        },
        /* shouldFadeBody */ true
    );
  }

  /**
   * Starts the Link account flow.
   * @return {!Promise}
   */
  start() {
    this.activityIframeView_.acceptResult().then(result => {
      if (result.ok) {
        this.openLoginForm_(/** @type {!Object} */ (result.data));
      }
    });
    return this.dialogManager_.openView(this.activityIframeView_);
  }


  /**
   * Opens the publication's login page.
   * @param {!Object} resp
   * @private
   */
  openLoginForm_(resp) {
    const redirectUrl = resp['redirectUrl'];
    this.activityPorts_.open(
        CONTINUE_LINK_REQUEST_ID, redirectUrl, '_blank', null, {
          // TODO(dvoytenko): Remove the debug code.
          // Only keep request URL params for debugging URLs.
          skipRequestInUrl: redirectUrl.indexOf('http://localhost') == -1,
        });
    // Disconnected flow: will proceed with LinkCompleteFlow once popup
    // returns.
    this.dialogManager_.completeView(this.activityIframeView_);
  }
}


/**
 * The flow to initiate linkback flow.
 */
export class LinkbackFlow {

  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = deps.pageConfig();
  }

  /**
   * Starts the Link account flow.
   * @return {!Promise}
   */
  start() {
    this.activityPorts_.open(
        LINK_REQUEST_ID, LINKBACK_URL, '_blank', {
          'publicationId': this.pageConfig_.getPublicationId(),
        }, {});
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
      deps.callbacks().triggerLinkProgress(Promise.resolve());
      const promise = acceptPortResult(
          port,
          parseUrl(LINK_CONFIRM_IFRAME_URL).origin,
          /* requireOriginVerified */ false,
          /* requireSecureChannel */ false);
      return promise.then(response => {
        const flow = new LinkCompleteFlow(deps, response);
        flow.start();
      });
    };
    deps.activities().onResult(CONTINUE_LINK_REQUEST_ID, handler);
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
            LINK_CONFIRM_IFRAME_URL.replace(/\$index\$/g, index),
            {
              'productId': deps.pageConfig().getProductId(),
              'publicationId': deps.pageConfig().getPublicationId(),
            },
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
          parseUrl(LINK_CONFIRM_IFRAME_URL).origin,
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
    this.callbacks_.triggerLinkComplete(Promise.resolve());
    this.callbacks_.resetLinkProgress();
    this.entitlementsManager_.setToastShown(true);
    this.entitlementsManager_.reset(response && response['success'] || false);
    this.completeResolver_();
  }

  /** @return {!Promise} */
  whenComplete() {
    return this.completePromise_;
  }
}
