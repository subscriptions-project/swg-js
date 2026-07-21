/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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
import {AddPreferredSourceResponse} from '../proto/api_messages';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {feArgs, feOrigin, feUrl} from './services';

export class AddPreferredSourceFlow {
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
      feUrl('/addpreferredsource'),
      feArgs({
        source: this.win_.location.href,
      }),
      /* titleLang */ this.deps_.clientConfigManager().getLanguage(),
      /* shouldFadeBody */ false
    );
  }

  /**
   * Starts the Add Preferred Source consent flow.
   */
  async start(): Promise<AddPreferredSourceResponse> {
    this.openViewPromise = this.dialogManager_.openView(
      this.activityIframeView_
    );

    let response: AddPreferredSourceResponse;
    try {
      response = (await this.activityIframeView_.acceptResultAndVerify(
        feOrigin(),
        /* requireOriginVerified */ true,
        /* requireSecureChannel */ true
      )) as AddPreferredSourceResponse;
    } catch (reason) {
      this.dialogManager_.completeView(this.activityIframeView_);
      throw reason;
    }

    this.dialogManager_.completeView(this.activityIframeView_);
    return response;
  }
}
