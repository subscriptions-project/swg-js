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

import {Constants} from './constants.js';
import {PostMessageService} from './post_message_service.js';

/**
 * Supported interactions between iframe and merchant page.
 *
 * @enum {number}
 */
// Next Id: 10
const PostMessageEventType = {
  IS_READY_TO_PAY: 6,
  LOG_BUTTON_CLICK: 5,
  LOG_IS_READY_TO_PAY_API: 0,
  LOG_LOAD_PAYMENT_DATA_API: 1,
  LOG_RENDER_BUTTON: 2,
  LOG_INITIALIZE_PAYMENTS_CLIENT: 9,
  LOG_PAY_FRAME_REQUESTED: 15,
  LOG_PAY_FRAME_LOADED: 16,
  LOG_PAY_FRAME_LOADED_WITH_ALL_JS: 17,
  LOG_INLINE_PAYMENT_WIDGET_INITIALIZE: 4,
  LOG_INLINE_PAYMENT_WIDGET_SUBMIT: 3,
  LOG_INLINE_PAYMENT_WIDGET_DISPLAYED: 7,
  LOG_INLINE_PAYMENT_WIDGET_HIDDEN: 8,
};

/**
 * Types of buy flow activity modes.
 *
 * @enum {number}
 */
const BuyFlowActivityMode = {
  UNKNOWN_MODE: 0,
  IFRAME: 1,
  POPUP: 2,
  REDIRECT: 3,
  ANDROID_NATIVE: 4,
  PAYMENT_HANDLER: 5,
};

/**
 * Types of buy flow activity modes.
 *
 * @enum {number}
 */
const PublicErrorCode = {
  UNKNOWN_ERROR_TYPE: 0,
  INTERNAL_ERROR: 1,
  DEVELOPER_ERROR: 2,
  BUYER_ACCOUNT_ERROR: 3,
  MERCHANT_ACCOUNT_ERROR: 4,
  UNSUPPORTED_API_VERSION: 5,
  BUYER_CANCEL: 6,
};

/**
 * The presentation mode of the buy flow
 *
 * @enum {number}
 */
const BuyFlowMode = {
  PAY_WITH_GOOGLE: 5,
  SUBSCRIBE_WITH_GOOGLE: 6,
};

/**
 * Iframe used for logging and prefetching.
 *
 * @type {?Element}
 */
let iframe = null;

/** @type {?PostMessageService} */
let postMessageService = null;

/** @type {?string} */
let environment = null;

/** @type {?string} */
let googleTransactionId = null;

/** @type {number} */
let originTimeMs = Date.now();

/** @type {?BuyFlowActivityMode} */
let buyFlowActivityMode = null;

/** @type {boolean} */
let iframeLoaded = false;

/** @type {!Array<!Object>} */
let buffer = [];

class PayFrameHelper {
  /**
   * Creates a hidden iframe for logging and appends it to the top level
   * document.
   */
  static load() {
    if (iframe) {
      return;
    }
    const initOptions =
        /** @type {!PaymentOptions} */ (window['gpayInitParams']) || {};
    environment = initOptions.environment || Constants.Environment.PRODUCTION;
    iframe = document.createElement('iframe');
    // Pass in origin because document.referrer inside iframe is empty in
    // certain cases
    // Can be replaced by iframe.src=... in non Google context.
    iframe.src = PayFrameHelper.getIframeUrl_(
            window.location.origin,
            initOptions.merchantInfo && initOptions.merchantInfo.merchantId);
    PayFrameHelper.postMessage({
      'eventType': PostMessageEventType.LOG_PAY_FRAME_REQUESTED,
      'clientLatencyStartMs': Date.now(),
    });
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    iframe.onload = function() {
      PayFrameHelper.postMessage({
        'eventType': PostMessageEventType.LOG_PAY_FRAME_LOADED_WITH_ALL_JS,
        'clientLatencyStartMs': Date.now(),
      });
      PayFrameHelper.iframeLoaded();
    };
    // If the body is already loaded, just append the iframe. Otherwise, we wait
    // until the DOM has loaded to append the iframe, otherwise document.body is
    // null.
    if (document.body) {
      PayFrameHelper.initialize_();
    } else {
      document.addEventListener(
          'DOMContentLoaded', () => PayFrameHelper.initialize_());
    }
  }

  /**
   * Appends the iframe to the DOM and updates the post message service.
   * @private
   */
  static initialize_() {
    document.body.appendChild(iframe);
    postMessageService = new PostMessageService(iframe.contentWindow);
  }

