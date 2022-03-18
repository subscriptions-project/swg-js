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

import {I18N_STRINGS} from '../i18n/strings';
import {JwtHelper} from './jwt';
import {
  ShowcaseEvent,
  Subscriptions as SubscriptionsDef,
} from '../api/subscriptions';
import {addQueryParam, parseQueryString} from './url';
import {debugLog, warn} from './log';
import {findInArray} from './object';
import {getLanguageCodeFromElement, msg} from './i18n';
import {parseJson} from './json';
import {setImportantStyles} from './style';

// Load types for Closure compiler.
import '../model/doc';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {showcaseEventToAnalyticsEvents} from '../runtime/event-type-mapping';

/** Stamp for post messages. */
export const POST_MESSAGE_STAMP = 'swg-gaa-post-message-stamp';

/** Introduction command for post messages. */
export const POST_MESSAGE_COMMAND_INTRODUCTION = 'introduction';

/** User command for post messages. */
export const POST_MESSAGE_COMMAND_USER = 'user';

/** Error command for post messages. */
export const POST_MESSAGE_COMMAND_ERROR = 'error';

/** Button click command for post messages. */
export const POST_MESSAGE_COMMAND_BUTTON_CLICK = 'button-click';

/** ID for the Google Sign-In iframe element. */
export const GOOGLE_SIGN_IN_IFRAME_ID = 'swg-google-sign-in-iframe';

/** ID for the Google Sign-In button element. */
export const GOOGLE_SIGN_IN_BUTTON_ID = 'swg-google-sign-in-button';

/** ID for the third party Google Sign-In button element.  */
export const GOOGLE_3P_SIGN_IN_BUTTON_ID = 'swg-google-3p-sign-in-button';

/** ID for the Google Sign-In button element. */
export const SIGN_IN_WITH_GOOGLE_BUTTON_ID = 'swg-sign-in-with-google-button';

/** ID for the Publisher sign-in button element. */
const PUBLISHER_SIGN_IN_BUTTON_ID = 'swg-publisher-sign-in-button';

/** ID for the Regwall container element. */
export const REGISTRATION_BUTTON_CONTAINER_ID =
  'swg-registration-button-container';

