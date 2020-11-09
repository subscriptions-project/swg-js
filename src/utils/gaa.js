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
import {parseJson} from '../utils/json';
import {setImportantStyles} from './style';

/** Stamp for post messages. */
export const POST_MESSAGE_STAMP = 'swg-gaa-post-message-stamp';

/** Introduction command for post messages. */
export const POST_MESSAGE_COMMAND_INTRODUCTION = 'introduction';

/** User command for post messages. */
export const POST_MESSAGE_COMMAND_USER = 'user';

/** ID for the Google Sign-In iframe element. */
export const GOOGLE_SIGN_IN_IFRAME_ID = 'swg-google-sign-in-iframe';

/** ID for the Google Sign-In button element. */
const GOOGLE_SIGN_IN_BUTTON_ID = 'swg-google-sign-in-button';

/** ID for the Publisher sign-in button element. */
const PUBLISHER_SIGN_IN_BUTTON_ID = 'swg-publisher-sign-in-button';

/** ID for the Regwall container element. */
const REGWALL_CONTAINER_ID = 'swg-regwall-container';

/** ID for the Regwall dialog element. */
export const REGWALL_DIALOG_ID = 'swg-regwall-dialog';

/** ID for the Regwall title element. */
export const REGWALL_TITLE_ID = 'swg-regwall-title';

/**
 * HTML for the metering regwall dialog, where users can sign in with Google.
 * The script creates a dialog based on this HTML.
 *
 * The HTML includes an iframe that loads the Google Sign-In button.
 * This iframe can live on a different origin.
 */
