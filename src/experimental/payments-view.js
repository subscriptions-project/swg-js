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

const USE_SANDBOX = true;
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


/**
 * @param {!Window} win The parent window object.
 * @param {!Element} context The Subscription container reference.
 * @param {string} paymentRequestBlob The payment request object.
 * @param {!LoadingView} loadingView The loading indicator.
 */
export class PaymentsView {
  constructor(win, context, paymentRequestBlob, loadingView) {
    /** @const @private {!Window} */
    this.win_ = win;

    /** @const @private {!PopupContext} */
    this.context_ = context;

    /** @const @private {string} */
    this.paymentRequestBlob_ = paymentRequestBlob;

    /** @private {!LoadingView} */
    this.loadingView_ = loadingView;

    /** @private @const {!Element} */
    this.iframe_ = this.win_.document.createElement('iframe');
    this.iframe_.setAttribute('frameborder', '0');
    this.iframe_.setAttribute('scrolling', 'no');
    setImportantStyles(this.iframe_, {
      'width': '100%',
      'min-height': '80px',
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
    this.loadingView_.show();
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

    this.iframe_.src = loc.origin + loc.path
        + '?pc=' + (themeColor ? encodeURIComponent(themeColor) : '')
        + '&ep=' + encodeURIComponent(this.paymentRequestBlob_);
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
          this.loadingView_.hide();
        }
        break;
      case 'busy':
        // No need to call content.setBusy() since, Payments UI manages it's
        // own loading state.
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
