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

import {setImportantStyles} from '../utils/style';

const BLOB = [
  'AFNo2jMpzZh8TPbec7JUf695ryozqoaeTW/zPkYs+Pz0ZMgP3tgFuCkwHiJqgAhPosX+lSaP8R8',
  'MA81za/HQ7CPPVFj6k3zlDyRPwhGYM0qMA/U3XVUvOj0X/vP1E7aFxwk2D3UtMaH2F+8HWhQzWR',
  'Q+vMfAaqONJH5acshBRRJQMHoXvHOwUy7iH4OerR8Ib6/BmT2cKNYTyOWz5HuK6EDOAqpsJ7zhv',
  'legHymbK2qAcdTxKkVQvCsDIqq6Z0t8x1U6z8DULc8zWON7Dt0Wju1Ri8B3wrF4JSnKeadySgtZ',
  '3BN1oyHEoZnUIPVtAT8x8fODYwVYI30JqDvhpmE2Eu6fgVOUfcZJ2IK8wwAX8etFu4FwdG56i71',
  'gnSQIJhoAakGSckSRDOBIK7gch8aWRyG7mtZhs4YB1uKx9VeFFbR/6X+khDkfcCU+FER1idrYSx',
  'Ok3B/QNt1WtQSWWgk2ETEhNWiI8i6o3gNtlU/ZhspACtN5KQ/xu+PSXaAWcVMs1RJHTRgDDVQvD',
  'KoctL2ZrwaVfw6ejOIdWA==',
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
    this.win_.addEventListener('message', e => {
      if (e.source == this.iframe_.contentWindow &&
          e.origin == 'https://subs-pay.googleplex.com' &&
          e.data && e.data.type) {
        this.onMessage_(e.data.type, e.data.payload);
      }
    });
    // TODO(dvoytenko): pass blob as an argument.
    this.iframe_.src = 'https://subs-pay.googleplex.com/proxy.html?ep=' +
        encodeURIComponent(BLOB);
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
        // TODO(dparikh): Decide on resize protocol for embeds and provide animation.
        setImportantStyles(this.iframe_, {
          'height': `${payload.height}px`,
        });
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
