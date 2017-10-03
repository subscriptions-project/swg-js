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


/**
 * Abbreviated Offers view. Renders the content in the parent <swg-popup>
 * element. Checks the state of <swg-popup> element to ensure that the no other
 * element exists. Hides the loading indicator once rendered.
 */
export class AbbreviatedOffersUi {

  constructor(win, doc, offerContainer, subscriptions) {

     /** @private @const {!Window} */
    this.win_ = win;

     /** @private @const {!Element} */
    this.document_ = doc;

     /** @private @const {!Element} */
    this.offerContainer_ = offerContainer;

    /** @privte @const {!SubscriptionResponse} */
    this.subscriptions_ = subscriptions;

     /** @private {!Element} */
    this.abbreviatedOffersElement_ = this.document_.createElement('iframe');
  }

  /**
   * Initializes the abbreviated offers and renders in the <swg-popup>.
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
   */
  buildAbbreviatedOffers_() {
    const iframe = this.abbreviatedOffersElement_;
     // TODO(dparikh): Polyfill 'srcdoc'.
     // Ref.: https://github.com/ampproject/amphtml/blob/master/src/friendly-iframe-embed.js#L148-L163
    iframe.srcdoc = getAbbreviatedOffers(this.subscriptions_);
    iframe.setAttribute('frameborder', 0);
    iframe.setAttribute('scrolling', 'no');
    iframe.style.position = 'fixed';
    iframe.style.display = 'none';
    iframe.style.left = 0;
    iframe.style.right = 0;
    iframe.style.opacity = 1;
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = '#fff';
     // TODO(dparikh): Vendor prefix for 'box-sizing'.
    iframe.style.boxSizing = 'border-box';
    // TODO(dparikh): Need to pass the height of the iframe to the parent.
    iframe.style.minHeight = '200px';
    this.offerContainer_.appendChild(iframe);
    return Promise.resolve();
  }
 }
