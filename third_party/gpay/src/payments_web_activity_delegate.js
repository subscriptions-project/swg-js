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
import {Graypane} from './graypane.js';
import {PaymentsClientDelegateInterface} from './payments_client_delegate_interface.js';
import {
  ActivityPort,
  ActivityPorts,
  ActivityIframePort,
} from 'activity-ports';
import {
  BuyFlowActivityMode,
  PayFrameHelper,
  PostMessageEventType,
} from './pay_frame_helper.js';
import {doesMerchantSupportOnlyTokenizedCards} from './validator.js';
import {injectStyleSheet, injectIframe} from './element_injector.js';

const GPAY_ACTIVITY_REQUEST = 'GPAY';
const IFRAME_CLOSE_DURATION_IN_MS = 250;
const IFRAME_SHOW_UP_DURATION_IN_MS = 250;
const IFRAME_SMOOTH_HEIGHT_TRANSITION = `height ${IFRAME_SHOW_UP_DURATION_IN_MS}ms`;
const ERROR_PREFIX = 'Error: ';

/**
 * Supported browser user agent keys.
 *
 * @enum {string}
 */
const BrowserUserAgent = {
  CHROME: 'Chrome',
  FIREFOX: 'Firefox',
  SAFARI: 'Safari',
};

/**
 * Resizing payload including resize height and transition style.
 *
 * @typedef {{
 *   height: string,
 *   transition: string,
 * }}
 */
let ResizePayload;

/**
 * An implementation of PaymentsClientDelegateInterface that uses the custom
 * hosting page along with web activities to actually get to the hosting page.
 * @implements {PaymentsClientDelegateInterface}
 */
class PaymentsWebActivityDelegate {
  /**
   * @param {string} environment
   * @param {string} googleTransactionId
   * @param {boolean=} useIframe
   * @param {!ActivityPorts=} activities Can be used to provide a shared
   *   activities manager. By default, the new manager is created.
   * @param {?string=} redirectKey The redirect key used for redirect mode.
   */
  constructor(
    environment,
    googleTransactionId,
    useIframe,
    activities,
    redirectKey
  ) {
    this.environment_ = environment;
    /** @private @const {boolean} */

    /** @const {!ActivityPorts} */
    this.activities = activities || new ActivityPorts(window);
    /** @const @private {!Graypane} */
    this.graypane_ = new Graypane(window.document);
    /** @private {?function(!Promise<!PaymentData>)} */
    this.callback_ = null;
    /**
     * @private {?{
     *             container: !Element,
     *             iframe:!HTMLIFrameElement,
     *             request:!PaymentDataRequest,
     *             dataPromise:?Promise<!PaymentData>}}
     */
    this.prefetchedObjects_ = null;
    /** @private {boolean} */
    this.shouldHandleResizing_ = false;
    /** @private {?ActivityIframePort} */
    this.port_ = null;
    /** @private {?function(!Promise<void>)} */
    this.dismissPromiseResolver_ = null;
    /** @const @private {string} */
    this.googleTransactionId_ = googleTransactionId;
    /** @const @private {?string} */
    this.redirectKey_ = redirectKey || null;

    /**
     * @private {?ResizePayload}
     */
    this.savedResizePayload_ = null;

    // Only install dialog styles when iframing is allowed.
    if (null) {
      injectStyleSheet(Constants.IFRAME_STYLE);
      if (null) {
        injectStyleSheet(Constants.IFRAME_STYLE_CENTER);
      }
    }
  }

  /** @override */
  onResult(callback) {
    if (this.callback_) {
      return;
    }
    this.callback_ = callback;
    this.activities.onResult(
      GPAY_ACTIVITY_REQUEST,
      this.onActivityResult_.bind(this)
    );
  }

