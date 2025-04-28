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
  LinkSubscriptionsRequest,
  LinkSubscriptionsResult,
  SubscriptionLinkResult,
} from '../api/subscriptions';
import {PageConfig} from '../model/page-config';
import {SubscriptionLinkingCompleteResponse} from '../proto/api_messages';
import {feArgs, feUrl} from './services';

export class SubscriptionLinkingFlow {
  private readonly activityPorts_: ActivityPorts;
  private readonly win_: Window;
  private readonly pageConfig_: PageConfig;
  private readonly dialogManager_: DialogManager;
  private completionResolver_: (result: LinkSubscriptionsResult) => void =
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
  async startMultipleLinks(
    request: LinkSubscriptionsRequest
  ): Promise<LinkSubscriptionsResult> {
    const {linkTo} = request;
    if (!linkTo || linkTo.length === 0) {
      throw new Error('Missing required field: linkTo');
    }
    const publicationId = this.pageConfig_.getPublicationId();
    const linkToStr = linkTo
      .map((link) =>
        encodeURIComponent(`${link.publicationId},${link.publisherProvidedId}`)
      )
      .join('&linkTo=');
    const args = feArgs({
      publicationId,
    });
    const url =
      feUrl('/linksaveiframe', {
        subscriptionLinking: 'true',
      }) + `&linkTo=${linkToStr}`;
    const activityIframeView = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      url,
      args,
      /* shouldFadeBody= */ false
    );

    activityIframeView.onCancel(() => {
      const completionStatus = AnalyticsEvent.ACTION_SUBSCRIPTION_LINKING_CLOSE;

      this.deps_.eventManager().logSwgEvent(completionStatus, true);

      this.completionResolver_({
        anyFailure: true,
        anySuccess: false,
        links: linkTo.map((link) => {
          return {
            publicationId: link.publicationId,
            publisherProvidedId: link.publisherProvidedId,
            success: false,
          };
        }),
      });
    });

    activityIframeView.on(
      SubscriptionLinkingCompleteResponse,
      (response: SubscriptionLinkingCompleteResponse) => {
        const completionStatus = response.getSuccess()
          ? AnalyticsEvent.EVENT_SUBSCRIPTION_LINKING_SUCCESS
          : AnalyticsEvent.EVENT_SUBSCRIPTION_LINKING_FAILED;

        this.deps_.eventManager().logSwgEvent(completionStatus);
        const linkResults = response.getLinkResultsList() || [];
        this.completionResolver_({
          anyFailure: !response.getSuccess(),
          anySuccess:
            linkResults.filter((linkResult) => linkResult.getSuccess()).length >
              0 || false,
          links: linkResults.map((link) => {
            const val: SubscriptionLinkResult = {
              publicationId: link.getSwgPublicationId() || '',
              publisherProvidedId: link.getPublisherProvidedId() || '',
              success: link.getSuccess() || false,
            };
            return val;
          }),
        });
      }
    );

    const completionPromise = new Promise<LinkSubscriptionsResult>(
      (resolve) => {
        this.completionResolver_ = resolve;
      }
    );
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
    return this.startMultipleLinks({
      linkTo: [{publicationId, publisherProvidedId}],
    }).then((result) => {
      return {
        success: !result.anyFailure,
        publisherProvidedId: result.links[0].publisherProvidedId,
      };
    });
  }
}
