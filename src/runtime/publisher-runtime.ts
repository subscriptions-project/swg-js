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
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {Doc, resolveDoc} from '../model/doc';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {
  PreferredSourceApi,
  PreferredSourceButtonOptions,
} from '../api/preferred-source';
import {Storage} from './storage';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';
import {feUrl} from './services';

class PublisherDeps implements Deps {
  private readonly win_: Window;
  private readonly doc_: Doc;
  private readonly fetcher_: XhrFetcher;
  private readonly eventManager_: ClientEventManager;
  private readonly pageConfig_: PageConfig;
  private readonly storage_: Storage;
  private readonly activities_: ActivityPorts;
  private readonly analytics_: AnalyticsService;
  private readonly clientConfigManager_: ClientConfigManager;
  private readonly dialogManager_: DialogManager;

  constructor(win: Window, lang: string, pageConfig: PageConfig) {
    this.win_ = win;
    this.doc_ = resolveDoc(win);
    this.fetcher_ = new XhrFetcher(win);
    this.eventManager_ = new ClientEventManager(Promise.resolve());
    this.pageConfig_ = pageConfig;

    this.storage_ = new Storage(this.win_, this.pageConfig_);
    this.activities_ = new ActivityPorts(this);
    this.analytics_ = new AnalyticsService(this);
    this.clientConfigManager_ = new ClientConfigManager(
      this,
      this.pageConfig_.getPublicationId(),
      this.fetcher_,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {lang} as any
    );
    this.dialogManager_ = new DialogManager(
      this.doc_,
      this.clientConfigManager_
    );

    this.analytics_.setReadyForLogging();
    this.analytics_.start();
  }

  win() {
    return this.win_;
  }
  doc() {
    return this.doc_;
  }
  pageConfig() {
    return this.pageConfig_;
  }
  activities() {
    return this.activities_;
  }
  eventManager() {
    return this.eventManager_;
  }
  storage() {
    return this.storage_;
  }
  analytics() {
    return this.analytics_;
  }
  clientConfigManager() {
    return this.clientConfigManager_;
  }
  dialogManager() {
    return this.dialogManager_;
  }
  isPublisher() {
    return true;
  }

  // Stubs for functionality not available in publisher.js
  config() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any;
  }
  entitlementsManager() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any;
  }
  callbacks() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any;
  }
  payClient() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any;
  }
  jserror() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any;
  }
  creationTimestamp() {
    return 0;
  }
  gisInteropManager() {
    return undefined;
  }
}

export class PublisherRuntime {
  private readonly win_: Window;
  private deps_?: Deps;
  private options_: PreferredSourceButtonOptions = {};
  private readonly buttons_: AddPreferredSourceButtonIframe[] = [];
  private currentStatus_?: AddPreferredSourceStatus;

  constructor(win: Window) {
    this.win_ = win;
  }

  private async getDeps_(): Promise<Deps> {
    if (!this.deps_) {
      const lang =
        this.options_.lang ||
        this.win_.navigator?.language ||
        this.win_.document.documentElement.lang ||
        'en';
      const pageConfig = await new PageConfigResolver(
        this.win_
      ).resolveConfig();
      this.deps_ = new PublisherDeps(this.win_, lang, pageConfig);
    }
    return this.deps_;
  }

  updateAllButtons(status: AddPreferredSourceStatus): void {
    this.currentStatus_ = status;
    for (const button of this.buttons_) {
      button.updateStatus(status);
    }
  }

  async init(args: PreferredSourceButtonOptions = {}): Promise<void> {
    this.options_ = Object.assign({}, this.options_, args);
    if (args.lang || args.theme) {
      this.deps_ = undefined;
    }
    const deps = await this.getDeps_();
    const document = this.win_.document;
    const buttons = document.querySelectorAll(
      '[google-add-preferred-source-btn]:not([data-initialized])'
    );
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i] as HTMLElement;
      button.setAttribute('data-initialized', 'true');
      const buttonComponent = new AddPreferredSourceButtonIframe(deps, button, {
        theme: this.options_.theme || 'light',
        lang: deps.clientConfigManager().getLanguage(),
      });
      this.buttons_.push(buttonComponent);
      if (this.currentStatus_ !== undefined) {
        buttonComponent.updateStatus(this.currentStatus_);
      }
      buttonComponent.attach(() => {
        this.addPreferredSource();
        return Promise.resolve(true);
      });
    }
  }

  async showToast(
    status: AddPreferredSourceStatus,
    sourceName = ''
  ): Promise<void> {
    const deps = await this.getDeps_();
    const params: {[key: string]: string} = {
      flavor: 'preferred_source',
      sourceName,
      confirmationType: `${status}`,
      hl: deps.clientConfigManager().getLanguage(),
    };
    if (this.options_.theme) {
      params['theme'] = this.options_.theme;
    }
    const toast = new Toast(
      deps,
      feUrl('/toastiframe', params),
      {},
      'publisher-toast'
    );
    toast.open();
  }

  async addPreferredSource(): Promise<void> {
    const deps = await this.getDeps_();
    const flow = new AddPreferredSourceFlow(deps);
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
          this.showToast(status, response.getSiteName() || '');
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
