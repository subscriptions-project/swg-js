/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
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

const MAX_Z_INDEX = 2147483647;

const Constants = {};

/**
 * Supported environments.
 *
 * @enum {string}
 */
Constants.Environment = {
  LOCAL: 'LOCAL',
  PREPROD: 'PREPROD',
  PRODUCTION: 'PRODUCTION',
  SANDBOX: 'SANDBOX',
  TEST: 'TEST',
  TIN: 'TIN',
};

/**
 * Supported payment methods.
 *
 * @enum {string}
 */
Constants.PaymentMethod = {
  CARD: 'CARD',
  TOKENIZED_CARD: 'TOKENIZED_CARD',
  UPI: 'UPI',
};

/**
 * Auth methods.
 *
 * @enum {string}
 */
Constants.AuthMethod = {
  CRYPTOGRAM_3DS: 'CRYPTOGRAM_3DS',
  PAN_ONLY: 'PAN_ONLY',
};

/**
 * Returned result status.
 *
 * @enum {string}
 */
Constants.ResponseStatus = {
  CANCELED: 'CANCELED',
  DEVELOPER_ERROR: 'DEVELOPER_ERROR',
};

/**
 * Supported total price status.
 *
 * @enum {string}
 */
Constants.TotalPriceStatus = {
  ESTIMATED: 'ESTIMATED',
  FINAL: 'FINAL',
  NOT_CURRENTLY_KNOWN: 'NOT_CURRENTLY_KNOWN',
};

/**
 * Supported Google Pay payment button type.
 *
 * @enum {string}
 */
Constants.ButtonType = {
  SHORT: 'short',
  LONG: 'long',
};

/**
 * Supported button colors.
 *
 * @enum {string}
 */
Constants.ButtonColor = {
  DEFAULT: 'default',  // Currently defaults to black.
  BLACK: 'black',
  WHITE: 'white',
};

/**
 * Id attributes.
 *
 * @enum {string}
 */
Constants.Id = {
  POPUP_WINDOW_CONTAINER: 'popup-window-container',
};

/** @const {string} */
Constants.STORAGE_KEY_PREFIX = 'google.payments.api.storage';

/** @const {string} */
Constants.IS_READY_TO_PAY_RESULT_KEY =
    Constants.STORAGE_KEY_PREFIX + '.isreadytopay.result';

/** @const {string} */
Constants.UPI_CAN_MAKE_PAYMENT_CACHE_KEY =
    Constants.STORAGE_KEY_PREFIX + '.upi.canMakePaymentCache';


Constants.CLASS_PREFIX = 'google-payments-';
Constants.IFRAME_ACTIVE_CONTAINER_CLASS =
    `${Constants.CLASS_PREFIX}activeContainer`;
Constants.IFRAME_CONTAINER_CLASS = `${Constants.CLASS_PREFIX}dialogContainer`;
Constants.IFRAME_STYLE_CENTER_CLASS = `${Constants.CLASS_PREFIX}dialogCenter`;
Constants.IFRAME_STYLE_CLASS = `${Constants.CLASS_PREFIX}dialog`;

Constants.IFRAME_STYLE = `
.${Constants.IFRAME_STYLE_CLASS} {
    animation: none 0s ease 0s 1 normal none running;
    background: none 0 0 / auto repeat scroll padding-box border-box #fff;
    background-blend-mode: normal;
    border: 0 none #333;
    border-radius: 8px 8px 0 0;
    border-collapse: separate;
    bottom: 0;
    box-shadow: #808080 0 3px 0 0, #808080 0 0 22px;
    box-sizing: border-box;
    letter-spacing: normal;
    max-height: 100%;
    overflow: visible;
    position: fixed;
    width: 100%;
    z-index: ${MAX_Z_INDEX};
    -webkit-appearance: none;
    left: 0;
}
@media (min-width: 480px) {
  .${Constants.IFRAME_STYLE_CLASS} {
    width: 480px !important;
    left: -240px !important;
    margin-left: calc(100vw - 100vw / 2) !important;
  }
}
.${Constants.IFRAME_CONTAINER_CLASS} {
  background-color: rgba(0,0,0,0.26);
  bottom: 0;
  height: 100%;
  left: 0;
  position: absolute;
  right: 0;
}
.iframeContainer {
  -webkit-overflow-scrolling: touch;
}
`;

