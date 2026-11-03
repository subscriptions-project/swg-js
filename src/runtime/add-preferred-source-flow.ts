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

import {AddPreferredSourceResponse} from '../proto/api_messages';
import {Deps} from './deps';
import {acceptPortResultData} from '../utils/activity-utils';
import {feArgs, feOrigin, feUrl} from './services';

export const ADD_PREFERRED_SOURCE_REQUEST_ID = 'addPreferredSource';

export interface AddPreferredSourceFlowOptions {
  language?: string;
}

export class AddPreferredSourceFlow {
  static configurePending(
    deps: Deps,
    onResponse: (response: AddPreferredSourceResponse) => void
  ): void {
    deps
      .activities()
      .onResult(ADD_PREFERRED_SOURCE_REQUEST_ID, async (port) => {
        try {
          const data = await acceptPortResultData(
            port,
            feOrigin(),
            /* requireOriginVerified */ true,
            /* requireSecureChannel */ false
          );
          if (Array.isArray(data)) {
            onResponse(new AddPreferredSourceResponse(data));
          }
        } catch {
          // Ignore canceled or unverified results.
        }
      });
  }

  constructor(
    private readonly deps_: Deps,
    private readonly options_?: AddPreferredSourceFlowOptions
  ) {}

  /**
   * Starts the Add Preferred Source consent flow in a popup or redirect window.
   */
  async start(): Promise<void> {
    const hl =
      this.options_?.language || this.deps_.clientConfigManager().getLanguage();
    const source = this.deps_.win().location.href;
    await this.deps_
      .activities()
      .openPopupWithMessaging(
        ADD_PREFERRED_SOURCE_REQUEST_ID,
        feUrl('/addpreferredsource', {hl, source}),
        '_blank',
        feArgs({source}),
        {}
      );
  }
}
