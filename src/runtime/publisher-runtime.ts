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
import {ConfiguredRuntime} from './runtime';
import {PageConfigResolver} from '../model/page-config-resolver';
import {Toast} from '../ui/toast';
import {feUrl} from './services';

export class PublisherRuntime {
  private readonly win_: Window;
  private configuredRuntime_: ConfiguredRuntime | null = null;
  private readonly configuredRuntimePromise_: Promise<ConfiguredRuntime>;

  constructor(win: Window) {
    this.win_ = win;

    const pageConfigResolver = new PageConfigResolver(win);
    this.configuredRuntimePromise_ = pageConfigResolver
      .resolveConfig()
      .then((pageConfig) => {
        this.configuredRuntime_ = new ConfiguredRuntime(win, pageConfig, {});
        return this.configuredRuntime_;
      });
  }

  init(args: {theme?: string} = {}): void {
    const document = this.win_.document;
    const buttons = document.querySelectorAll(
      '[google-add-preferred-source-btn]:not([data-initialized])'
    );
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i] as HTMLElement;
      button.setAttribute('data-initialized', 'true');
      this.configuredRuntimePromise_.then((configuredRuntime) => {
        const buttonComponent = new AddPreferredSourceButtonIframe(
          configuredRuntime,
          button,
          {
            theme: args.theme || 'light',
            lang: this.win_.document.documentElement.lang || 'en',
          }
        );
        buttonComponent.attach(() => {
          this.addPreferredSource();
          return Promise.resolve(true);
        });
      });
    }
  }

  addPreferredSource(): void {
    this.configuredRuntimePromise_.then((configuredRuntime) => {
      const flow = new AddPreferredSourceFlow(configuredRuntime);
      flow.start().then((response) => {
        const status = response.getStatus();
        if (
          status ===
            AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS ||
          status ===
            AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED
        ) {
          const toast = new Toast(configuredRuntime, feUrl('/toastiframe'), {});
          toast.open();
        }
      });
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
