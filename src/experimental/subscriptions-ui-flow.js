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
  setCssAttributes,
} from './subscriptions-ui-util';
import {getSubscriptionDetails} from './subscriptions-ui-service';
import {AbbreviatedOffersUi} from './abbreviated-offers-ui';
import {LoadingUi} from './loading-ui';
import {CSS as SWG_POPUP} from '../../build/css/experimental/swg-popup.css';
import {NotificationUi} from './notification-ui';
import {PaymentsView} from './payments-flow';
import {setImportantStyles} from '../utils/style';

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
  getSubscriptionDetails().then(response => {
    // TODO(dparikh): See if multiple CSS be built and used based on the
    // current view. (Currently, injects one CSS for everything).
    injectCssToWindow_();

    if (isSubscriber(response)) {
      new NotificationUi(win, response).start();
    } else {
      new SubscriptionsUiFlow(win, response).start();
    }
  });

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
export class SubscriptionsUiFlow {

  constructor(win, response) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!SubscriptionResponse} */
    this.subscription_ = response;

    /** @private {?Element} */
    this.offerContainer_ = null;

    /** @private {?LoadingUi} */
    this.loadingUi_ = null;

    /** @private {?View} */
    this.activeView_ = null;

    /** @private {boolean} */
    this.activeViewInitialized_ = false;
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

    this.show_();

    // Build the loading indicator.
    this.loadingUi_ = new LoadingUi(this.win_, this.offerContainer_);

    this.openView_(new AbbreviatedOffersUi(
        this.win_,
        this.offerContainer_,
        this.subscription_)
        .onSubscribeClicked(this.activatePay_.bind(this)));
  }

  /**
   * @param {!View} view
   * @return {!Promise}
   * @private
   */
  openView_(view) {
    this.loadingUi_.show();

    if (this.activeView_) {
      this.offerContainer_.removeChild(this.activeView_.getElement());
      this.activeView_ = null;
    }
    this.activeView_ = view;
    this.activeViewInitialized_ = false;
    setImportantStyles(view.getElement(), {
      'visibility': 'hidden',
      'opacity': 0,
    });
    this.offerContainer_.appendChild(view.getElement());
    return view.init().then(() => {
      // TODO(dparikh): Transition necessary height and possible fade in content.
      this.loadingUi_.hide();
      setImportantStyles(view.getElement(), {
        'visibility': 'visible',
        'opacity': 1,
      });
      this.activeViewInitialized_ = true;
    }, error => {
      this.loadingUi_.hide();
      throw error;
    });
  }

  /**
   * @param {boolean} busy
   */
  setBusy(busy) {
    if (!this.activeViewInitialized_) {
      return;
    }
    if (busy) {
      this.loadingUi_.show();
      if (this.activeView_) {
        setImportantStyles(this.activeView_.getElement(), {
          'opacity': 0.5,
        });
      }
    } else {
      this.loadingUi_.hide();
      if (this.activeView_) {
        setImportantStyles(this.activeView_.getElement(), {
          'opacity': 1,
        });
      }
    }
  }

  /** @private */
  close_() {
    this.offerContainer_.parentNode.removeChild(this.offerContainer_);
  }

  /** @private */
  activatePay_() {
    this.openView_(new PaymentsView(this.win_, this)
        .onComplete(this.paymentComplete_.bind(this)));
  }

  /** @private */
  paymentComplete_() {
    this.close_();
    // TODO(avimehta): Restart authorization again.
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
    closeButton.textContent = '\u00D7';

    closeButton.addEventListener('click', () => this.close_());
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
