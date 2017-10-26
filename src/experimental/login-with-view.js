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
  createElement,
  getMetaTagValue,
  injectFontsLink,
  injectStyleSheet,
} from '../utils/dom';
import {setImportantStyles} from '../utils/style';
import {IFRAME_CLASS} from './utils';
import {CSS as OFFERS_CSS} from
    '../../build/css/experimental/swg-popup-offer.css';

/** @const {string} */
const GOOGLE_FONTS_URL =
    'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';


/**
 * Login with View. User could be a subscriber through "Subscribe with Google"
 * service or with the publisher. Render options to login through either with
 * Google or with the publisher. Clicking on either button will launch a new
 * window to login.
 */
export class LoginWithView {

   /**
    * @param {!Window} win The parent window object.
    * @param {!PopupContext} context The Subscription container reference.
    * @param {!Element} offerContainer The offer container element <swg-popup>.
    */
  constructor(win, context, offerContainer) {

    /** @private @const {!Window} */
    this.win_ = win;

    /** @const @private {!PopupContext} */
    this.context_ = context;

    /** @private @const {!Element} */
    this.offerContainer_ = offerContainer;

    /** @private @const {!Element} */
    this.document_ = win.document;

    /** @private @const {!Element} */
    this.viewElement_ = createElement(this.document_, 'iframe', {
      'frameborder': 0,
      'top': '4px',  // Space for the top 4px high Google bar.
      'scrolling': 'no',
      'class': IFRAME_CLASS,
    });

    this.viewElementDoc_ = null;
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.viewElement_;
  }

  /**
   * Returns if document should fade for this view.
   * @return {boolean}
   */
  shouldFadeBody() {
    return true;
  }

  /**
   * Initializes the "Login with" view in the <swg-popup>.
   * @return {!Promise}
   */
  init() {
    const iframe = this.viewElement_;

    const readyPromise = new Promise(resolve => {
      iframe.onload = resolve;
    });
    this.offerContainer_.appendChild(this.viewElement_);

    return readyPromise.then(() => {
      this.viewElementDoc_ = this.viewElement_.contentDocument;
      const doc = iframe.contentDocument;
      injectFontsLink(doc, GOOGLE_FONTS_URL);
      injectStyleSheet(doc, OFFERS_CSS);

      setImportantStyles(doc.body, {
        'padding': 0,
        'margin': 0,
      });

      const container = this.injectContainer_();

      this.injectSignInContent_(container);

      doc.body.appendChild(container);
    });
  }

  /**
   * Creates container element and injects in the BODY section of iframe.
   * @private
   */
  injectContainer_() {
    const doc = this.viewElementDoc_;
    const container = createElement(doc, 'div', {});
    container.classList.add('swg-container', 'swg-signin-container');
    setImportantStyles(container, {
      'align-items': 'center',
    });
    return container;
  }

  /**
   * Injects sign-in content.
   * @param {!Element} container The container div (class='swg-container').
   */
  injectSignInContent_(container) {
    const signInHeader = createElement(this.viewElementDoc_, 'div', {
      'class': 'swg-signin-header',
    });

    signInHeader.textContent = 'Choose account to Sign in with';
    container.appendChild(signInHeader);

    this.injectGoogleSigninButton_(container);
    this.injectPublisherSigninButton_(container);
  }

  /**
   * Injects Google sign-in button.
   * @param {!Element} container The container div (class='swg-container').
   */
  injectGoogleSigninButton_(container) {
    const gSignInLabel = createElement(this.viewElementDoc_, 'span', {});
    gSignInLabel.textContent = 'Sign in with Google';

    const gSignInButton = createElement(this.viewElementDoc_, 'div', {
      'class': 'swg-button-content',
    });

    const gSignInIcon = createElement(this.viewElementDoc_, 'div', {
      'class': 'swg-icon',
    });

    const gSignInButtonIcon = createElement(this.viewElementDoc_, 'div', {
      'class': 'swg-button-icon',
    });

    const gSignInButtonContent = createElement(this.viewElementDoc_, 'div', {
      'class': 'swg-button-content-wrapper',
    });

    const gSwgButton = createElement(this.viewElementDoc_, 'div', {
      'role': 'button',
      'tabindex': 1,
    });
    gSwgButton.classList.add('swg-button');
    setImportantStyles(gSwgButton, {
      'margin': '8px',
    });

    gSignInButton.appendChild(gSignInLabel);
    gSignInButtonIcon.appendChild(gSignInIcon);

    gSignInButtonContent.appendChild(gSignInButtonIcon);
    gSignInButtonContent.appendChild(gSignInButton);

    gSwgButton.appendChild(gSignInButtonContent);
    container.appendChild(gSwgButton);
  }

  /**
   * Injects publisher sign-in button.
   * @param {!Element} container The container div (class='swg-container').
   */
  injectPublisherSigninButton_(container) {
    const signInLabel = createElement(this.viewElementDoc_, 'span', {});
    signInLabel.textContent = 'Sign in with Scenic';

    const signInButton = createElement(this.viewElementDoc_, 'div', {
      'class': 'swg-button-content',
    });

    const signInButtonContent = createElement(this.viewElementDoc_, 'div', {
      'class': 'swg-button-content-wrapper',
    });

    const swgButton = createElement(this.viewElementDoc_, 'div', {
      'role': 'button',
      'tabindex': 1,
      'class': 'swg-button',
    });
    setImportantStyles(swgButton, {
      'background-color':
          getMetaTagValue(this.document_, 'msapplication-TileColor'),
      'margin-top': '24px',
    });

    signInButton.appendChild(signInLabel);
    signInButtonContent.appendChild(signInButton);
    swgButton.appendChild(signInButtonContent);
    container.appendChild(swgButton);
  }
 }