/** ID for the Regwall container element. */
export const REGWALL_CONTAINER_ID = 'swg-regwall-container';

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
  .gaa-metering-regwall--registration-button-container,
  .gaa-metering-regwall--casl {
    all: initial !important;
    box-sizing: border-box !important;
    font-family: Roboto, arial, sans-serif !important;
  }

  .gaa-metering-regwall--dialog-spacer {
    background: linear-gradient(0, #808080, transparent) !important;
    bottom: 0 !important;
    display: block !important;
    position: fixed !important;
    width: 100% !important;
  }

  @keyframes slideUp {
    from {transform: translate(0, 200px) !important;}
    to {transform: translate(0, 0) !important;}
  }

  .gaa-metering-regwall--dialog {
    animation: slideUp 0.5s !important;
    background: white !important;
    border-radius: 12px 12px 0 0 !important;
    box-shadow: 0px -2px 6px rgba(0, 0, 0, 0.3) !important;
    display: block !important;
    margin: 0 auto !important;
    max-width: 100% !important;
    padding: 24px 20px !important;
    pointer-events: auto !important;
    width: 410px !important;
  }

  .gaa-metering-regwall--logo {
    display: block !important;
    margin: 0 auto 24px !important;
  }

  .gaa-metering-regwall--title {
    color: #000 !important;
    display: block !important;
    font-size: 16px !important;
    margin: 0 0 8px !important;
    outline: none !important !important;
  }

  .gaa-metering-regwall--description {
    color: #646464 !important;
    display: block !important;
    font-size: 14px !important;
    line-height: 19px !important;
    margin: 0 0 30px !important;
  }

  .gaa-metering-regwall--description strong {
    color: #646464 !important;
    font-size: 14px !important;
    line-height: 19px !important;
    font-weight: bold !important;
  }

  .gaa-metering-regwall--iframe {
    border: none !important;
    display: block !important;
    height: 44px !important;
    margin: 0 0 30px !important;
    width: 100% !important;
  }

  .gaa-metering-regwall--registration-button-container {
    border: none !important;
    display: block !important;
    height: 44px !important;
    margin: 0 0 30px !important;
    width: 100% !important;
  }

  .gaa-metering-regwall--casl {
    color: #646464 !important;
    display: block !important;
    font-size: 12px !important;
    text-align: center !important;
    margin: -16px auto 32px !important;
  }

  .gaa-metering-regwall--casl a {
    color: #1967d2 !important;
  }

  .gaa-metering-regwall--line {
    background-color: #ddd !important;
    display: block !important;
    height: 1px !important;
    margin: 0 0 24px !important;
  }

  .gaa-metering-regwall--publisher-sign-in-button {
    color: #1967d2 !important;
    cursor: pointer !important;
    display: block !important;
    font-size: 12px !important;
    text-decoration: underline !important;
  }

  .gaa-metering-regwall--google-sign-in-button {
    height: 36px !important;
    margin: 0 auto 30px !important;
  }

  .gaa-metering-regwall--google-sign-in-button > div {
    animation: swgGoogleSignInButtonfadeIn 0.32s !important;
  }

  @keyframes swgGoogleSignInButtonfadeIn {
    from {
      opacity: 0 !important;
    }
    to {
      opacity: 1 !important;
    }
  }
</style>

<div class="gaa-metering-regwall--dialog-spacer">
  <div role="dialog" aria-modal="true" class="gaa-metering-regwall--dialog" id="${REGWALL_DIALOG_ID}" aria-labelledby="${REGWALL_TITLE_ID}">
    <img alt="Google" class="gaa-metering-regwall--logo" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3NCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDc0IDI0Ij48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNOS4yNCA4LjE5djIuNDZoNS44OGMtLjE4IDEuMzgtLjY0IDIuMzktMS4zNCAzLjEtLjg2Ljg2LTIuMiAxLjgtNC41NCAxLjgtMy42MiAwLTYuNDUtMi45Mi02LjQ1LTYuNTRzMi44My02LjU0IDYuNDUtNi41NGMxLjk1IDAgMy4zOC43NyA0LjQzIDEuNzZMMTUuNCAyLjVDMTMuOTQgMS4wOCAxMS45OCAwIDkuMjQgMCA0LjI4IDAgLjExIDQuMDQuMTEgOXM0LjE3IDkgOS4xMyA5YzIuNjggMCA0LjctLjg4IDYuMjgtMi41MiAxLjYyLTEuNjIgMi4xMy0zLjkxIDIuMTMtNS43NSAwLS41Ny0uMDQtMS4xLS4xMy0xLjU0SDkuMjR6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTI1IDYuMTljLTMuMjEgMC01LjgzIDIuNDQtNS44MyA1LjgxIDAgMy4zNCAyLjYyIDUuODEgNS44MyA1LjgxczUuODMtMi40NiA1LjgzLTUuODFjMC0zLjM3LTIuNjItNS44MS01LjgzLTUuODF6bTAgOS4zM2MtMS43NiAwLTMuMjgtMS40NS0zLjI4LTMuNTIgMC0yLjA5IDEuNTItMy41MiAzLjI4LTMuNTJzMy4yOCAxLjQzIDMuMjggMy41MmMwIDIuMDctMS41MiAzLjUyLTMuMjggMy41MnoiLz48cGF0aCBmaWxsPSIjNDI4NUY0IiBkPSJNNTMuNTggNy40OWgtLjA5Yy0uNTctLjY4LTEuNjctMS4zLTMuMDYtMS4zQzQ3LjUzIDYuMTkgNDUgOC43MiA0NSAxMmMwIDMuMjYgMi41MyA1LjgxIDUuNDMgNS44MSAxLjM5IDAgMi40OS0uNjIgMy4wNi0xLjMyaC4wOXYuODFjMCAyLjIyLTEuMTkgMy40MS0zLjEgMy40MS0xLjU2IDAtMi41My0xLjEyLTIuOTMtMi4wN2wtMi4yMi45MmMuNjQgMS41NCAyLjMzIDMuNDMgNS4xNSAzLjQzIDIuOTkgMCA1LjUyLTEuNzYgNS41Mi02LjA1VjYuNDloLTIuNDJ2MXptLTIuOTMgOC4wM2MtMS43NiAwLTMuMS0xLjUtMy4xLTMuNTIgMC0yLjA1IDEuMzQtMy41MiAzLjEtMy41MiAxLjc0IDAgMy4xIDEuNSAzLjEgMy41NC4wMSAyLjAzLTEuMzYgMy41LTMuMSAzLjV6Ii8+PHBhdGggZmlsbD0iI0ZCQkMwNSIgZD0iTTM4IDYuMTljLTMuMjEgMC01LjgzIDIuNDQtNS44MyA1LjgxIDAgMy4zNCAyLjYyIDUuODEgNS44MyA1LjgxczUuODMtMi40NiA1LjgzLTUuODFjMC0zLjM3LTIuNjItNS44MS01LjgzLTUuODF6bTAgOS4zM2MtMS43NiAwLTMuMjgtMS40NS0zLjI4LTMuNTIgMC0yLjA5IDEuNTItMy41MiAzLjI4LTMuNTJzMy4yOCAxLjQzIDMuMjggMy41MmMwIDIuMDctMS41MiAzLjUyLTMuMjggMy41MnoiLz48cGF0aCBmaWxsPSIjMzRBODUzIiBkPSJNNTggLjI0aDIuNTF2MTcuNTdINTh6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTY4LjI2IDE1LjUyYy0xLjMgMC0yLjIyLS41OS0yLjgyLTEuNzZsNy43Ny0zLjIxLS4yNi0uNjZjLS40OC0xLjMtMS45Ni0zLjctNC45Ny0zLjctMi45OSAwLTUuNDggMi4zNS01LjQ4IDUuODEgMCAzLjI2IDIuNDYgNS44MSA1Ljc2IDUuODEgMi42NiAwIDQuMi0xLjYzIDQuODQtMi41N2wtMS45OC0xLjMyYy0uNjYuOTYtMS41NiAxLjYtMi44NiAxLjZ6bS0uMTgtNy4xNWMxLjAzIDAgMS45MS41MyAyLjIgMS4yOGwtNS4yNSAyLjE3YzAtMi40NCAxLjczLTMuNDUgMy4wNS0zLjQ1eiIvPjwvc3ZnPg==" />

    <div class="gaa-metering-regwall--title" id="${REGWALL_TITLE_ID}" tabindex="0">$SHOWCASE_REGWALL_TITLE$</div>

    <div class="gaa-metering-regwall--description">
      $SHOWCASE_REGWALL_DESCRIPTION$
    </div>

    $SHOWCASE_REGISTRATION_BUTTON$

    $SHOWCASE_REGWALL_CASL$

    <div class="gaa-metering-regwall--line"></div>

    <a
        id="${PUBLISHER_SIGN_IN_BUTTON_ID}"
        class="gaa-metering-regwall--publisher-sign-in-button"
        tabindex="0"
        href="#">
      $SHOWCASE_REGWALL_PUBLISHER_SIGN_IN_BUTTON$
    </a>
  </div>
</div>
`;

/**
 * HTML for iFrame to render registration widget.
 */
const REGISTRATION_WIDGET_IFRAME_HTML = `
  <iframe
      id="${GOOGLE_SIGN_IN_IFRAME_ID}"
      class="gaa-metering-regwall--iframe"
      src="$iframeUrl$">
  </iframe>
`;

/**
 * HTML for container of the registration button.
 */
const REGISTRATION_BUTTON_HTML = `
  <div
      id="${REGISTRATION_BUTTON_CONTAINER_ID}"
      class="gaa-metering-regwall--registration-button-container">
  </div>
`;

/**
 * HTML for the CASL blurb.
 * CASL stands for Canadian Anti-Spam Law.
 */
const CASL_HTML = `
<div class="gaa-metering-regwall--casl">
  $SHOWCASE_REGWALL_CASL$
</div>
`;

/** Base styles for both the Google and Google 3p Sign-In button iframes. */
const GOOGLE_SIGN_IN_BUTTON_STYLES = `
  #${GOOGLE_3P_SIGN_IN_BUTTON_ID},
  #${SIGN_IN_WITH_GOOGLE_BUTTON_ID},
  #${GOOGLE_SIGN_IN_BUTTON_ID} {
    margin: 0 auto;
  }

  #${SIGN_IN_WITH_GOOGLE_BUTTON_ID}{
    width: 220px;
  }

  #${GOOGLE_3P_SIGN_IN_BUTTON_ID} > div,
  #${SIGN_IN_WITH_GOOGLE_BUTTON_ID} > div,
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
  #${GOOGLE_3P_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue,
  #${SIGN_IN_WITH_GOOGLE_BUTTON_ID} .abcRioButton.abcRioButtonBlue,
  #${GOOGLE_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue {
    background-color: #1A73E8;
    box-shadow: none;
    -webkit-box-shadow: none;
    border-radius: 4px;
    width: 100% !important;
  }
  #${GOOGLE_3P_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonIcon,
  #${SIGN_IN_WITH_GOOGLE_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonIcon,
  #${GOOGLE_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonIcon {
    display: none;
  }
  /** Hides default "Sign in with Google" text. */
  #${GOOGLE_3P_SIGN_IN_BUTTON_ID}  .abcRioButton.abcRioButtonBlue .abcRioButtonContents span[id^=not_signed_],
  #${SIGN_IN_WITH_GOOGLE_BUTTON_ID}  .abcRioButton.abcRioButtonBlue .abcRioButtonContents span[id^=not_signed_],
  #${GOOGLE_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonContents span[id^=not_signed_] {
    font-size: 0 !important;
  }
  /** Renders localized "Sign in with Google" text instead. */
  #${GOOGLE_3P_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonContents span[id^=not_signed_]::before,
  #${SIGN_IN_WITH_GOOGLE_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonContents span[id^=not_signed_]::before,
  #${GOOGLE_SIGN_IN_BUTTON_ID} .abcRioButton.abcRioButtonBlue .abcRioButtonContents span[id^=not_signed_]::before {
    content: '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$';
    font-size: 15px;
  }`;
const GOOGLE_SIGN_IN_IFRAME_STYLES = `
  body {
    margin: 0;
    overflow: hidden;
  }${GOOGLE_SIGN_IN_BUTTON_STYLES}
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
 *   authorizationData: {
 *     access_token: string,
 *     id_token: string,
 *     scope: string,
 *     expires_in: number,
 *     first_issued_at: number,
 *     expires_at: number,
 *   },
 * }} GaaUserDef
 */
export let GaaUserDef;

