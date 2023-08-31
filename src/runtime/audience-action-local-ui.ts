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
import {CONST_GOOGLE_LOGO} from '../utils/assets';

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

const REWARDED_AD_PROMPT = css`
  ${SLIDE_UP_ANIMATION}

  .rewarded-ad-prompt {
    animation: 0.5s slideUp;
    margin-left: auto !important;
    margin-right: auto !important;
    margin-top: auto !important;
    border-top-left-radius: 20px !important;
    border-top-right-radius: 20px !important;
    width: 375px !important;
    pointer-events: auto !important;
    background: white !important;
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
    outline: inherit;
  }
`;

const CLOSE_BUTTON = css`
  .rewarded-ad-close-button {
    height: 24px;
    width: 24px;
    padding: 8px;
    border-radius: 20px;

    background: #5f6368;
    -webkit-mask: url(https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/close/default/24px.svg)
      center/contain no-repeat;

    grid-column: 3;
    grid-row: 1;
  }
`;

// Error view for prompts that fail to init.
// TODO: mhkawano - Update once UX finished.
const ERROR_CSS = css`
  .prompt {
    width: 600px;
    height: 200px;
    background: white;
    pointer-events: auto !important;
    text-align: center;
  }
`;

// TODO: mhkawano - allow error view to be closed.
export const ERROR_HTML = html`
  <style>
    ${ERROR_CSS}
  </style>
  <div class="prompt">Something went wrong.</div>
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
    width: 375px !important;

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
// TODO: mhkawano - Add aria attributes.
// TODO: mhkawano - allow error view to be closed.
const REWARDED_AD_CSS = css`
  ${DEFAULT_BUTTON}
  ${CLOSE_BUTTON}
  ${REWARDED_AD_PROMPT}

  .rewarded-ad-container {
    margin: 20px;
    text-align: center;
    font-family: 'Google Sans', 'Roboto-Regular', sans-serif, arial;
  }

  .rewarded-ad-header {
    display: grid !important;
    grid-template-columns: 24px 1fr 24px;
    grid-template-rows: 40px;
  }

  .rewarded-ad-title {
    font-size: 28px;
    font-weight: 400;
    line-height: 36px;
    letter-spacing: 0em;
    color: #202124;
    grid-column: 2;
    grid-row: 1;
  }

  .rewarded-ad-icon {
    margin: 8px auto 0px auto;
    height: 40px;
    width: 40px;
    background: #1a73e8;
    -webkit-mask: url(https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/lock_open/default/40px.svg)
      center/contain no-repeat;
  }

  .rewarded-ad-message {
    margin-top: 8px;
    padding: 0px 11px 0px 11px;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    letter-spacing: 0.25px;
    color: #202124;
  }

  .rewarded-ad-cta {
    margin-top: 20px;
  }

  .rewarded-ad-view-ad-button {
    width: 100%;
    height: 36px;
    background-color: #1a73e8;
    color: white;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    letter-spacing: 0.25px;
  }

  .rewarded-ad-view-ad-button:disabled {
    background-color: darkgrey;
    color: lightgrey;
  }

  .rewarded-ad-contribute-button {
    width: 100%;
    height: 36px;
    border: 1px solid #dadce0;
    margin-top: 8px;
    border-radius: 4px;
    color: #1a73e8;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    letter-spacing: 0.25px;
  }

  .rewarded-ad-subscribe-button {
    width: 100%;
    height: 36px;
    border: 1px solid #dadce0;
    margin-top: 8px;
    border-radius: 4px;
    color: #1a73e8;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    letter-spacing: 0.25px;
  }

  .rewarded-ad-footer {
    padding-top: 24px;
    padding-bottom: 24px;
  }

  .rewarded-ad-google-logo {
    float: left;
    height: 24px;
  }

  .rewarded-ad-sign-in-button {
    float: right;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    letter-spacing: 0.25px;
    text-align: right;
    color: #1a73e8;
  }
`;

export const REWARDED_AD_HTML = html`
  <style>
    ${REWARDED_AD_CSS}
  </style>
  <div class="rewarded-ad-prompt">
    <div class="rewarded-ad-container">
      <div class="rewarded-ad-header">
        <div class="rewarded-ad-title">title</div>
        <button class="rewarded-ad-close-button"></button>
      </div>
      <div class="rewarded-ad-icon"></div>
      <div class="rewarded-ad-message"></div>
      <div class="rewarded-ad-cta">
        <button class="rewarded-ad-view-ad-button">View an ad</button>
        <button class="rewarded-ad-contribute-button">Contribute</a>
        <button class="rewarded-ad-subscribe-button">Subscribe</button>
      </div>
      <div class="rewarded-ad-footer">
        <img
          alt="Google"
          class="rewarded-ad-google-logo"
          src="${CONST_GOOGLE_LOGO}"
        />
        <button class="rewarded-ad-sign-in-button">Already a subscriber?</button>
      </div>
    </div>
  </div>
`;

const REWARDED_AD_THANKS_CSS = css`
  ${DEFAULT_BUTTON}
  ${CLOSE_BUTTON}
  ${REWARDED_AD_PROMPT}

  .rewarded-ad-prompt {
    height: 125px !important;
    padding: 20px;
  }

  .rewarded-ad-thanks-container {
    height: 100%;
    display: grid !important;
    grid-template-columns: 24px 1fr 24px;
    grid-template-rows: 40px 24px 8px 28px;
  }

  .rewarded-ad-thanks-icon {
    margin: auto;
    height: 64px;
    width: 64px;
    background: #1a73e8;
    -webkit-mask: url(https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/rewarded_ads/default/48px.svg)
      center/contain no-repeat;
    grid-column: 2;
    grid-row: 1 / 2;
  }

  .rewarded-ad-thanks-message {
    font-size: 22px;
    font-weight: 400;
    line-height: 28px;
    letter-spacing: 0px;
    text-align: center;
    color: #202124;

    grid-column: 2;
    grid-row: 4;
  }
`;

export const REWARDED_AD_THANKS_HTML = html`
  <style>
    ${REWARDED_AD_THANKS_CSS}
  </style>
  <div class="rewarded-ad-prompt">
    <div class="rewarded-ad-thanks-container">
      <div class="rewarded-ad-thanks-icon"></div>
      <div class="rewarded-ad-thanks-message">Thanks for viewing this ad</div>
      <button class="rewarded-ad-close-button"></button>
      <div></div>
    </div>
  </div>
`;
