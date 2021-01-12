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
import {AnalyticsEvent} from '../proto/api_messages';
import {SubscriptionFlows} from '../api/subscriptions';
import {
  ToastCloseRequest,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {feUrl} from './services';
import {setImportantStyles, setStyle} from '../utils/style';
import {warn} from '../utils/log';

const IFRAME_BOX_SHADOW =
  'rgba(60, 64, 67, .3) 0 -2px 5px, rgba(60, 64, 67, .15) 0 -5px 5px';
const MINIMIZED_IFRAME_SIZE = '420px';

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

    const iframeArgs = this.activityPorts_.addDefaultArguments({
      isClosable: true,
      hasSubscriptionCallback: deps.callbacks().hasSubscribeRequestCallback(),
    });
    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/metertoastiframe'),
      iframeArgs,
      /* shouldFadeBody */ false
    );

    /**
     * Function this class calls when a user dismisses the toast to consume a free read.
     * @private {?function()}
     */
    this.onConsumeCallback_ = null;

    /** @private @const {!function()} */
    this.sendCloseRequestFunction_ = () => {
      this.deps_
        .eventManager()
        .logSwgEvent(
          AnalyticsEvent.ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION,
          true
        );
      const closeRequest = new ToastCloseRequest();
      closeRequest.setClose(true);
      this.activityIframeView_.execute(closeRequest);
      this.removeCloseEventListener();

      if (this.onConsumeCallback_) {
        this.onConsumeCallback_();
      }
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
    if (!this.deps_.callbacks().hasSubscribeRequestCallback()) {
      const errorMessage =
        '[swg.js]: `setOnNativeSubscribeRequest` has not been ' +
        'set before starting the metering flow, so users will not be able to ' +
        'subscribe from the metering dialog directly. Please call ' +
        '`setOnNativeSubscribeRequest` with a subscription flow callback before ' +
        'starting metering.';
      warn(errorMessage);
    }
    this.dialogManager_.callWhenCompleteAndHandleError(
      this.activityIframeView_
    );
    return this.dialogManager_.openDialog().then((dialog) => {
      this.setDialogBoxShadow_();
      this.setLoadingViewWidth_();
      return dialog.openView(this.activityIframeView_).then(() => {
        // Allow closing of the iframe with any scroll or click event.
        this.win_.addEventListener('click', this.sendCloseRequestFunction_);
        this.win_.addEventListener(
          'touchstart',
          this.sendCloseRequestFunction_
        );
        this.win_.addEventListener('mousedown', this.sendCloseRequestFunction_);
        this.win_.addEventListener('wheel', this.sendCloseRequestFunction_);
        // Making body's overflow property 'hidden' to prevent scrolling
        // while swiping on the iframe.
        const $body = this.win_.document.body;
        setStyle($body, 'overflow', 'hidden');
        this.deps_
          .eventManager()
          .logSwgEvent(AnalyticsEvent.IMPRESSION_METER_TOAST);
        this.deps_
          .eventManager()
          .logSwgEvent(AnalyticsEvent.EVENT_OFFERED_METER);
      });
    });
  }

  /**
   * Sets a callback function this class calls when a user dismisses the toast to consume a free read.
   * @param {function()} onConsumeCallback
   */
  setOnConsumeCallback(onConsumeCallback) {
    this.onConsumeCallback_ = onConsumeCallback;
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
    const element = this.dialogManager_.getDialog().getElement();
    if (mq.matches) {
      setImportantStyles(element, {'box-shadow': IFRAME_BOX_SHADOW});
    }
    mq.addListener((changed) => {
      if (changed.matches) {
        setImportantStyles(element, {'box-shadow': IFRAME_BOX_SHADOW});
      } else {
        setImportantStyles(element, {'box-shadow': ''});
      }
    });
  }

  /**
   * Changes the size of the loading iframe on desktop to match the size of
   * the meter toast iframe.
   */
  setLoadingViewWidth_() {
    const mq = this.win_.matchMedia(
      '(min-width: 640px) and (min-height: 640px)'
    );
    const element = this.dialogManager_
      .getDialog()
      .getLoadingView()
      .getElement();
    if (mq.matches) {
      setImportantStyles(element, {
        'width': MINIMIZED_IFRAME_SIZE,
        'margin': 'auto',
      });
    }
  }

  /**
   * @param {ViewSubscriptionsResponse} response
   * @private
   */
  startNativeFlow_(response) {
    if (response.getNative()) {
      this.removeCloseEventListener();
      this.deps_.callbacks().triggerSubscribeRequest();
    }
  }
}
