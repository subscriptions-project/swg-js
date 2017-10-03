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
  'AFNo2jNduCh+0/ExLXJ9AUz87cjXS/ziOOoK0Ef/o1e+16g/A0u2Ra29J6KmnIrDXWYAXQ9fYJN',
  'za1ExlLnVfU/pEVvRa6pd6GRZmuR8eF3ahEhB3qN/5xlTStGmQqzphTPGP3HhI9xk+vnj1fye3o',
  'Nxr9Fgv1xRr2figwA1NWDnKWeiXjEg/F0Yg+U8bcRwcuAdqVrS6Pwg4VAJgZrXeBXeqMHJOT5GV',
  '7yUCGQNNBumaC205TgXberY+M6KBRvvXed1Ikzzjtfp380g1aVBTeHNTGh06nn4RaeO/ge85+W4',
  'RLqAZCjwP/TBgjPwIvFrH3yc5N/ccaXR7I4YKqb1IhTXVFJD0UyxnULpyZgCdZjWrfPwuBJ3pit',
  'R724gkZ6qIokoR8ykGEjDUPv4OUBxU2G2aOzjIa8H5V9tnHZ0Tfb3epHZ65KFcG5O14bhwWALlD',
  'YUaHlv1aHm3itOLlxwqImggAUj/fqCGnsc9fzFVd9bGGK7jMi9MKzhTp1Bn2QStMGceHiRENSGj',
  'Y7LDgK7HNvn1vDrwSgQ2w==',
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
  constructor(win) {
    /** @const @private {!Window} */
    this.win_ = win;

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
      default:
        throw new Error(`unknown message type: "${type}"`);
    }
  }
}


// TODO(dvoytenko): remove
export class PaymentsFlow {

  /**
   * @param {SubscriptionState} state
   */
  constructor(state) {

    /** @const */
    this.state_ = state;

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
   * @return {!Promise}
   */
  start() {

    let chosenOffer = this.state_.getChosenOffer();
    assert(chosenOffer, "No offer was chosen");

    this.iframe_.style.background = 'gray';
    this.iframe_.src = 'https://subs-pay.googleplex.com/proxy.html?ep=' +
        // To generate payment_request blob, see go/subs-pay-blob.
        encodeURIComponent(chosenOffer['payment_request']);
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
