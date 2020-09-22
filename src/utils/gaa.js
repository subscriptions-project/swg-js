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

const REGWALL_HTML = `
<html>
  <head>
    <style>
      .card-spacer {
        bottom: 0;
        position: absolute;
        width: 100%;
      }

      .card {
        background: white;
        border-radius: 12px 12px 0 0;
        margin: 0 auto;
        padding: 20px;
        width: 410px;
      }
    </style>
  </head>

  <body>
    <div class="card-spacer">
      <div class="card">
        <div>[Google logo]</div>

        <div>Get more with Google</div>

        <div>
          You're out of free articles, so sign in. Lorem ipsum dolor sit amet,
          consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
          labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
          exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </div>

        <div id="swg-google-sign-in-button"></div>
      </div>
    </div>
  </body>
</html>
`;

/** Renders Google Article Access (GAA) Metering Regwall. */
export class GaaMeteringRegwall {
  /**
   * Returns a promise with Google User object:
   * Reference: https://developers.google.com/identity/sign-in/web/reference#users
   * Example usage: https://developers.google.com/identity/sign-in/web
   * @param {{ googleSignInClientId: string }} params
   * @return {!Promise}
   */
  static show({googleSignInClientId}) {
    this.addGoogleSignInMetaTag_(googleSignInClientId);
    return this.loadGoogleSignInJs_().then(this.renderCard_);
  }

  /**
   * Signs the user out.
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

    const el = self.document.createElement('meta');
    el.name = 'google-signin-client_id';
    el.content = clientId;
    self.document.head.appendChild(el);
  }

  /** @return {!Promise} */
  static loadGoogleSignInJs_() {
    return new Promise((resolve) => {
      const script = self.document.createElement('script');
      script.onload = resolve;
      script.src = 'https://apis.google.com/js/platform.js';
      self.document.body.appendChild(script);
    });
  }

  /** @return {!Promise} */
  static renderCard_() {
    const doc = self.document;
    const el = doc.createElement('div');
    el.style.backgroundColor = 'rgba(0,0,0,0.5)';
    el.style.border = 'none';
    el.style.bottom = '0';
    el.style.height = '100%';
    el.style.left = '0';
    el.style.position = 'fixed';
    el.style.right = '0';
    el.style.top = '0';
    el.style.width = '100%';
    el.style.zIndex = 2147483646;
    el.innerHTML = REGWALL_HTML;
    doc.body.appendChild(el);

    return new Promise((resolve, reject) => {
      self.gapi.signin2.render('swg-google-sign-in-button', {
        'scope': 'profile email',
        'width': 240,
        'height': 50,
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
