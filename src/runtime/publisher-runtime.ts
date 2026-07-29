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
import {PreferredSourceButtonOptions} from '../api/preferred-source';
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
      const pageConfig = new PageConfig('publisher', false);
      const lang =
        this.options_.lang ||
        this.win_.navigator?.language ||
        this.win_.document.documentElement.lang ||
        'en';
      this.configuredRuntime_ = new ConfiguredRuntime(
        this.win_,
        pageConfig,
        {},
        undefined,
        {
          lang,
          theme: this.options_.theme as ClientTheme | undefined,
          forceLangInIframes: true,
        }
      );
    }
    return this.configuredRuntime_;
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
      const buttonComponent = new AddPreferredSourceButtonIframe(
        runtime,
        button,
        {
          theme: this.options_.theme || 'light',
          lang: runtime.clientConfigManager().getLanguage(),
        }
      );
      this.buttons_.push(buttonComponent);
      if (this.currentStatus_ !== undefined) {
        buttonComponent.updateStatus(this.currentStatus_);
      }
      buttonComponent.attach(() => {
        this.updateAllButtons(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
        );
        this.addPreferredSource();
        return Promise.resolve(true);
      });
    }
  }

  addPreferredSource(): void {
    const runtime = this.getRuntime_();
    const flow = new AddPreferredSourceFlow(runtime);
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
          const params: {[key: string]: string} = {
            flavor: 'preferred_source',
            sourceName: response.getSiteName() || '',
            confirmationType: `${status}`,
            hl: runtime.clientConfigManager().getLanguage(),
          };
          const toast = new Toast(runtime, feUrl('/toastiframe', params));
          toast.open();
        }
      })
      .catch(() => {
        // Ignore user cancellation or abortion of the flow natively.
      });
  }
}

export function installPublisherRuntime(win: Window) {
  const runtime = new PublisherRuntime(win);

  // Expose the API to the global PREFERRED_SOURCE structure
  const globalObj = ((
    win as unknown as {[key: string]: unknown}
  ).PREFERRED_SOURCE =
    (win as unknown as {[key: string]: unknown}).PREFERRED_SOURCE ||
    []) as Function[];

  // Set up the API object
  const api = {
    init: runtime.init.bind(runtime),
    addPreferredSource: runtime.addPreferredSource.bind(runtime),
  };

  // Flush queued callbacks
  const waitingArgs = globalObj.slice(0);
  globalObj.length = 0;
  globalObj.push = (...args: Function[]): number => {
    args.forEach((arg) => arg(api));
    return globalObj.length;
  };

  waitingArgs.forEach((args: unknown) => {
    if (typeof args === 'function') {
      args(api);
    }
  });

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
