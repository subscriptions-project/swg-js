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
import {AddPreferredSourceButtonIframe} from '../ui/add-preferred-source-button-iframe';
import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {AddPreferredSourceStatus} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {ClientEventManager} from './client-event-manager';
import {Config} from '../api/subscriptions';
import {DIALOG_CSS} from '../ui/ui-css';
import {Deps} from './deps';
import {Doc, resolveDoc} from '../model/doc';
import {PageConfig} from '../model/page-config';
import {
  PreferredSourceApi,
  PreferredSourceButtonOptions,
} from '../api/preferred-source';
import {Toast} from '../ui/toast';
import {feUrl} from './services';
import {injectStyleSheet} from '../utils/dom';
import type {Callbacks} from './callbacks';
import type {ClientConfigManager} from './client-config-manager';
import type {DialogManager} from '../components/dialog-manager';
import type {EntitlementsManager} from './entitlements-manager';
import type {GisInteropManager} from './gis/gis-interop-manager';
import type {JsError} from './jserror';
import type {PayClient} from './pay-client';
import type {Storage} from './storage';

export class PublisherRuntime implements Deps {
  private readonly win_: Window;
  private readonly doc_: Doc;
  private readonly pageConfig_: PageConfig;
  private readonly eventManager_: ClientEventManager;
  private readonly activityPorts_: ActivityPorts;
  private readonly analyticsService_: AnalyticsService;
  private readonly creationTimestamp_ = Date.now();
  private options_: PreferredSourceButtonOptions = {};
  private readonly buttons_: AddPreferredSourceButtonIframe[] = [];
  private currentStatus_?: AddPreferredSourceStatus;
  private startedLogging_ = false;

  constructor(win: Window) {
    this.win_ = win;
    this.doc_ = resolveDoc(win);
    this.pageConfig_ = new PageConfig('publication-id-free', false);
    this.eventManager_ = new ClientEventManager(Promise.resolve());
    this.activityPorts_ = new ActivityPorts(this);
    this.analyticsService_ = new AnalyticsService(this);
    injectStyleSheet(this.doc_, DIALOG_CSS);
  }

  // --- Deps Implementation ---

  win(): Window {
    return this.win_;
  }

  doc(): Doc {
    return this.doc_;
  }

  pageConfig(): PageConfig {
    return this.pageConfig_;
  }

  activities(): ActivityPorts {
    return this.activityPorts_;
  }

  analytics(): AnalyticsService {
    return this.analyticsService_;
  }

  eventManager(): ClientEventManager {
    return this.eventManager_;
  }

  creationTimestamp(): number {
    return this.creationTimestamp_;
  }

  config(): Config {
    return {enableSwgAnalytics: true};
  }

  isPublisher(): boolean {
    return true;
  }

  storage(): Storage {
    return {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    } as unknown as Storage;
  }

  clientConfigManager(): ClientConfigManager {
    return {
      getLanguage: () => this.resolveLanguage_(),
    } as unknown as ClientConfigManager;
  }

  entitlementsManager(): EntitlementsManager {
    return null as unknown as EntitlementsManager;
  }

  dialogManager(): DialogManager {
    return null as unknown as DialogManager;
  }

  jserror(): JsError {
    return null as unknown as JsError;
  }

  payClient(): PayClient {
    return null as unknown as PayClient;
  }

  callbacks(): Callbacks {
    return null as unknown as Callbacks;
  }

  gisInteropManager(): GisInteropManager | undefined {
    return undefined;
  }

  // --- Internal Lifecycle & Helpers ---

  private maybeStartLogging_(): void {
    if (!this.startedLogging_) {
      this.startedLogging_ = true;
      this.analyticsService_.setReadyForLogging();
      this.analyticsService_.start();
    }
  }

  private resolveLanguage_(override?: string | null): string {
    return (
      override ||
      this.options_.lang ||
      this.win_.navigator?.language ||
      this.win_.document?.documentElement?.lang ||
      'en'
    );
  }

  private resolveTheme_(override?: string | null): string {
    return override || this.options_.theme || 'light';
  }

  // --- Public API Methods ---

