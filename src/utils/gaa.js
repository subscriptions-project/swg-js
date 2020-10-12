/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

// PLEASE DO NOT HOST THIS FILE YOURSELF. DOING SO WILL BREAK THINGS.
//
// Publishers should load this file from:
// https://news.google.com/swg/js/v1/swg-gaa.js
//
// Thanks!

// eslint-disable-next-line no-unused-vars
import {Subscriptions} from '../api/subscriptions';
import {setImportantStyles} from './style';

/** ID for the Google Sign-In button element. */
const GOOGLE_SIGN_IN_BUTTON_ID = 'swg-google-sign-in-button';

/** ID for the Publisher sign-in button element. */
const PUBLISHER_SIGN_IN_BUTTON_ID = 'swg-publisher-sign-in-button';

/** ID for the Regwall element. */
const REGWALL_ID = 'swg-regwall-element';

/**
 * HTML for the metering regwall dialog, where users can sign in with Google.
 * The script creates a dialog based on this HTML.
 */
const REGWALL_HTML = `
<style>
  .gaa-metering-regwall--card-spacer,
  .gaa-metering-regwall--card,
  .gaa-metering-regwall--logo,
  .gaa-metering-regwall--title,
  .gaa-metering-regwall--description,
  .gaa-metering-regwall--description strong,
  .gaa-metering-regwall--publisher-sign-in-button,
  .gaa-metering-regwall--publisher-no-thanks-button {
    all: initial;
    box-sizing: border-box;
    font-family: Roboto, arial, sans-serif;
  }

  .gaa-metering-regwall--card-spacer {
    bottom: 0;
    display: block;
    position: fixed;
    width: 100%;
  }

  @keyframes slideUp {
    from {transform: translate(0, 200px);}
    to {transform: translate(0, 0);}
  }

  .gaa-metering-regwall--card {
    animation: slideUp 0.5s;
    background: white;
    border-radius: 12px 12px 0 0;
    box-shadow: 0px -2px 6px rgba(0, 0, 0, 0.3);
    display: block;
    margin: 0 auto;
    max-width: 100%;
    padding: 24px 20px;
    width: 410px;
  }

  .gaa-metering-regwall--logo {
    display: block;
    margin: 0 auto 24px;
  }

  .gaa-metering-regwall--title {
    color: #000;
    display: block;
    font-size: 16px;
    margin: 0 0 8px;
  }
  
  .gaa-metering-regwall--description {
    color: #646464;
    display: block;
    font-size: 14px;
    line-height: 19px;
    margin: 0 0 30px;
  }

  .gaa-metering-regwall--description strong {
    color: #646464;
    font-size: 14px;
    line-height: 19px;
    font-weight: bold;
  }

  .gaa-metering-regwall--line {
    background-color: #ddd;
    display: block;
    height: 1px;
    margin: 0 0 24px;
  }

  .gaa-metering-regwall--publisher-sign-in-button,
  .gaa-metering-regwall--publisher-no-thanks-button {
    color: #1967d2;
    display: block;
    cursor: pointer;
    font-size: 12px;
  }

  .gaa-metering-regwall--publisher-sign-in-button {
  }

  .gaa-metering-regwall--publisher-no-thanks-button {
    display: none;
    float: right;
  }

  .gaa-metering-regwall--google-sign-in-button {
    height: 36px;
    margin: 0 auto 30px;
  }

  .gaa-metering-regwall--google-sign-in-button > div {
    animation: swgGoogleSignInButtonfadeIn 0.32s;
  }

  @keyframes swgGoogleSignInButtonfadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .gaa-metering-regwall--google-sign-in-button .abcRioButton.abcRioButtonBlue {
    background-color: #1A73E8;
    box-shadow: none;
    -webkit-box-shadow: none;
    border-radius: 4px;
    width: 100% !important;
  }

  .gaa-metering-regwall--google-sign-in-button .abcRioButton.abcRioButtonBlue .abcRioButtonIcon {
    display: none;
  }

  .gaa-metering-regwall--google-sign-in-button .abcRioButton.abcRioButtonBlue .abcRioButtonContents {
    font-size: 15px !important;
  }
</style>

<div class="gaa-metering-regwall--card-spacer">
  <div class="gaa-metering-regwall--card">
    <img class="gaa-metering-regwall--logo" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3NCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDc0IDI0Ij48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNOS4yNCA4LjE5djIuNDZoNS44OGMtLjE4IDEuMzgtLjY0IDIuMzktMS4zNCAzLjEtLjg2Ljg2LTIuMiAxLjgtNC41NCAxLjgtMy42MiAwLTYuNDUtMi45Mi02LjQ1LTYuNTRzMi44My02LjU0IDYuNDUtNi41NGMxLjk1IDAgMy4zOC43NyA0LjQzIDEuNzZMMTUuNCAyLjVDMTMuOTQgMS4wOCAxMS45OCAwIDkuMjQgMCA0LjI4IDAgLjExIDQuMDQuMTEgOXM0LjE3IDkgOS4xMyA5YzIuNjggMCA0LjctLjg4IDYuMjgtMi41MiAxLjYyLTEuNjIgMi4xMy0zLjkxIDIuMTMtNS43NSAwLS41Ny0uMDQtMS4xLS4xMy0xLjU0SDkuMjR6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTI1IDYuMTljLTMuMjEgMC01LjgzIDIuNDQtNS44MyA1LjgxIDAgMy4zNCAyLjYyIDUuODEgNS44MyA1LjgxczUuODMtMi40NiA1LjgzLTUuODFjMC0zLjM3LTIuNjItNS44MS01LjgzLTUuODF6bTAgOS4zM2MtMS43NiAwLTMuMjgtMS40NS0zLjI4LTMuNTIgMC0yLjA5IDEuNTItMy41MiAzLjI4LTMuNTJzMy4yOCAxLjQzIDMuMjggMy41MmMwIDIuMDctMS41MiAzLjUyLTMuMjggMy41MnoiLz48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNNTMuNTggNy40OWgtLjA5Yy0uNTctLjY4LTEuNjctMS4zLTMuMDYtMS4zQzQ3LjUzIDYuMTkgNDUgOC43MiA0NSAxMmMwIDMuMjYgMi41MyA1LjgxIDUuNDMgNS44MSAxLjM5IDAgMi40OS0uNjIgMy4wNi0xLjMyaC4wOXYuODFjMCAyLjIyLTEuMTkgMy40MS0zLjEgMy40MS0xLjU2IDAtMi41My0xLjEyLTIuOTMtMi4wN2wtMi4yMi45MmMuNjQgMS41NCAyLjMzIDMuNDMgNS4xNSAzLjQzIDIuOTkgMCA1LjUyLTEuNzYgNS41Mi02LjA1VjYuNDloLTIuNDJ2MXptLTIuOTMgOC4wM2MtMS43NiAwLTMuMS0xLjUtMy4xLTMuNTIgMC0yLjA1IDEuMzQtMy41MiAzLjEtMy41MiAxLjc0IDAgMy4xIDEuNSAzLjEgMy41NC4wMSAyLjAzLTEuMzYgMy41LTMuMSAzLjV6Ii8+PHBhdGggZmlsbD0iI0ZCQkMwNSIgZD0iTTM4IDYuMTljLTMuMjEgMC01LjgzIDIuNDQtNS44MyA1LjgxIDAgMy4zNCAyLjYyIDUuODEgNS44MyA1LjgxczUuODMtMi40NiA1LjgzLTUuODFjMC0zLjM3LTIuNjItNS44MS01LjgzLTUuODF6bTAgOS4zM2MtMS43NiAwLTMuMjgtMS40NS0zLjI4LTMuNTIgMC0yLjA5IDEuNTItMy41MiAzLjI4LTMuNTJzMy4yOCAxLjQzIDMuMjggMy41MmMwIDIuMDctMS41MiAzLjUyLTMuMjggMy41MnoiLz48cGF0aCBmaWxsPSIjMzRBODUzIiBkPSJNNTggLjI0aDIuNTF2MTcuNTdINTh6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTY4LjI2IDE1LjUyYy0xLjMgMC0yLjIyLS41OS0yLjgyLTEuNzZsNy43Ny0zLjIxLS4yNi0uNjZjLS40OC0xLjMtMS45Ni0zLjctNC45Ny0zLjctMi45OSAwLTUuNDggMi4zNS01LjQ4IDUuODEgMCAzLjI2IDIuNDYgNS44MSA1Ljc2IDUuODEgMi42NiAwIDQuMi0xLjYzIDQuODQtMi41N2wtMS45OC0xLjMyYy0uNjYuOTYtMS41NiAxLjYtMi44NiAxLjZ6bS0uMTgtNy4xNWMxLjAzIDAgMS45MS41MyAyLjIgMS4yOGwtNS4yNSAyLjE3YzAtMi40NCAxLjczLTMuNDUgMy4wNS0zLjQ1eiIvPjwvc3ZnPg==" />

    <div class="gaa-metering-regwall--title">Get more with Google</div>

    <div class="gaa-metering-regwall--description">
      You’re out of articles from <strong>$publisherName$</strong>. Read more articles, compliments of Google, when you register with your Google Account.
    </div>

    <div id="${GOOGLE_SIGN_IN_BUTTON_ID}"
         class="gaa-metering-regwall--google-sign-in-button"></div>

    <div class="gaa-metering-regwall--line"></div>

    <a
        id="${PUBLISHER_SIGN_IN_BUTTON_ID}"
        class="gaa-metering-regwall--publisher-sign-in-button">
      Already have an account?
    </a>
  </div>
</div>
`;

