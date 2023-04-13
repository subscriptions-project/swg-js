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
import {isCancelError} from '../utils/errors';

export class LoginPromptApi {
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
        // First ask the user if they want us to log them in.
        userConsent: true,
      }),
      /* shouldFadeBody */ true
    );
  }

  /**
   * Prompts the user to login.
   */
  async start(): Promise<void> {
    this.deps_
      .callbacks()
      .triggerFlowStarted(SubscriptionFlows.SHOW_LOGIN_PROMPT);

    this.openViewPromise = this.dialogManager_.openView(
      this.activityIframeView_
    );

    try {
      await this.activityIframeView_.acceptResult();
    } catch (reason) {
      if (isCancelError(reason as Error)) {
        this.deps_
          .callbacks()
          .triggerFlowCanceled(SubscriptionFlows.SHOW_LOGIN_PROMPT);
      } else {
        this.dialogManager_.completeView(this.activityIframeView_);
      }
      throw reason;
    }

    this.dialogManager_.completeView(this.activityIframeView_);
  }
}
