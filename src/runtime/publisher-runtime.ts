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

import {AddPreferredSourceButtonIframe} from '../ui/add-preferred-source-button-iframe';
import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {AddPreferredSourceStatus} from '../proto/api_messages';
import {ClientTheme} from '../api/subscriptions';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {
  PreferredSourceApi,
  PreferredSourceButtonOptions,
} from '../api/preferred-source';
import {Toast} from '../ui/toast';
import {feUrl} from './services';

export class PublisherRuntime {
  private readonly win_: Window;
  private configuredRuntime_?: ConfiguredRuntime;
  private options_: PreferredSourceButtonOptions = {};
  private readonly buttons_: AddPreferredSourceButtonIframe[] = [];
  private currentStatus_?: AddPreferredSourceStatus;

  constructor(win: Window) {
    this.win_ = win;
  }

  private getRuntime_(): ConfiguredRuntime {
    if (!this.configuredRuntime_) {
      const pageConfig = new PageConfig('publication-id-free', false);
      const lang =
        this.options_.lang ||
        this.win_.navigator?.language ||
        this.win_.document.documentElement.lang ||
        'en';
      this.configuredRuntime_ = new ConfiguredRuntime(
        this.win_,
        pageConfig,
        {
          isPublisher: true,
        },
        undefined,
        {
          lang,
          theme: this.options_.theme as ClientTheme | undefined,
          forceLangInIframes: true,
        }
      );

      this.configuredRuntime_.analytics().setReadyForLogging();
      this.configuredRuntime_.analytics().start();
    }
    return this.configuredRuntime_;
  }

  private resolveLanguage_(override?: string | null): string {
    return (
      override ||
      this.options_.lang ||
      this.getRuntime_().clientConfigManager().getLanguage()
    );
  }

  private resolveTheme_(override?: string | null): string {
    return override || this.options_.theme || 'light';
  }

  updateAllButtons(status: AddPreferredSourceStatus): void {
    this.currentStatus_ = status;
    for (const button of this.buttons_) {
      button.updateStatus(status);
    }
  }

  init(args: PreferredSourceButtonOptions = {}): void {
    this.options_ = Object.assign({}, this.options_, args);
    if (args.lang || args.theme) {
      this.configuredRuntime_ = undefined;
    }
    const runtime = this.getRuntime_();
    const document = this.win_.document;
    const buttons = document.querySelectorAll(
      '[google-add-preferred-source-btn]:not([data-initialized])'
    );
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i] as HTMLElement;
      button.setAttribute('data-initialized', 'true');
      const lang = this.resolveLanguage_(button.getAttribute('data-lang'));
      const theme = this.resolveTheme_(button.getAttribute('data-theme'));
      const buttonComponent = new AddPreferredSourceButtonIframe(
        runtime,
        button,
        {
          theme,
          lang,
        }
      );
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
    const runtime = this.getRuntime_();
    const params: {[key: string]: string} = {
      flavor: 'preferred_source',
      sourceName,
      confirmationType: `${status}`,
      hl: this.resolveLanguage_(options?.language),
      theme: this.resolveTheme_(options?.theme),
    };
    const toast = new Toast(
      runtime,
      feUrl('/toastiframe', params),
      {},
      'publisher-toast'
    );
    toast.open();
  }

  addPreferredSource(options?: {language?: string; theme?: string}): void {
    const runtime = this.getRuntime_();
    const flow = new AddPreferredSourceFlow(runtime, options);
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