Constants.IFRAME_STYLE_CENTER = `
.${Constants.IFRAME_STYLE_CENTER_CLASS} {
  animation: none 0s ease 0s 1 normal none running;
  background-blend-mode: normal;
  background: none 0 0 / auto repeat scroll padding-box border-box #fff;
  border-collapse: separate;
  border-radius: 8px;
  border: 0px none #333;
  bottom: auto;
  box-shadow: #808080 0 0 22px;
  box-sizing: border-box;
  left: -240px;
  letter-spacing: normal;
  margin-left: calc(100vw - 100vw / 2) !important;
  max-height: 90%;
  overflow: visible;
  position: absolute;
  top: 100%;
  transform: scale(0.8);
  width: 480px;
  z-index: ${MAX_Z_INDEX};
  -webkit-appearance: none;
}
@media (min-height: 667px) {
  .${Constants.IFRAME_STYLE_CENTER_CLASS} {
    max-height: 600px;
  }
}
.${Constants.IFRAME_ACTIVE_CONTAINER_CLASS} {
  top: 50%;
  transform: scale(1.0) translateY(-50%);
}
`;

Constants.GPAY_BUTTON_WITH_CARD_INFO_IMAGE =
    'background-image: url(https://pay.google.com/gp/p/generate_gpay_btn_img);';

Constants.BUTTON_LOCALE_TO_MIN_WIDTH = {
  'en': 152,
  'bg': 163,
  'cs': 192,
  'de': 183,
  'es': 183,
  'fr': 183,
  'hr': 157,
  'id': 186,
  'ja': 148,
  'ko': 137,
  'ms': 186,
  'nl': 167,
  'pl': 182,
  'pt': 193,
  'ru': 206,
  'sk': 157,
  'sl': 211,
  'sr': 146,
  'tr': 161,
  'uk': 207,
  'zh': 156,
};

/**
 * Name of the graypane.
 *
 * @const {string}
 */
Constants.GPAY_GRAYPANE = 'gpay-graypane';

/**
 * Class used for the gpay button.
 *
 * @const {string}
 */
Constants.GPAY_BUTTON_CLASS = 'gpay-button';

Constants.BUTTON_STYLE = `
.${Constants.GPAY_BUTTON_CLASS} {
  background-origin: content-box;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: contain;
  border: 0px;
  border-radius: 4px;
  box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 1px 0px, rgba(60, 64, 67, 0.15) 0px 1px 3px 1px;
  cursor: pointer;
  height: 40px;
  min-height: 40px;
  padding: 11px 24px;
}

.${Constants.GPAY_BUTTON_CLASS}.black {
  background-color: #000;
  box-shadow: none;
  padding: 12px 24px 10px;
}

.${Constants.GPAY_BUTTON_CLASS}.white {
  background-color: #fff;
}

.${Constants.GPAY_BUTTON_CLASS}.short {
  min-width: 90px;
  width: 160px;
}

.${Constants.GPAY_BUTTON_CLASS}.black.short {
  background-image: url(https://www.gstatic.com/instantbuy/svg/dark_gpay.svg);
}

.${Constants.GPAY_BUTTON_CLASS}.white.short {
  background-image: url(https://www.gstatic.com/instantbuy/svg/light_gpay.svg);
}

.${Constants.GPAY_BUTTON_CLASS}.black.active {
  background-color: #5f6368;
}

.${Constants.GPAY_BUTTON_CLASS}.black.hover {
  background-color: #3c4043;
}

.${Constants.GPAY_BUTTON_CLASS}.white.active {
  background-color: #fff;
}

.${Constants.GPAY_BUTTON_CLASS}.white.focus {
  box-shadow: #e8e8e8 0 1px 1px 0, #e8e8e8 0 1px 3px;
}

.${Constants.GPAY_BUTTON_CLASS}.white.hover {
  background-color: #f8f8f8;
}
`;

