/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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


/**
 * @param {string} blob
 */
export function launchBuyFlow(blob) {
  new BuyFlow().start(blob);
}


export class BuyFlow {

  constructor() {
    /** @private @const {!Element} */
    this.iframe_ = document.createElement('iframe');
    this.iframe_.style.position = 'fixed';
    this.iframe_.style.bottom = '0';
    this.iframe_.style.left = '0';
    this.iframe_.style.right = '0';
    this.iframe_.style.width = '100%';
    this.iframe_.style.height = '100px';
    this.iframe_.setAttribute('frameborder', '0');
    this.iframe_.setAttribute('scrolling', 'no');
  }

  /**
   * To generate blob, see go/subs-pay-blob.
   * @param {string} blob
   * @return {!Promise}
   */
  start(blob) {
    this.iframe_.style.background = 'gray';
    this.iframe_.src = 'https://subs-pay.googleplex.com/proxy.html?ep=' +
        encodeURIComponent(blob);
    document.body.appendChild(this.iframe_);

    window.addEventListener('message', e => {
      if (e.source == this.iframe_.contentWindow &&
          e.origin == 'https://subs-pay.googleplex.com' &&
          e.data && e.data.type) {
        this.onMessage_(e.data.type, e.data.payload);
      }
    });
  }

  /**
   * @param {string} type
   * @param {!Object} payload
   * @private
   */
  onMessage_(type, payload) {
    console.log('onMessage_: ', type, payload);
    switch (type) {
      case 'init':
        break;
      case 'resize':
        this.iframe_.style.width = `${payload.width}px`;
        this.iframe_.style.height = `${payload.height}px`;
        break;
      case 'ready':
        this.iframe_.style.background = '';
        break;
      default:
        throw new Error(`unknown message type: "${type}"`);
    }
  }
}
