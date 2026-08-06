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

import {ActivityPorts} from '../components/activities';
import {AddPreferredSourceResponse} from '../proto/api_messages';
import {Deps} from './deps';
import {acceptPortResultData} from '../utils/activity-utils';
import {feArgs, feOrigin, feUrl} from './services';

export const ADD_PREFERRED_SOURCE_REQUEST_ID = 'addPreferredSource';

export class AddPreferredSourceFlow {
  private readonly activityPorts_: ActivityPorts;
  private readonly win_: Window;

  constructor(private readonly deps_: Deps) {
    this.win_ = deps_.win();
    this.activityPorts_ = deps_.activities();
  }

  /**
   * Starts the Add Preferred Source consent flow in a popup window.
   */
  start(): Promise<AddPreferredSourceResponse> {
    return new Promise((resolve, reject) => {
      this.activityPorts_.onResult(ADD_PREFERRED_SOURCE_REQUEST_ID, (port) => {
        acceptPortResultData(
          port,
          feOrigin(),
          /* requireOriginVerified */ true,
          /* requireSecureChannel */ true
        )
          .then((data) => {
            resolve(new AddPreferredSourceResponse(data as unknown[]));
          })
          .catch(reject);
      });

      const queryParams: {[key: string]: string} = {
        hl: this.deps_.clientConfigManager().getLanguage(),
        source: this.win_.location.href,
      };
      this.activityPorts_.open(
        ADD_PREFERRED_SOURCE_REQUEST_ID,
        feUrl('/addpreferredsource', queryParams),
        '_blank',
        feArgs({
          source: this.win_.location.href,
        }),
        {}
      );
    });
  }
}