  /**
   * @param {!ActivityPort} port
   * @private
   */
  onActivityResult_(port) {
    // Hide the graypane.
    this.graypane_.hide();
    // Only verified origins are allowed.
    this.callback_(
      port.acceptResult().then(
        result => {
          // Origin must always match: popup, iframe or redirect.
          if (result.origin != this.getOrigin_()) {
            throw new Error('channel mismatch');
          }
          const data = /** @type {!PaymentData} */ (result.data);
          if (data['redirectEncryptedCallbackData']) {
            PayFrameHelper.setBuyFlowActivityMode(BuyFlowActivityMode.REDIRECT);
            return this.fetchRedirectResponse_(
              data['redirectEncryptedCallbackData']
            ).then(decrypedJson => {
              // Merge other non-encrypted fields into the final response.
              const clone = Object.assign({}, data);
              delete clone['redirectEncryptedCallbackData'];
              return Object.assign(clone, decrypedJson);
            });
          }
          // Unencrypted data supplied: must be a verified and secure channel.
          if (!result.originVerified || !result.secureChannel) {
            throw new Error('channel mismatch');
          }
          return data;
        },
        error => {
          // TODO: Log the original and the inferred error to eye3.
          const originalError = error['message'];
          let inferredError = error['message'];
          try {
            // Try to parse the error message to a structured error, if it's
            // not possible, fallback to use the error message string.
            inferredError = JSON.parse(
              originalError.substring(ERROR_PREFIX.length)
            );
          } catch (e) {}
          if (
            inferredError['statusCode'] &&
            ['DEVELOPER_ERROR', 'MERCHANT_ACCOUNT_ERROR'].indexOf(
              inferredError['statusCode']
            ) == -1
          ) {
            inferredError = {
              'statusCode': 'CANCELED',
            };
          }
          if (inferredError == 'AbortError') {
            inferredError = {
              'statusCode': 'CANCELED',
            };
          }
          return Promise.reject(inferredError);
        }
      )
    );
  }

  /**
   * @param {string} redirectEncryptedCallbackData
   * @return {!PaymentData}
   * @private
   */
  fetchRedirectResponse_(redirectEncryptedCallbackData) {
    // This method has to rely on the legacy XHR API because the redirect
    // functionality is, in part, aimed at older browsers.
    return new Promise((resolve, reject) => {
      const url = this.getDecryptionUrl_();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      if ('withCredentials' in xhr) {
        // It's fine to proceed in a non-redirect mode because redirectVerifier
        // plays the part of CORS propagation.
        xhr.withCredentials = true;
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState < /* STATUS_RECEIVED */ 2) {
          return;
        }
        if (xhr.status < 100 || xhr.status > 599) {
          xhr.onreadystatechange = null;
          reject(new Error(`Unknown HTTP status ${xhr.status}`));
          return;
        }
        if (xhr.readyState == /* COMPLETE */ 4) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            // JSON parsing error is expected here.
            reject(e);
          }
        }
      };
      xhr.onerror = () => {
        reject(new Error('Network failure'));
      };
      xhr.onabort = () => {
        reject(new Error('Request aborted'));
      };

