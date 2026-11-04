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
import {AddPreferredSourceButton} from '../ui/add-preferred-source-button';
import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {
  AddPreferredSourceStatus,
  AnalyticsEvent,
  EventParams,
  PreferredSourcesAddSourceTrigger,
} from '../proto/api_messages';
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
import {getCanonicalUrl, getHttpOrigin} from '../utils/url';
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
  private analyticsService_: AnalyticsService | null = null;
  private readonly creationTimestamp_ = Date.now();
  private options_: PreferredSourceButtonOptions = {};
  private readonly buttons_: AddPreferredSourceButton[] = [];
  private currentStatus_?: AddPreferredSourceStatus;
  private startedLogging_ = false;

  constructor(win: Window) {
    this.win_ = win;
    this.doc_ = resolveDoc(win);
    this.pageConfig_ = new PageConfig('publication-id-free', false);
    this.eventManager_ = new ClientEventManager(Promise.resolve());
    this.activityPorts_ = new ActivityPorts(this);
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
    if (!this.analyticsService_) {
      this.analyticsService_ = new AnalyticsService(this);
    }
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
      const analyticsService = this.analytics();
      analyticsService.setReadyForLogging();
      analyticsService.start();
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

  private resolveTheme_(override?: string | null): 'light' | 'dark' | 'auto' {
    const theme = (override || this.options_.theme) as
      | 'light'
      | 'dark'
      | 'auto'
      | undefined;
    if (theme === 'dark' || theme === 'light' || theme === 'auto') {
      return theme;
    }
    return 'light';
  }

  // --- Public API Methods ---

  /**
   * Updates the status for all registered publisher buttons.
   */
  updateAllButtons(status: AddPreferredSourceStatus): void {
    this.currentStatus_ = status;
    for (const button of this.buttons_) {
      button.updateStatus(status);
    }
  }

  /**
   * Initializes publisher buttons found on the page.
   */
  init(args: PreferredSourceButtonOptions = {}): void {
    this.options_ = Object.assign({}, this.options_, args);

    const document = this.win_.document;
    const buttons = document.querySelectorAll(
      '[google-add-preferred-source-btn]:not([data-initialized])'
    );
    if (buttons.length === 0) {
      return;
    }

    this.maybeStartLogging_();
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i] as HTMLElement;
      button.setAttribute('data-initialized', 'true');
      const lang = this.resolveLanguage_(button.getAttribute('data-lang'));
      const theme = this.resolveTheme_(button.getAttribute('data-theme'));
      const buttonComponent = new AddPreferredSourceButton(this, button, {
        theme,
        lang,
      });
      this.buttons_.push(buttonComponent);
      if (this.currentStatus_ !== undefined) {
        buttonComponent.updateStatus(this.currentStatus_);
      }
      buttonComponent.attach(() => {
        this.addPreferredSource_({
          language: lang,
          theme,
          isFromInflatedButton: true,
        });
        return Promise.resolve(true);
      });
    }
  }

  /**
   * Displays the confirmation toast for the add preferred source flow.
   */
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

  /**
   * Initiates the Add Preferred Source consent flow via the public API.
   */
  addPreferredSource(): void {
    this.addPreferredSource_({isFromInflatedButton: false});
  }

  /**
   * Internal implementation of the Add Preferred Source consent flow and telemetry.
   */
  private addPreferredSource_(options?: {
    language?: string;
    theme?: string;
    isFromInflatedButton?: boolean;
  }): void {
    this.maybeStartLogging_();
    const actionTrigger = options?.isFromInflatedButton
      ? PreferredSourcesAddSourceTrigger.PREFERRED_SOURCES_ADD_SOURCE_TRIGGER_INFLATED_BUTTON
      : PreferredSourcesAddSourceTrigger.PREFERRED_SOURCES_ADD_SOURCE_TRIGGER_API;
    const params = new EventParams();
    params.setPreferredSourcesAddSourceTrigger(actionTrigger);
    const canonicalOrigin = getHttpOrigin(getCanonicalUrl(this.doc_));
    if (canonicalOrigin) {
      params.setCanonicalUrl(canonicalOrigin);
    }
    this.eventManager_.logSwgEvent(
      AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCE,
      /* isFromUserAction */ Boolean(options?.isFromInflatedButton),
      params
    );

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

/**
 * Installs the Publisher runtime on the given window and attaches global API handlers.
 */
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

  const isManual =
    options?.autoStart === false ||
    Boolean(
      win.document?.querySelector?.(
        'script[preferred-sources-control="manual"]'
      )
    );

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

  if (!isManual) {
    runtime.init();
  }

  return api;
}
