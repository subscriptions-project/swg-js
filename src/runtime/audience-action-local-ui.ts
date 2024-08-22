/**
 * Copyright 2023 The Subscribe with Google Authors. All Rights Reserved.
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

import {ASSETS} from '../constants';
import {GOOGLE_LOGO_IMAGE_DATA} from '../utils/assets';

// Helper for syntax highlighting.
const html = String.raw;
const css = String.raw;

const SLIDE_UP_ANIMATION = css`
  @keyframes slideUp {
    from {
      transform: translate(0, 200px);
    }
    to {
      transform: translate(0, 0);
    }
  }
`;

const EXIT_CSS = css`
  .exit-container {
    width: 100%;
    display: flex;
    flex-direction: row-reverse;
  }
`;

const BACK_TO_HOME_CSS = css`
  .back-to-home-button {
    border-radius: 4px;
    text-decoration: none;
    font-size: 14px;
    color: #1a73e8;
    padding: 17px;
    outline-offset: 4px;
    outline-color: #145ab5;
  }

  .back-to-home-button:focus,
  .back-to-home-button:hover {
    background-color: #f2f8ff;
  }
`;

export const BACK_TO_HOME_HTML = html`
  <a class="back-to-home-button" href="$BACK_TO_HOME_LINK$">
    $BACK_TO_HOME_TEXT$
  </a>
`;

const REWARDED_AD_PROMPT = css`
  ${SLIDE_UP_ANIMATION}

  .rewarded-ad-prompt {
    animation: 0.5s slideUp;
    margin-left: auto !important;
    margin-right: auto !important;
    margin-top: auto !important;
    border-top-left-radius: 20px !important;
    border-top-right-radius: 20px !important;
    pointer-events: auto !important;
    background: white !important;
    max-height: 90%;
    overflow: auto;
    outline: none;
    font-family: 'Google Sans', 'Roboto-Regular', sans-serif, arial;
    width: 100%;
  }

  @media (min-width: 450px) {
    .rewarded-ad-prompt {
      width: 375px !important;
    }
  }
`;

const DEFAULT_BUTTON = css`
  button {
    background: none;
    color: inherit;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    outline-offset: 4px; // 0.25rem;
    outline-color: #145ab5;
  }
`;

const REWARDED_AD_CLOSE_BUTTON_CSS = css`
  .rewarded-ad-close-button {
    margin: 8px 8px 0px 0px;
    padding: 12px;
    height: 48px;
    width: 48px;
    grid-column: 3;
    grid-row: 1;
    border-radius: 4px;
  }
  .rewarded-ad-close-img {
    border-radius: 20px;
    height: 24px;
    width: 24px;
    background: #5f6368;
    -webkit-mask: url(https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/close/default/24px.svg)
      center/contain no-repeat;
  }

  .rewarded-ad-close-button:hover,
  .rewarded-ad-close-button:focus {
    background-color: #f2f8ff;
  }
`;

export const REWARDED_AD_CLOSE_BUTTON_HTML = html` <button
  aria-label="$CLOSE_BUTTON_DESCRIPTION$"
  class="rewarded-ad-close-button"
>
  <div class="rewarded-ad-close-img"></div>
</button>`;

const OPT_IN_CLOSE_BUTTON_CSS = css`
  .opt-in-close-button-container {
    text-align: end !important;
  }

  .opt-in-close-button {
    background: none;
    border: none;
    border-radius: 4px;
    height: 48px;
    padding: 12px;
    width: 48px;
  }

  .opt-in-close-img {
    border-radius: 20px;
    height: 24px;
    width: 24px;
  }

  .opt-in-close-button:hover,
  .opt-in-close-button:focus {
    background-color: #f2f8ff;
  }

  @media (forced-colors: active) {
    .opt-in-close-img {
      background: buttonText;
    }
  }
`;

export const OPT_IN_CLOSE_BUTTON_HTML = html`<style>
    ${OPT_IN_CLOSE_BUTTON_CSS}
  </style>
  <div class="opt-in-close-button-container">
    <button aria-label="$CLOSE_BUTTON_DESCRIPTION$" class="opt-in-close-button">
      <img
        class="opt-in-close-img"
        src="https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/close/default/24px.svg"
        alt="Close button"
      />
    </button>
  </div>`;

// Error view for prompts that fail to init.
const ERROR_CSS = css`
  ${REWARDED_AD_PROMPT}
`;

export const ERROR_HTML = html`
  <style>
    ${ERROR_CSS} .rewarded-ad-prompt {
      height: 120px;
      width: 100%;
      align-items: center;
      justify-items: center;
      display: grid;
    }
  </style>
  <div class="rewarded-ad-prompt">Something went wrong.</div>
`;

const LOADING_CSS = css`
  swg-container,
  swg-loading,
  swg-loading-animate,
  swg-loading-image {
    display: block;
  }

  swg-loading-container {
    margin-left: auto !important;
    margin-right: auto !important;
    margin-top: auto !important;

    border-top-left-radius: 8px !important;
    border-top-right-radius: 8px !important;

    height: 148px !important;
    width: 100% !important;

    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    bottom: 0 !important;
    z-index: 2147483647 !important;

    background-color: rgba(255, 255, 255, 1) !important;
    box-shadow: rgba(60, 64, 67, 0.3) 0 1px 1px,
      rgba(60, 64, 67, 0.15) 0 1px 4px 1px !important;
  }

  swg-loading-container.centered-on-desktop {
    height: 120px !important;
    min-height: 120px !important;
    border-radius: 8px !important;
  }

  swg-loading {
    z-index: 2147483647 !important;
    width: 36px;
    height: 36px;
    overflow: hidden;
    animation: mspin-rotate 1568.63ms infinite linear;
  }

  swg-loading-animate {
    animation: mspin-revrot 5332ms infinite steps(4);
  }

  swg-loading-image {
    background-image: url('${ASSETS}/loader.svg');
    background-size: 100%;
    width: 11664px;
    height: 36px;
    animation: swg-loading-film 5332ms infinite steps(324);
  }

  @keyframes swg-loading-film {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-11664px);
    }
  }

  @keyframes mspin-rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes mspin-revrot {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(-360deg);
    }
  }

  @media (min-width: 450px) {
    swg-loading-container {
      width: 375px !important;
    }
  }
`;

export const LOADING_HTML = html`
  <style>
    ${LOADING_CSS}
  </style>
  <swg-loading-container>
    <swg-loading>
      <swg-loading-animate>
        <swg-loading-image></swg-loading-image>
      </swg-loading-animate>
    </swg-loading>
  </swg-loading-container>
`;

// Rewarded ad wall prompt css and html.
const REWARDED_AD_CSS = css`
  ${DEFAULT_BUTTON}
  ${REWARDED_AD_CLOSE_BUTTON_CSS}
  ${REWARDED_AD_PROMPT}
  ${BACK_TO_HOME_CSS}
  ${EXIT_CSS}

  .rewarded-ad-container {
    margin: 0px;
    text-align: center;
  }

  .rewarded-ad-header {
    display: grid !important;
    grid-template-columns: 56px 1fr 56px;
  }

  .rewarded-ad-title {
    font-size: 28px; //1.75rem;
    line-height: 36px; // 2.25rem;
    font-weight: 400;
    letter-spacing: 0em;
    color: #202124;
    grid-column: 2;
    grid-row: 1;
    line-break: auto;
  }

  .rewarded-ad-message {
    margin-top: 8px;
    padding: 0px 11px 0px 11px;
    font-size: 16px; // 1rem;
    font-weight: 500;
    line-height: 24px; // 1.5rem;
    letter-spacing: 0.25px;
    color: #202124;
  }

  .rewarded-ad-cta {
    margin: 20px 14px 0px 14px;
  }

  .rewarded-ad-cta-button {
    padding: 6px; // 0.375rem;
    width: 100%;
    outline-offset: -2px; // 0.125rem;
  }

  .rewarded-ad-cta-button-inner {
    width: 100%;
    height: 36px; // 2.25rem;
    border-radius: 4px; // 0.25rem;
    font-size: 14px; // 0.875rem;
    font-weight: 500;
    letter-spacing: 0.25px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .rewarded-ad-view-ad-button-inner {
    background-color: #1a73e8;
    color: white;
  }

  .rewarded-ad-cta-button:focus .rewarded-ad-view-ad-button-inner,
  .rewarded-ad-cta-button:hover .rewarded-ad-view-ad-button-inner {
    background-color: #145ab5;
  }

  .rewarded-ad-view-ad-button:disabled .rewarded-ad-view-ad-button-inner {
    background-color: darkgrey;
    color: lightgrey;
  }

  .rewarded-ad-support-button-inner {
    border: 1px solid #dadce0;
    border-radius: 4px; // 0.25rem;
    color: #1a73e8;
  }

  .rewarded-ad-cta-button:focus .rewarded-ad-support-button-inner,
  .rewarded-ad-cta-button:hover .rewarded-ad-support-button-inner {
    background-color: #e6e6e6;
  }

  .rewarded-ad-google-logo {
    float: left;
    height: 24px;
    margin: 20px 0px 20px 0px;
  }

  .rewarded-ad-sign-in-button {
    float: right;
    font-size: 14px; // 0.875rem;
    font-weight: 500;
    line-height: 20px; // 1.25rem;
    letter-spacing: 0.25px;
    text-align: right;
    color: #1a73e8;
    height: 48px;
    border-radius: 4px;
    margin: 8px 0px 8px 0px;
    padding: 0px 7px 0px 7px;
  }

  .rewarded-ad-sign-in-button:focus,
  .rewarded-ad-sign-in-button:hover {
    background-color: #f2f8ff;
  }

  .rewarded-ad-footer {
    margin-left: 20px;
    margin-right: 20px;
  }
`;

export const REWARDED_AD_SUPPORT_HTML = html`<button
  class="rewarded-ad-support-button rewarded-ad-cta-button"
>
  <div class="rewarded-ad-support-button-inner rewarded-ad-cta-button-inner">
    $SUPPORT_MESSAGE$
  </div>
</button>`;

export const REWARDED_AD_SIGN_IN_HTML = html`<button
  class="rewarded-ad-sign-in-button"
>
  $SIGN_IN_MESSAGE$
</button>`;

export const REWARDED_AD_HTML = html`
  <style>
    ${REWARDED_AD_CSS}
  </style>
  <div
    class="rewarded-ad-prompt"
    tabindex="-1"
    role="dialog"
    aria-labelledby="title-id"
    aria-describedby="message-id"
    aria-modal="true"
  >
    <div class="rewarded-ad-container">
      <div class="exit-container">$EXIT$</div>
      <div class="rewarded-ad-header">
        <div class="rewarded-ad-title" id="title-id">$TITLE$</div>
      </div>
      <div class="rewarded-ad-message" id="message-id">$MESSAGE$</div>
      <div class="rewarded-ad-cta">
        <button class="rewarded-ad-view-ad-button rewarded-ad-cta-button">
          <div
            class="rewarded-ad-view-ad-button-inner rewarded-ad-cta-button-inner"
          >
            $VIEW_AN_AD$
          </div>
        </button>
        $SUPPORT_BUTTON$
      </div>
      <div class="rewarded-ad-footer">
        <img
          alt="Google"
          class="rewarded-ad-google-logo"
          src="${GOOGLE_LOGO_IMAGE_DATA}"
        />
        $SIGN_IN_BUTTON$
      </div>
    </div>
  </div>
`;

const REWARDED_AD_THANKS_CSS = css`
  ${DEFAULT_BUTTON}
  ${REWARDED_AD_CLOSE_BUTTON_CSS}
  ${REWARDED_AD_PROMPT}
  ${EXIT_CSS}

  .rewarded-ad-prompt {
    width: 100%;
  }

  .rewarded-ad-thanks-message {
    font-size: 22px; // 1.375rem;
    font-weight: 400;
    line-height: 28px; // 1.75rem;
    letter-spacing: 0px;
    text-align: center;
    color: #202124;
    margin-block-end: 48px; // 3rem;
  }
`;

export const REWARDED_AD_THANKS_HTML = html`
  <style>
    ${REWARDED_AD_THANKS_CSS}
  </style>
  <div
    class="rewarded-ad-prompt"
    tabindex="-1"
    role="dialog"
    aria-labelledby="thanks-id"
    aria-modal="true"
  >
    <div class="exit-container">${REWARDED_AD_CLOSE_BUTTON_HTML}</div>
    <div class="rewarded-ad-thanks-message" id="thanks-id">
      $THANKS_FOR_VIEWING_THIS_AD$
    </div>
  </div>
`;
