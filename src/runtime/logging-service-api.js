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
import {feArgs, feUrl} from './services';


export class LoggingServiceApi {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

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
        feUrl('/serviceiframe'),
        feArgs({
          publicationId: deps.pageConfig().getPublicationId(),
          productId: deps.pageConfig().getProductId(),
          // No user consent necessary. This is a hidden iframe.
          userConsent: false,
          // TODO(sohanirao): send analytics context here
        }),
        /* shouldFadeBody */ false
    );
  }

  /**
   * @return {!Promise}
   */
  start() {
    this.activityIframeView_.acceptResult().then(() => {
      // Iframe is closed
      this.dialogManager_.completeView(this.activityIframeView_);
    }, reason => {
      // Some error occured
      this.dialogManager_.completeView(this.activityIframeView_);
      throw reason;
    });

    return this.dialogManager_.openView(
        this.activityIframeView_,
        /* hidden */ true
      );
  }
}