      // Send POST.
      xhr.send(redirectEncryptedCallbackData);
    });
  }

  /** @override */
  isReadyToPay(isReadyToPayRequest) {
    return new Promise((resolve, reject) => {
      if (doesMerchantSupportOnlyTokenizedCards(isReadyToPayRequest)) {
        resolve({'result': false});
        return;
      }
      const userAgent = window.navigator.userAgent;
      const isIosGsa =
        userAgent.indexOf('GSA/') > 0 &&
        userAgent.indexOf(BrowserUserAgent.SAFARI) > 0;
      // pop up in IGSA doesn't work.
      if (isIosGsa && !null) {
        resolve({'result': false});
        return;
      }
      const isFirefoxIos = userAgent.indexOf('FxiOS') > 0;
      if (isFirefoxIos) {
        resolve({'result': false});
        return;
      }
      const isSupported =
        userAgent.indexOf(BrowserUserAgent.CHROME) > 0 ||
        userAgent.indexOf(BrowserUserAgent.FIREFOX) > 0 ||
        userAgent.indexOf(BrowserUserAgent.SAFARI) > 0;
      if (
        isSupported &&
        isReadyToPayRequest.apiVersion >= 2 &&
        isReadyToPayRequest.existingPaymentMethodRequired
      ) {
        isReadyToPayRequest.environment = this.environment_;
        PayFrameHelper.sendAndWaitForResponse(
          isReadyToPayRequest,
          PostMessageEventType.IS_READY_TO_PAY,
          'isReadyToPayResponse',
          function(event) {
            const response = {
              'result': isSupported,
            };
            if (isReadyToPayRequest.existingPaymentMethodRequired) {
              response['paymentMethodPresent'] =
                event.data['isReadyToPayResponse'] == 'READY_TO_PAY';
            }
            resolve(response);
          }
        );
      } else {
        resolve({'result': isSupported});
      }
    });
  }

  /** @override */
  prefetchPaymentData(paymentDataRequest) {
    // Only handles prefetch for iframe for now.
    if (!null) {
      return;
    }
    const containerAndFrame = this.injectIframe_(paymentDataRequest);
    const paymentDataPromise = this.openIframe_(
      containerAndFrame['container'],
      containerAndFrame['iframe'],
      paymentDataRequest
    );
    this.prefetchedObjects_ = {
      'container': containerAndFrame['container'],
      'iframe': containerAndFrame['iframe'],
      'request': paymentDataRequest,
      'dataPromise': paymentDataPromise,
    };
  }

  /** @override */
  loadPaymentData(paymentDataRequest) {
    if (!paymentDataRequest.swg) {
      // Only set the apiVersion if the merchant is not setting it.
      if (!paymentDataRequest.apiVersion) {
        paymentDataRequest.apiVersion = 1;
      }
    }
    paymentDataRequest.environment = this.environment_;
    if (null) {
      PayFrameHelper.setBuyFlowActivityMode(BuyFlowActivityMode.IFRAME);
      // TODO: Compare the request with prefetched request.
      let containerAndFrame;
      let paymentDataPromise;
      if (this.prefetchedObjects_) {
        // Rendering prefetched frame and container.
        containerAndFrame = this.prefetchedObjects_;
        paymentDataPromise = this.prefetchedObjects_['dataPromise'];
        this.prefetchedObjects_ = null;
      } else {
        containerAndFrame = this.injectIframe_(paymentDataRequest);
        paymentDataPromise = this.openIframe_(
          containerAndFrame['container'],
          containerAndFrame['iframe'],
          paymentDataRequest
        );
      }
      this.showContainerAndIframeWithAnimation_(
        containerAndFrame['container'],
        containerAndFrame['iframe'],
        paymentDataRequest
      );
      history.pushState({}, '', '');
      const onPopState = e => {
        e.preventDefault();
        this.backButtonHandler_(containerAndFrame);
        window.removeEventListener('popstate', onPopState);
      };
      window.addEventListener('popstate', onPopState);
      const dismissPromise = new Promise(resolve => {
        this.dismissPromiseResolver_ = resolve;
      });
      this.callback_(Promise.race([paymentDataPromise, dismissPromise]));
      return;
    }
    PayFrameHelper.setBuyFlowActivityMode(
      paymentDataRequest['forceRedirect']
        ? BuyFlowActivityMode.REDIRECT
        : BuyFlowActivityMode.POPUP
    );
    const opener = this.activities.open(
      GPAY_ACTIVITY_REQUEST,
      this.getHostingPageUrl_(),
      this.getRenderMode_(paymentDataRequest),
      paymentDataRequest,
      {'width': 600, 'height': 600}
    );
    this.graypane_.show(opener && opener.targetWin);
  }

  /**
   * Returns the render mode whether need to force redirect.
   *
   * @param {!PaymentDataRequest} paymentDataRequest
   * @return {string}
   * @private
   */
  getRenderMode_(paymentDataRequest) {
    return paymentDataRequest['forceRedirect'] ? '_top' : 'gp-js-popup';
  }

  /**
   * Returns the server origin based on the environment.
   *
   * @private
   * @return {string}
   */
  getOrigin_() {
    if (this.environment_ == Constants.Environment.LOCAL) {
      return '';
    }

    let baseDomain;
    if (this.environment_ == Constants.Environment.PREPROD) {
      baseDomain = 'pay-preprod.sandbox';
    } else if (this.environment_ == Constants.Environment.SANDBOX) {
      baseDomain = 'pay.sandbox';
    } else {
      baseDomain = 'pay';
    }
    return 'https://' + baseDomain + '.google.com';
  }

  /**
   * Returns the base path based on the environment.
   *
   * @private
   * @return {string} The base path
   */
  getBasePath_() {
    return this.getOrigin_() + '/gp/p';
  }

  /**
   * Returns the decryption url to be used to decrypt the encrypted payload.
   *
   * @private
   * @return {string} The decryption url
   */
  getDecryptionUrl_() {
    let url = this.getBasePath_() + '/apis/buyflow/process';
    if (this.redirectKey_) {
      url += '?rk=' + encodeURIComponent(this.redirectKey_);
    }
    return url;
  }

  /**
   * Returns the hosting page url.
   *
   * @private
   * @return {string} The hosting page url
   */
  getHostingPageUrl_() {
    // In Tin tests, the hosting page is requested from
    // /testing/buyflow/merchantdemo.html and is accessed relatively since the
    // base path is unknown ahead of time.
    if (this.environment_ == Constants.Environment.TIN) {
      // There is no /gp/p prefix since multilogin prefixes is broken in Tin:
      // http://yaqs/4912322941550592
      return '/ui/pay';
    }
    return this.getBasePath_() + '/ui/pay';
  }

  /**
   * Returns the iframe pwg url to be used to be used for amp.
   *
   * @param {string} environment
   * @param {string} origin
   * @return {string} The iframe url
   */
  getIframeUrl(environment, origin) {
    // TODO: These should be compile time constants and not dependent
    // on the environment.
    let iframeUrl = `https://pay.google.com/gp/p/ui/pay?origin=${origin}`;
    if (
      environment == Constants.Environment.SANDBOX ||
      environment == Constants.Environment.PREPROD
    ) {
      iframeUrl = `https://pay'+  (environment == Constants.Environment.PREPROD ? '-preprod' : '')+  '.sandbox.google.com/gp/p/ui/pay?origin=${origin}`;
    }
    return iframeUrl;
  }

  /**
   * Close iframe with animation.
   *
   * @param {!Element} container
   * @param {!HTMLIFrameElement} iframe
   * @private
   */
  removeIframeAndContainer_(container, iframe) {
    const transitionStyle = 'all ' + IFRAME_CLOSE_DURATION_IN_MS + 'ms ease 0s';
    this.setTransition_(iframe, transitionStyle);
    iframe.height = '0px';
    // TODO: This should be replaced by listening to TransitionEnd event
    setTimeout(() => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, IFRAME_CLOSE_DURATION_IN_MS);
  }

  /**
   * @param {!PaymentDataRequest} paymentDataRequest
   * @return {{container: !Element, iframe:!HTMLIFrameElement}}
   * @private
   */
  injectIframe_(paymentDataRequest) {
    const containerAndFrame = injectIframe(
      this.isVerticalCenterExperimentEnabled_(paymentDataRequest)
        ? Constants.IFRAME_STYLE_CENTER_CLASS
        : Constants.IFRAME_STYLE_CLASS
    );
    const iframe = containerAndFrame['iframe'];
    const container = containerAndFrame['container'];
    container.addEventListener(
      'click',
      this.closeActionHandler_.bind(this, containerAndFrame)
    );
    // Hide iframe and disable resize at initialize.
    container.style.display = 'none';
    iframe.style.display = 'none';
    iframe.height = '0px';
    const transitionStyle =
      'all ' + IFRAME_SHOW_UP_DURATION_IN_MS + 'ms ease 0s';
    this.setTransition_(iframe, transitionStyle);
    this.shouldHandleResizing_ = false;
    return containerAndFrame;
  }

  /**
   * Handler when back button is triggered, should dismiss iframe if present.
   * @param {{container: !Element, iframe:!HTMLIFrameElement}} containerAndFrame
   * @private
   */
  backButtonHandler_(containerAndFrame) {
    this.dismissIframe_(containerAndFrame);
  }

  /**
   * Handler when close action is triggered, will pop history state to close
   * the iframe.
   * @param {{container: !Element, iframe:!HTMLIFrameElement}} containerAndFrame
   * @private
   */
  closeActionHandler_(containerAndFrame) {
    if (containerAndFrame['container'].parentNode) {
      // Close action only when container is still attached to the page.
      history.back();
    }
  }

  /**
   * @param {{container: !Element, iframe:!HTMLIFrameElement}} containerAndFrame
   * @private
   */
  dismissIframe_(containerAndFrame) {
    // Dismiss iframe only when container is still attached in the page.
    if (containerAndFrame['container'].parentNode) {
      // TODO: Think about whether this could be just hide instead of
      // disconnect and remove, the tricky part is how to handle the case where
      // payment data request is not the same.
      this.dismissPromiseResolver_(Promise.reject({'errorCode': 'CANCELED'}));
      this.removeIframeAndContainer_(
        containerAndFrame['container'],
        containerAndFrame['iframe']
      );
      this.port_ && this.port_.disconnect();
    }
  }

  /**
   * @param {!PaymentDataRequest} paymentDataRequest
   * @return {boolean}
   * @private
   */
  isVerticalCenterExperimentEnabled_(paymentDataRequest) {
    return (
      null &&
      paymentDataRequest['i'] &&
      paymentDataRequest['i'].renderContainerCenter
    );
  }

  /**
   * @param {!Element} container
   * @param {!HTMLIFrameElement} iframe
   * @param {!PaymentDataRequest} paymentDataRequest
   * @private
   */
  showContainerAndIframeWithAnimation_(container, iframe, paymentDataRequest) {
    container.style.display = 'block';
    iframe.style.display = 'block';
    setTimeout(() => {
      // Hard code the apprx height here, it will be resize to expected height
      // later.
      iframe.height = '280px';
      if (this.isVerticalCenterExperimentEnabled_(paymentDataRequest)) {
        iframe.classList.add(Constants.IFRAME_ACTIVE_CONTAINER_CLASS);
      }
      // TODO: This should be handles properly by listening to
      // TransitionEnd event.
      setTimeout(() => {
        this.shouldHandleResizing_ = true;
        // TODO: Add browser test that catches this.
        if (this.savedResizePayload_) {
          this.setTransition_(iframe, this.savedResizePayload_['transition']);
          iframe.height = this.savedResizePayload_['height'];
          this.savedResizePayload_ = null;
        }
      }, IFRAME_SHOW_UP_DURATION_IN_MS);
    }, 1);
  }

  /**
   * @param {!HTMLIFrameElement} iframe
   * @param {string} transitionStyle
   * @private
   */
  setTransition_(iframe, transitionStyle) {
    iframe.style.setProperty('transition', transitionStyle);
    // For safari.
    iframe.style.setProperty('-webkit-transition', transitionStyle);
  }

  /**
   * Use WebActivitiy to open iframe that's in given container.
   *
   * @param {!Element} container
   * @param {!HTMLIFrameElement} iframe
   * @param {!PaymentDataRequest} paymentDataRequest
   * @return {!Promise<!PaymentData>}
   * @private
   */
  openIframe_(container, iframe, paymentDataRequest) {
    if (!paymentDataRequest.swg) {
      if (!paymentDataRequest.apiVersion) {
        paymentDataRequest.apiVersion = 1;
      }
    }
    paymentDataRequest.environment = this.environment_;
    let iframeLoadStartTime;
    const trustedUrl = this.getIframeUrl(
      this.environment_,
      window.location.origin
    );
    return this.activities
      .openIframe(iframe, trustedUrl, paymentDataRequest)
      .then(port => {
        // Handle custom resize message.
        this.port_ = port;
        port.onMessage(payload => {
          if (payload['type'] !== 'resize' || !this.shouldHandleResizing_) {
            // Save the resize event later after initial animation is finished
            this.savedResizePayload_ = {
              'height': payload['height'],
              'transition': payload['transition'],
            };
            return;
          }
          // b/111310899: Smooth out initial iFrame loading
          if (!iframeLoadStartTime) {
            iframeLoadStartTime = Date.now();
          }
          if (
            Date.now() <
            iframeLoadStartTime + IFRAME_SHOW_UP_DURATION_IN_MS
          ) {
            this.setTransition_(
              iframe,
              payload['transition'] + ', ' + IFRAME_SMOOTH_HEIGHT_TRANSITION
            );
          } else {
            this.setTransition_(iframe, payload['transition']);
          }
          iframe.height = payload['height'];
        });
        return /** @type {!Promise<!Object>} */ (port.acceptResult());
      })
      .then(
        /**
         * @param {!Object} result
         * @return {!PaymentData}
         */
        result => {
          this.removeIframeAndContainer_(container, iframe);
          // This is only for popping the state we pushed earlier.
          history.back();
          const data = /** @type {!PaymentData} */ (result['data']);
          return data;
        },
        error => {
          this.removeIframeAndContainer_(container, iframe);
          // This is only for popping the state we pushed earlier.
          history.back();
          return Promise.reject(error);
        }
      );
  }
}

export {PaymentsWebActivityDelegate};
