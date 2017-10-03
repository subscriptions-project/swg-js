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
  setCssAttributes,
} from './subscriptions-ui-util';
import {getSubscriptionDetails} from './subscriptions-ui-service';
import {AbbreviatedOffersUi} from './abbreviated-offers-ui';
import {LoadingUi} from './loading-ui';
import {CSS as SWG_POPUP} from '../../build/css/experimental/swg-popup.css';

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
        const subscriptionsUiFlow =
            new SubscriptionsUiFlow(win, response);
        subscriptionsUiFlow.start();
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

    /** @private {Element} */
    this.offerContainer_;

    /** @private {Element} */
    this.loadingUi_;

    /** @private {Element} */
    this.abbreviatedOffersUi_;

    /** @private {boolean} */
    this.isLoading_ = false;

    /** @private {?string} */
    this.activeView_;
  }

  /*
   * Starts the subscriptions flow.
   */
  start() {
    this.offerContainer_ = this.document_.createElement(POPUP_TAG);

    // Add close button with action.
    this.addCloseButton_();

    setCssAttributes(this.offerContainer_, CONTAINER_HEIGHT);
    this.document_.body.appendChild(this.offerContainer_);

    this.injectCssToWindow_();
    this.show_();

    // Build the loading indicator.
    this.loadingUi =
        new LoadingUi(this.win_, this.document_, this.offerContainer_);

    // Build the abbreviated offers element.
    this.abbreviatedOffersUi_ =
        new AbbreviatedOffersUi(
            this.win_,
            this.document_,
            this.offerContainer_,
            this.subscription_);

    // Render the abbreviated offers.
    this.abbreviatedOffersUi_.init();
  }

  /**
   * Injects common CSS styles to the container window's <head> element.
   * @private
   */
  injectCssToWindow_() {
    const style = this.document_.createElement('style');
    style.innerText = `${SWG_POPUP}`;
    const head = this.document_.getElementsByTagName('HEAD')[0];
    head.appendChild(style);
  }

  /**
   * Builds and renders the close pop-up dialog button.
   * TODO(dparikh): Use the setImportantStyles() as discussed.
   * @private
   */
  addCloseButton_() {
    const closeButton = this.document_.createElement('button');
    closeButton.classList.add('swg-close-action');
    this.offerContainer_.appendChild(closeButton);
    closeButton.innerText = '\u00D7';

    closeButton.addEventListener('click', () =>
        this.offerContainer_.parentNode.removeChild(this.offerContainer_));
  }

  /**
   * Displays the element in the UI. Element is hidden when created,
   * and should now be displayed when element is attached to the DOM.
   * @private
   */
  show_() {
    this.offerContainer_.style.setProperty('display', 'inline', 'important');
  }
}