const REGWALL_HTML = `
<style>
  .gaa-metering-regwall--dialog-spacer,
  .gaa-metering-regwall--dialog,
  .gaa-metering-regwall--logo,
  .gaa-metering-regwall--title,
  .gaa-metering-regwall--description,
  .gaa-metering-regwall--description strong,
  .gaa-metering-regwall--iframe,
  .gaa-metering-regwall--publisher-no-thanks-button {
    all: initial;
    box-sizing: border-box;
    font-family: Roboto, arial, sans-serif;
  }

  .gaa-metering-regwall--dialog-spacer {
    bottom: 0;
    display: block;
    position: fixed;
    width: 100%;
  }

  @keyframes slideUp {
    from {transform: translate(0, 200px);}
    to {transform: translate(0, 0);}
  }

  .gaa-metering-regwall--dialog {
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

  .gaa-metering-regwall--iframe {
    border: none;
    display: block;
    height: 36px;
    margin: 0 0 30px;
    width: 100%;
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

<div class="gaa-metering-regwall--dialog-spacer">
  <div role="dialog" aria-modal="true" class="gaa-metering-regwall--dialog" id="${REGWALL_DIALOG_ID}" aria-labelledby="${REGWALL_TITLE_ID}">
    <img alt="Google" class="gaa-metering-regwall--logo" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3NCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDc0IDI0Ij48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNOS4yNCA4LjE5djIuNDZoNS44OGMtLjE4IDEuMzgtLjY0IDIuMzktMS4zNCAzLjEtLjg2Ljg2LTIuMiAxLjgtNC41NCAxLjgtMy42MiAwLTYuNDUtMi45Mi02LjQ1LTYuNTRzMi44My02LjU0IDYuNDUtNi41NGMxLjk1IDAgMy4zOC43NyA0LjQzIDEuNzZMMTUuNCAyLjVDMTMuOTQgMS4wOCAxMS45OCAwIDkuMjQgMCA0LjI4IDAgLjExIDQuMDQuMTEgOXM0LjE3IDkgOS4xMyA5YzIuNjggMCA0LjctLjg4IDYuMjgtMi41MiAxLjYyLTEuNjIgMi4xMy0zLjkxIDIuMTMtNS43NSAwLS41Ny0uMDQtMS4xLS4xMy0xLjU0SDkuMjR6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTI1IDYuMTljLTMuMjEgMC01LjgzIDIuNDQtNS44MyA1LjgxIDAgMy4zNCAyLjYyIDUuODEgNS44MyA1LjgxczUuODMtMi40NiA1LjgzLTUuODFjMC0zLjM3LTIuNjItNS44MS01LjgzLTUuODF6bTAgOS4zM2MtMS43NiAwLTMuMjgtMS40NS0zLjI4LTMuNTIgMC0yLjA5IDEuNTItMy41MiAzLjI4LTMuNTJzMy4yOCAxLjQzIDMuMjggMy41MmMwIDIuMDctMS41MiAzLjUyLTMuMjggMy41MnoiLz48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNNTMuNTggNy40OWgtLjA5Yy0uNTctLjY4LTEuNjctMS4zLTMuMDYtMS4zQzQ3LjUzIDYuMTkgNDUgOC43MiA0NSAxMmMwIDMuMjYgMi41MyA1LjgxIDUuNDMgNS44MSAxLjM5IDAgMi40OS0uNjIgMy4wNi0xLjMyaC4wOXYuODFjMCAyLjIyLTEuMTkgMy40MS0zLjEgMy40MS0xLjU2IDAtMi41My0xLjEyLTIuOTMtMi4wN2wtMi4yMi45MmMuNjQgMS41NCAyLjMzIDMuNDMgNS4xNSAzLjQzIDIuOTkgMCA1LjUyLTEuNzYgNS41Mi02LjA1VjYuNDloLTIuNDJ2MXptLTIuOTMgOC4wM2MtMS43NiAwLTMuMS0xLjUtMy4xLTMuNTIgMC0yLjA1IDEuMzQtMy41MiAzLjEtMy41MiAxLjc0IDAgMy4xIDEuNSAzLjEgMy41NC4wMSAyLjAzLTEuMzYgMy41LTMuMSAzLjV6Ii8+PHBhdGggZmlsbD0iI0ZCQkMwNSIgZD0iTTM4IDYuMTljLTMuMjEgMC01LjgzIDIuNDQtNS44MyA1LjgxIDAgMy4zNCAyLjYyIDUuODEgNS44MyA1LjgxczUuODMtMi40NiA1LjgzLTUuODFjMC0zLjM3LTIuNjItNS44MS01LjgzLTUuODF6bTAgOS4zM2MtMS43NiAwLTMuMjgtMS40NS0zLjI4LTMuNTIgMC0yLjA5IDEuNTItMy41MiAzLjI4LTMuNTJzMy4yOCAxLjQzIDMuMjggMy41MmMwIDIuMDctMS41MiAzLjUyLTMuMjggMy41MnoiLz48cGF0aCBmaWxsPSIjMzRBODUzIiBkPSJNNTggLjI0aDIuNTF2MTcuNTdINTh6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTY4LjI2IDE1LjUyYy0xLjMgMC0yLjIyLS41OS0yLjgyLTEuNzZsNy43Ny0zLjIxLS4yNi0uNjZjLS40OC0xLjMtMS45Ni0zLjctNC45Ny0zLjctMi45OSAwLTUuNDggMi4zNS01LjQ4IDUuODEgMCAzLjI2IDIuNDYgNS44MSA1Ljc2IDUuODEgMi42NiAwIDQuMi0xLjYzIDQuODQtMi41N2wtMS45OC0xLjMyYy0uNjYuOTYtMS41NiAxLjYtMi44NiAxLjZ6bS0uMTgtNy4xNWMxLjAzIDAgMS45MS41MyAyLjIgMS4yOGwtNS4yNSAyLjE3YzAtMi40NCAxLjczLTMuNDUgMy4wNS0zLjQ1eiIvPjwvc3ZnPg==" />

    <div class="gaa-metering-regwall--title" id="${REGWALL_TITLE_ID}" tabindex="0">Get more with Google</div>

    <div class="gaa-metering-regwall--description">
      You’re out of articles from <strong>$publisherName$</strong>. Read more articles, compliments of Google, when you register with your Google Account.
    </div>

    <iframe
        id="${GOOGLE_SIGN_IN_IFRAME_ID}"
        class="gaa-metering-regwall--iframe"
        src="$iframeUrl$">
    </iframe>

    <div class="gaa-metering-regwall--line"></div>

    <a
        id="${PUBLISHER_SIGN_IN_BUTTON_ID}"
        class="gaa-metering-regwall--publisher-sign-in-button"
        tabindex="0"
        href="#">
      Already have an account?
    </a>
  </div>
</div>
`;

/** Styles for the Google Sign-In button iframe. */
const GOOGLE_SIGN_IN_IFRAME_STYLES = `
body {
  margin: 0;
  overflow: hidden;
}
#${GOOGLE_SIGN_IN_BUTTON_ID} {
  margin: 0 auto;
}
#${GOOGLE_SIGN_IN_BUTTON_ID} > div {
  animation: fadeIn 0.32s;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
#${GOOGLE_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue {
  background-color: #1A73E8;
  box-shadow: none;
  -webkit-box-shadow: none;
  border-radius: 4px;
  width: 100% !important;
}
#${GOOGLE_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonIcon {
  display: none;
}
#${GOOGLE_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonContents {
  font-size: 15px !important;
}
`;

