/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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


import {AbbreviatedView} from './abbreviated-view';
import {assert} from '../utils/log';
import {debounce} from '../utils/rate-limit';
import {Dialog} from '../components/dialog';
import {parseQueryString} from '../utils/url';
import {setImportantStyles} from '../utils/style';
import {transition} from '../utils/animation';

/**
 * The pop-up element name to be used.
 * @const {string}
 */
const POPUP_TAG = 'swg-popup';

/**
 * The fullscreen pop-up class name to be used.
 * @const {string}
 */
const POPUP_FULLSCREEN_CLASS = 'swg-popup-fullscreen';

/**
 * The default height of the pop-up.
 * @const {number}
 */
const CONTAINER_HEIGHT = 50;

/**
 * The max width of the pop-up.
 * @const {number}
 */
const MAX_POPUP_WIDTH = 480;

/**
 * The max height of the pop-up.
 * This is in aspect ratio of max-width of pop-up
 * @const {number}
 */
const MAX_POPUP_HEIGHT = 640;


/**
 * The class for SwG offers flow.
 */
export class SubscriptionsFlow {

  /**
   * @param {!Window} win The parent window.
   * @param {!SubscriptionMarkup} markup The markup object.
   * @param {!SubscriptionState} state The subscriptions state.
   */
  constructor(win, markup, state) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!SubscriptionMarkup} */
    this.markup_ = markup;

    /** @private @const {!SubscriptionState} */
    this.state_ = state;

    /** @private @const {!Dialog} */
    this.dialog_ = new Dialog(this.win_);

    /** @private {?Element} */
    this.offerContainer_ = null;

    /** @private {?View} */
    this.activeView_ = null;

    /** @private {boolean} */
    this.activeViewInitialized_ = false;

    /** @private {boolean} */
    this.shouldFadeBody_ = false;

    /** @private @const {!Element} */
    this.fadeBackground_ = this.document_.createElement('swg-popup-background');

    /**
     * Animates the resizing of view with additional debounce.
     * @param {!Element} view The current view.
     * @param {number} newHeight The new height of the element.
     * @private
     */
    this.animateResizeView_ =
        debounce(this.win_, this.animateResizeView_.bind(this), 300);

    /** @private {number} */
    this.winHeight_ = this.win_.innerHeight;

    this.orientationChangeListener_ =
        this.orientationChangeListener_.bind(this);

    /**
     * Listens to orientation change of window.
     */
    this.win_.addEventListener('orientationchange',
        this.orientationChangeListener_);

    this.complete_ = null;
  }

  /*
   * Starts the subscriptions flow.
   *
   * @return {!Promise}
   */
  start() {
    const urlLocation = this.win_.location;
    const isIframeRender = parseQueryString(urlLocation.search).iframe || 0;

    // This is to test existing implementation and iframe implementation.
    // TODO(dparikh): Remove this once iframe is fully implemented.
    if (isIframeRender == 0) {
      this.addOfferContainer_();
      this.show_();

      // Attach the invisible faded background to be used for some views.
      this.attachBackground_();

      this.openView_(new AbbreviatedView(
          this.win_,
          this,
          this.offerContainer_,
          this.state_.activeResponse)
          .onAlreadySubscribedClicked(this.activateLoginWith_.bind(this))
          .onSubscribeClicked(this.activateOffers_.bind(this)));
      return new Promise(resolve => {
        this.complete_ = resolve;
      });
    } else {
      this.dialog_.open().then(() => {
        // TODO(dparikh): Implementation.
      });

    }
  }

  /** @private */
  orientationChangeListener_() {
    // Orientation change doesn't trigger right screen sizes instantly.
    setTimeout(() => {
      this.winHeight_ = this.win_.innerHeight;
      this.resizeView(this.activeView_,
          this.activeView_.getElement().offsetHeight);
    }, 200);
  }

  /**
   * Attaches the hidden faded background to the parent document.
   * @private
   */
  attachBackground_() {
    setImportantStyles(this.fadeBackground_, {
      'display': 'none',
    });
    this.document_.body.appendChild(this.fadeBackground_);
  }

  /**
   * @param {!View} view
   * @return {!Promise}
   * @private
   */
  openView_(view) {
    this.unlockBodyScroll_();

    if (this.activeView_) {
      // Set initial height as previous screen so that content doesnt jump
      // Onload or Resize event will resize this to match content height.
      this.setBottomSheetHeight_(view.getElement(),
          this.activeView_.getElement().offsetHeight);
      this.offerContainer_.removeChild(this.activeView_.getElement());
      this.activeView_ = null;
    }
    this.activeView_ = view;
    this.shouldFadeBody_ = this.shouldFadeBody_ || view.shouldFadeBody();

    // If the current view should fade the parent document.
    if (this.shouldFadeBody_) {
      this.fadeTheParent_();
    }

    this.activeViewInitialized_ = false;
    setImportantStyles(view.getElement(), {
      'visibility': 'hidden',
      'opacity': 0,
    });
    this.offerContainer_.appendChild(view.getElement());
    return view.init().then(() => {
      view.getElement().classList.add('swg-step-appear');
      setImportantStyles(view.getElement(), {
        'visibility': 'visible',
        'opacity': 1,
      });

      this.activeViewInitialized_ = true;
    }, error => {
      throw error;
    });
  }

  /**
   * Fades the main page content when subscription offers view is rendered.
   * The content will be reset on close of the subscription popup.
   * @private
   */
  fadeTheParent_() {
    this.fadeBackground_.style.removeProperty('display');
  }

  /**
   * Adds bottom padding to the main Html element to allow scrolling through
   * the entire document content, hiding behind the <swg-popup> element.
   * @param {number} height The popup height.
   * @private
   */
  addBottomPaddingToHtml_(height) {
    if (height > 0) {
      const bottomPadding = height + 20;  // Add some extra padding.
      const htmlElement = this.document_.documentElement;

      setImportantStyles(htmlElement, {
        'padding-bottom': `${bottomPadding}px`,
      });
    }
  }

  /**
   * @param {boolean} busy
   */
  setBusy(busy) {
    if (!this.activeViewInitialized_) {
      return;
    }
    if (busy) {
      if (this.activeView_) {
        setImportantStyles(this.activeView_.getElement(), {
          'opacity': 0.5,
        });
      }
    } else {
      if (this.activeView_) {
        setImportantStyles(this.activeView_.getElement(), {
          'opacity': 1,
        });
      }
    }
  }

  /**
   * Resizes the view to the given height.
   * @param {!Element} view The current view.
   * @param {number} newHeight The new height of the element.
   * @param {boolean=} animate Animate the new height change or not.
   * @return {!Promise<number>}
   */
  resizeView(view, newHeight, animate = true) {
    if (view != this.activeView_) {
      return;
    }

    if (animate) {
      this.animateResizeView_(view, newHeight);
    } else {
      this.setBottomSheetHeight_(view.getElement(), newHeight);
    }
    return Promise.resolve(newHeight);
  }

  /**
   * Animates the resizing of view.
   * @param {!Element} view The current view.
   * @param {number} newHeight The new height of the element.
   * @private
   */
  animateResizeView_(view, newHeight) {
    const heightThreshold = this.winHeight_ * 0.7;

    const winHeight =
        this.win_.innerWidth > MAX_POPUP_WIDTH ?
            Math.min(this.winHeight_, MAX_POPUP_HEIGHT) :
            this.winHeight_;

    const oldHeight = view.getElement().offsetHeight;
    let delta = newHeight - oldHeight;

    if (newHeight > heightThreshold) {
      delta = winHeight - this.offerContainer_.offsetHeight;
      this.offerContainer_.classList.add(POPUP_FULLSCREEN_CLASS);
      // Setting this from js as 100vh in css would make screen jump due to
      // keyboard.
      setImportantStyles(this.offerContainer_, {
        'height': `${winHeight}px`,
      });
      this.lockBodyScroll_();
    } else if (oldHeight > heightThreshold) {
      this.unlockBodyScroll_();
      this.offerContainer_.classList.remove(POPUP_FULLSCREEN_CLASS);
      delta = newHeight - winHeight;
      // Not removing height here as it would because height it will shrink
      // without animation.
    }

    if (delta == 0) {
      // This might be needed in case height jumps above heightThreshold.
      this.setBottomSheetHeight_(view.getElement(), newHeight);
      return;
    }

    if (delta > 0) {
      this.setBottomSheetHeight_(view.getElement(), newHeight);

      // Adjust height and translate to show no difference in Y position.
      // We dont want animation happening at this step.
      setImportantStyles(this.offerContainer_, {
        'transition': 'none',
        'transform': `translateY(${delta}px)`,
      });

      this.win_.requestAnimationFrame(() => {
        this.win_.requestAnimationFrame(() => {
          this.animateViewToTransform_('none');
        });
      });
    } else {

      // First animate to scroll this down and then shrink the height.
      this.animateViewToTransform_(`translateY(${Math.abs(delta)}px)`)
          .then(() => {
            this.setBottomSheetHeight_(view.getElement(), newHeight);

            if (oldHeight > heightThreshold && newHeight <= heightThreshold) {
              this.offerContainer_.style.removeProperty('height');
            }

            setImportantStyles(this.offerContainer_, {
              'transform': 'none',
            });
          });
    }
  }

  /**
   * @private
   * @param {string} finalTransform Value of final transform property.
   */
  animateViewToTransform_(finalTransform) {
    return transition(this.offerContainer_, {
      'transform': finalTransform,
    }, 300, 'ease-out');
  }

  /**
   * @private
   * @param {!Element} view View of which height is to be set.
   * @param {!number} height New height of the view.
   */
  setBottomSheetHeight_(view, height) {
    setImportantStyles(view, {
      'height': `${height}px`,
    });

    // Add padding at the bootom of the page.
    this.addBottomPaddingToHtml_(height);
  }

  /**
   * @param  {boolean} shouldRetry True if the subscription flow should be
   *     restarted.
   * @private
   */
  close_(shouldRetry) {
    // Remove additional padding added at the document bottom.
    this.document_.documentElement.style.removeProperty('padding-bottom');

    // Remove the swg-popup element.
    this.offerContainer_.parentNode.removeChild(this.offerContainer_);

    // Remove the faded background from the parent document.
    this.document_.body.removeChild(this.fadeBackground_);

    // Unlock scroll on body.
    this.unlockBodyScroll_();

    // Remove event listener for orientation change.
    this.win_.removeEventListener('orientationchange',
        this.orientationChangeListener_);

    this.activeView_ = null;
    this.state_.shouldRetry = shouldRetry;
    this.complete_();
  }

  /**
   * @private
   */
  googleSigninConfirmed_() {
    // TODO(avimehta, #21): Restart authorization again, instead of redirect
    // here. (btw, it's fine if authorization restart does redirect itself when
    // needed)
    this.win_.location.assign(
        this.win_.location.origin +
        this.win_.location.pathname +
        '?test=1' +
        '&test_response=subscriber-response');
  }

  /**
   * Locks the scroll on body.
   * @private
   */
  lockBodyScroll_() {
    this.document_.body.classList.add('swg-locked');
  }

  /**
   * Unlocks the scroll on body.
   * @private
   */
  unlockBodyScroll_() {
    this.document_.body.classList.remove('swg-locked');
  }

  /**
   * @param {!number} selectedOfferIndex
   * @private
   */
  activatePay_(selectedOfferIndex) {
    const offer = this.state_.activeResponse['offer'][selectedOfferIndex];
    // First, try to pay via PaymentRequest.
    const prFlow =
        offer['paymentRequestJson'] ?
        this.executeViaPaymentRequest_(offer['paymentRequestJson']) :
        Promise.resolve(false);
    prFlow.then(working => {
      if (!working) {
      }
    });
  }

  /**
   * @param {!Object} paymentRequestJson
   * @return {!Promise<boolean>}
   * @private
   */
  executeViaPaymentRequest_(paymentRequestJson) {
    if (!this.win_.PaymentRequest ||
        !this.win_.PaymentRequest.prototype.canMakePayment) {
      return Promise.resolve(false);
    }

    // See https://www.w3.org/TR/payment-request/#constructing-a-paymentrequest
    const methods = paymentRequestJson['methods'];
    const details = paymentRequestJson['details'];
    const options = {
      'requestPayerName': true,
      'requestPayerEmail': true,
    };
    const request = new this.win_.PaymentRequest(methods, details, options);
    return request.canMakePayment().then(result => {
      if (!result) {
        return false;
      }
      request.show().then(result => {
        if (result) {
          this.paymentComplete_();
        }
      });
      return true;
    });
  }

  /**
   * @param {Object} payload indicates if the payment was successful or not.
   * @private
   */
  paymentComplete_(payload) {
    // If payload and payload.data are present, the payment was successful.
    this.close_(!!(payload && payload.data));
  }

  /**
   * Builds and renders the  offers container and it's UI elements.
   * @private
   */
  addOfferContainer_() {
    // Ensure that the element is not already built by external resource.
    assert(!this.document_.querySelector(POPUP_TAG),
        'Only one instance of the popup tag is allowed!');

    this.offerContainer_ = this.document_.createElement(POPUP_TAG);

    // Add UI elements to offerContainer_
    const closeButton = this.document_.createElement('div');
    closeButton.classList.add('swg-close-action');
    closeButton.setAttribute('role', 'button');
    this.offerContainer_.appendChild(closeButton);
    closeButton.addEventListener('click', () => this.close_(false));

    // Add Google bar.
    const googleBar = this.document_.createElement('div');
    googleBar.classList.add('swg-google-bar');
    for (let i = 0; i < 4; i++) {
      const swgBar = this.document_.createElement('div');
      googleBar.appendChild(swgBar);
      swgBar.classList.add('swg-bar');
    }
    this.offerContainer_.appendChild(googleBar);

    setImportantStyles(this.offerContainer_, {
      'min-height': `${CONTAINER_HEIGHT}px`,
      'display': 'none',
      'opacity': 1,
    });
    this.document_.body.appendChild(this.offerContainer_);
  }

/**
   * Displays the element in the UI. Element is hidden when created,
   * and should now be displayed when element is attached to the DOM.
   * @private
   */
  show_() {
    this.offerContainer_.style.removeProperty('display');
  }
}
