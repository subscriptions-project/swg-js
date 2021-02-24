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

// The ClientConfigManager import is needed because it's referenced here, but
// not yet needed for SwG classic/imported by runtime.js (but that will soon
// change).
// TODO(stellachui): Remove this import once we start requiring a
//   ClientConfigManager in both runtimes.
// eslint-disable-next-line no-unused-vars
import {ClientConfigManager} from './client-config-manager';

/** @interface */
export class DepsDef {
  /**
   * @return {!../model/doc.Doc}
   */
  doc() {}

  /**
   * @return {!Window}
   */
  win() {}

  /**
   * @return {!../api/subscriptions.Config}
   */
  config() {}

  /**
   * @return {!../model/page-config.PageConfig}
   */
  pageConfig() {}

  /**
   * @return {!../components/activities.ActivityPorts}
   */
  activities() {}

  /**
   * @return {!./pay-client.PayClient}
   */
  payClient() {}

  /**
   * @return {!../components/dialog-manager.DialogManager}
   */
  dialogManager() {}

  /**
   * @return {!./entitlements-manager.EntitlementsManager}
   */
  entitlementsManager() {}

  /**
   * @return {!./callbacks.Callbacks}
   */
  callbacks() {}

  /**
   * @return {!../runtime/storage.Storage}
   */
  storage() {}

  /**
   * @return {!../runtime/analytics-service.AnalyticsService}
   */
  analytics() {}

  /**
   * @return {!../runtime/jserror.JsError}
   */
  jserror() {}

  /**
   * @return {!../runtime/client-event-manager.ClientEventManager}
   */
  eventManager() {}

  /**
   * @return {?../runtime/client-config-manager.ClientConfigManager}
   */
  clientConfigManager() {}
}
