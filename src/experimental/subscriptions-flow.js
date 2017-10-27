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
  isSubscriber,
} from './utils';
import {AbbreviatedView} from './abbreviated-view';
import {CSS as SWG_POPUP} from '../../build/css/experimental/swg-popup.css';
import {debounce} from '../utils/rate-limit';
import {LoadingView} from './loading-view';
import {LoginWithView} from './login-with-view';
import {NotificationView} from './notification-view';
import {OffersView} from './offers-view';
import {PaymentsView} from './payments-view';
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
 * @param {!SubscriptionMarkup} markup The markup object.
 * @param {!SubscriptionResponse} response
 */
export function buildSubscriptionsUi(win, markup, response) {

  // Ensure that the element is not already built by external resource.
  assertNoPopups(win.document, POPUP_TAG);

  // Gets subscription details and build the pop-up.

  // TODO(dparikh): See if multiple CSS be built and used based on the
  // current view. (Currently, injects one CSS for everything).
  injectCssToWindow_();

  if (isSubscriber(response)) {
    new NotificationView(win, response).start();
  } else {
    new SubscriptionsFlow(win, markup, response).start();
  }

  /**
   * Injects common CSS styles to the container window's <head> element.
   * @private
   */
  function injectCssToWindow_() {
    const style = win.document.createElement('style');
    style.textContent = `${SWG_POPUP}`;
    win.document.head.appendChild(style);
  }
}


/**
 * The class for SwG offers flow.
 */
export class SubscriptionsFlow {

  /**
   * @param {!Window} win The parent window.
   * @param {!SubscriptionMarkup} markup The markup object.
   * @param {!SubscriptionResponse} response The subscriptions object.
   */
  constructor(win, markup, response) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!SubscriptionMarkup} */
    this.markup_ = markup;

    /** @private @const {!SubscriptionResponse} */
    this.subscription_ = response;

    /** @private {?Element} */
    this.offerContainer_ = null;

    /** @private {?LoadingView} */
    this.loadingView_ = null;

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
  }

  /*
   * Starts the subscriptions flow.
   */
  start() {
    this.offerContainer_ = this.document_.createElement(POPUP_TAG);

    // Add close button with action.
    this.addCloseButton_();

    this.addGoogleBar_();

    setImportantStyles(this.offerContainer_, {
      'min-height': `${CONTAINER_HEIGHT}px`,
      'display': 'none',
      'opacity': 1,
    });
    this.document_.body.appendChild(this.offerContainer_);

    this.show_();

    // Attach the invisible faded background to be used for some views.
    this.attachBackground_();

    // Build the loading indicator.
    this.loadingView_ = new LoadingView(this.win_, this.offerContainer_);

    this.openView_(new AbbreviatedView(
        this.win_,
        this,
        this.offerContainer_,
        this.subscription_)
        .onAlreadySubscribedClicked(this.activateLoginWith_.bind(this))
        .onSubscribeClicked(this.activateOffers_.bind(this)));
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
    this.loadingView_.show();
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
      this.loadingView_.hide();
      view.getElement().classList.add('swg-step-appear');
      setImportantStyles(view.getElement(), {
        'visibility': 'visible',
        'opacity': 1,
      });

      this.activeViewInitialized_ = true;
    }, error => {
      this.loadingView_.hide();
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
      // TODO(dparikh): Read the existing padding with the unit value
      // (em, ex, %, px, cm, mm, in, pt, pc), and if available then append the
      // padding after converting the units.
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
      this.loadingView_.show();
      if (this.activeView_) {
        setImportantStyles(this.activeView_.getElement(), {
          'opacity': 0.5,
        });
      }
    } else {
      this.loadingView_.hide();
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

  /** @private */
  close_() {
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
  }

  /** @private */
  activateLoginWith_() {
    this.openView_(new LoginWithView(
      this.win_,
      this.markup_,
      this,
      this.offerContainer_));
  }

  /**
   * @private
   */
  activateOffers_() {
    this.openView_(new OffersView(this.win_,
      this,
      this.offerContainer_,
      this.subscription_).onSubscribeClicked(this.activatePay_.bind(this)));
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
    const offer = this.subscription_['offer'][selectedOfferIndex];
    // First, try to pay via PaymentRequest.
    const prFlow =
        offer['paymentRequestJson'] ?
        this.executeViaPaymentRequest_(offer['paymentRequestJson']) :
        Promise.resolve(false);
    prFlow.then(working => {
      if (!working) {
        // Fallback to the inline flow.
        const paymentRequestBlob = offer['paymentRequest'];
        this.openView_(new PaymentsView(this.win_, this, paymentRequestBlob)
            .onComplete(this.paymentComplete_.bind(this)));
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

  /** @private */
  paymentComplete_() {
    this.close_();
    /* TODO(dvoytenko): Remove when integration with backend/OMS is complete.
    if (this.win_.sessionStorage) {
      this.win_.sessionStorage.setItem('subscriberData', JSON.stringify({
        'types': ['premium'],
        'expires': Date.now() + 1000 * 60 * 5,  // 5min
      }));
    }
    */
    // TODO(avimehta, #21): Restart authorization again, instead of redirect
    // here. (btw, it's fine if authorization restart does redirect itself when
    // needed)
    this.win_.location.reload(true);
  }

  /**
   * Builds and renders the close pop-up dialog button.
   * TODO(dparikh): Use the setImportantStyles() as discussed.
   * @private
   */
  addCloseButton_() {
    const closeButton = this.document_.createElement('div');
    closeButton.classList.add('swg-close-action');
    closeButton.setAttribute('role', 'button');
    this.offerContainer_.appendChild(closeButton);


    closeButton.addEventListener('click', () => this.close_());
  }

  /**
   * Adds the top Google branding multi-color bar.
   * @private
   */
  addGoogleBar_() {
    const googleBar = this.document_.createElement('div');
    googleBar.classList.add('swg-google-bar');
    for (let i = 0; i < 4; i++) {
      const swgBar = this.document_.createElement('div');
      googleBar.appendChild(swgBar);
      swgBar.classList.add('swg-bar');
    }
    this.offerContainer_.appendChild(googleBar);
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
