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

export class MeterRegwallApi {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {string} gsiHelperIframe
   * @param {string} alreadyRegisteredLink
   * TODO(chenshay): Figure out the gsi type.
   */
  constructor(deps, gsiHelperIframe, alreadyRegisteredLink) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/meterregwalliframe'),
      feArgs({
        publicationId: deps.pageConfig().getPublicationId(),
        productId: deps.pageConfig().getProductId(),
        gsiHelperIframe,
        alreadyRegisteredLink,
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
    return this.dialogManager_.openView(this.activityIframeView_);
  }
}