/**
 * Google Identity (V1) that Google Identity Services returns after someone signs in.
 * https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse
 * @typedef {{
 *   iss: string,
 *   nbf: number,
 *   aud: string,
 *   sub: string,
 *   hd: string,
 *   email: string,
 *   email_verified: boolean,
 *   azp: string,
 *   name: string,
 *   picture: string,
 *   given_name: string,
 *   family_name: string,
 *   iat: number,
 *   exp: number,
 *   jti: string,
 * }} GoogleIdentityV1
 */
export let GoogleIdentityV1;

/**
 * GoogleUser object that Google Sign-In returns after users sign in.
 * https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile
 * @typedef {{
 *   getAuthResponse: function(boolean): {
 *     access_token: string,
 *     id_token: string,
 *     scope: string,
 *     expires_in: number,
 *     first_issued_at: number,
 *     expires_at: number,
 *   },
 *   getBasicProfile: function(): {
 *     getName: function(): string,
 *     getGivenName: function(): string,
 *     getFamilyName: function(): string,
 *     getImageUrl: function(): string,
 *     getEmail: function(): string,
 *   },
 * }} GoogleUserDef
 */
export let GoogleUserDef;

/**
 * Returns true if the query string contains fresh Google Article Access (GAA) params.
 * @param {string} queryString
 * @param {boolean} allowAllAccessTypes
 * @return {boolean}
 */
export function queryStringHasFreshGaaParams(
  queryString,
  allowAllAccessTypes = false
) {
  const params = parseQueryString(queryString);

  // Verify GAA params exist.
  if (
    !params['gaa_at'] ||
    !params['gaa_n'] ||
    !params['gaa_sig'] ||
    !params['gaa_ts']
  ) {
    return false;
  }

  if (!allowAllAccessTypes) {
    // Verify access type.
    const noAccess = params['gaa_at'] === 'na';
    if (noAccess) {
      return false;
    }
  }

  // Verify timestamp isn't stale.
  const expirationTimestamp = parseInt(params['gaa_ts'], 16);
  const currentTimestamp = Date.now() / 1000;
  if (expirationTimestamp < currentTimestamp) {
    return false;
  }

  return true;
}

/** Renders Google Article Access (GAA) Metering Regwall. */
export class GaaMeteringRegwall {
  /**
   * Returns a promise for a Google user object.
   * The user object will be a:
   * - GaaUserDef, if you use the GaaGoogleSignInButton
   * - GoogleIdentityV1, if you use the GaaSignInWithGoogleButton
   * - Custom object, if you use the GaaGoogle3pSignInButton
   *
   * This method opens a metering regwall dialog,
   * where users can sign in with Google.
   * @nocollapse
   * @param {{ iframeUrl: string, caslUrl: string }} params
   * @return {!Promise<!GaaUserDef|!GoogleIdentityV1|!Object>}
   */
  static show({iframeUrl, caslUrl}) {
    const queryString = GaaUtils.getQueryString();
    if (!queryStringHasFreshGaaParams(queryString)) {
      const errorMessage =
        '[swg-gaa.js:GaaMeteringRegwall.show]: URL needs fresh GAA params.';
      warn(errorMessage);
      return Promise.reject(errorMessage);
    }

    logEvent({
      showcaseEvent: ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL,
      isFromUserAction: false,
    });

    GaaMeteringRegwall.render_({iframeUrl, caslUrl});
    GaaMeteringRegwall.sendIntroMessageToGsiIframe_({iframeUrl});
    GaaMeteringRegwall.logButtonClickEvents_();
    return GaaMeteringRegwall.getGaaUser_()
      .then((gaaUser) => {
        GaaMeteringRegwall.remove();
        return gaaUser;
      })
      .catch((err) => {
        // Close the Regwall, since the flow failed.
        GaaMeteringRegwall.remove();

        // Rethrow error.
        throw err;
      });
  }

  /**
   * Returns a promise for a Google user object.
   * The user object will be a GoogleIdentityV1
   *
   * This method opens a metering regwall dialog,
   * where users can sign in with Google.
   * @nocollapse
   * @param {{ caslUrl: string, clientId: string }} params
   * @return {!Promise<!GoogleIdentityV1>}
   */
  static showWithNativeRegistrationButton({caslUrl, clientId}) {
    logEvent({
      showcaseEvent: ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL,
      isFromUserAction: false,
    });

    GaaMeteringRegwall.render_({caslUrl, useNativeMode: true});

    return GaaMeteringRegwall.createNativeRegistrationButton({clientId})
      .then((jwt) => {
        GaaMeteringRegwall.remove();
        return jwt;
      })
      .catch((err) => {
        // Close the Regwall, since the flow failed.
        GaaMeteringRegwall.remove();

        // Rethrow error.
        debugLog(`Regwall failed: ${err}`);
      });
  }