  updateAllButtons(status: AddPreferredSourceStatus): void {
    this.currentStatus_ = status;
    for (const button of this.buttons_) {
      button.updateStatus(status);
    }
  }

  init(args: PreferredSourceButtonOptions = {}): void {
    this.options_ = Object.assign({}, this.options_, args);
    this.maybeStartLogging_();

    const document = this.win_.document;
    const buttons = document.querySelectorAll(
      '[google-add-preferred-source-btn]:not([data-initialized])'
    );
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i] as HTMLElement;
      button.setAttribute('data-initialized', 'true');
      const lang = this.resolveLanguage_(button.getAttribute('data-lang'));
      const theme = this.resolveTheme_(button.getAttribute('data-theme'));
      const buttonComponent = new AddPreferredSourceButtonIframe(this, button, {
        theme,
        lang,
      });
      this.buttons_.push(buttonComponent);
      if (this.currentStatus_ !== undefined) {
        buttonComponent.updateStatus(this.currentStatus_);
      }
      buttonComponent.attach(() => {
        this.addPreferredSource({language: lang, theme});
        return Promise.resolve(true);
      });
    }
  }

  showToast(
    status: AddPreferredSourceStatus,
    sourceName = '',
    options?: {language?: string; theme?: string}
  ): void {
    this.maybeStartLogging_();
    const params: {[key: string]: string} = {
      flavor: 'preferred_source',
      sourceName,
      confirmationType: `${status}`,
      hl: this.resolveLanguage_(options?.language),
      theme: this.resolveTheme_(options?.theme),
    };
    const toast = new Toast(
      this,
      feUrl('/toastiframe', params),
      {},
      'publisher-toast'
    );
    toast.open();
  }

  addPreferredSource(options?: {language?: string; theme?: string}): void {
    this.maybeStartLogging_();
    const flow = new AddPreferredSourceFlow(this, options);
    flow
      .start()
      .then((response) => {
        const status = response.getStatus();
        if (
          status ===
            AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS ||
          status ===
            AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED ||
          status ===
            AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE
        ) {
          this.updateAllButtons(status);
          this.showToast(status, response.getSiteName() || '', options);
        }
      })
      .catch(() => {
        // Ignore user cancellation or abortion of the flow natively.
      });
  }
}

interface PublisherWindow extends Window {
  PREFERRED_SOURCE?:
    | unknown[]
    | {
        api?: PreferredSourceApi;
        push?: (...args: Function[]) => void;
        ready?: () => Promise<PreferredSourceApi>;
      };
}

export function installPublisherRuntime(
  win: Window,
  options?: {autoStart?: boolean}
): PreferredSourceApi {
  // Only install the Publisher runtime once.
  const existingProp = (win as PublisherWindow).PREFERRED_SOURCE;
  if (existingProp && !Array.isArray(existingProp)) {
    return (
      existingProp.api ?? {
        init: () => {},
        addPreferredSource: () => {},
      }
    );
  }

  const runtime = new PublisherRuntime(win);

  // Set up the API object
  const api: PreferredSourceApi = {
    init: runtime.init.bind(runtime),
    addPreferredSource: runtime.addPreferredSource.bind(runtime),
  };

  // Flush queued callbacks
  const waitingCallbacks = ([] as unknown[]).concat(
    Array.isArray(existingProp) ? existingProp : []
  );
  for (const waitingCallback of waitingCallbacks) {
    if (typeof waitingCallback === 'function') {
      waitingCallback(api);
    }
  }

  // Replace global array with an object so subsequent calls know it is installed
  (win as PublisherWindow).PREFERRED_SOURCE = {
    push: (...args: Function[]): void => {
      args.forEach((arg) => {
        if (typeof arg === 'function') {
          arg(api);
        }
      });
    },
    ready: (): Promise<PreferredSourceApi> => Promise.resolve(api),
    api,
  };

  if (options?.autoStart !== false) {
    // Handle auto-initialization
    let autoInit = true;
    const scripts = win.document.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.getAttribute('preferred-sources-control') === 'manual') {
        autoInit = false;
        break;
      }
    }

    if (autoInit) {
      runtime.init();
    }
  }

  return api;
}
