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
  renderOffers,
  SWG_OFFER_ITEM_CLASS,
  SWG_OFFER_CONTENT_CLASS,
} from './subscriptions-ui-util';
import {setImportantStyles} from '../utils/style';


/**
 *  Offers view. Renders the content in the parent <swg-popup>
 * element. Checks the state of <swg-popup> element to ensure that the no other
 * element exists. Hides the loading indicator once rendered.
 */
export class OffersView {

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
    this.offersElement_ = this.document_.createElement('iframe');

    /** @private {?function()} */
    this.subscribeClicked_ = null;

    /** @private @const {function()} */
    this.ref_ = this.boundResizeListener_.bind(this);

    /** @private {number} */
    this.selectedOfferIndex_ = null;
  }

  /**
   * @param {function()} callback
   * @return {!OffersView}
   */
  onSubscribeClicked(callback) {
    this.subscribeClicked_ = callback;
    return this;
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.offersElement_;
  }

  /**
   * Initializes the offers and renders in the <swg-popup>.
   * @return {!Promise}
   */
  init() {
    const subscriptions = this.subscriptions_;
    if (!subscriptions.offer || subscriptions.offer.length == 0) {
      throw new Error('No offers available!');
    }
    return this.buildOffers_(subscriptions)
        .then(this.boundOfferSelection_.bind(this))
        .then(this.show.bind(this));
  }

  /*
   * Shows the offers element within the <swg-popup> element.
   */
  show() {
    this.offersElement_.style.removeProperty('display');
  }

  /*
   * Hides the  offers element within the <swg-popup> element.
   */
  hide() {
    this.offersElement_.style
        .setProperty('display', 'none', 'important');
  }

  /*
   * Builds the  offers element within the <swg-popup> element.
   * @return {!Promise}
   * @private
   */
  buildOffers_() {
    const iframe = this.offersElement_;
     // TODO(dparikh): Polyfill 'srcdoc'.
     // Ref.: https://github.com/ampproject/amphtml/blob/master/src/friendly-iframe-embed.js#L148-L163
    iframe.srcdoc = renderOffers(this.subscriptions_);
    iframe.setAttribute('frameborder', 0);
    iframe.setAttribute('scrolling', 'no');

    // It's important to add `onload` callback before appending to DOM, otherwise
    // onload could arrive immediately.
    const readyPromise = new Promise(resolve => {
      iframe.onload = resolve;
    });
    this.offerContainer_.appendChild(iframe);

    //iframe.contentWindow.addEventListener('resize', this.ref_);
    return readyPromise.then(() => {
      const subscribeButton = iframe.contentDocument.getElementById(
          'swg-button');

      subscribeButton.onclick = () => {
        this.subscribeClicked_(this.selectedOfferIndex_);
      };

      setImportantStyles(iframe, {
        'opacity': 1,
        'border': 'none',
        'width': '100%',
        'background-color': '#fff',
      });

      const height = iframe.contentDocument.body.scrollHeight;

      // If iframe's scrollHeight is available, use it skip adding an event
      // listener for the 'resize' event. This check is to protect the case,
      // when 'onload' event does not report the iframe's scrollHeight.
      if (height > 0) {
        this.ref_();
      } else {
        // The correct scrollHeight of iframe's document is available only after
        // 'resize' event, at least in Chrome (latest), for ref:
        // https://bugs/chromium.org/p/chromium/issues/detail?id=34224
        // After reading the iframe height, this event listener is removed.
        iframe.contentWindow.addEventListener('resize', this.ref_);
      }
    });
  }

  /**
   * Binds the selection event to the offers.
   * @private
   */
  boundOfferSelection_() {
    this.setSelectedOfferIndex_();
    const iframe = this.offersElement_;
    const offerItems =
        iframe.contentDocument.querySelectorAll(`.${SWG_OFFER_ITEM_CLASS}`);
    offerItems.forEach(offerItem => offerItem
        .addEventListener('click', this.offerSelectionTrigger_.bind(this)));

    offerItems.forEach(offerItem => offerItem
        .addEventListener('keyup', this.offerSelectionTrigger_.bind(this)));
    return this;
  }

  /**
   * Sets the index of the selected offer for later use.
   * Defaults to first offer.
   * @param {?number} index The offer index (zero based).
   */
  setSelectedOfferIndex_(index = 0) {
    // If user has clicked/Pressed Enter key on existing offer.
    if (this.selectedOfferIndex_ == index) {
      return;
    }

    const previousOfferIndex = this.selectedOfferIndex_;
    this.selectedOfferIndex_ = index;

    this.updateOfferSelection_(this.selectedOfferIndex_, previousOfferIndex);
  }

  /**
   * Updates the offer selection in the UI by highlighting the new selection
   * and removing the previous selection.
   * @param {number} currentOfferIndex
   * @param {?number} previousOfferIndex
   * @private
   */
  updateOfferSelection_(currentOfferIndex, previousOfferIndex) {
    const iframe = this.offersElement_;
    const offerContainer = iframe.contentDocument
        .querySelector(`#${SWG_OFFER_CONTENT_CLASS}`);
    offerContainer.children[currentOfferIndex].classList.add('checked');
    if (previousOfferIndex != undefined) {
      offerContainer.children[previousOfferIndex].classList.remove('checked');
    }
  }

  /**
   * Selects the new offer, either by mouse click or by focusing the new
   * offer and pressing the Enter key.
   * @param {!Event} event The event object.
   * @private
   */
  offerSelectionTrigger_(event) {
    if (!event.target.dataset.offerIndex) {
      throw new Error('No offers selected!');
    }
    // TODO(dparikh): Define constants for keyCode(s).
    if (event.keyCode == 13 || event.type == 'click') {
      const index = event.target.dataset.offerIndex;
      this.setSelectedOfferIndex_(index);
    }
  }

  /**
   * Listens for the iframe content resize to notify the parent container.
   * The event listener is removed after reading the correct height.
   * @param {!Event=} event
   * @private
   */
  boundResizeListener_(event = null) {
    const iframe = this.offersElement_;
    const height = iframe.contentDocument.body.scrollHeight;
    this.context_.resizeView(this, height).then(() => {
      if (event) {
        event.currentTarget.removeEventListener(event.type, this.ref_);
      }
    });
  }
 }
