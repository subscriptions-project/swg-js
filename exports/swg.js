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

import {ConfiguredRuntime} from '../src/runtime/runtime';
import {
  Entitlements,
  Entitlement,
} from '../src/api/entitlements';
import {Fetcher} from '../src/runtime/fetcher';
import {SubscribeResponse} from '../src/api/subscribe-response';
import {SwgClientEventManagerApi}
    from '../src/api/swg-client-event-manager-api';

module.exports = {
  ConfiguredRuntime,
  Entitlements,
  Entitlement,
  Fetcher,
  SubscribeResponse,
  SwgClientEventManagerApi,
};