  /**
   * Removes the Regwall.
   * @nocollapse
   */
  static remove() {
    const regwallContainer = self.document.getElementById(REGWALL_CONTAINER_ID);
    if (regwallContainer) {
      regwallContainer.remove();
    }
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
   * @param {{ iframeUrl: string, caslUrl: string, useNativeMode: boolean }} params
   */
  static render_({iframeUrl, caslUrl, useNativeMode}) {
    const languageCode = getLanguageCodeFromElement(self.document.body);
    const publisherName = GaaMeteringRegwall.getPublisherNameFromPageConfig_();
    const placeholderPatternForPublication = /<ph name="PUBLICATION".+?\/ph>/g;
    const placeholderPatternForLinkStart = /<ph name="LINK_START".+?\/ph>/g;
    const placeholderPatternForLinkEnd = /<ph name="LINK_END".+?\/ph>/g;

    // Create and style container element.
    // TODO: Consider using a FriendlyIframe here, to avoid CSS conflicts.
    const containerEl = /** @type {!HTMLDivElement} */ (
      self.document.createElement('div')
    );
    containerEl.id = REGWALL_CONTAINER_ID;
    setImportantStyles(containerEl, {
      'all': 'unset',
      'background-color': 'rgba(32, 33, 36, 0.6)',
      'border': 'none',
      'bottom': '0',
      'height': '100%',
      'left': '0',
      'opacity': '0',
      'pointer-events': 'none',
      'position': 'fixed',
      'right': '0',
      'transition': 'opacity 0.5s',
      'top': '0',
      'width': '100%',
      'z-index': 2147483646,
    });

    // Optionally include CASL HTML.
    let caslHtml = '';
    if (caslUrl) {
      caslHtml = CASL_HTML.replace(
        '$SHOWCASE_REGWALL_CASL$',
        msg(I18N_STRINGS['SHOWCASE_REGWALL_CASL'], languageCode)
      )
        // Update link.
        .replace(
          placeholderPatternForLinkStart,
          `<a href="${encodeURI(caslUrl)}" target="_blank">`
        )
        .replace(placeholderPatternForLinkEnd, '</a>')
        // Update publisher name.
        .replace(
          placeholderPatternForPublication,
          `<strong>${publisherName}</strong>`
        );
    }

    let registrationButtonHtml = '';
    if (useNativeMode) {
      registrationButtonHtml = REGISTRATION_BUTTON_HTML;
    } else {
      // Tell the iframe which language to render.
      iframeUrl = addQueryParam(iframeUrl, 'lang', languageCode);
      registrationButtonHtml = REGISTRATION_WIDGET_IFRAME_HTML.replace(
        '$iframeUrl$',
        iframeUrl
      );
    }

    // Prepare HTML.
    containerEl./*OK*/ innerHTML = REGWALL_HTML.replace(
      '$SHOWCASE_REGISTRATION_BUTTON$',
      registrationButtonHtml
    )
      .replace(
        '$SHOWCASE_REGWALL_TITLE$',
        msg(I18N_STRINGS['SHOWCASE_REGWALL_TITLE'], languageCode)
      )
      .replace(
        '$SHOWCASE_REGWALL_DESCRIPTION$',
        msg(I18N_STRINGS['SHOWCASE_REGWALL_DESCRIPTION'], languageCode)
          // Update publisher name.
          .replace(placeholderPatternForPublication, publisherName)
      )
      .replace(
        '$SHOWCASE_REGWALL_PUBLISHER_SIGN_IN_BUTTON$',
        msg(
          I18N_STRINGS['SHOWCASE_REGWALL_PUBLISHER_SIGN_IN_BUTTON'],
          languageCode
        )
      )
      .replace('$SHOWCASE_REGWALL_CASL$', caslHtml);

    // Add container to DOM.
    self.document.body.appendChild(containerEl);

    // Trigger a fade-in transition.
    /** @suppress {suspiciousCode} */
    containerEl.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(containerEl, {'opacity': 1});

    // Listen for clicks.
    GaaMeteringRegwall.addClickListenerOnPublisherSignInButton_();

    // Focus on the title after the dialog animates in.
    // This helps people using screenreaders.
    const dialogEl = self.document.getElementById(REGWALL_DIALOG_ID);
    dialogEl.addEventListener('animationend', () => {
      const titleEl = self.document.getElementById(REGWALL_TITLE_ID);
      titleEl.focus();
    });

    return containerEl;
  }

  /**
   * Gets publisher name from page config.
   * @private
   * @nocollapse
   * @return {string}
   */
  static getPublisherNameFromPageConfig_() {
    const jsonLdPageConfig =
      GaaMeteringRegwall.getPublisherNameFromJsonLdPageConfig_();
    if (jsonLdPageConfig) {
      return jsonLdPageConfig;
    }

    const microdataPageConfig =
      GaaMeteringRegwall.getPublisherNameFromMicrodataPageConfig_();
    if (microdataPageConfig) {
      return microdataPageConfig;
    }

    throw new Error(
      'Showcase articles must define a publisher name with either JSON-LD or Microdata.'
    );
  }

  /**
   * Gets publisher name from JSON-LD page config.
   * @private
   * @nocollapse
   * @return {string|undefined}
   */
  static getPublisherNameFromJsonLdPageConfig_() {
    // Get JSON from ld+json scripts.
    const ldJsonScripts = Array.prototype.slice.call(
      self.document.querySelectorAll('script[type="application/ld+json"]')
    );
    const jsonQueue = /** @type {!Array<*>} */ (
      ldJsonScripts.map((script) => parseJson(script.textContent))
    );

    // Search for publisher name, breadth-first.
    for (let i = 0; i < jsonQueue.length; i++) {
      const json = /** @type {!Object<?,?>} */ (jsonQueue[i]);

      // Return publisher name, if possible.
      const publisherName = json?.publisher?.name;
      if (publisherName) {
        return publisherName;
      }

      // Explore JSON.
      if (json && typeof json === 'object') {
        jsonQueue.push(...Object.values(json));
      }
    }
  }

  /**
   * Gets publisher name from Microdata page config.
   * @private
   * @nocollapse
   * @return {string|undefined}
   */
  static getPublisherNameFromMicrodataPageConfig_() {
    const publisherNameElements = self.document.querySelectorAll(
      '[itemscope][itemtype][itemprop="publisher"] [itemprop="name"]'
    );

    for (const publisherNameElement of publisherNameElements) {
      const publisherName = publisherNameElement.content;
      if (publisherName) {
        return publisherName;
      }
    }
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

        logEvent({
          analyticsEvent:
            AnalyticsEvent.ACTION_SHOWCASE_REGWALL_EXISTING_ACCOUNT_CLICK,
          isFromUserAction: true,
        });

        callSwg((swg) => swg.triggerLoginRequest({linkRequested: false}));
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
    return new Promise((resolve, reject) => {
      self.addEventListener('message', (e) => {
        if (e.data.stamp === POST_MESSAGE_STAMP) {
          if (e.data.command === POST_MESSAGE_COMMAND_USER) {
            // Pass along user details.
            resolve(e.data.gaaUser || e.data.returnedJwt);
          }

          if (e.data.command === POST_MESSAGE_COMMAND_ERROR) {
            // Reject promise due to Google Sign-In error.
            reject('Google Sign-In could not render');
          }
        }
      });
    });
  }

  /**
   * Logs button click events.
   * @private
   * @nocollapse
   */
  static logButtonClickEvents_() {
    // Listen for button event messages.
    self.addEventListener('message', (e) => {
      if (
        e.data.stamp === POST_MESSAGE_STAMP &&
        e.data.command === POST_MESSAGE_COMMAND_BUTTON_CLICK
      ) {
        // Log button click event.
        logEvent({
          analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_GSI_CLICK,
          isFromUserAction: true,
        });
      }
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
    const googleSignInIframe = /** @type {!HTMLIFrameElement} */ (
      self.document.getElementById(GOOGLE_SIGN_IN_IFRAME_ID)
    );
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

  static createNativeRegistrationButton({clientId}) {
    const languageCode = getLanguageCodeFromElement(self.document.body);
    const parentElement = self.document.getElementById(
      REGISTRATION_BUTTON_CONTAINER_ID
    );
    if (!parentElement) {
      return false;
    }
    // Apply iframe styles.
    const styleEl = self.document.createElement('style');
    styleEl./*OK*/ innerText = GOOGLE_SIGN_IN_BUTTON_STYLES.replace(
      '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$',
      msg(I18N_STRINGS['SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON'], languageCode)
    );
    self.document.head.appendChild(styleEl);

    const buttonEl = self.document.createElement('div');
    buttonEl.id = SIGN_IN_WITH_GOOGLE_BUTTON_ID;
    buttonEl.tabIndex = 0;

    parentElement.appendChild(buttonEl);

    // Track button clicks.
    buttonEl.addEventListener('click', () => {
      logEvent({
        analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_GSI_CLICK,
        isFromUserAction: true,
      });
    });

    return new Promise((resolve) => {
      self.google.accounts.id.initialize({
        /* eslint-disable google-camelcase/google-camelcase */
        client_id: clientId,
        callback: resolve,
        /* eslint-enable google-camelcase/google-camelcase */
      });
      self.google.accounts.id.renderButton(buttonEl, {
        'type': 'standard',
        'theme': 'outline',
        'text': 'continue_with',
        'logo_alignment': 'center',
      });
    });
  }
}

export class GaaGoogleSignInButton {
  /**
   * Renders the Google Sign-In button.
   * @nocollapse
   * @param {{ allowedOrigins: !Array<string> }} params
   */
  static show({allowedOrigins}) {
    // Optionally grab language code from URL.
    const queryString = GaaUtils.getQueryString();
    const queryParams = parseQueryString(queryString);
    const languageCode = queryParams['lang'] || 'en';

    // Apply iframe styles.
    const styleEl = self.document.createElement('style');
    styleEl./*OK*/ innerText = GOOGLE_SIGN_IN_IFRAME_STYLES.replace(
      '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$',
      msg(I18N_STRINGS['SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON'], languageCode)
    );
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

    function sendErrorMessageToParent() {
      sendMessageToParentFnPromise.then((sendMessageToParent) => {
        sendMessageToParent({
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_ERROR,
        });
      });
    }

    // Validate origins.
    for (const allowedOrigin of allowedOrigins) {
      const url = new URL(allowedOrigin);

      const isOrigin = url.origin === allowedOrigin;
      const protocolIsValid =
        url.protocol === 'http:' || url.protocol === 'https:';
      const isValidOrigin = isOrigin && protocolIsValid;

      if (!isValidOrigin) {
        warn(
          `[swg-gaa.js:GaaGoogleSignInButton.show]: You specified an invalid origin: ${allowedOrigin}`
        );
        sendErrorMessageToParent();
        return;
      }
    }

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
              'longtitle': true,
              'onsuccess': resolve,
              'prompt': 'select_account',
              'scope': 'profile email',
              'theme': 'dark',
            });

            // Track button clicks.
            buttonEl.addEventListener('click', () => {
              // Tell parent frame about button click.
              sendMessageToParentFnPromise.then((sendMessageToParent) => {
                sendMessageToParent({
                  stamp: POST_MESSAGE_STAMP,
                  command: POST_MESSAGE_COMMAND_BUTTON_CLICK,
                });
              });
            });
          })
      )
      .then((googleUser) => {
        // Gather GAA user details.
        const basicProfile = /** @type {!GoogleUserDef} */ (
          googleUser
        ).getBasicProfile();
        // Gather authorization response.
        const authorizationData = /** @type {!GoogleUserDef} */ (
          googleUser
        ).getAuthResponse(true);
        /** @type {!GaaUserDef} */
        const gaaUser = {
          idToken: authorizationData.id_token,
          name: basicProfile.getName(),
          givenName: basicProfile.getGivenName(),
          familyName: basicProfile.getFamilyName(),
          imageUrl: basicProfile.getImageUrl(),
          email: basicProfile.getEmail(),
          authorizationData,
        };

        // Send GAA user to parent frame.
        sendMessageToParentFnPromise.then((sendMessageToParent) => {
          sendMessageToParent({
            stamp: POST_MESSAGE_STAMP,
            command: POST_MESSAGE_COMMAND_USER,
            gaaUser,
          });
        });
      })
      .catch(sendErrorMessageToParent);
  }
}