/**
 * User object that Publisher JS receives after users sign in.
 * @typedef {{
 *   idToken: string,
 *   name: string,
 *   givenName: string,
 *   familyName: string,
 *   imageUrl: string,
 *   email: string,
 * }} GaaUserDef
 */
let GaaUserDef;

/**
 * GoogleUser object that Google Sign-In returns after users sign in.
 * https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile
 * @typedef {{
 *   getAuthResponse: function(): {id_token: string},
 *   getBasicProfile: function(): {
 *     getName: function(): string,
 *     getGivenName: function(): string,
 *     getFamilyName: function(): string,
 *     getImageUrl: function(): string,
 *     getEmail: function(): string,
 *   },
 * }} GoogleUserDef
 */
let GoogleUserDef;

/** Renders Google Article Access (GAA) Metering Regwall. */
export class GaaMeteringRegwall {
  /**
   * Returns a promise for a Google Sign-In user object.
   * https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile
   *
   * This method opens a metering regwall dialog,
   * where users can sign in with Google.
   * @nocollapse
   * @param {{ iframeUrl: string }} params
   * @return {!Promise<!GaaUserDef>}
   */
  static show({iframeUrl}) {
    GaaMeteringRegwall.render_({iframeUrl});
    GaaMeteringRegwall.sendIntroMessageToGsiIframe_({iframeUrl});
    return GaaMeteringRegwall.getGaaUser_().then((gaaUser) => {
      GaaMeteringRegwall.remove_();
      return gaaUser;
    });
  }

  /**
   * Signs out of Google Sign-In.
   * This is useful for developers who are testing their
   * SwG integrations.
   * @nocollapse
   * @return {!Promise}
   */
  static signOut() {
    return configureGoogleSignIn().then(() =>
      self.gapi.auth2.getAuthInstance().signOut()
    );
  }

