/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

//need to pass in a login url and a publisher gsi frame url
//from swg.js to boq dialog which will in turn lauch the iframe.
//Login url is so dialog can display an "already subscribed" link (or do we have that in swg config already?)
import {ActivityIframeView} from '../ui/activity-iframe-view';
import {SubscriptionFlows} from '../api/subscriptions';
import {feArgs, feUrl} from './services';
import {isCancelError} from '../utils/errors';

export class MeterRegwallApi {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private {?Promise} */
    this.openViewPromise_ = null;

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/meterregwalliframe'),
      feArgs({
        publicationId: deps.pageConfig().getPublicationId(),
        productId: deps.pageConfig().getProductId(),
        // First ask the user if they want us to log them in.
        userConsent: true,
      }),
      /* shouldFadeBody */ true
    );
  }

  /**
   * Prompts the user to register to the meter.
   * @return {!Promise}
   */
  start() {
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_METER_REGWALL);

    this.openViewPromise_ = this.dialogManager_.openView(
      this.activityIframeView_
    );

    return this.activityIframeView_.acceptResult().then(
      () => {
        // The consent part is complete.
        this.dialogManager_.completeView(this.activityIframeView_);
      },
      (reason) => {
        if (isCancelError(reason)) {
          this.deps_
            .callbacks()
            .triggerFlowCanceled(SubscriptionFlows.SHOW_METER_REGWALL);
        } else {
          this.dialogManager_.completeView(this.activityIframeView_);
        }
        throw reason;
      }
    );
  }
}
