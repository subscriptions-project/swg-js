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

import {ActivityIframePort, ActivityPorts} from '../components/activities';
import {
  AddPreferredSourceRequest,
  AddPreferredSourceStatus,
  UpdateAddPreferredSourceButtonRequest,
} from '../proto/api_messages';
import {Deps} from '../runtime/deps';
import {feUrl} from '../runtime/services';
import {log} from '../utils/log';
import {parseUrl} from '../utils/url';
import {setStyles} from '../utils/style';

export class AddPreferredSourceButtonIframe {
  private readonly activityPorts_: ActivityPorts;
  private portPromise_?: Promise<ActivityIframePort>;

  constructor(
    private readonly deps_: Deps,
    private readonly container_: Element,
    private readonly options_: {lang?: string; theme?: string}
  ) {
    this.activityPorts_ = deps_.activities();
  }

  async updateStatus(status: AddPreferredSourceStatus): Promise<void> {
    if (this.portPromise_) {
      try {
        log(
          `[AddPreferredSourceButtonIframe] Awaiting portPromise_ for status ${status}`
        );
        const port = await this.portPromise_;
        const updateMsg = new UpdateAddPreferredSourceButtonRequest();
        updateMsg.setStatus(status);
        log(
          '[AddPreferredSourceButtonIframe] Updating iframe button status:',
          status,
          'on port',
          port
        );
        port.execute(updateMsg);
        log(
          `[AddPreferredSourceButtonIframe] Successfully executed updateMsg on port for status ${status}`
        );
      } catch (reason) {
        log(
          '[AddPreferredSourceButtonIframe] Error updating status on port:',
          reason
        );
      }
    } else {
      log(
        `[AddPreferredSourceButtonIframe] No portPromise_ available for status ${status}`
      );
    }
  }

  async attach(onResult: () => void): Promise<void> {
    log('[AddPreferredSourceButtonIframe] Attaching button iframe...');
    const doc = this.deps_.doc();
    const iframe = doc.getWin().document.createElement('iframe');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('title', 'Add Preferred Source');

    // Style container and iframe with absolute positioning matching swg-smart-button.
    // Setting width 100% and min-height 60px ensures safe vertical clearance.
    setStyles(this.container_ as HTMLElement, {
      'position': 'relative',
      'width': '100%',
      'min-height': '60px',
    });
    setStyles(iframe, {
      'opacity': '1',
      'position': 'absolute',
      'top': '0',
      'bottom': '0',
      'left': '0',
      'right': '0',
      'width': '100%',
      'height': '100%',
      'border': 'none',
    });

    this.container_.appendChild(iframe);

    // Provide the full href instead of just host, to capture the exact context
    const params: {[key: string]: string} = {
      'origin': parseUrl(doc.getWin().location.href).origin,
      'source': doc.getWin().location.href,
    };
    if (this.options_.theme) {
      params['theme'] = this.options_.theme;
    }
    if (this.options_.lang) {
      params['hl'] = this.options_.lang;
    }

    const url = feUrl('/addpreferredsourcebuttoniframe', params);
    log('[AddPreferredSourceButtonIframe] Opening iframe with URL:', url);

    try {
      this.portPromise_ = this.activityPorts_.openIframe(iframe, url, {});
      const port = await this.portPromise_;
      log(
        '[AddPreferredSourceButtonIframe] ActivityPort connected successfully.'
      );

      log(
        '[AddPreferredSourceButtonIframe] Registering listener for AddPreferredSourceRequest clicks...'
      );
      port.on(AddPreferredSourceRequest, (request) => {
        log(
          '[AddPreferredSourceButtonIframe] Received AddPreferredSourceRequest from iframe:',
          request
        );
        log(
          '[AddPreferredSourceButtonIframe] Triggering onResult callback (launching AddPreferredSourceFlow)...'
        );
        onResult();
      });

      await port.whenReady();
    } catch (reason) {
      log('[AddPreferredSourceButtonIframe] Error or port closure:', reason);
      // Ignored. The user might have closed the iframe or blocked cross-domain ports.
    }
  }
}
