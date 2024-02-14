/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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
import {DialogManager} from '../components/dialog-manager';
import {
  LinkSubscriptionRequest,
  LinkSubscriptionResult,
} from '../api/subscriptions';
import {PageConfig} from '../model/page-config';
import {SubscriptionLinkingCompleteResponse} from '../proto/api_messages';
import {feArgs, feUrl} from './services';

export class SubscriptionLinkingFlow {
  private readonly activityPorts_: ActivityPorts;
  private readonly win_: Window;
  private readonly pageConfig_: PageConfig;
  private readonly dialogManager_: DialogManager;
  private completionResolver_: (result: LinkSubscriptionResult) => void =
    () => {};

  constructor(private readonly deps_: Deps) {
    this.activityPorts_ = deps_.activities();

    this.win_ = deps_.win();

    this.pageConfig_ = deps_.pageConfig();

    this.dialogManager_ = deps_.dialogManager();
  }

  /**
   * Starts the subscription linking flow.
   */
  async start(
    request: LinkSubscriptionRequest
  ): Promise<LinkSubscriptionResult> {
    const {publisherProvidedId} = request;
    if (!publisherProvidedId) {
      throw new Error('Missing required field: publisherProvidedId');
    }
    const publicationId = this.pageConfig_.getPublicationId();
    const args = feArgs({
      publicationId,
    });
    const activityIframeView = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/linksaveiframe', {
        subscriptionLinking: 'true',
        ppid: publisherProvidedId,
      }),
      args,
      /* shouldFadeBody= */ false
    );

    activityIframeView.onCancel(() => {
      const CompletionStatus = AnalyticsEvent.EVENT_SUBSCRIPTION_LINKING_FAILED;

      this.deps_.eventManager().logSwgEvent(CompletionStatus, true);

      this.completionResolver_({
        publisherProvidedId,
        success: false,
      });
    });

    activityIframeView.on(
      SubscriptionLinkingCompleteResponse,
      (response: SubscriptionLinkingCompleteResponse) => {
        const CompletionStatus = response.getSuccess()
          ? AnalyticsEvent.EVENT_SUBSCRIPTION_LINKING_SUCCESS
          : AnalyticsEvent.EVENT_SUBSCRIPTION_LINKING_FAILED;

        this.deps_.eventManager().logSwgEvent(CompletionStatus);

        this.completionResolver_({
          publisherProvidedId: response.getPublisherProvidedId(),
          success: response.getSuccess() ?? false,
        });
      }
    );

    const completionPromise = new Promise<LinkSubscriptionResult>((resolve) => {
      this.completionResolver_ = resolve;
    });
    try {
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.IMPRESSION_SUBSCRIPTION_LINKING_LOADING);

      await this.dialogManager_.openView(
        activityIframeView,
        /* hidden= */ false,
        {
          desktopConfig: {isCenterPositioned: false},
        }
      );

      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.IMPRESSION_SUBSCRIPTION_LINKING_COMPLETE);
      return completionPromise;
    } catch (e) {
      this.deps_
        .eventManager()
        .logSwgEvent(AnalyticsEvent.IMPRESSION_SUBSCRIPTION_LINKING_ERROR);
      throw e;
    }
  }
}