Constants.GPAY_BUTTON_WITH_OFFER_ICON_ADDITIONAL_STYLE = 'position: relative;';

Constants.GPAY_OFFER_ICON_CLASS = 'gpay-offer-icon';

Constants.GPAY_OFFER_ICON_SVG =
    "<svg width=\"20px\" height=\"20px\" viewBox=\"0 0 20 20\" " +
    "version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=" +
    "\"http://www.w3.org/1999/xlink\" class=\"gpay-offer-icon\"><defs><path d=\"M19.41,9.58 L10.41,0.58 " +
    "C10.05,0.22 9.55,0 9,0 L2,0 C0.9,0 0,0.9 0,2 L0,9 C0,9.55 0.22,10.05 " +
    "0.59,10.42 L9.59,19.42 C9.95,19.78 10.45,20 11,20 C11.55,20 12.05,19.78 " +
    "12.41,19.41 L19.41,12.41 C19.78,12.05 20,11.55 20,11 C20,10.45 19.77," +
    "9.94 19.41,9.58 Z\" id=\"path-1\"></path></defs><g id=\"buttons_10.05\"" +
    " stroke=\"none\" stroke-width=\"1\" fill=\"none\" fill-rule=\"evenodd\">" +
    "<g id=\"Artboard\" transform=\"translate(-40.000000, -43.000000)\">" +
    "<g id=\"Group-3\" transform=\"translate(40.000000, 43.000000)\">" +
    "<g id=\"Group-2-Copy-2\"><g id=\"Group-Copy\"><g id=\"ic_loyalty_24px\">" +
    "<mask id=\"mask-2\" fill=\"white\"><use xlink:href=\"#path-1\"></use>" +
    "</mask><use id=\"gpay-Shape\" fill=\"#FF6100\" fill-rule=\"nonzero\" " +
    "xlink:href=\"#path-1\"></use><path d=\"M3.5,5 C2.67,5 2,4.33 2,3.5 C2," +
    "2.67 2.67,2 3.5,2 C4.33,2 5,2.67 5,3.5 C5,4.33 4.33,5 3.5,5 Z\" " +
    "id=\"Path\" fill=\"#FFFFFF\" fill-rule=\"nonzero\" mask=\"url(#mask-2)\">" +
    "</path></g></g></g><g id=\"Group-13-Copy-7\" transform=\"translate" +
    "(6.000000, 6.000000)\" fill=\"#FFFFFF\" fill-rule=\"nonzero\">" +
    "<g id=\"Group-13-Copy-2\"><path d=\"M2.15217391,4.55172414 C0.963561082," +
    "4.55172414 1.99840144e-14,3.53278598 1.99840144e-14,2.27586207 " +
    "C1.99840144e-14,1.01893816 0.963561082,6.30606678e-14 2.15217391,6." +
    "30606678e-14 C3.34078674,6.30606678e-14 4.30434783,1.01893816 4.30434783," +
    "2.27586207 C4.30434783,3.53278598 3.34078674,4.55172414 2.15217391," +
    "4.55172414 Z M2.15217391,3.31034483 C2.69245247,3.31034483 3.13043478,2." +
    "84719112 3.13043478,2.27586207 C3.13043478,1.70453302 2.69245247," +
    "1.24137931 2.15217391,1.24137931 C1.61189535,1.24137931 1.17391304,1" +
    ".70453302 1.17391304,2.27586207 C1.17391304,2.84719112 1.61189535,3." +
    "31034483 2.15217391,3.31034483 Z\" id=\"Combined-Shape\"></path>" +
    "<path d=\"M6.84782609,9 C5.65921326,9 4.69565217,7.98106184 4.69565217," +
    "6.72413793 C4.69565217,5.46721402 5.65921326,4.44827586 6.84782609," +
    "4.44827586 C8.03643892,4.44827586 9,5.46721402 9,6.72413793 C9,7.98106184" +
    " 8.03643892,9 6.84782609,9 Z M6.84782609,7.75862069 C7.38810465," +
    "7.75862069 7.82608696,7.29546698 7.82608696,6.72413793 C7.82608696" +
    ",6.15280888 7.38810465,5.68965517 6.84782609,5.68965517 C6.30754753," +
    "5.68965517 5.86956522,6.15280888 5.86956522,6.72413793 C5.86956522," +
    "7.29546698 6.30754753,7.75862069 6.84782609,7.75862069 Z\" " +
    "id=\"Combined-Shape\"></path><polygon id=\"Rectangle\" " +
    "transform=\"translate(4.497720, 4.541938) rotate(34.000000) " +
    "translate(-4.497720, -4.541938) \" points=\"3.77901778 -0.202295978 " +
    "4.9740273 -0.171019161 5.21642263 9.28617278 4.02141311 9.25489596\">" +
    "</polygon></g></g></g></g></g></svg>";

