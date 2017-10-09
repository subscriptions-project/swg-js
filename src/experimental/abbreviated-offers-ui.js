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


import {getAbbreviatedOffers} from './subscriptions-ui-util';
import {setImportantStyles} from '../utils/style';


/**
 * Abbreviated Offers view. Renders the content in the parent <swg-popup>
 * element. Checks the state of <swg-popup> element to ensure that the no other
 * element exists. Hides the loading indicator once rendered.
 */
export class AbbreviatedOffersUi {

  /**
   * @param {!Window} win The parent window object.
   * @param {!Element} context The Subscription container reference.
   * @param {!Element} offerContainer The offer container element <swg-popup>.
   * @param {!SubscriptionResponse} subscriptions The subscriptions object.
   */
  constructor(win, context, offerContainer, subscriptions) {

     /** @private @const {!Window} */
    this.win_ = win;

    /** @const @private {!PopupContext} */
    this.context_ = context;

     /** @private @const {!Element} */
    this.document_ = win.document;

     /** @private @const {!Element} */
    this.offerContainer_ = offerContainer;

    /** @private @const {!SubscriptionResponse} */
    this.subscriptions_ = subscriptions;

    /** @private @const {!Element} */
    this.abbreviatedOffersElement_ = this.document_.createElement('iframe');

    /** @private {?function()} */
    this.subscribeClicked_ = null;

    /** @private @const {function()} */
    this.ref_ = this.resizeListener_.bind(this);
  }

  /**
   * @param {function()} callback
   * @return {!AbbreviatedOffersUi}
   */
  onSubscribeClicked(callback) {
    this.subscribeClicked_ = callback;
    return this;
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.abbreviatedOffersElement_;
  }

  /**
   * Initializes the abbreviated offers and renders in the <swg-popup>.
   * @return {!Promise}
   */
  init() {
    return this.buildAbbreviatedOffers_(this.subscriptions)
        .then(() => this.show());
  }

  /*
   * Shows the abbreviated offers element within the <swg-popup> element.
   */
  show() {
    this.abbreviatedOffersElement_.style.removeProperty('display');
  }

  /*
   * Hides the abbreviated offers element within the <swg-popup> element.
   */
  hide() {
    this.abbreviatedOffersElement_.style
        .setProperty('display', 'none', 'important');
  }

  /*
   * Builds the abbreviated offers element within the <swg-popup> element.
   * @return {!Promise}
   * @private
   */
  buildAbbreviatedOffers_() {
    const iframe = this.abbreviatedOffersElement_;
     // TODO(dparikh): Polyfill 'srcdoc'.
     // Ref.: https://github.com/ampproject/amphtml/blob/master/src/friendly-iframe-embed.js#L148-L163
    iframe.srcdoc = getAbbreviatedOffers(this.subscriptions_);
    iframe.setAttribute('frameborder', 0);
    iframe.setAttribute('scrolling', 'no');

    // It's important to add `onload` callback before appending to DOM, otherwise
    // onload could arrive immediately.
    const readyPromise = new Promise(resolve => {
      iframe.onload = resolve;
    });
    this.offerContainer_.appendChild(iframe);

    return readyPromise.then(() => {
      const subscribeButton = iframe.contentDocument.getElementById(
          'swg-button');

      subscribeButton.onclick = () => {
        const el = iframe.contentDocument
            .querySelector('input[name="offer"][checked]');
        this.subscribeClicked_(el.dataset.offerIndex);
      };

      setImportantStyles(iframe, {
        'opacity': 1,
        'border': 'none',
        'width': '100%',
        'background-color': '#fff',
      });

      // The correct scrollHeight of iframe's document is available only after
      // 'resize' event, at least in Chrome (latest), for ref:
      // https://bugs/chromium.org/p/chromium/issues/detail?id=34224
      // After reading the iframe height, this event listener is removed.
      iframe.contentWindow.addEventListener('resize', this.ref_);
    });
  }

  /**
   * Listens for the iframe content resize to notify the parent container.
   * The event listener is removed after reading the correct height.
   * @param {!Event} event
   * @private
   */
  resizeListener_(event) {
    const iframe = this.abbreviatedOffersElement_;
    const height = iframe.contentDocument.body.scrollHeight;
    this.context_.resizeView(this, height);
    event.currentTarget.removeEventListener(event.type, this.ref_);
  }
 }
