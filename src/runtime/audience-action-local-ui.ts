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
`

// Rewarded ad wall prompt css and html.
// TODO: mhkawano - update when UX is done.
// TODO: mhkawano - allow error view to be closed.
const REWARDED_AD_CSS = css`
  .rewarded-ad-prompt {
    margin-left: auto !important;
    margin-right: auto !important;
    margin-top: auto !important;

    border-top-left-radius: 8px !important;
    border-top-right-radius: 8px !important;


    width: 375px !important;
    height: 347px !important;

    pointer-events: auto !important;
    
    background: white !important;
  }

  .rewarded-ad-container {
    margin: 20px;
    text-align: center;
  }

  .rewarded-ad-header {
    display: grid !important;
    grid-template-columns: 40px 1fr 40px;
    grid-template-rows: 40px;
  }

  .rewarded-ad-title {
    font-size: 28px;
  }

  button {
    background: none;
    color: inherit;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    outline: inherit;
  }

  .rewarded-ad-title {
    grid-column: 2;
    grid-row: 1;
  }

  .close {
    height: 24px;
    width: 24px;
    background-origin: content-box;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
    padding: 8px;
    box-sizing: content-box;
    border-radius: 20px;
    background-image: url("https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/close/default/24px.svg");

    grid-column: 3;
    grid-row: 1;
  }

  .close:hover {
    background-color: #F8F9FA;
  }

  .rewarded-ad-icon {
    margin: auto;
    height: 24px;
    width: 24px;
    background-origin: content-box;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
    box-sizing: content-box;
    background-image: url("https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/lock_open/default/40px.svg");
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
        <button class="close"></button>
      </div>
      <div class="rewarded-ad-icon"></div>
      <div class="rewarded-ad-message">message</div>
      <div class="rewarded-ad-cta">
        <button class="rewarded-ad-contribute-button">contribute</a>
        <button class="rewarded-ad-view-ad-button">view ad</button>
        <button class="rewarded-ad-subscribe-button">subscribe</button>
      </div>
      <div class="rewarded-ad-footer">
        <button class="rewarded-ad-sign-in-button">sign-in</button>
      </div>
    <div>
  </div>
`;

const REWARDED_AD_THANKS_CSS = css`
  .rewarded-ad-thanks-prompt {
    margin-left: auto !important;
    margin-right: auto !important;
    margin-top: auto !important;

    border-top-left-radius: 8px !important;
    border-top-right-radius: 8px !important;


    width: 375px !important;
    height: 347px !important;

    pointer-events: auto !important;

    background: white !important;
  }

  .rewarded-ad-thanks-container {
    margin: 32px;
    text-align: center;
  }

  .rewarded-ad-thanks-close-button {}

  .rewarded-ad-thanks-icon {}

  .rewarded-ad-thanks-message {}
`;

export const REWARDED_AD_THANKS_HTML = html`
  <style>
    ${REWARDED_AD_THANKS_CSS}
  </style>
  <div class="rewarded-ad-thanks-prompt">
    <div class="rewarded-ad-thanks-container">
      <a
        class="rewarded-ad-thanks-close-button"
        href="#"
      >close</a>
      <div class="rewarded-ad-thanks-icon">icon</div>
      <div class="rewarded-ad-thanks-message">message</div>
    <div>
  </div>
`;
