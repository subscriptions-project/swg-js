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

import {setImportantStyles} from './style';

/** ID for the Google Sign-In button element. */
const GOOGLE_SIGN_IN_BUTTON_ID = 'swg-google-sign-in-button';

/** HTML for the metering regwall dialog, where users can sign in with Google. */
const REGWALL_HTML = `
<style>
  .gaa-metering-regwall--card-spacer,
  .gaa-metering-regwall--card,
  .gaa-metering-regwall--logo,
  .gaa-metering-regwall--title,
  .gaa-metering-regwall--description,
  .gaa-metering-regwall--button {
    all: initial;
    box-sizing: border-box;
    display: block;
    font-family: sans-serif;
  }

  .gaa-metering-regwall--card-spacer {
    bottom: 0;
    display: block;
    position: absolute;
    width: 100%;
  }

  .gaa-metering-regwall--card {
    background: white;
    border-radius: 12px 12px 0 0;
    box-shadow: 0px -2px 6px rgba(0, 0, 0, 0.3);
    display: block;
    margin: 0 auto;
    padding: 24px 20px;
    width: 410px;
  }

  .gaa-metering-regwall--logo {
    display: block;
    margin: 0 auto 24px;
  }

  .gaa-metering-regwall--title {
    color: #000;
    font-size: 16px;
    margin: 0 0 8px;
  }
  
  .gaa-metering-regwall--description {
    color: #646464;
    font-size: 14px;
    margin: 0 0 20px;
  }

  .gaa-metering-regwall--button {
    display: block;
    min-height: 36px;
  }
</style>

<div class="gaa-metering-regwall--card-spacer">
  <div class="gaa-metering-regwall--card">
    <img class="gaa-metering-regwall--logo" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3NCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDc0IDI0Ij48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNOS4yNCA4LjE5djIuNDZoNS44OGMtLjE4IDEuMzgtLjY0IDIuMzktMS4zNCAzLjEtLjg2Ljg2LTIuMiAxLjgtNC41NCAxLjgtMy42MiAwLTYuNDUtMi45Mi02LjQ1LTYuNTRzMi44My02LjU0IDYuNDUtNi41NGMxLjk1IDAgMy4zOC43NyA0LjQzIDEuNzZMMTUuNCAyLjVDMTMuOTQgMS4wOCAxMS45OCAwIDkuMjQgMCA0LjI4IDAgLjExIDQuMDQuMTEgOXM0LjE3IDkgOS4xMyA5YzIuNjggMCA0LjctLjg4IDYuMjgtMi41MiAxLjYyLTEuNjIgMi4xMy0zLjkxIDIuMTMtNS43NSAwLS41Ny0uMDQtMS4xLS4xMy0xLjU0SDkuMjR6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTI1IDYuMTljLTMuMjEgMC01LjgzIDIuNDQtNS44MyA1LjgxIDAgMy4zNCAyLjYyIDUuODEgNS44MyA1LjgxczUuODMtMi40NiA1LjgzLTUuODFjMC0zLjM3LTIuNjItNS44MS01LjgzLTUuODF6bTAgOS4zM2MtMS43NiAwLTMuMjgtMS40NS0zLjI4LTMuNTIgMC0yLjA5IDEuNTItMy41MiAzLjI4LTMuNTJzMy4yOCAxLjQzIDMuMjggMy41MmMwIDIuMDctMS41MiAzLjUyLTMuMjggMy41MnoiLz48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNNTMuNTggNy40OWgtLjA5Yy0uNTctLjY4LTEuNjctMS4zLTMuMDYtMS4zQzQ3LjUzIDYuMTkgNDUgOC43MiA0NSAxMmMwIDMuMjYgMi41MyA1LjgxIDUuNDMgNS44MSAxLjM5IDAgMi40OS0uNjIgMy4wNi0xLjMyaC4wOXYuODFjMCAyLjIyLTEuMTkgMy40MS0zLjEgMy40MS0xLjU2IDAtMi41My0xLjEyLTIuOTMtMi4wN2wtMi4yMi45MmMuNjQgMS41NCAyLjMzIDMuNDMgNS4xNSAzLjQzIDIuOTkgMCA1LjUyLTEuNzYgNS41Mi02LjA1VjYuNDloLTIuNDJ2MXptLTIuOTMgOC4wM2MtMS43NiAwLTMuMS0xLjUtMy4xLTMuNTIgMC0yLjA1IDEuMzQtMy41MiAzLjEtMy41MiAxLjc0IDAgMy4xIDEuNSAzLjEgMy41NC4wMSAyLjAzLTEuMzYgMy41LTMuMSAzLjV6Ii8+PHBhdGggZmlsbD0iI0ZCQkMwNSIgZD0iTTM4IDYuMTljLTMuMjEgMC01LjgzIDIuNDQtNS44MyA1LjgxIDAgMy4zNCAyLjYyIDUuODEgNS44MyA1LjgxczUuODMtMi40NiA1LjgzLTUuODFjMC0zLjM3LTIuNjItNS44MS01LjgzLTUuODF6bTAgOS4zM2MtMS43NiAwLTMuMjgtMS40NS0zLjI4LTMuNTIgMC0yLjA5IDEuNTItMy41MiAzLjI4LTMuNTJzMy4yOCAxLjQzIDMuMjggMy41MmMwIDIuMDctMS41MiAzLjUyLTMuMjggMy41MnoiLz48cGF0aCBmaWxsPSIjMzRBODUzIiBkPSJNNTggLjI0aDIuNTF2MTcuNTdINTh6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTY4LjI2IDE1LjUyYy0xLjMgMC0yLjIyLS41OS0yLjgyLTEuNzZsNy43Ny0zLjIxLS4yNi0uNjZjLS40OC0xLjMtMS45Ni0zLjctNC45Ny0zLjctMi45OSAwLTUuNDggMi4zNS01LjQ4IDUuODEgMCAzLjI2IDIuNDYgNS44MSA1Ljc2IDUuODEgMi42NiAwIDQuMi0xLjYzIDQuODQtMi41N2wtMS45OC0xLjMyYy0uNjYuOTYtMS41NiAxLjYtMi44NiAxLjZ6bS0uMTgtNy4xNWMxLjAzIDAgMS45MS41MyAyLjIgMS4yOGwtNS4yNSAyLjE3YzAtMi40NCAxLjczLTMuNDUgMy4wNS0zLjQ1eiIvPjwvc3ZnPg==" />

    <div class="gaa-metering-regwall--title">Get more with Google</div>

    <div class="gaa-metering-regwall--description">
      You're out of free articles, so sign in. Lorem ipsum dolor sit amet,
      consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
      labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
      exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
    </div>

    <a id="${GOOGLE_SIGN_IN_BUTTON_ID}"
          class="gaa-metering-regwall--button">
    </a>
  </div>
</div>
`;

