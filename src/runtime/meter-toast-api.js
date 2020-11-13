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
import {setImportantStyles, setStyle} from '../utils/style';

const IFRAME_BOX_SHADOW =
  'rgba(60, 64, 67, .3) 0 -2px 5px, rgba(60, 64, 67, .15) 0 -5px 5px';

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

    /** @private @const {!function()} */
    this.sendCloseRequestFunction_ = () => {
      const closeRequest = new ToastCloseRequest();
      closeRequest.setClose(true);
      this.activityIframeView_.execute(closeRequest);
    };
  }

  /**
   * Shows the user the metering toast.
   * @return {!Promise}
   */
  start() {
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_METER_TOAST);
    this.activityIframeView_.on(
      ViewSubscriptionsResponse,
      this.startNativeFlow_.bind(this)
    );
    return this.dialogManager_.openView(this.activityIframeView_).then(() => {
      this.setDialogBoxShadow_();
      // Allow closing of the iframe with any scroll or click event.
      this.win_.addEventListener('click', this.sendCloseRequestFunction_);
      this.win_.addEventListener('touchstart', this.sendCloseRequestFunction_);
      this.win_.addEventListener('mousedown', this.sendCloseRequestFunction_);
      this.win_.addEventListener('wheel', this.sendCloseRequestFunction_);
      // Making body's overflow property 'hidden' to prevent scrolling
      // while swiping on the iframe.
      const $body = this.win_.document.body;
      setStyle($body, 'overflow', 'hidden');
    });
  }

  /**
   * Sets a callback function to happen onCancel.
   * @param {function()} onCancelCallback
   */
  setOnCancelCallback(onCancelCallback) {
    this.activityIframeView_.onCancel(onCancelCallback);
  }

  /**
   * Removes the event listeners that close the iframe and make the body visible.
   */
  removeCloseEventListener() {
    this.win_.removeEventListener('click', this.sendCloseRequestFunction_);
    this.win_.removeEventListener('touchstart', this.sendCloseRequestFunction_);
    this.win_.removeEventListener('mousedown', this.sendCloseRequestFunction_);
    this.win_.removeEventListener('wheel', this.sendCloseRequestFunction_);
    const $body = this.win_.document.body;
    setStyle($body, 'overflow', 'visible');
  }

  /**
   * Changes the iframe box shadow to match desired specifications on mobile.
   */
  setDialogBoxShadow_() {
    const mq = this.win_.matchMedia('(max-width: 640px), (max-height: 640px)');
    if (mq.matches) {
      const element = this.dialogManager_.getDialog().getElement();
      setImportantStyles(element, {'box-shadow': IFRAME_BOX_SHADOW});
    }
    mq.addListener((changed) => {
      const element = this.dialogManager_.getDialog().getElement();
      if (changed.matches) {
        setImportantStyles(element, {'box-shadow': IFRAME_BOX_SHADOW});
      } else {
        setImportantStyles(element, {'box-shadow': ''});
      }
    });
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