Constants.GPAY_OFFER_ICON_STYLE = `
.${Constants.GPAY_OFFER_ICON_CLASS} {
  position: absolute;
  right: -5px;
  top: -5px;
}

#ic_loyalty_24px use.hover {
  fill: #FC853B;
}
`;

Constants.GPAY_OFFER_DESCRIPTION_CLASS = 'gpay-offer-description';

Constants.GPAY_OFFER_DESCRIPTION_STYLE = `
@import url(//fonts.googleapis.com/css?family=Google+Sans:500);
.${Constants.GPAY_OFFER_DESCRIPTION_CLASS} {
  text-align: center;
  font: 10px 'Google Sans';
  margin-top: 2px;
  margin-bottom: 0px;
}

.${Constants.GPAY_OFFER_DESCRIPTION_CLASS}.gpay-btn-clicked {
  color: #3C4043;
}

.${Constants.GPAY_OFFER_DESCRIPTION_CLASS}.short {
  min-width: 90px;
  width: 160px;
}

.${Constants.GPAY_OFFER_DESCRIPTION_CLASS}.long {
  min-width: 152px;
  width: 240px;
}
`;

/**
 * Class used for the new gpay button with card info (last 4 digits, card net).
 *
 * @const {string}
 */
Constants.GPAY_BUTTON_CARD_INFO_CLASS = 'gpay-card-info-btn';

Constants.GPAY_BUTTON_CARD_INFO_BUTTON_STYLE = `
  .${Constants.GPAY_BUTTON_CARD_INFO_CLASS} {
    background-origin: content-box;
    background-position: center center;
    background-repeat: no-repeat;
    background-size: contain;
    border: 0px;
    border-radius: 4px;
    box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 1px 0px, rgba(60, 64, 67, 0.15) 0px 1px 3px 1px;
    cursor: pointer;
    height: 40px;
    min-height: 40px;
    padding: 11px 24px;
    background-color: #000;
    box-shadow: none;
    padding: 9px 24px 10px;
    min-width: 190px;
    width: 240px;
  }

  .${Constants.GPAY_BUTTON_CARD_INFO_CLASS}.active {
    background-color: #5f6368;
  }

  .${Constants.GPAY_BUTTON_CARD_INFO_CLASS}.hover {
    background-color: #3c4043;
  }
  `;


/**
 * Trusted domain for secure context validation
 *
 * @const {string}
 */
Constants.TRUSTED_DOMAIN = '.google.com';

export {Constants};