/** Renders Google Article Access (GAA) Metering Regwall. */
export class GaaMeteringRegwall {
  /**
   * Returns a promise for a GAA user.
   *
   * This method opens a metering regwall dialog,
   * where users can sign in with Google.
   * @nocollapse
   * @param {{ publisherName: string, redirectUri: string }} params
   * @return {!Promise}
   */
  static show({publisherName, redirectUri}) {
    return GaaMeteringRegwall.render_({publisherName, redirectUri});
  }

  /**
   * Signs out of Google Sign-In.
   * This is useful for developers who are testing their
   * SwG integrations.
   * @nocollapse
   * @return {!Promise}
   */
  static signOut() {
    return this.configureGoogleSignIn().then(() =>
      self.gapi.auth2.getAuthInstance().signOut()
    );
  }

  /**
   * Redirects user to article URL.
   * @nocollapse
   */
  static redirectToArticle() {
    const articleUrl = sessionStorage.gaaRegwallArticleUrl;
    if (articleUrl) {
      delete sessionStorage.gaaRegwallArticleUrl;
      location.href = articleUrl;
    }
  }

  /**
   * Configures Google Sign-In.
   * @nocollapse
   * @param {{ redirectUri: string }=} params
   * @return {!Promise}
   */
  static configureGoogleSignIn({redirectUri} = {redirectUri: ''}) {
    // Wait for Google Sign-In API.
    return (
      new Promise((resolve) => {
        const apiCheckInterval = setInterval(() => {
          if (!!self.gapi) {
            clearInterval(apiCheckInterval);
            resolve();
          }
        }, 50);
      })
        // Load Auth2 module.
        .then(() => new Promise((resolve) => self.gapi.load('auth2', resolve)))
        // Specify "redirect" mode. It plays nicer with webviews.
        .then(
          () =>
            // Only initialize Google Sign-In once.
            self.gapi.auth2.getAuthInstance() ||
            self.gapi.auth2.init({
              'ux_mode': 'redirect',
              'redirect_uri': redirectUri,
            })
        )
    );
  }

