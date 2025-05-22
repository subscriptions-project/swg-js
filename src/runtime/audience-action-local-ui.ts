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

export const BACK_TO_HOME_HTML = html`
  <a class="back-to-home-button" href="$BACK_TO_HOME_LINK$">
    $BACK_TO_HOME_TEXT$
  </a>
`;

const LOCAL_CTA_CSS = css`
  ${SLIDE_UP_ANIMATION}

  .local-cta {
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
    .local-cta {
      width: 375px !important;
    }
  }
`;

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

export const ERROR_HTML = html`
  <style>
    ${LOCAL_CTA_CSS} .local-cta {
      height: 120px;
      width: 100%;
      align-items: center;
      justify-items: center;
      display: grid;
    }
  </style>
  <div class="local-cta">Something went wrong.</div>
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
