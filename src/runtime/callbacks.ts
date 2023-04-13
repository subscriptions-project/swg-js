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
import {Entitlements} from '../api/entitlements';
import {LoginRequest} from '../api/subscriptions';
import {SubscribeResponse} from '../api/subscribe-response';
import {isCancelError} from '../utils/errors';
import {warn} from '../utils/log';

enum CallbackId {
  ENTITLEMENTS = 1,
  SUBSCRIBE_REQUEST = 2,
  PAYMENT_RESPONSE = 3,
  LOGIN_REQUEST = 4,
  LINK_PROGRESS = 5,
  LINK_COMPLETE = 6,
  FLOW_STARTED = 7,
  FLOW_CANCELED = 8,
  PAY_CONFIRM_OPENED = 9,
  OFFERS_FLOW_REQUEST = 10,
}

type Callback = (data: unknown) => void;

export class Callbacks {
  private readonly callbacks_: {
    [key in CallbackId]?: Callback;
  } = {};
  resultBuffer_: {
    [key in CallbackId]?: unknown;
  } = {};
  paymentResponsePromise_: Promise<void> | null = null;

  setOnEntitlementsResponse(
    callback: (entitlementsPromise: Promise<Entitlements>) => void
  ): void {
    this.setCallback_(CallbackId.ENTITLEMENTS, callback as Callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerEntitlementsResponse(promise: Promise<Entitlements>): boolean {
    return this.trigger_(
      CallbackId.ENTITLEMENTS,
      promise.then((res) => res.clone())
    );
  }

  hasEntitlementsResponsePending(): boolean {
    return !!this.resultBuffer_[CallbackId.ENTITLEMENTS];
  }

  setOnLoginRequest(callback: (request: LoginRequest) => void): void {
    this.setCallback_(CallbackId.LOGIN_REQUEST, callback as Callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerLoginRequest(request: LoginRequest): boolean {
    return this.trigger_(CallbackId.LOGIN_REQUEST, request);
  }

  setOnLinkProgress(callback: () => void): void {
    this.setCallback_(CallbackId.LINK_PROGRESS, callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerLinkProgress(): boolean {
    return this.trigger_(CallbackId.LINK_PROGRESS, true);
  }

  resetLinkProgress(): void {
    this.resetCallback_(CallbackId.LINK_PROGRESS);
  }

  setOnLinkComplete(callback: () => void): void {
    this.setCallback_(CallbackId.LINK_COMPLETE, callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerLinkComplete(): boolean {
    return this.trigger_(CallbackId.LINK_COMPLETE, true);
  }

  hasLinkCompletePending(): boolean {
    return !!this.resultBuffer_[CallbackId.LINK_COMPLETE];
  }

  setOnPayConfirmOpened(
    callback: (activityIframeView: ActivityIframeView) => void
  ): void {
    this.setCallback_(CallbackId.PAY_CONFIRM_OPENED, callback as Callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerPayConfirmOpened(activityIframeView: ActivityIframeView): boolean {
    return this.trigger_(CallbackId.PAY_CONFIRM_OPENED, activityIframeView);
  }

  setOnSubscribeRequest(callback: () => void): void {
    this.setCallback_(CallbackId.SUBSCRIBE_REQUEST, callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerSubscribeRequest(): boolean {
    return this.trigger_(CallbackId.SUBSCRIBE_REQUEST, true);
  }

  hasSubscribeRequestCallback(): boolean {
    return !!this.callbacks_[CallbackId.SUBSCRIBE_REQUEST];
  }

  setOnOffersFlowRequest(callback: () => void): void {
    this.setCallback_(CallbackId.OFFERS_FLOW_REQUEST, callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerOffersFlowRequest(): boolean {
    return this.trigger_(CallbackId.OFFERS_FLOW_REQUEST, true);
  }

  hasOffersFlowRequestCallback(): boolean {
    return !!this.callbacks_[CallbackId.OFFERS_FLOW_REQUEST];
  }

  setOnSubscribeResponse(
    callback: (responsePromise: Promise<SubscribeResponse>) => void
  ): void {
    warn(
      `[swg.js:setOnSubscribeResponse]: This method has been deprecated, please switch usages to 'setOnPaymentResponse'`
    );
    this.setCallback_(CallbackId.PAYMENT_RESPONSE, callback as Callback);
  }

  setOnContributionResponse(
    callback: (responsePromise: Promise<SubscribeResponse>) => void
  ): void {
    warn(
      `[swg.js:setOnContributionResponse]: This method has been deprecated, please switch usages to 'setOnPaymentResponse'`
    );
    this.setCallback_(CallbackId.PAYMENT_RESPONSE, callback as Callback);
  }

  setOnPaymentResponse(
    callback: (responsePromise: Promise<SubscribeResponse>) => void
  ): void {
    this.setCallback_(CallbackId.PAYMENT_RESPONSE, callback as Callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerPaymentResponse(responsePromise: Promise<SubscribeResponse>): boolean {
    this.paymentResponsePromise_ = responsePromise.then(
      (res) => {
        this.trigger_(
          CallbackId.PAYMENT_RESPONSE,
          Promise.resolve(res.clone())
        );
      },
      (reason) => {
        if (isCancelError(reason)) {
          return;
        }
        throw reason;
      }
    );
    return !!this.callbacks_[CallbackId.PAYMENT_RESPONSE];
  }

  hasPaymentResponsePending(): boolean {
    return !!this.resultBuffer_[CallbackId.PAYMENT_RESPONSE];
  }

  setOnFlowStarted(
    callback: ({flow, data}: {flow: string; data: object}) => void
  ): void {
    this.setCallback_(CallbackId.FLOW_STARTED, callback as Callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerFlowStarted(flow: string, data = {}): boolean {
    return this.trigger_(CallbackId.FLOW_STARTED, {
      flow,
      data,
    });
  }

  setOnFlowCanceled(
    callback: (params: {flow: string; data: object}) => void
  ): void {
    this.setCallback_(CallbackId.FLOW_CANCELED, callback as Callback);
  }

  /**
   * @return Whether the callback has been found.
   */
  triggerFlowCanceled(flow: string, data = {}): boolean {
    return this.trigger_(CallbackId.FLOW_CANCELED, {
      flow,
      data,
    });
  }

  private setCallback_(id: CallbackId, callback: Callback): void {
    if (this.callbacks_[id]) {
      warn(
        `[swg.js]: You have registered multiple callbacks for the same response.`
      );
    }
    this.callbacks_[id] = callback;
    // If result already exist, execute the callback right away.
    if (id in this.resultBuffer_) {
      this.executeCallback_(id, callback, this.resultBuffer_[id]);
    }
  }

  private trigger_(id: CallbackId, data: unknown): boolean {
    this.resultBuffer_[id] = data;
    const callback = this.callbacks_[id];
    if (callback) {
      this.executeCallback_(id, callback, data);
    }
    return !!callback;
  }

  private resetCallback_(id: CallbackId): void {
    if (id in this.resultBuffer_) {
      delete this.resultBuffer_[id];
    }
  }

  private async executeCallback_(
    id: CallbackId,
    callback: Callback,
    data: unknown
  ): Promise<void> {
    // Always execute callbacks in a microtask.
    await 0;

    callback(data);
    this.resetCallback_(id);
  }
}