export class GaaSignInWithGoogleButton {
  /**
   * Renders the Google Sign-In button.
   * @nocollapse
   * @param {{ clientId: string, allowedOrigins: !Array<string>, rawJwt: boolean }} params
   */
  static show({clientId, allowedOrigins, rawJwt = false}) {
    // Optionally grab language code from URL.
    const queryString = GaaUtils.getQueryString();
    const queryParams = parseQueryString(queryString);
    const languageCode = queryParams['lang'] || 'en';

    // Apply iframe styles.
    const styleEl = self.document.createElement('style');
    styleEl./*OK*/ innerText = GOOGLE_SIGN_IN_IFRAME_STYLES.replace(
      '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$',
      msg(I18N_STRINGS['SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON'], languageCode)
    );
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

    function sendErrorMessageToParent() {
      sendMessageToParentFnPromise.then((sendMessageToParent) => {
        sendMessageToParent({
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_ERROR,
        });
      });
    }

    // Validate origins.
    for (let i = 0; i < allowedOrigins.length; i++) {
      const allowedOrigin = allowedOrigins[i];
      const url = new URL(allowedOrigin);

      const isOrigin = url.origin === allowedOrigin;
      const protocolIsValid =
        url.protocol === 'http:' || url.protocol === 'https:';
      const isValidOrigin = isOrigin && protocolIsValid;

      if (!isValidOrigin) {
        warn(
          `[swg-gaa.js:GaaSignInWithGoogleButton.show]: You specified an invalid origin: ${allowedOrigin}`
        );
        sendErrorMessageToParent();
        return;
      }
    }

    new Promise((resolve) => {
      const buttonEl = self.document.createElement('div');
      buttonEl.id = SIGN_IN_WITH_GOOGLE_BUTTON_ID;
      buttonEl.tabIndex = 0;
      self.document.body.appendChild(buttonEl);

      self.google.accounts.id.initialize({
        /* eslint-disable google-camelcase/google-camelcase */
        client_id: clientId,
        callback: resolve,
        allowed_parent_origin: allowedOrigins,
        /* eslint-enable google-camelcase/google-camelcase */
      });
      self.google.accounts.id.renderButton(
        self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID),
        {
          'type': 'standard',
          'theme': 'outline',
          'text': 'continue_with',
          'logo_alignment': 'center',
          'width': buttonEl.offsetWidth,
          'height': buttonEl.offsetHeight,
        }
      );

      // Track button clicks.
      buttonEl.addEventListener('click', () => {
        // Tell parent frame about button click.
        sendMessageToParentFnPromise.then((sendMessageToParent) => {
          sendMessageToParent({
            stamp: POST_MESSAGE_STAMP,
            command: POST_MESSAGE_COMMAND_BUTTON_CLICK,
          });
        });
      });
    })
      .then((jwt) => {
        const jwtPayload = /** @type {!GoogleIdentityV1} */ (
          new JwtHelper().decode(jwt.credential)
        );
        const returnedJwt = rawJwt ? jwt : jwtPayload;

        // Send GAA user to parent frame.
        sendMessageToParentFnPromise.then((sendMessageToParent) => {
          sendMessageToParent({
            stamp: POST_MESSAGE_STAMP,
            command: POST_MESSAGE_COMMAND_USER,
            // Note: jwtPayload is deprecated in favor of returnedJwt.
            jwtPayload,
            returnedJwt,
          });
        });
      })
      .catch(sendErrorMessageToParent);
  }
}

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

/**
 * Calls Swgjs.
 * @param { function(!SubscriptionsDef) } callback
 */
function callSwg(callback) {
  (self.SWG = self.SWG || []).push(callback);
}

/** Styles for the third party Google Sign-In button iframe. */
const GOOGLE_3P_SIGN_IN_IFRAME_STYLES =
  GOOGLE_SIGN_IN_IFRAME_STYLES +
  `
  #${GOOGLE_3P_SIGN_IN_BUTTON_ID} .abcRioButtonContents {
    font-family: Roboto,arial,sans-serif;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: .21px;
    margin-left: 6px;
    margin-right: 6px;
    vertical-align: top;
  }
  #${GOOGLE_3P_SIGN_IN_BUTTON_ID} .abcRioButton {
    border-radius: 1px;
    box-shadow: 0 2px 4px 0 rgb(0 0 0 / 25%);
    -moz-box-sizing: border-box;
    box-sizing: border-box;
    -webkit-transition: background-color .218s,border-color .218s,box-shadow .218s;
    transition: background-color .218s,border-color .218s,box-shadow .218s;
    -webkit-user-select: none;
    -webkit-appearance: none;
    background-color: #fff;
    background-image: none;
    color: #262626;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    position: relative;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
    width: auto;
  }
  #${GOOGLE_3P_SIGN_IN_BUTTON_ID} .abcRioButtonBlue {
    border: none;
    color: #fff;
  }
  `;

const GOOGLE_3P_SIGN_IN_BUTTON_HTML = `
<div style="height:36px;width:180px;" class="abcRioButton abcRioButtonBlue">
  <span style="font-size:15px;line-height:34px;" class="abcRioButtonContents">
    <span id="not_signed_in">Sign in with Google</span>
  </span>
</div>
`;

