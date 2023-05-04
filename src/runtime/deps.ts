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

import {ActivityPorts} from '../components/activities';
import {AnalyticsService} from './analytics-service';
import {Callbacks} from './callbacks';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Config} from '../api/subscriptions';
import {DialogManager} from '../components/dialog-manager';
import {Doc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {JsError} from './jserror';
import {PageConfig} from '../model/page-config';
import {PayClient} from './pay-client';
import {Storage} from './storage';

export interface Deps {
  doc(): Doc;

  win(): Window;

  config(): Config;

  pageConfig(): PageConfig;

  activities(): ActivityPorts;

  payClient(): PayClient;

  dialogManager(): DialogManager;

  entitlementsManager(): EntitlementsManager;

  callbacks(): Callbacks;

  storage(): Storage;

  analytics(): AnalyticsService;

  jserror(): JsError;

  eventManager(): ClientEventManager;

  clientConfigManager(): ClientConfigManager;

  creationTimestamp(): number;
}
