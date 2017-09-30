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


import {
  assertNoPopups,
  getAbbriviatedOffers,
  setCssAttributes,
} from './subscriptions-ui-util';
import {getSubscriptionDetails} from './subscriptions-ui-service';


/**
 * The pop-up element name to be used.
 * @const {string}
 */
const POPUP_TAG = 'swg-popup';


/**
 * The default height of the pop-up.
 * @const {number}
 */
const CONTAINER_HEIGHT = 200;


/**
 * Builds offers container, including headers and footer. It builds an
 * element <swg-payflow> at the end of the <body> of the containing document.
 * The offer container within the element is built from the offers API response.
 * The offers API response could be different base on:
 *     1. Subscriber   : Notify user with a toast message
 *     2. Metered      : Show available quota and offers received from the API
 *     3. Non-metered  : Show available quota and offers received from the API
 *     4. Subscriber   : Payment broken. Notify user
 *     5. Not signed-in: Notify user to sign-in and show offers
 * @param {!Window} win The main containing window object.
 * @return {!Promise}
 */
export function buildSubscriptionsUi(win) {

  // Ensure that the element is not already built by external resource.
  assertNoPopups(win.document, POPUP_TAG);

  // Gets subscription details and build the pop-up.
  getSubscriptionDetails()
      .then(response => {
        const subscriptionsUiFlow = new SubscriptionsUiFlow(win, response);
        subscriptionsUiFlow.show_();
      });
}


/**
 * The class for SwG offers flow.
 */
export class SubscriptionsUiFlow {

  constructor(win, response) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!SubscriptionResponse} */
    this.subscription_ = response;

    // Build the pop-up element and add the offers.
    /** @private @const {!Element} */
    this.offerContainer_ = this.document_.createElement(POPUP_TAG);
    this.addCloseButton();
    setCssAttributes(this.offerContainer_, CONTAINER_HEIGHT);
    this.document_.body.appendChild(this.offerContainer_);

    // Add the abbriviated offers.
    this.addAbbriviatedOfferFrame_();
  }

  /**
   * Builds and renders the close pop-up dialog button.
   * TODO(dparikh): Use the setImportantStyles() as discussed.
   */
  addCloseButton() {
    const closeButton = this.document_.createElement('button');
    closeButton.classList.add('swg-close-action');
    this.offerContainer_.appendChild(closeButton);
    closeButton.innerText = 'X';
    const closeButtonStyle = closeButton.style;
    closeButtonStyle.setProperty('z-index', '2147483647', 'important');
    closeButtonStyle.setProperty('position', 'absolute', 'important');
    closeButtonStyle.setProperty('width', '28px', 'important');
    closeButtonStyle.setProperty('height', '28px', 'important');
    closeButtonStyle.setProperty('top', '8px', 'important');
    closeButtonStyle.setProperty('right', '10px', 'important');
    closeButtonStyle.setProperty('color', '#757575', 'important');
    closeButtonStyle.setProperty('font-size', '14px', 'important');
    closeButtonStyle.setProperty('background-size', '13px 13px', 'important');
    closeButtonStyle
        .setProperty('background-position', '9px center', 'important');
    closeButtonStyle.setProperty('background-color', '#ececec', 'important');
    closeButtonStyle.setProperty('background-repeat', 'no-repeat', 'important');
    closeButtonStyle.setProperty('border', 'none', 'important');

    closeButton.addEventListener('click', () =>
        this.offerContainer_.parentNode.removeChild(this.offerContainer_));
  }

  /**
   * Displays the element in the UI. Element is hidden when created,
   * and should now be displayed when element is attached to the DOM.
   * @private
   */
  show_() {
    this.offerContainer_.style.removeProperty('display');
  }

  /**
   * Adds the abbriviated offers as a friendly iframe in the element.
   * @private
   * @return {?string}
   */
  addAbbriviatedOfferFrame_() {
    const iframe = this.document_.createElement('iframe');
    // TODO(dparikh): Polyfill 'srcdoc'.
    // Ref.: https://github.com/ampproject/amphtml/blob/master/src/friendly-iframe-embed.js#L148-L163
    iframe.srcdoc = getAbbriviatedOffers();
    iframe.id = 'offer-frame';
    iframe.name = 'offer-frame';
    iframe.setAttribute('frameborder', 0);
    iframe.setAttribute('scrolling', 'no');
    iframe.style.position = 'fixed';
    iframe.style.display = 'flex';
    iframe.style.left = 0;
    iframe.style.right = 0;
    iframe.style.opacity = 1;
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = '#fff';
    // TODO(dparikh): Vendor prefix for 'box-sizing'.
    iframe.style.boxSizing = 'border-box';
    iframe.style.minHeight = `${CONTAINER_HEIGHT}px`;
    this.offerContainer_.appendChild(iframe);
  }
}
