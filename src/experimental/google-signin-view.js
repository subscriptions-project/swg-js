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


import {CSS as GOOGLE_SIGNIN_CSS} from
    '../../build/css/experimental/google-signin-view.css';
import {IFRAME_CLASS} from './utils';
import {
  createElement,
  injectFontsLink,
  injectStyleSheet,
} from '../utils/dom.js';
import {setImportantStyles} from '../utils/style';

/** @const {string} */
const GOOGLE_FONTS_URL =
    'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';


/**
 * Google Sign-in view.
 */
export class GoogleSigninView {

  /**
   * @param {!Window} win The parent window object.
   * @param {!Element} context The Subscription container reference.
   * @param {!Element} container The container element <swg-popup>.
   */
  constructor(win, context, container) {

     /** @private @const {!Window} */
    this.win_ = win;

    /** @const @private {!PopupContext} */
    this.context_ = context;

     /** @private @const {!Element} */
    this.document_ = win.document;

     /** @private @const {!Element} */
    this.container_ = container;

    /** @private @const {!Element} */
    this.element_ = createElement(this.document_, 'iframe', {
      'class': IFRAME_CLASS,
      'frameborder': 0,
      'scrolling': 'no',
      'top': '4px',  // Space for the top 4px high Google bar.
    });

    /** @private {?function(!Object)} */
    this.onSignedIn_ = null;
  }

  /**
   * @param {function(!Object)} callback
   * @return {!GoogleSigninView}
   */
  onSignedIn(callback) {
    this.onSignedIn_ = callback;
    return this;
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.element_;
  }

  /**
   * Initializes and renders the sign-in.
   * @return {!Promise}
   */
  init() {
    return this.build_();
  }

  /**
   * Returns if document should fade for this view.
   * @return {boolean}
   */
  shouldFadeBody() {
    return true;
  }

  /*
   * Builds the sign-in element within the <swg-popup> element.
   * @return {!Promise}
   * @private
   */
  build_() {
    const iframe = this.element_;

    const readyPromise = new Promise(resolve => {
      iframe.onload = resolve;
    });
    this.container_.appendChild(iframe);

    return readyPromise.then(() => {
      const doc = iframe.contentDocument;
      injectFontsLink(doc, GOOGLE_FONTS_URL);
      injectStyleSheet(doc, GOOGLE_SIGNIN_CSS);

      setImportantStyles(doc.body, {
        'padding': 0,
        'margin': 0,
      });

      const container = createElement(doc, 'div', {
        'class': 'swg-container swg-google-signin-container',
      });
      doc.body.appendChild(container);

      const signInHeader = createElement(doc, 'div', {
        'class': 'swg-google-signin-header',
      }, 'Sign in with Google');
      container.appendChild(signInHeader);

      const userSignIn = createElement(doc, 'div', {
        'class': 'swg-google-signin-item',
      }, [
        createElement(doc, 'img', {
          'class': 'swg-google-signin-item-icon',
          'src': 'https://lh4.googleusercontent.com/-kMCa2CY9V_s/AAAAAAAAAAI/AAAAAAAAAA8/xzV4vlsg1go/photo.jpg?sz=96',
        }),
        createElement(doc, 'div', {
          'class': 'swg-google-signin-item-label',
        }, [
          createElement(doc, 'div', {
            'class': 'swg-google-signin-item-label-name',
          }, 'Dima Test'),
          createElement(doc, 'div', {
            'class': 'swg-google-signin-item-label-email',
          }, 'dvtest2016@gmail.com'),
        ]),
      ]);
      container.appendChild(userSignIn);
      userSignIn.addEventListener('click', () => {
        this.onSignedIn_({
          id: 'dvtest2016@gmail.com',
          name: 'Dima Test',
          email: 'dvtest2016@gmail.com',
        });
      });

      const addAccount = createElement(doc, 'div', {
        'class': 'swg-google-signin-item',
      }, [
        createElement(doc, 'div', {
          'class': 'swg-google-signin-item-icon swg-google-signin-item-icon-ac',
        }),
        createElement(doc, 'div', {
          'class': 'swg-google-signin-item-label',
        }, [
          createElement(doc, 'div', {
            'class': 'swg-google-signin-item-label-name',
          }, 'Another Google account'),
        ]),
      ]);
      container.appendChild(addAccount);
      addAccount.addEventListener('click', () => {
        this.win_.location.assign(
            'https://accounts.google.com/AddSession?hl=en&continue=' +
            encodeURIComponent('https://www.google.com/'));
      });
    });
  }
}
