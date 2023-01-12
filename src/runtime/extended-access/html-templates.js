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

/** ID for the Google Sign-In button element. */
export const GOOGLE_SIGN_IN_BUTTON_ID = 'swg-google-sign-in-button';

/** ID for the third party Google Sign-In button element.  */
export const GOOGLE_3P_SIGN_IN_BUTTON_ID = 'swg-google-3p-sign-in-button';

/** ID for the Google Sign-In button element. */
export const SIGN_IN_WITH_GOOGLE_BUTTON_ID = 'swg-sign-in-with-google-button';

/** ID for the Publisher sign-in button element. */
export const PUBLISHER_SIGN_IN_BUTTON_ID = 'swg-publisher-sign-in-button';

/** ID for the Google Sign-In iframe element. */
export const GOOGLE_SIGN_IN_IFRAME_ID = 'swg-google-sign-in-iframe';

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
 * HTML for iFrame to render registration widget.
 */
export const REGISTRATION_WIDGET_IFRAME_HTML = `
  <iframe
    id="${GOOGLE_SIGN_IN_IFRAME_ID}"
    class="gaa-metering-regwall--iframe"
    src="$iframeUrl$">
  </iframe>
`;

/**
 * HTML for the metering regwall dialog, where users can sign in with Google.
 * The script creates a dialog based on this HTML.
 *
 * The HTML includes an iframe that loads the Google Sign-In button.
 * This iframe can live on a different origin.
 */
export const REGWALL_HTML = `
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
 * HTML for container of the registration button.
 */
export const REGISTRATION_BUTTON_HTML = `
  <div
      id="${REGISTRATION_BUTTON_CONTAINER_ID}"
      class="gaa-metering-regwall--registration-button-container">
  </div>
`;

/**
 * HTML for the CASL blurb.
 * CASL stands for Canadian Anti-Spam Law.
 */
export const CASL_HTML = `
<div class="gaa-metering-regwall--casl">
  $SHOWCASE_REGWALL_CASL$
</div>
`;

/** Base styles for both the Google and Google 3p Sign-In button iframes. */
export const GOOGLE_SIGN_IN_BUTTON_STYLES = `
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
export const GOOGLE_SIGN_IN_IFRAME_STYLES = `
  body {
    margin: 0;
    overflow: hidden;
  }${GOOGLE_SIGN_IN_BUTTON_STYLES}
`;

/** Styles for the third party Google Sign-In button iframe. */
export const GOOGLE_3P_SIGN_IN_IFRAME_STYLES =
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

export const GOOGLE_3P_SIGN_IN_BUTTON_HTML = `
<div style="height:36px;width:180px;" class="abcRioButton abcRioButtonBlue">
  <span style="font-size:15px;line-height:34px;" class="abcRioButtonContents">
    <span id="not_signed_in">Sign in with Google</span>
  </span>
</div>
`;
