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
import {ActivityPorts} from '../components/activities';
import {AnalyticsEvent} from '../proto/api_messages';
import {Deps} from './deps';
import {Dialog} from '../components/dialog';
import {DialogManager} from '../components/dialog-manager';
import {MeterClientTypes} from '../api/metering';
import {SubscriptionFlows} from '../api/subscriptions';
import {
  ToastCloseRequest,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {feUrl} from './services';
import {isCancelError} from '../utils/errors';
import {parseUrl} from '../utils/url';
import {setImportantStyles, setStyle} from '../utils/style';
import {warn} from '../utils/log';

export const IFRAME_BOX_SHADOW =
  'rgba(60, 64, 67, 0.3) 0px -2px 5px, rgba(60, 64, 67, 0.15) 0px -5px 5px';
export const MINIMIZED_IFRAME_SIZE = '420px';
export const DEFAULT_IFRAME_URL = '/metertoastiframe';
export const ANONYMOUS_USER_ATTRIBUTE = 'anonymous_user';

/**
 * The iframe URLs to be used per MeterClientType
 */
export const IframeUrlByMeterClientType: {[key in MeterClientTypes]: string} = {
  [MeterClientTypes.LICENSED_BY_GOOGLE]: '/metertoastiframe',
  [MeterClientTypes.METERED_BY_GOOGLE]: '/meteriframe',
};

enum MeterType {
  UNKNOWN = 'UNKNOWN',
  KNOWN = 'KNOWN',
}

export interface MeterToastApiParams {
  meterClientType?: MeterClientTypes;
  meterClientUserAttribute?: string;
}

export class MeterToastApi {
  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly meterClientType_: MeterClientTypes;
  private readonly meterClientUserAttribute_: string;
  /**
   * Function this class calls when a user dismisses the toast to consume a
   * free read.
   */
  private onConsumeCallback_: (() => void) | null = null;
  /**
   * Boolean indicating whether or not the onConsumeCallback_ has been handled
   * (either called or ignored). This is used to protect against unexpected
   * cancellations not consuming a meter.
   */
  private onConsumeCallbackHandled_ = false;
  private scrollEventListener_: (() => void) | null = null;
  private sendCloseRequestFunction_ = () => {};

  constructor(
    private readonly deps_: Deps,
    {
      meterClientType = MeterClientTypes.LICENSED_BY_GOOGLE,
      meterClientUserAttribute = ANONYMOUS_USER_ATTRIBUTE,
    }: MeterToastApiParams = {}
  ) {
    this.win_ = deps_.win();

    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();

    this.meterClientType_ = meterClientType;

    this.meterClientUserAttribute_ = meterClientUserAttribute;
  }

  /**
   * Shows the user the metering toast.
   */
  async start(): Promise<void> {
    const additionalArguments = {
      isClosable: true,
      hasSubscriptionCallback: this.deps_
        .callbacks()
        .hasSubscribeRequestCallback(),
    } as {
      isClosable: boolean;
      hasSubscriptionCallback: boolean;
      meterType?: MeterType;
    };
    if (this.meterClientType_ === MeterClientTypes.METERED_BY_GOOGLE) {
      additionalArguments['meterType'] =
        this.meterClientUserAttribute_ === ANONYMOUS_USER_ATTRIBUTE
          ? MeterType.UNKNOWN
          : MeterType.KNOWN;
    }
    const iframeArgs =
      this.activityPorts_.addDefaultArguments(additionalArguments);

    const iframeUrl =
      IframeUrlByMeterClientType[
        this.meterClientType_ ?? MeterClientTypes.LICENSED_BY_GOOGLE
      ];

    const iframeUrlParams = {
      'origin': parseUrl(this.win_.location.href).origin,
    } as {
      origin: string;
      hl?: string;
    };

    if (this.deps_.clientConfigManager().shouldForceLangInIframes()) {
      iframeUrlParams['hl'] = this.deps_.clientConfigManager().getLanguage();
    }

    const activityIframeView = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl(iframeUrl, iframeUrlParams),
      iframeArgs,
      /* shouldFadeBody */ false
    );

    this.sendCloseRequestFunction_ = () => {
      const closeRequest = new ToastCloseRequest();
      closeRequest.setClose(true);
      activityIframeView.execute(closeRequest);
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

    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_METER_TOAST);
    activityIframeView.on(
      ViewSubscriptionsResponse,
      this.startSubscriptionFlow_.bind(this)
    );
    if (
      !this.deps_.callbacks().hasSubscribeRequestCallback() &&
      !this.deps_.callbacks().hasOffersFlowRequestCallback()
    ) {
      const errorMessage =
        '[swg.js]: `setOnNativeSubscribeRequest` has not been set ' +
        'before starting the metering flow, so users will not be able to ' +
        'subscribe from the metering dialog directly. Please call ' +
        '`setOnNativeSubscribeRequest` with a subscription flow callback ' +
        'before starting metering.';
      warn(errorMessage);
    }

    this.dialogManager_
      .handleCancellations(activityIframeView)
      .catch((reason) => {
        // Possibly call onConsumeCallback on all dialog cancellations to
        // ensure unexpected dialog closures don't give access without a
        // meter consumed.
        if (this.onConsumeCallback_ && !this.onConsumeCallbackHandled_) {
          this.onConsumeCallbackHandled_ = true;
          this.onConsumeCallback_();
        }
        // Don't throw on cancel errors since they happen when a user closes
        // the toast, which is expected.
        if (!isCancelError(reason)) {
          // eslint-disable-next-line no-console
          console /*OK*/
            .error(
              '[swg.js]: Error occurred during meter toast handling: ' + reason
            );
          throw reason;
        }
      });

    const dialog = await this.dialogManager_.openDialog();

    this.setDialogBoxShadow_(dialog);
    this.setLoadingViewWidth_(dialog);

    await dialog.openView(activityIframeView);

    // Allow closing of the iframe with any scroll or click event.
    this.win_.addEventListener('click', this.sendCloseRequestFunction_);
    this.win_.addEventListener('touchstart', this.sendCloseRequestFunction_);
    this.win_.addEventListener('mousedown', this.sendCloseRequestFunction_);
    // Making body's overflow property 'hidden' to prevent scrolling
    // while swiping on the iframe only on mobile.
    if (this.isMobile_()) {
      const $body = this.win_.document.body;
      setStyle($body, 'overflow', 'hidden');
    } else {
      let start: number;
      let scrollTimeout: number;
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
    this.deps_.eventManager().logSwgEvent(AnalyticsEvent.EVENT_OFFERED_METER);
  }

  /**
   * Sets a callback function this class calls when a user dismisses the toast to consume a free read.
   */
  setOnConsumeCallback(onConsumeCallback: () => void): void {
    this.onConsumeCallback_ = onConsumeCallback;
  }

  /**
   * Removes the event listeners that close the iframe and make the body visible.
   */
  removeCloseEventListener(): void {
    this.win_.removeEventListener('click', this.sendCloseRequestFunction_);
    this.win_.removeEventListener('touchstart', this.sendCloseRequestFunction_);
    this.win_.removeEventListener('mousedown', this.sendCloseRequestFunction_);
    if (this.isMobile_()) {
      const $body = this.win_.document.body;
      setStyle($body, 'overflow', 'visible');
    } else if (this.scrollEventListener_) {
      this.win_.removeEventListener('scroll', this.scrollEventListener_);
    }
  }

  /**
   * Changes the iframe box shadow to match desired specifications on mobile.
   */
  private setDialogBoxShadow_(dialog: Dialog): void {
    const mobileMediaQuery = this.win_.matchMedia(
      '(max-width: 640px), (max-height: 640px)'
    );
    const element = dialog.getElement();
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
  private setLoadingViewWidth_(dialog: Dialog): void {
    const desktopMediaQuery = this.win_.matchMedia(
      '(min-width: 640px) and (min-height: 640px)'
    );
    if (desktopMediaQuery.matches) {
      const element = dialog.getLoadingView()!.getElement();
      setImportantStyles(element, {
        'width': MINIMIZED_IFRAME_SIZE,
        'margin': 'auto',
      });
    }
  }

  private startSubscriptionFlow_(response: ViewSubscriptionsResponse): void {
    this.removeCloseEventListener();
    // We shouldn't decrement the meter on redirects, so don't call onConsumeCallback.
    this.onConsumeCallbackHandled_ = true;
    if (response.getNative()) {
      this.deps_.callbacks().triggerSubscribeRequest();
    } else {
      this.deps_.callbacks().triggerOffersFlowRequest();
    }
  }

  /**
   * Returns true if the window userAgent is a mobile platform.
   */
  private isMobile_(): boolean {
    return !!this.win_.navigator.userAgent.match(
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile/i
    );
  }
}