export class GaaGoogle3pSignInButton {
  /**
   * Renders the third party Google Sign-In button for external authentication.
   * @nocollapse
   * @param {{ allowedOrigins: !Array<string>, authorizationUrl: string }} params
   */
  static show({allowedOrigins, authorizationUrl}) {
    // Optionally grab language code from URL.
    const queryString = GaaUtils.getQueryString();
    const queryParams = parseQueryString(queryString);
    const languageCode = queryParams['lang'] || 'en';

    // Apply iframe styles.
    const styleEl = self.document.createElement('style');
    styleEl./*OK*/ innerText = GOOGLE_3P_SIGN_IN_IFRAME_STYLES.replace(
      '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$',
      msg(I18N_STRINGS['SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON'], languageCode)
    );
    self.document.head.appendChild(styleEl);

    // Render the third party Google Sign-In button.
    const buttonEl = self.document.createElement('div');
    buttonEl.id = GOOGLE_3P_SIGN_IN_BUTTON_ID;
    buttonEl.tabIndex = 0;
    buttonEl./*OK*/ innerHTML = GOOGLE_3P_SIGN_IN_BUTTON_HTML;
    buttonEl.onclick = () => {
      self.open(authorizationUrl);
    };
    self.document.body.appendChild(buttonEl);

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

    function sendErrorMessageToParent() {
      sendMessageToParentFnPromise.then((sendMessageToParent) => {
        sendMessageToParent({
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_ERROR,
        });
      });
    }

    // Validate origins.
    for (let i = 0; i < allowedOrigins.length; i++) {
      const allowedOrigin = allowedOrigins[i];
      const url = new URL(allowedOrigin);

      const isOrigin = url.origin === allowedOrigin;
      const protocolIsValid =
        url.protocol === 'http:' || url.protocol === 'https:';
      const isValidOrigin = isOrigin && protocolIsValid;

      if (!isValidOrigin) {
        warn(
          `[swg-gaa.js:GaaGoogle3pSignInButton.show]: You specified an invalid origin: ${allowedOrigin}`
        );
        sendErrorMessageToParent();
        return;
      }
    }

    // Relay message to the parent frame (GAA Intervention).
    self.addEventListener('message', (e) => {
      if (
        allowedOrigins.indexOf(e.origin) !== -1 &&
        e.data.stamp === POST_MESSAGE_STAMP &&
        e.data.command === POST_MESSAGE_COMMAND_USER
      ) {
        self.parent.postMessage(e.data, e.origin);
      }
    });
  }
  /**
   * Notify Google Intervention of a complete sign-in event.
   * @nocollapse
   * @param {{ gaaUser: GaaUserDef}} params
   */
  static gaaNotifySignIn({gaaUser}) {
    self.opener.postMessage({
      stamp: POST_MESSAGE_STAMP,
      command: POST_MESSAGE_COMMAND_USER,
      gaaUser,
    });
  }
}

/**
 * Logs Showcase events.
 * @param {{
 *   analyticsEvent: (AnalyticsEvent|undefined),
 *   showcaseEvent: (ShowcaseEvent|undefined),
 *   isFromUserAction: boolean,
 * }} params
 */
function logEvent({analyticsEvent, showcaseEvent, isFromUserAction} = {}) {
  callSwg((swg) => {
    // Get reference to event manager.
    swg.getEventManager().then((eventManager) => {
      // Get list of analytics events.
      const eventTypes = showcaseEvent
        ? showcaseEventToAnalyticsEvents(showcaseEvent)
        : [analyticsEvent];

      // Log each analytics event.
      for (const eventType of eventTypes) {
        eventManager.logEvent({
          eventType,
          eventOriginator: EventOriginator.SWG_CLIENT,
          isFromUserAction,
          additionalParameters: null,
        });
      }
    });
  });
}

export class GaaUtils {
  /**
   * Returns query string from current URL.
   * Tests can override this method to return different URLs.
   * @return {string}
   */
  static getQueryString() {
    return self.location.search;
  }
}

export class GaaMetering {
  gaaUser;
  gaaUserPromise_;
  gaaUserPromiseResolve_;

  static setGaaUser(jwt) {
    GaaMetering.gaaUser = jwt;
    //ensure that gaaUserPromiseResolve_ is defined
    GaaMetering.getGaaUser();
    GaaMetering.gaaUserPromiseResolve_(GaaMetering.gaaUser);
  }

  static getGaaUser() {
    if(GaaMetering.gaaUserPromise_ === undefined) {
      GaaMetering.gaaUserPromise_ = new Promise(function(resolve){
        GaaMetering.gaaUserPromiseResolve_ = resolve;
      });
    }
    return GaaMetering.gaaUserPromise_;
  }

