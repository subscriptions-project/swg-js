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

import {getAbbriviatedOffers, setCssAttributes} from './offers-util';
import {isSubscriber, getOffers} from './offers-service';


/**
 * The pop-up element name to be used.
 * @const {string}
 */
const POPUP_TAG = 'swg-popup';


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
 *
 */
export function buildOffersContainer() {
  const offersFlow = new OffersFlow();

  // Check if user is a subscriber.
  isSubscriber().then(response => {
    offersFlow.access_ = !!response.access;
    offersFlow.subscriber_ = response.subscriber || {};
    return response;
  })
    .then(getOffers)  // Get the offers to show to the user.
    .then(response => offersFlow.createContainerElement_())
    .then(() => offersFlow.addAbbriviatedOfferFrame_())
    .catch(error => {
      this.error_ = error;
    });
}


/**
 * The class for SwG offers flow.
 */
export class OffersFlow {

  constructor() {
    /** @private @const {boolean} */
    this.isContainerBuilt_ = false;

    /** @private @const {boolean} */
    this.isAbbriviatedOffer_ = false;

    /** @private @const {number} */
    this.containerHeight_ = 200;

    /** @private @const {Element} */
    this.offerContainer_ = null;

    /** @private @const {boolean} */
    this.access_ = false;

    /**
     *  @private @const {Object}
     *  TODO(dparikh): Define the object type in externs.
     */
    this.subscriber_ = {};

    /**
     * @private @const {!Array<Object>}
     * TODO(dparikh): Define the object type in externs.
     */
    this.offersAbbreviated = [];

    /**
     * @private @const {!Array<Object>}
     * TODO(dparikh): Define the object type in externs.
     */
    this.offers = [];
  }

  /**
   * Creates the container element to hold the offers and payments iframe.
   * @private
   */
  createContainerElement_() {
    if (this.isElementexists_()) {
      console.log(`Error: Element <${POPUP_TAG}> exists!!`);
      return;
    }
    this.offerContainer_ = (document.createElement(POPUP_TAG));
    if (this.isValidElement_(this.offerContainer_)) {
      setCssAttributes(this.offerContainer_, this.containerHeight_);
      document.body.appendChild(this.offerContainer_);
      this.isContainerBuilt_ = true;
      return Promise.resolve();
    }
    Promise.reject();
  }

  /**
   * Checks if the element exists.
   * @return {boolean}
   * @private
   */
  isElementexists_() {
    return (document.getElementsByTagName(POPUP_TAG) == null);
  }

  /**
   * Checks that the custom element to hold the offers, exists and is of type
   * element.
   * @param {Element} element
   * @return {boolean}
   */
  isValidElement_(element) {
    return element != null && element.nodeName &&
        element.nodeName == POPUP_TAG.toUpperCase() &&
        element.nodeType == 1;
  }

  /**
   * Adds the abbriviated offers as a friendly iframe in the element.
   * @private
   */
  addAbbriviatedOfferFrame_() {
    if (!this.offerContainer_) {
      console.log('Error: element <${POPUP_TAG}> not found!');
      return;
    }

    const iFrame = document.createElement('iframe');
    // TODO(dparikh): Polyfill 'srcdoc'.
    // Ref.: https://github.com/ampproject/amphtml/blob/master/src/friendly-iframe-embed.js#L148-L163
    iFrame.srcdoc = getAbbriviatedOffers();
    iFrame.id = 'offer-frame';
    iFrame.name = 'offer-frame';
    iFrame.style.position = 'fixed';
    iFrame.style.display = 'flex';
    iFrame.style.left = 0;
    iFrame.style.right = 0;
    iFrame.style.opacity = .97;
    iFrame.style.border = 'none';
    iFrame.style.width = '100%';
    iFrame.style.border = 'none';
    iFrame.style.backgroundColor = '#fff';
    // TODO(dparikh): Vendor prefix for 'box-sizing'.
    iFrame.style.boxSizing = 'border-box';
    iFrame.style.display = 'inline-block';
    iFrame.style.height = `${this.containerHeight_}px`;
    this.offerContainer_.appendChild(iFrame);
  }
}
