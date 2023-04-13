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
import {ActivityPorts} from '../components/activities';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {SubscriptionFlows} from '../api/subscriptions';
import {feArgs, feUrl} from './services';

export class LoginNotificationApi {
  /** Visible for testing. */
  openViewPromise: Promise<void> | null = null;

  private readonly activityIframeView_: ActivityIframeView;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly win_: Window;

  constructor(private readonly deps_: Deps) {
    this.win_ = deps_.win();

    this.activityPorts_ = deps_.activities();

    this.dialogManager_ = deps_.dialogManager();

    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/loginiframe'),
      feArgs({
        publicationId: deps_.pageConfig().getPublicationId(),
        productId: deps_.pageConfig().getProductId(),
        // No need to ask the user. Just tell them you're logging them in.
        userConsent: false,
      }),
      /* shouldFadeBody */ true
    );
  }

  /**
   * Continues the Login flow (after waiting).
   */
  async start(): Promise<void> {
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_LOGIN_NOTIFICATION);

    this.openViewPromise = this.dialogManager_.openView(
      this.activityIframeView_
    );

    try {
      await this.activityIframeView_.acceptResult();
    } catch (reason) {
      this.dialogManager_.completeView(this.activityIframeView_);
      throw reason;
    }

    this.dialogManager_.completeView(this.activityIframeView_);
  }
}
