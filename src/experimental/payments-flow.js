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

import {SubscriptionMarkup} from '../runtime/subscription-markup';
import {setImportantStyles} from '../utils/style';

const USE_SANDBOX = false;
const PAY_SERVICE =
    USE_SANDBOX ?
    {
      origin: 'https://sandbox.google.com',
      path: '/payments/apis/instantbuy/serving/proxy.html',
    } :
    {
      origin: 'https://subs-pay.googleplex.com',
      path: '/proxy.html',
    };

const BLOB = [
  'AFNo2jP6vC1UQf/ygljw0tWov9h/V9jRTCCrKUlFVNOzQS6phouVIp5/cFjukVW9h4y/i6XYDop',
  'U8IEm5/w0Cb6w3Pd6ufCLMkvCRA1wqRB/1ONmcCE183YXWJAqdFvO+p6xoqYywjS/uedMvQYLPD',
  'RlpPXKJeso6Se2Gcct1qZz/ySBNlrM0HR456lheSnRvnHuUvuGUNJcwEDR+DoSQlFVhY2hUWOxi',
  'F7nIDnm/W7HblT0so9dHJ0NCXxNQYDv5e9hxvzZwKtYyBvklQYWvjCSkyZ1uO+MDfiUO8XxIAtt',
  'IxDAoJsKFo0Per756nMtNIGmsAJrZnDxgjZMK8G7cojZ2aKjYp19bHXO49Zr4N0kB44cPDHI9k5',
  'XgAk4gR/HmUMZq8kJk2OYM9OgfrtNylglJI1xuh9kxd3CIilxc6wPhg2WjlP5a4nKQPsQ7ubst2',
  'fs84Fy0l3dx2/2pRA2+BotzoSvVA6HD3i9rO0QQRhmdbAy4JkxVntIcU8qwnMukvF14+udG69e',
].join('');



/**
 * @param {string} blob
 */
export function launchPaymentsFlow(blob) {
  new PaymentsFlow().start(blob);
}


/**
 */
export class PaymentsView {
  constructor(win, context) {
    /** @const @private {!Window} */
    this.win_ = win;

    /** @const @private {!PopupContext} */
    this.context_ = context;

    /** @private @const {!Element} */
    this.iframe_ = this.win_.document.createElement('iframe');
    this.iframe_.setAttribute('frameborder', '0');
    this.iframe_.setAttribute('scrolling', 'no');
    setImportantStyles(this.iframe_, {
      'width': '100%',
      'min-height': '80px',
      'margin-top': '16px',
    });

    /** @private {?function(number, number)} */
    this.onResize_ = null;

    /** @private {?function()} */
    this.onComplete_ = null;
  }

  /**
   * @param {function()} callback
   * @return {!PaymentsView}
   */
  onComplete(callback) {
    this.onComplete_ = callback;
    return this;
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.iframe_;
  }

  /**
   * @return {!Promise}
   */
  init() {
    const readyPromise = new Promise(resolve => {
      // Wait for the first resize.
      this.onResize_ = resolve;
    });
    const loc = PAY_SERVICE;
    const markup = new SubscriptionMarkup(this.win_);
    const themeColor = markup.getThemeColor();
    this.win_.addEventListener('message', e => {
      if (e.source == this.iframe_.contentWindow &&
          e.origin == loc.origin &&
          e.data && e.data.type) {
        this.onMessage_(e.data.type, e.data.payload);
      }
    });
    // TODO(dvoytenko): pass blob as an argument.
    this.iframe_.src = loc.origin + loc.path
        + '?pc=' + (themeColor ? encodeURIComponent(themeColor) : '')
        + '&ep=' + encodeURIComponent(BLOB);
    return readyPromise;
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
      case 'ready':
        break;
      case 'resize':
        // Notify the context about resize required.
        this.context_.resizeView(this, payload.height);

        if (this.onResize_) {
          this.onResize_(payload.width, payload.height);
        }
        break;
      case 'busy':
        this.context_.setBusy(payload.busy);
        break;
      case 'complete':
        if (this.onComplete_) {
          this.onComplete_();
        }
        break;
      default:
        throw new Error(`unknown message type: "${type}"`);
    }
  }
}


// TODO(dvoytenko): remove
export class PaymentsFlow {

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
