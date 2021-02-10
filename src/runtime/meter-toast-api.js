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
import {isCancelError} from '../utils/errors';
import {setImportantStyles, setStyle} from '../utils/style';
import {warn} from '../utils/log';

export const IFRAME_BOX_SHADOW =
  'rgba(60, 64, 67, 0.3) 0px -2px 5px, rgba(60, 64, 67, 0.15) 0px -5px 5px';
export const MINIMIZED_IFRAME_SIZE = '420px';

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

    /**
     * Boolean indicating whether or not the onConsumeCallback_ has been handled
     * (either called or ignored). This is used to protect against unexpected
     * cancellations not consuming a meter.
     * @private {!boolean}
     */
    this.onConsumeCallbackHandled_ = false;

    /** @private @const {!function()} */
    this.sendCloseRequestFunction_ = () => {
      const closeRequest = new ToastCloseRequest();
      closeRequest.setClose(true);
      this.activityIframeView_.execute(closeRequest);
      this.removeCloseEventListener();

      this.deps_
        .eventManager()
        .logSwgEvent(
          AnalyticsEvent.ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION,
          true
        );

      if (this.onConsumeCallback_ && !this.onConsumeCallbackHandled_) {
        this.onConsumeCallbackHandled_ = true;
        this.onConsumeCallback_();
      }
    };

    /** @private {?function()} */
    this.scrollEventListener_ = null;
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

    this.dialogManager_
      .handleCancellations(this.activityIframeView_)
      .catch((reason) => {
        // Possibly call onConsumeCallback on all dialog cancellations to ensure unexpected
        // dialog closures don't give access without a meter consumed.
        if (this.onConsumeCallback_ && !this.onConsumeCallbackHandled_) {
          this.onConsumeCallbackHandled_ = true;
          this.onConsumeCallback_();
        }
        // Don't throw on cancel errors since they happen when a user closes the toast,
        // which is expected.
        if (!isCancelError(reason)){
          throw reason;
        }
      });
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
        // Making body's overflow property 'hidden' to prevent scrolling
        // while swiping on the iframe only on mobile.
        if (this.isMobile_()) {
          const $body = this.win_.document.body;
          setStyle($body, 'overflow', 'hidden');
        } else {
          let start, scrollTimeout;
          this.scrollEventListener_ = () => {
            start = start || this.win_./*REVIEW*/ pageYOffset;
            this.win_.clearTimeout(scrollTimeout);
            scrollTimeout = this.win_.setTimeout(() => {
              // If the scroll is longer than 100, close the toast.
              if (Math.abs(this.win_./*REVIEW*/ pageYOffset - start) > 100) {
                this.sendCloseRequestFunction_();
              }
            }, 100);
          };
          this.win_.addEventListener('scroll', this.scrollEventListener_);
        }
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
    if (this.isMobile_()) {
      const $body = this.win_.document.body;
      setStyle($body, 'overflow', 'visible');
    } else {
      this.win_.removeEventListener('scroll', this.scrollEventListener_);
    }
  }

  /**
   * Changes the iframe box shadow to match desired specifications on mobile.
   */
  setDialogBoxShadow_() {
    const mobileMediaQuery = this.win_.matchMedia(
      '(max-width: 640px), (max-height: 640px)'
    );
    const element = this.dialogManager_.getDialog().getElement();
    if (mobileMediaQuery.matches) {
      setImportantStyles(element, {'box-shadow': IFRAME_BOX_SHADOW});
    }
    mobileMediaQuery.addListener((changed) => {
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
    const desktopMediaQuery = this.win_.matchMedia(
      '(min-width: 640px) and (min-height: 640px)'
    );
    if (desktopMediaQuery.matches) {
      const element = this.dialogManager_
        .getDialog()
        .getLoadingView()
        .getElement();
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
      // We shouldn't decrement the meter on redirects, so don't call onConsumeCallback.
      this.onConsumeCallbackHandled_ = true;
      this.deps_.callbacks().triggerSubscribeRequest();
    }
  }

  /**
   * Returns true if the window userAgent is a mobile platform.
   * @private
   */
  isMobile_() {
    return !!this.win_.navigator.userAgent.match(
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile/i
    );
  }
}