  static init({params}) {
    // Validate GaaMetering parameters
    if (!params || !GaaMetering.validateParameters(params)) {
      debugLog('[gaa.js:GaaMetering.init]: Invalid params.');
      return false;
    }

    // Register publisher's callbacks, promises, and parameters
    const productId = GaaMetering.getProductIDFromPageConfig_();
    const googleSignInClientId = params.googleSignInClientId;
    const allowedReferrers = params.allowedReferrers;
    const showcaseEntitlement = params.showcaseEntitlement;

    const showPaywall = params.showPaywall;
    const userState = params.userState;
    const unlockArticle = params.unlockArticle;
    const handleSwGEntitlement = params.handleSwGEntitlement;

    const registerUserPromise = params.registerUserPromise;
    const handleLoginPromise = params.handleLoginPromise;
    const publisherEntitlementPromise = params.publisherEntitlementPromise;

    // Validate gaa parameters and referrer
    if (!GaaMetering.isGaa(allowedReferrers)) {
      debugLog('Extended Access - Invalid gaa parameters or referrer.');
      return false;
    }

    callSwg((subscriptions) => {
      subscriptions.init(productId);

      if ('granted' in userState && 'grantReason' in userState) {
        unlockArticleIfGranted();
      } else if (GaaMetering.isArticleFreeFromPageConfig_()) {
        userState.grantReason = 'FREE';
        userState.granted = true;
        debugLog('Article free from markup.');
        unlockArticleIfGranted();
      } else if (showcaseEntitlement) {
        debugLog(showcaseEntitlement);
        subscriptions.consumeShowcaseEntitlementJwt(showcaseEntitlement);
      } else {
        debugLog('resolving publisherEntitlement');
        publisherEntitlementPromise.then((fetchedPublisherEntitlements) => {
          if (GaaMetering.validateUserState(fetchedPublisherEntitlements)) {
            userState.id = fetchedPublisherEntitlements.id;
            userState.registrationTimestamp =
              fetchedPublisherEntitlements.registrationTimestamp;
            userState.subscriptionTimestamp =
              fetchedPublisherEntitlements.subscriptionTimestamp;
            userState.granted = fetchedPublisherEntitlements.granted;
            userState.grantReason = fetchedPublisherEntitlements.grantReason;

            unlockArticleIfGranted();
          } else {
            debugLog("Publisher entitlement isn't valid");
          }
        });
      }

      subscriptions.setOnLoginRequest(() => {
        handleLoginPromise.then((handleLoginUserState) => {
          if (GaaMetering.validateUserState(handleLoginUserState)) {
            userState.id = handleLoginUserState.id;
            userState.registrationTimestamp =
              handleLoginUserState.registrationTimestamp;
            userState.subscriptionTimestamp =
              handleLoginUserState.subscriptionTimestamp;
            userState.granted = handleLoginUserState.granted;
            userState.grantReason = handleLoginUserState.grantReason;

            GaaMeteringRegwall.remove();
            unlockArticleIfGranted();
          }
        });
      });

      subscriptions.setOnNativeSubscribeRequest(() => showPaywall());

      subscriptions.setOnEntitlementsResponse((googleEntitlementsPromise) => {
        // Wait for Google check and publisher check to finish
        Promise.all([
          googleEntitlementsPromise,
          publisherEntitlementPromise,
        ]).then((entitlements) => {
          // Determine Google response from publisher response.
          const googleEntitlement = entitlements[0];
          // const publisherEntitlement = entitlements[1];

          if (googleEntitlement.enablesThisWithGoogleMetering()) {
            // Google returned metering entitlement so grant access
            googleEntitlement.consume(() => {
              // Consume the entitlement and trigger a dialog that lets the user
              // know Google provided them with a free read.
              // Unlock the article AFTER the user consumes a free read.
              unlockArticle();
            });
          } else if (googleEntitlement.enablesThis()) {
            // Google returned a non-metering entitlement
            // This is only relevant for publishers doing SwG
            handleSwGEntitlement();
          } else if (
            !GaaMetering.isUserRegistered(userState) &&
            GaaMetering.isGaa(allowedReferrers)
          ) {
            // This is an anonymous user so show the Google registration intervention
            showGoogleRegwall();
          } else {
            // User does not any access from publisher or Google so show the standard paywall
            subscriptions.setShowcaseEntitlement({
              entitlement: 'EVENT_SHOWCASE_NO_ENTITLEMENTS_PAYWALL',
              isUserRegistered: GaaMetering.isUserRegistered(userState),
            });
            // Show the paywall
            showPaywall();
          }
        });
      });
    });

    // Show the Google registration intervention.
    function showGoogleRegwall() {
      debugLog('show Google Regwall');
      // Don't render the regwall until the window has loaded.
      self.addEventListener('load', () => {
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          clientId: googleSignInClientId,
        }).then((jwt) => {
          // Handle registration for new users
          // Save credentials object so that registerUserPromise can use it using getGaaUser.
          GaaMetering.setGaaUser(jwt);
          registerUserPromise.then((registerUserUserState) => {
            debugLog('registerUserPromise resolved');
            if (GaaMetering.validateUserState(registerUserUserState)) {
              userState.id = registerUserUserState.id;
              userState.registrationTimestamp =
                registerUserUserState.registrationTimestamp;
              userState.subscriptionTimestamp =
                registerUserUserState.subscriptionTimestamp;
              userState.granted = registerUserUserState.granted;
              userState.grantReason = registerUserUserState.grantReason;

              unlockArticleIfGranted();
            }
          });
        });
      });
    }

    function unlockArticleIfGranted() {
      if (!GaaMetering.validateUserState(userState)) {
        debugLog('Invalid userState object');
        return false;
      } 
      else if (userState.granted === true) {
        callSwg((subscriptions) => {
          if (userState.grantReason === 'SUBSCRIBER') {
            // The user has access because they have a subscription
            subscriptions.setShowcaseEntitlement({
              entitlement: 'EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION',
              isUserRegistered: GaaMetering.isUserRegistered(userState),
            });
            debugLog('unlocked for subscriber');
          } else if (userState.grantReason === 'FREE') {
            subscriptions.setShowcaseEntitlement({
              entitlement: 'EVENT_SHOWCASE_UNLOCKED_FREE_PAGE',
              isUserRegistered: GaaMetering.isUserRegistered(userState),
            });
            debugLog('unlocked for free');
          } else if (userState.grantReason === 'METERING') {
            // The user has access from the publisher's meter
            subscriptions.setShowcaseEntitlement({
              entitlement: 'EVENT_SHOWCASE_UNLOCKED_BY_METER',
              isUserRegistered: GaaMetering.isUserRegistered(userState),
            });
            debugLog('unlocked for metering');
          }
        });

        // User has access from publisher so unlock article
        unlockArticle();
      } 
      else {
        checkShowcaseEntitlement(userState);
      }
    }

    function checkShowcaseEntitlement(userState) {
      if (userState.registrationTimestamp) {
        // Send userState to Google
        callSwg((subscriptions) => {
          debugLog('getting entitlements from Google');
          debugLog(GaaMetering.newUserStateToUserState(userState));
          subscriptions.getEntitlements(
            GaaMetering.newUserStateToUserState(userState)
          );
        });
      } else {
        // If userState is undefined, it’s likely the user isn’t
        // logged in. Do not send an empty userState to Google in
        // this case.
        showGoogleRegwall();
      }
    }
  }

  static isUserRegistered(userState) {
    return userState.id !== undefined && userState.id != '';
  }

  static validateParameters(params) {
    if (
      !('googleSignInClientId' in params) ||
      !(typeof params.googleSignInClientId === 'string') ||
      !params.googleSignInClientId.includes('.apps.googleusercontent.com')
    ) {
      debugLog(
        'Missing googleSignInClientId, or it is not a string, or it is not in a correct format'
      );
      return false;
    }

    if (
      !('allowedReferrers' in params && Array.isArray(params.allowedReferrers))
    ) {
      debugLog('Missing allowedReferrers or it is not an array');
      return false;
    }

    const reqFunc = ['unlockArticle', 'showPaywall'];

    for (const reqFuncNo in reqFunc) {
      if (
        !(
          reqFunc[reqFuncNo] in params &&
          typeof params[reqFunc[reqFuncNo]] === 'function'
        )
      ) {
        debugLog(`Missing ${reqFunc[reqFuncNo]} or it is not a function`);
        return false;
      }
    }

    if (
      'handleSwGEntitlement' in params &&
      typeof params.handleSwGEntitlement != 'function'
    ) {
      debugLog('handleSwGEntitlement is provided but it is not a function');
      return false;
    }

    const reqPromise = ['handleLoginPromise', 'registerUserPromise'];

    for (const reqPromiseNo in reqPromise) {
      if (
        !(
          reqPromise[reqPromiseNo] in params &&
          GaaMetering.isPromise(params[reqPromise[reqPromiseNo]])
        )
      ) {
        debugLog(`Missing ${reqPromise[reqPromiseNo]} or it is not a promise`);
        return false;
      }
    }

    if (
      !(
        'publisherEntitlementPromise' in params &&
        GaaMetering.isPromise(params.publisherEntitlementPromise)
      )
    ) {
      debugLog(
        'publisherEntitlementPromise is provided but it is not a promise'
      );
    }

    // Check userState is an 'object'
    if (
      !('userState' in params) &&
      !('publisherEntitlementPromise' in params)
    ) {
      debugLog(`userState or publisherEntitlementPromise needs to be provided`);
      return false;
    }

    if ('userState' in params && typeof params.userState != 'object') {
      debugLog(`userState is not an object`);
      return false;
    }

    if (
      (!('granted' in params.userState) ||
        (params.userState.granted && !('grantReason' in params.userState))) &&
      !('publisherEntitlementPromise' in params)
    ) {
      debugLog(
        'Either granted and grantReason have to be supplied or you have to provide pubisherEntitlementPromise'
      );
      return false;
    }

    return true;
  }

  static isGaa(publisherReferrers = []) {
    // Validate GAA params.
    const queryString = GaaUtils.getQueryString();
    if (!queryStringHasFreshGaaParams(queryString, true)) {
      return false;
    }

    // Validate referrer.
    // NOTE: This regex was copied from SwG's AMP extension. https://github.com/ampproject/amphtml/blob/c23bf281f817a2ee5df73f6fd45e9f4b71bb68b6/extensions/amp-subscriptions-google/0.1/amp-subscriptions-google.js#L56
    const GOOGLE_DOMAIN_RE =
      /(^|\.)google\.(com?|[a-z]{2}|com?\.[a-z]{2}|cat)$/;
    const referrer = GaaMetering.getAnchorFromUrl(self.document.referrer);
    if (
      !GOOGLE_DOMAIN_RE.test(referrer.hostname) &&
      !publisherReferrers.includes(referrer.hostname)
    ) {
      // Real publications should bail if this referrer check fails.
      // This script is only logging a warning for metering demo purposes.
      debugLog(
        `This page's referrer ("${referrer.origin}") can't grant Google Article Access.`
      );

      return false;
    }

    return true;
  }

  static getAnchorFromUrl(url) {
    const a = self.document.createElement('a');
    a.href = url;
    return a;
  }

  static getProductIDFromPageConfig_() {
    const jsonLdPageConfig = GaaMetering.getProductIDFromJsonLdPageConfig_();
    if (jsonLdPageConfig) {
      return jsonLdPageConfig;
    }

    const microdataPageConfig =
      GaaMetering.getProductIDFromMicrodataPageConfig_();
    if (microdataPageConfig) {
      return microdataPageConfig;
    }

    throw new Error(
      'Showcase articles must define a publisher ID with either JSON-LD or Microdata.'
    );
  }

  /**
   * Gets publisher ID from JSON-LD page config.
   * @private
   * @nocollapse
   * @return {string|undefined}
   */
  static getProductIDFromJsonLdPageConfig_() {
    const ldJsonElements = self.document.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    for (let i = 0; i < ldJsonElements.length; i++) {
      const ldJsonElement = ldJsonElements[i];
      let ldJson = /** @type {*} */ (parseJson(ldJsonElement.textContent));

      if (!Array.isArray(ldJson)) {
        ldJson = [ldJson];
      }

      const productId = findInArray(
        ldJson,
        (entry) => entry?.isPartOf?.productID
      )?.isPartOf.productID;

      if (productId) {
        return productId;
      }
    }
  }

  /**
   * Gets product ID from Microdata page config.
   * @private
   * @nocollapse
   * @return {string|undefined}
   */
  static getProductIDFromMicrodataPageConfig_() {
    const productIdElements = self.document.querySelectorAll(
      '[itemscope][itemtype][itemprop="isPartOf"] [itemprop="productID"]'
    );

    for (let i = 0; i < productIdElements.length; i++) {
      const productIdElement = productIdElements[i];
      const productId = productIdElement.content;
      if (productId) {
        return productId;
      }
    }
  }

  static isArticleFreeFromPageConfig_() {
    const jsonLdPageConfig = GaaMetering.isArticleFreeFromJsonLdPageConfig_();
    if (jsonLdPageConfig) {
      return jsonLdPageConfig;
    }

    const microdataPageConfig =
      GaaMetering.isArticleFreeFromMicrodataPageConfig_();
    if (microdataPageConfig) {
      return microdataPageConfig;
    }

    return false;
  }

  /**
   * @private
   * @nocollapse
   * @return {boolean}
   */
  static isArticleFreeFromJsonLdPageConfig_() {
    const ldJsonElements = self.document.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    for (let i = 0; i < ldJsonElements.length; i++) {
      const ldJsonElement = ldJsonElements[i];
      let ldJson = /** @type {*} */ (parseJson(ldJsonElement.textContent));

      if (!Array.isArray(ldJson)) {
        ldJson = [ldJson];
      }

      const accessibleForFree = findInArray(
        ldJson,
        (entry) => entry?.isAccessibleForFree
      )?.isAccessibleForFree;

      if (accessibleForFree == null || accessibleForFree === '') {
        return false;
      }
      if (typeof accessibleForFree == 'boolean') {
        return accessibleForFree;
      }
      if (typeof accessibleForFree == 'string') {
        const lowercase = accessibleForFree.toLowerCase();
        return lowercase == 'true';
      }
    }

    return false;
  }

  /**
   * @private
   * @nocollapse
   * @return {boolean}
   */
  static isArticleFreeFromMicrodataPageConfig_() {
    const accessibleForFreeElements = self.document.querySelectorAll(
      '[itemscope][itemtype] [itemprop="isAccessibleForFree"]'
    );

    for (let i = 0; i < accessibleForFreeElements.length; i++) {
      const accessibleForFreeElement = accessibleForFreeElements[i];
      const accessibleForFree = accessibleForFreeElement.content;
      debugLog(typeof accessibleForFree);
      if (accessibleForFree) {
        const lowercase = accessibleForFree.toLowerCase();
        return lowercase == 'true';
      }
    }

    return false;
  }

  static isPromise(p) {
    return p && Object.prototype.toString.call(p) === '[object Promise]';
  }

  static newUserStateToUserState(newUserState) {
    return {
      'metering': {
        'state': {
          'id': newUserState.id,
          'standardAttributes': {
            'registered_user': {
              'timestamp': newUserState.registrationTimestamp,
            },
          },
        },
      },
    };
  }

  static validateUserState(newUserState) {
    if (!newUserState) {
      return false;
    }

    if (
      !('granted' in newUserState && typeof newUserState.granted === 'boolean')
    ) {
      debugLog(
        'userState.granted is missing or invalid (must be true or false)'
      );

      return false;
    }

    if (
      newUserState.granted === true &&
      !['METERING', 'SUBSCRIBER', 'FREE'].includes(newUserState.grantReason)
    ) {
      debugLog(
        'if userState.granted is true then userState.grantReason has to be either METERING, or SUBSCRIBER'
      );

      return false;
    }

    if (
      newUserState.granted === true &&
      newUserState.grantReason === 'SUBSCRIBER'
    ) {
      if (
        !('id' in newUserState) ||
        !('registrationTimestamp' in newUserState)
      ) {
        debugLog(
          'Missing user ID or registrationTimestamp in userState object'
        );
        return false;
      } else {
        if (
          !(
            typeof newUserState.registrationTimestamp === 'number' &&
            newUserState.registrationTimestamp % 1 === 0
          )
        ) {
          debugLog(
            'userState.registrationTimestamp invalid, userState.registrationTimestamp needs to be an integer and in seconds'
          );

          return false;
        }

        if (newUserState.registrationTimestamp > (new Date().getTime() / 1000)) {
          debugLog('userState.registrationTimestamp is in the future');

          return false;
        }

        if (
          newUserState.grantReason === 'SUBSCRIBER' &&
          !('subscriptionTimestamp' in newUserState)
        ) {
          debugLog(
            'subscriptionTimestamp is required if userState.grantReason is SUBSCRIBER'
          );

          return false;
        }

        if (
          'subscriptionTimestamp' in newUserState &&
          !(
            typeof newUserState.subscriptionTimestamp === 'number' &&
            newUserState.subscriptionTimestamp % 1 === 0
          )
        ) {
          debugLog(
            'userState.subscriptionTimestamp invalid, userState.subscriptionTimestamp needs to be an integer and in seconds'
          );

          return false;
        }

        if (
          'subscriptionTimestamp' in newUserState &&
          newUserState.subscriptionTimestamp > (new Date().getTime() / 1000)
        ) {
          debugLog('userState.subscriptionTimestamp is in the future');

          return false;
        }
      }
    }

    if (
      ('id' in newUserState) ||
      ('registrationTimestamp' in newUserState)
    ) {
        if (!('id' in newUserState)) {
          debugLog('Missing user ID in userState object');
          return false;
        }

        if (!('registrationTimestamp' in newUserState)) {
          debugLog(
            'Missing registrationTimestamp in userState object'
          );
          return false;
        }
    }

    return true;
  }
}