  /**
   * Sends a message to the iframe and wait for a response.
   * Uses the responseHandler specified only if the responseType is a match.
   *
   * @param {!Object} data
   * @param {!PostMessageEventType} eventType
   * @param {string} responseType
   * @param {function(!Event)} responseHandler
   */
  static sendAndWaitForResponse(
      data, eventType, responseType, responseHandler) {
    function callback(event) {
      if (event.data[responseType]) {
        responseHandler(event);
        // We only want to process the response from the payframe once.
        // so stop listening to the event once processed.
        PayFrameHelper.removeMessageEventListener_(callback);
      }
    }

    PayFrameHelper.addMessageEventListener_(callback);

    const postMessageData = Object.assign({'eventType': eventType}, data);
    PayFrameHelper.postMessage(postMessageData);
  }

  /**
   * Add an event listener for listening to messages received.
   *
   * @param {function(!Event)} callback
   * @private
   */
  static addMessageEventListener_(callback) {
    window.addEventListener('message', callback);
  }

  /**
   * Remove the event listener for listening to messages.
   *
   * @param {function(!Event)} callback
   * @private
   */
  static removeMessageEventListener_(callback) {
    window.removeEventListener('message', callback);
  }

  /**
   * Posts a message to the iframe with the given data.
   *
   * @param {!Object} data
   */
  static postMessage(data) {
    if (!iframeLoaded) {
      buffer.push(data);
      return;
    }
    const postMessageData = Object.assign(
        {
          'buyFlowActivityMode': buyFlowActivityMode,
          'googleTransactionId': googleTransactionId,
          'originTimeMs': originTimeMs,
        },
        data);
    postMessageService.postMessage(
        postMessageData, PayFrameHelper.getIframeOrigin_());
  }

  /**
   * Sets the activity mode.
   *
   * @param {!BuyFlowActivityMode} mode
   */
  static setBuyFlowActivityMode(mode) {
    buyFlowActivityMode = mode;
  }

  /**
   * Sets the google transaction id.
   *
   * @param {string} txnId
   */
  static setGoogleTransactionId(txnId) {
    googleTransactionId = txnId;
  }

  /**
   * Sets the originTimeMs. To be used only for tests.
   *
   * @param {number} originTimeMsTemp
   */
  static setOriginTimeMs(originTimeMsTemp) {
    originTimeMs = originTimeMsTemp;
  }

  /**
   * Override postMessageService for testing.
   *
   * @param {!PostMessageService} messageService
   */
  static setPostMessageService(messageService) {
    postMessageService = messageService;
  }

  /**
   * Clears the singleton variables.
   */
  static reset() {
    iframe = null;
    buffer.length = 0;
    iframeLoaded = false;
    buyFlowActivityMode = null;
  }

  /**
   * Sets whether the iframe has been loaded or not.
   *
   * @param {boolean} loaded
   */
  static setIframeLoaded(loaded) {
    iframeLoaded = loaded;
  }

  /**
   * Called whenever the iframe is loaded.
   */
  static iframeLoaded() {
    iframeLoaded = true;
    buffer.forEach(function(data) {
      PayFrameHelper.postMessage(data);
    });
    buffer.length = 0;
  }

  /**
   * Returns the events that have been buffered.
   *
   * @return {!Array<!Object>}
   */
  static getBuffer() {
    return buffer;
  }

  /**
   * Mocks the iframe as an arbitrary html element instead of actually injecting
   * it for testing.
   */
  static injectIframeForTesting() {
    PayFrameHelper.reset();
    iframe = document.createElement('p');
    PayFrameHelper.iframeLoaded();
  }

  /**
   * Returns the payframe origin based on the environment.
   *
   * @return {string}
   * @private
   */
  static getIframeOrigin_() {
    let iframeUrl = 'https://pay';
    if (environment == Constants.Environment.SANDBOX) {
      iframeUrl += '.sandbox';
    } else if (environment == Constants.Environment.PREPROD) {
      iframeUrl += '-preprod.sandbox';
    }
    return iframeUrl + '.google.com';
  }

  /**
   * Returns the payframe URL based on the environment.
   *
   * @param {string} origin The origin that is opening the payframe.
   * @param {string|null=} merchantId The merchant id.
   * @return {string}
   * @private
   */
  static getIframeUrl_(origin, merchantId) {
    // TrustedResourceUrl header needs to start with https or '//'.
    const iframeUrl = `https://pay${environment == Constants.Environment.PREPROD ?
             '-preprod.sandbox' :
             environment == Constants.Environment.SANDBOX ? '.sandbox' : ''}.google.com/gp/p/ui/payframe?origin=${origin}&mid=%{merchantId}`;
    return iframeUrl;
  }
}

export {
  BuyFlowActivityMode,
  BuyFlowMode,
  PayFrameHelper,
  PostMessageEventType,
  PublicErrorCode,
};
