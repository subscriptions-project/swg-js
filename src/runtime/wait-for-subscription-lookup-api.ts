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
import {feArgs, feUrl} from './services';
import {DialogManager} from '../components/dialog-manager';

const NO_PROMISE_ERR = 'No account promise provided';

export class WaitForSubscriptionLookupApi {
  /** Visible for testing. */
  openViewPromise: Promise<void> | null = null;

  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly activityIframeView_: ActivityIframeView;

  constructor(
    deps: Deps,
    private readonly accountPromise_: Promise<unknown> | null
  ) {
    this.win_ = deps.win();

    this.activityPorts_ = deps.activities();

    this.dialogManager_ = deps.dialogManager();

    this.accountPromise_ ||= Promise.reject(NO_PROMISE_ERR);

    this.activityIframeView_ = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      feUrl('/waitforsubscriptionlookupiframe'),
      feArgs({
        publicationId: deps.pageConfig().getPublicationId(),
        productId: deps.pageConfig().getProductId(),
      }),
      /* shouldFadeBody */ true,
      /* hasLoadingIndicator */ true
    );
  }

  /**
   * Starts the Login Flow.
   */
  async start(): Promise<unknown> {
    this.openViewPromise = this.dialogManager_.openView(
      this.activityIframeView_
    );

    try {
      const account = await this.accountPromise_;
      // Account was found.
      this.dialogManager_.completeView(this.activityIframeView_);
      return account;
    } catch (reason) {
      this.dialogManager_.completeView(this.activityIframeView_);
      throw reason;
    }
  }
}