/** Where to load the JS for Google Sign-In. */
const GOOGLE_SIGN_IN_JS_URL = 'https://apis.google.com/js/platform.js';

/** Renders Google Article Access (GAA) Metering Regwall. */
export class GaaMeteringRegwall {
  /**
   * Returns a promise with Google User object:
   * Reference: https://developers.google.com/identity/sign-in/web/reference#users
   * Example usage: https://developers.google.com/identity/sign-in/web
   *
   * This method opens a metering regwall dialog,
   * where users can sign in with Google.
   * @param {{ googleSignInClientId: string }} params
   * @return {!Promise}
   */
  static show({googleSignInClientId}) {
    this.addGoogleSignInMetaTag_(googleSignInClientId);
    return this.loadGoogleSignInJs_().then(this.renderCard_);
  }

  /**
   * Signs the user out.
   *
   * This method signs the user out of Google Sign-In.
   * This is useful for developers who are testing their
   * SwG integrations.
   * @param {{ googleSignInClientId: string }} params
   * @return {!Promise}
   */
  static signOut({googleSignInClientId}) {
    this.addGoogleSignInMetaTag_(googleSignInClientId);
    return this.loadGoogleSignInJs_()
      .then(
        () =>
          new Promise((resolve) => {
            self.gapi.load('auth2', () => {
              resolve(self.gapi.auth2.init());
            });
          })
      )
      .then(() => self.gapi.auth2.getAuthInstance().signOut());
  }

  /**
   * Adds Google Sign-In meta tag, if necessary.
   * @param {string} clientId
   */
  static addGoogleSignInMetaTag_(clientId) {
    if (self.document.querySelector('meta[name="google-signin-client_id"]')) {
      return;
    }

    /** @type {!HTMLMetaElement} */
    const el = /** @type {!HTMLMetaElement} */ (self.document.createElement(
      'meta'
    ));
    el.name = 'google-signin-client_id';
    el.content = clientId;
    self.document.head.appendChild(el);
  }

  /** @return {!Promise} */
  static loadGoogleSignInJs_() {
    return new Promise((resolve) => {
      const script = self.document.createElement('script');
      script.onload = resolve;
      script.src = GOOGLE_SIGN_IN_JS_URL;
      self.document.body.appendChild(script);
    });
  }

  /** @return {!Promise} */
  static renderCard_() {
    const el = /** @type {!HTMLDivElement} */ (self.document.createElement(
      'div'
    ));
    setImportantStyles(el, {
      'background-color': 'rgba(0,0,0,0.5)',
      'border': 'none',
      'bottom': '0',
      'height': '100%',
      'left': '0',
      'position': 'fixed',
      'right': '0',
      'top': '0',
      'width': '100%',
      'z-index': 2147483646,
    });
    el./*OK*/ innerHTML = REGWALL_HTML;
    self.document.body.appendChild(el);

    return new Promise((resolve, reject) => {
      self.gapi.signin2.render(GOOGLE_SIGN_IN_BUTTON_ID, {
        'scope': 'profile email',
        'width': 370,
        'longtitle': true,
        'theme': 'dark',
        'onsuccess': resolve,
        'onfailure': reject,
      });
    }).then((result) => {
      el.remove();
      return result;
    });
  }
}

self.GaaMeteringRegwall = GaaMeteringRegwall;
