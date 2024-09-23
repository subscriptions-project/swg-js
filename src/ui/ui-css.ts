/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

/**
 * Template literal helper to enable syntax highlighting for our CSS below.
 */
const css = String.raw;

/** @const {string} */
export const UI_CSS = css`
  body {
    padding: 0;
    margin: 0;
  }

  swg-container,
  swg-loading,
  swg-loading-animate,
  swg-loading-image {
    display: block;
  }

  swg-loading-container {
    width: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 148px !important;
    height: 100% !important;
    bottom: 0 !important;
    margin-top: 5px !important;
    z-index: 2147483647 !important;
  }

  /**
  * Since the desktop view has the parent iframe (.swg-dialog) transparent,
  * this style adds the background with borders to the loading indicator.
  */
  @media (min-width: 630px), (min-height: 630px) {
    swg-loading-container {
      width: 560px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      border-top-left-radius: 8px !important;
      border-top-right-radius: 8px !important;
      background-color: rgba(255, 255, 255, 1) !important;
      box-shadow: rgba(60, 64, 67, 0.3) 0 1px 1px,
        rgba(60, 64, 67, 0.15) 0 1px 4px 1px !important;
    }

    swg-loading-container.centered-on-desktop {
      height: 120px !important;
      min-height: 120px !important;
      border-radius: 8px !important;
    }
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

/**
 * This contains common styles for the Dialog and Toast components.
 * Swgjs injects these styles as a <style> element in the <head> element
 * of 3p article pages.
 *
 * These styles affect <iframe> elements, not their inner contents.
 * @const {string}
 */
export const DIALOG_CSS = css`
  /** Common styles across all window sizes. */
  .swg-dialog,
  .swg-toast {
    box-sizing: border-box;
    background-color: rgba(255, 255, 255, 1) !important;
  }

  .swg-toast {
    position: fixed !important;
    bottom: 0 !important;
    max-height: 46px !important;
    z-index: 2147483647 !important;
    border: none !important;
  }

  /**
  * Wide desktop screen support, when width is >= 871px and height is >= 641px.
  */
  @media (min-width: 871px) and (min-height: 641px) {
    .swg-dialog.swg-wide-dialog {
      width: 870px !important;
      left: -435px !important;
    }
  }

  /** Tablet/Medium screen support, when width OR height is <= 640px. */
  @media (max-width: 640px), (max-height: 640px) {
    .swg-dialog,
    .swg-toast {
      width: 480px !important;
      left: -240px !important;
      margin-inline-start: calc(100vw - 100vw / 2) !important;
      border-top-left-radius: 8px !important;
      border-top-right-radius: 8px !important;
      box-shadow: rgba(60, 64, 67, 0.3) 0 1px 1px,
        rgba(60, 64, 67, 0.15) 0 1px 4px 1px !important;
    }

    [dir='rtl'] .swg-dialog,
    [dir='rtl'] .swg-toast {
      margin-inline-start: calc(100vw - 100vw / 2 - 240px) !important;
    }
  }

  /** Desktop/Large screen support, when width AND height are >= 641px. */
  @media (min-width: 641px) and (min-height: 641px) {
    .swg-dialog {
      width: 630px !important;
      left: -315px !important;
      margin-inline-start: calc(100vw - 100vw / 2) !important;
      background-color: transparent !important;
      border: none !important;
    }

    [dir='rtl'] .swg-dialog {
      margin-inline-start: calc(100vw - 100vw / 2 - 315px) !important;
    }

    .swg-toast {
      border-radius: 4px !important;
      bottom: 8px !important;
      box-shadow: 0 3px 1px -2px rgb(0 0 0 / 20%), 0 2px 2px 0 rgb(0 0 0 / 14%),
        0 1px 5px 0 rgb(0 0 0 / 12%) !important;
      left: 8px !important;
    }
  }

  /** Phone/Small screen support, when width is <= 480px. */
  @media (max-width: 480px) {
    .swg-dialog,
    .swg-toast {
      width: 100% !important;
      left: 0 !important;
      right: 0 !important;
      margin-inline-start: 0 !important;
    }
  }

  /**
  * Class applied to content page to disable scrolling.
  */
  html > body.swg-disable-scroll,
  html > body.swg-disable-scroll * {
    overflow: hidden !important;
  }
`;