  /**
   * Renders the Regwall.
   * @private
   * @nocollapse
   * @param {{ publisherName: string, redirectUri: string }} params
   * @return {!Promise}
   */
  static render_({publisherName, redirectUri}) {
    const cardEl = /** @type {!HTMLDivElement} */ (self.document.createElement(
      'div'
    ));
    cardEl.id = REGWALL_ID;
    setImportantStyles(cardEl, {
      'all': 'unset',
      'background-color': 'rgba(32, 33, 36, 0.6)',
      'border': 'none',
      'bottom': '0',
      'height': '100%',
      'left': '0',
      'opacity': '0',
      'position': 'fixed',
      'right': '0',
      'transition': 'opacity 0.5s',
      'top': '0',
      'width': '100%',
      'z-index': 2147483646,
    });
    cardEl./*OK*/ innerHTML = REGWALL_HTML.replace(
      '$publisherName$',
      publisherName
    );
    self.document.body.appendChild(cardEl);
    /** @suppress {suspiciousCode} */
    cardEl.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(cardEl, {'opacity': 1});
    GaaMeteringRegwall.addClickListenerOnPublisherSignInButton_();

    // Save article URL for redirect.
    sessionStorage.gaaRegwallArticleUrl = location.href;

    // Render the Google Sign-In button.
    GaaMeteringRegwall.renderGoogleSignInButton_({redirectUri});

    // Currently users can't dismiss the Regwall.
    // This might change in the future.
    // This promise leaves room for a dismissal feature.
    // This feature would cause the returned promise to reject.
    // Returning a promise from day one encourages publishers to write
    // JS that supports this possibility.
    return new Promise(() => {});
  }

  /**
   * Removes the Regwall.
   * @private
   * @nocollapse
   */
  static remove_() {
    self.document.getElementById(REGWALL_ID).remove();
  }

  /**
   * Adds a click listener on the publisher sign-in button.
   * @private
   * @nocollapse
   */
  static addClickListenerOnPublisherSignInButton_() {
    self.document
      .getElementById(PUBLISHER_SIGN_IN_BUTTON_ID)
      .addEventListener('click', () => {
        (self.SWG = self.SWG || []).push((subscriptions) => {
          /** @type {!Subscriptions} */ (subscriptions).triggerLoginRequest({
            linkRequested: false,
          });
        });
      });
  }

  /**
   * Renders the Google Sign-In button.
   * @private
   * @nocollapse
   * @param {{ redirectUri: string }} params
   */
  static renderGoogleSignInButton_({redirectUri}) {
    this.configureGoogleSignIn({redirectUri}).then(() => {
      self.gapi.signin2.render(GOOGLE_SIGN_IN_BUTTON_ID, {
        'scope': 'profile email',
        'longtitle': true,
        'theme': 'dark',
      });
    });
  }
}

self.GaaMeteringRegwall = GaaMeteringRegwall;
