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

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {SubscriptionFlows} from '../api/subscriptions';
import {
  ToastCloseRequest,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {feArgs, feUrl} from './services';

export class MeterToastApi {
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

    /** @private @const {!function()} */
    this.sendCloseRequestFunction_ = () => {
      const closeRequest = new ToastCloseRequest();
      closeRequest.setClose(true);
      this.activityIframeView_.execute(closeRequest);
    };

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/metertoastiframe'),
      feArgs({
        publicationId: deps.pageConfig().getPublicationId(),
        productId: deps.pageConfig().getProductId(),
        hasSubscriptionCallback: deps.callbacks().hasSubscribeRequestCallback(),
      }),
      /* shouldFadeBody */ false
    );
  }

  /**
   * Shows the user the metering toast.
   * @return {!Promise}
   */
  start() {
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_METER_TOAST);
    this.win_.addEventListener('click', this.sendCloseRequestFunction_);
    this.activityIframeView_.on(
      ViewSubscriptionsResponse,
      this.startNativeFlow_.bind(this)
    );
    return this.dialogManager_.openView(this.activityIframeView_);
  }

  /**
   * Sets a callback function to happen onCancel.
   * @param {function()} onCancelCallback
   */
  setOnCancelCallback(onCancelCallback) {
    this.activityIframeView_.onCancel(onCancelCallback);
  }

  /**
   * Removes the event listener that closes the iframe.
   */
  removeCloseEventListener() {
    this.win_.removeEventListener('click', this.sendCloseRequestFunction_);
  }

  /**
   * @param {ViewSubscriptionsResponse} response
   * @private
   */
  startNativeFlow_(response) {
    if (response.getNative()) {
      this.deps_.callbacks().triggerSubscribeRequest();
    }
  }
}
