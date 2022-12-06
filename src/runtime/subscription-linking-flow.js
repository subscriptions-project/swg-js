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
import {SubscriptionLinkingCompleteResponse} from '../proto/api_messages';
import {feArgs, feUrl} from './services';

export class SubscriptionLinkingFlow {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = deps.pageConfig();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private {function(!../api/subscriptions.LinkSubscriptionResult): undefined} */
    this.completionResolver_ = () => {};
  }

  /**
   * Starts the subscription linking flow.
   * @param {!../api/subscriptions.LinkSubscriptionRequest} request
   * @return {!Promise<!../api/subscriptions.LinkSubscriptionResult>}
   */
  async start(request) {
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
        subscriptionLinking: true,
        ppid: publisherProvidedId,
      }),
      args,
      /* shouldFadeBody= */ true
    );
    activityIframeView.on(
      SubscriptionLinkingCompleteResponse,
      (/** @type {!SubscriptionLinkingCompleteResponse} */ response) => {
        this.completionResolver_({
          publisherProvidedId: response.getPublisherProvidedId(),
          success: response.getSuccess() ?? false,
        });
      }
    );

    const completionPromise = new Promise((resolve) => {
      this.completionResolver_ = resolve;
    });

    await this.dialogManager_.openView(
      activityIframeView,
      /* hidden= */ false,
      {
        desktopConfig: {isCenterPositioned: true},
      }
    );

    return completionPromise;
  }
}
