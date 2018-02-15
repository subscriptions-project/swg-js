/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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
import {getHostUrl} from '../utils/url';

const LINK_FRONT_IFRAME_URL =
    '$frontend$/swglib/linkfrontiframe$frontendDebug$';

const LINK_CONFIRM_IFRAME_URL =
    '$frontend$/swglib/linkconfirmiframe$frontendDebug$';

const COMPLETE_LINK_REQUEST_ID = 'swg-link-continue';


/**
 * The flow to initiate linking process.
 */
export class LinkStartFlow {

  /**
   * @param {!../model/deps.DepsDef} deps
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
          'publisherId': deps.pageConfig().getPublisherId(),
          'publicationId': deps.pageConfig().getPublisherId(),  // MIGRATE
          'requestId': COMPLETE_LINK_REQUEST_ID,
          'returnUrl': getHostUrl(this.win_.location.href),
        },
        /* shouldFadeBody */ true,
        /* showCloseAction */ false
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
   * Opens the publisher's login page.
   * @param {!Object} resp
   * @private
   */
  openLoginForm_(resp) {
    const redirectUrl = resp['redirectUrl'];
    this.activityPorts_.open(
        COMPLETE_LINK_REQUEST_ID, redirectUrl, '_blank', null, {
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
 * The class for Link accounts flow.
 */
export class LinkCompleteFlow {

  /**
   * @param {!../model/deps.DepsDef} deps
   */
  static configurePending(deps) {
    deps.activities().onResult(COMPLETE_LINK_REQUEST_ID, port => {
      return port.acceptResult().then(result => {
        if (result.ok) {
          const flow = new LinkCompleteFlow(deps);
          flow.start();
        }
      });
    });
  }

  /**
   * @param {!../model/deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!../runtime/callbacks.Callbacks} */
    this.callbacks_ = deps.callbacks();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ =
        new ActivityIframeView(
            this.win_,
            this.activityPorts_,
            LINK_CONFIRM_IFRAME_URL,
            {
              'publisherId': deps.pageConfig().getPublisherId(),
              'publicationId': deps.pageConfig().getPublisherId(),  // MIGRATE
            },
            /* shouldFadeBody */ true,
            /* showCloseAction */ false
        );
  }

  /**
   * Starts the Link account flow.
   * @return {!Promise}
   */
  start() {
    this.callbacks_.triggerLinkComplete(Promise.resolve());
    this.activityIframeView_.acceptResult().then(() => {
      // The flow is complete.
      this.dialogManager_.completeView(this.activityIframeView_);
    });
    return this.dialogManager_.openView(this.activityIframeView_);
  }
}