  /**
   * Renders the Regwall.
   * @private
   * @nocollapse
   * @param {{ iframeUrl: string }} params
   */
  static render_({iframeUrl}) {
    const containerEl = /** @type {!HTMLDivElement} */ (self.document.createElement(
      'div'
    ));
    containerEl.id = REGWALL_CONTAINER_ID;
    setImportantStyles(containerEl, {
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
    containerEl./*OK*/ innerHTML = REGWALL_HTML.replace(
      '$iframeUrl$',
      iframeUrl
    ).replace(
      '$publisherName$',
      GaaMeteringRegwall.getPublisherNameFromPageConfig_()
    );
    self.document.body.appendChild(containerEl);
    /** @suppress {suspiciousCode} */
    containerEl.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(containerEl, {'opacity': 1});
    GaaMeteringRegwall.addClickListenerOnPublisherSignInButton_();

    // Focus on the title after the dialog animates in.
    // This helps people using screenreaders.
    const dialogEl = self.document.getElementById(REGWALL_DIALOG_ID);
    dialogEl.addEventListener('animationend', () => {
      const titleEl = self.document.getElementById(REGWALL_TITLE_ID);
      titleEl.focus();
    });
  }

  /**
   * Gets publisher name from page config.
   * @private
   * @nocollapse
   * @return {string}
   */
  static getPublisherNameFromPageConfig_() {
    const ldJsonElements = self.document.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    for (let i = 0; i < ldJsonElements.length; i++) {
      const ldJsonElement = ldJsonElements[i];
      const ldJson = /** @type {{ publisher: { name: string } }} */ (parseJson(
        ldJsonElement.textContent
      ));
      if (ldJson.publisher && ldJson.publisher.name) {
        return ldJson.publisher.name;
      }
    }

    throw new Error('Article needs JSON-LD with a publisher name.');
  }

  /**
   * Adds a click listener on the publisher sign-in button.
   * @private
   * @nocollapse
   */
  static addClickListenerOnPublisherSignInButton_() {
    self.document
      .getElementById(PUBLISHER_SIGN_IN_BUTTON_ID)
      .addEventListener('click', (e) => {
        e.preventDefault();
        (self.SWG = self.SWG || []).push((subscriptions) => {
          /** @type {!Subscriptions} */ (subscriptions).triggerLoginRequest({
            linkRequested: false,
          });
        });
      });
  }

  /**
   * Returns the GAA user, after the user signs in.
   * @private
   * @nocollapse
   * @return {!Promise<!GoogleUserDef>}
   */
  static getGaaUser_() {
    // Listen for GAA user.
    return new Promise((resolve) => {
      self.addEventListener('message', (e) => {
        if (
          e.data.stamp === POST_MESSAGE_STAMP &&
          e.data.command === POST_MESSAGE_COMMAND_USER
        ) {
          resolve(e.data.gaaUser);
        }
      });
    });
  }

  /**
   * Sends intro post message to Google Sign-In iframe.
   * @private
   * @nocollapse
   * @param {{ iframeUrl: string }} params
   */
  static sendIntroMessageToGsiIframe_({iframeUrl}) {
    // Introduce this window to the publisher's Google Sign-In iframe.
    // This lets the iframe send post messages back to this window.
    // Without the introduction, the iframe wouldn't have a reference to this window.
    const googleSignInIframe = /** @type {!HTMLIFrameElement} */ (self.document.getElementById(
      GOOGLE_SIGN_IN_IFRAME_ID
    ));
    googleSignInIframe.onload = () => {
      googleSignInIframe.contentWindow.postMessage(
        {
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_INTRODUCTION,
        },
        new URL(iframeUrl).origin
      );
    };
  }

  /**
   * Removes the Regwall.
   * @private
   * @nocollapse
   */
  static remove_() {
    self.document.getElementById(REGWALL_CONTAINER_ID).remove();
  }
}

self.GaaMeteringRegwall = GaaMeteringRegwall;

export class GaaGoogleSignInButton {
  /**
   * Renders the Google Sign-In button.
   * @nocollapse
   * @param {{ allowedOrigins: !Array<string> }} params
   */
  static show({allowedOrigins}) {
    // Apply iframe styles.
    const styleEl = self.document.createElement('style');
    styleEl./*OK*/ innerText = GOOGLE_SIGN_IN_IFRAME_STYLES;
    self.document.head.appendChild(styleEl);

    // Promise a function that sends messages to the parent frame.
    // Note: A function is preferable to a reference to the parent frame
    // because referencing the parent frame outside of the 'message' event
    // handler throws an Error. A function defined within the handler can
    // effectively save a reference to the parent frame though.
    const sendMessageToParentFnPromise = new Promise((resolve) => {
      self.addEventListener('message', (e) => {
        if (
          allowedOrigins.indexOf(e.origin) !== -1 &&
          e.data.stamp === POST_MESSAGE_STAMP &&
          e.data.command === POST_MESSAGE_COMMAND_INTRODUCTION
        ) {
          resolve((message) => {
            e.source.postMessage(message, e.origin);
          });
        }
      });
    });

    // Render the Google Sign-In button.
    configureGoogleSignIn()
      .then(
        // Promise credentials.
        () =>
          new Promise((resolve) => {
            // Render the Google Sign-In button.
            const buttonEl = self.document.createElement('div');
            buttonEl.id = GOOGLE_SIGN_IN_BUTTON_ID;
            buttonEl.tabIndex = 0;
            self.document.body.appendChild(buttonEl);
            self.gapi.signin2.render(GOOGLE_SIGN_IN_BUTTON_ID, {
              'scope': 'profile email',
              'longtitle': true,
              'theme': 'dark',
              'onsuccess': resolve,
            });
          })
      )
      .then((googleUser) => {
        // Gather GAA user details.
        const basicProfile = /** @type {!GoogleUserDef} */ (googleUser).getBasicProfile();
        /** @type {!GaaUserDef} */
        const gaaUser = {
          idToken: /** @type {!GoogleUserDef} */ (googleUser).getAuthResponse()
            .id_token,
          name: basicProfile.getName(),
          givenName: basicProfile.getGivenName(),
          familyName: basicProfile.getFamilyName(),
          imageUrl: basicProfile.getImageUrl(),
          email: basicProfile.getEmail(),
        };

        // Send GAA user to parent frame.
        sendMessageToParentFnPromise.then((sendMessageToParent) => {
          sendMessageToParent({
            stamp: POST_MESSAGE_STAMP,
            command: POST_MESSAGE_COMMAND_USER,
            gaaUser,
          });
        });
      });
  }
}

self.GaaGoogleSignInButton = GaaGoogleSignInButton;

/**
 * Loads the Google Sign-In API.
 *
 * This function is used in two places.
 * 1. The publisher's Google Sign-In iframe.
 * 2. (Optional) Demos that allow users to sign out.
 *
 * @return {!Promise}
 */
function configureGoogleSignIn() {
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
          self.gapi.auth2.getAuthInstance() || self.gapi.auth2.init()
      )
  );
}
