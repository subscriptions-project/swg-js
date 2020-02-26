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

import {TC_STRING_UNAVAILABLE} from './gdpr-tcfv2-constants.js';
import {isFunction} from '../utils/types.js';
import {parseJson} from '../utils/json';
import {
  registerEventHandler,
  runOnce,
  searchIframeInWindowOrAncestors,
  unregisterEventHandler,
} from '../utils/dom.js';

const DEFAULT_ERROR_TIMEOUT_MS = 500;

/** @enum {string} */
const TcfConstants = {
  POST_MESSAGE_CALL: '__tcfapiCall',
  POST_MESSAGE_RESPONSE: '__tcfapiReturn',
  FRAME_LOCATOR: '__tcfapiLocator',
};

/** @enum {string} */
const TcfCommands = {
  GET_TC_DATA: 'getTCData',
  GET_STATUS: 'ping',
  ADD_EVENT_LISTENER: 'addEventListener',
  REMOVE_EVENT_LISTENER: 'removeEventListener',
};

/**
 * The status of the CMP in its loading lifecycle.
 * @enum {string}
 */
const CmpStatus = {
  /**
   * CMP not yet loaded - stub still in place.
   */
  STUB: 'stub',

  /**
   * CMP is loading.
   */
  LOADING: 'loading',

  /**
   * CMP is finished loading.
   */
  LOADED: 'loaded',

  /**
   * CMP is in an error state and will not respond to any API requests. To be
   * used when a CMP cannot perform operations in compliance with the TCF.
   */
  ERROR: 'error',

  /**
   * User interface is currently displayed
   */
  VISIBLE: 'visible',

  /**
   * User interface is not yet or no longer displayed
   */
  HIDDEN: 'hidden',

  /**
   * User interface will not show.
   */
  DISABLED: 'disabled',
};

/**
 * The version of TCF implemented. Used by CMP providers on API calls to
 * align their behavior based on different vendor implementations.
 * @const {number}
 */
const TCF_VERSION = 2;

/**
 * What has caused an event to trigger the addEventListener callback.
 * @enum {string}
 */
const EventStatus = {
  /**
   * The CMP is loaded and prepared to surface a TC String to calling scripts.
   */
  TC_LOADED: 'tcloaded',
  /**
   * The status when the UI is surfaced or re-surfaced. This indicates that the
   * user has been presented with the "transparency" interface. The TC string
   * will be available with updates.
   */
  CMP_UI_SHOWN: 'cmpuishown',
  /**
   * The status when a user has confirmed or re-comfirmed their CMP choices,
   * and the CMP is prepared to surface the updated value.
   */
  USER_ACTION_COMPLETE: 'useractioncomplete',
};

/**
 * TC object returned postmessage API calls.
 * @typedef {{
 *   command: (!string),
 *   version: (number),
 *   callId: (number),
 *   parameter: (?|undefined),
 * }}
 */
// eslint-disable-next-line no-unused-vars
let TCPostMessageRequest;

/**
 * TC object returned postmessage API calls.
 * @typedef {{
 *   returnValue: (!./gdpr-tcfv2-constants.TCData),
 *   success: (boolean),
 *   callId: (number),
 * }}
 */
// eslint-disable-next-line no-unused-vars
let TCPostMessageResponse;

/**
 * Returns true if the TCData object is correctly populated by the CMP.
 * TCData carries the Transparency & Consent information, required by the
 * Transparency & Consent Framework v2 (TCF v2) spec. CMP is the consent
 * management platform implementing the TCF v2 spec.
 * https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md
 * @param {!./gdpr-tcfv2-constants.TCData} tcData
 * @return {boolean}
 */
const isTcDataCorrect = tcData => {
  if (
    (tcData.tcString !== undefined && typeof tcData.tcString !== 'string') ||
    (tcData.gdprApplies !== undefined &&
      typeof tcData.gdprApplies !== 'boolean') ||
    (tcData.addtlConsent !== undefined &&
      typeof tcData.addtlConsent !== 'string')
  ) {
    return false;
  }

  if (!tcData.cmpStatus || tcData.cmpStatus === CmpStatus.ERROR) {
    return false;
  }

  return true;
};

/**
 * Returns true if the TCData object reflects user intention.
 * @param {!./gdpr-tcfv2-constants.TCData} tcData
 * @return {boolean}
 */
const isTcDataReady = tcData => {
  if (
    tcData.cmpStatus === CmpStatus.LOADED &&
    (tcData.eventStatus === EventStatus.TC_LOADED ||
      tcData.eventStatus === EventStatus.USER_ACTION_COMPLETE)
  ) {
    return true;
  }

  return false;
};

/**
 * Utility class for querying the IAB TCFv2 CMP API for Transparency and Consent
 * data.
 */
export class TcfV2 {
  /**
   * @param {!Window} win The frame which the vendor is running in.
   * @param {number=} timeoutMs How long to wait for the callback before
   *     erroring out.
   */
  constructor(win, timeoutMs = DEFAULT_ERROR_TIMEOUT_MS) {
    /**
     * The frame which this code is running in.
     * @private {!Window}
     */
    this.window_ = win;

    /**
     * The frame where the CMP is located.
     * @private {?Window}
     */
    this.cmpFrameWin_ = null;

    /**
     * Store callbacks until the CMP replies.
     * @private {!Object<number, function(!./gdpr-tcfv2-constants.TCData, boolean): undefined>}
     */
    this.pendingCalls_ = {};

    /**
     * A simple counter to disambiguate multiple callback messages from outer
     * frames.
     * @private {number}
     */
    this.callbackIndex_ = 0;

    /**
     * How long to wait for the callback before erroring out.
     * @private @const {number}
     */
    this.timeoutMs_ = timeoutMs;

    /**
     * Postmessage listener bound to this object.
     * @private {?function(!Object):undefined}
     */
    this.boundHandler_ = null;
  }

  /**
   * Eliminates all traces of this component from the page
   */
  disposeInternal() {
    this.pendingCalls_ = {};
    if (this.boundHandler_) {
      unregisterEventHandler(this.window_, 'message', this.boundHandler_);
      delete this.boundHandler_;
    }
    delete this.pendingCalls_;
    delete this.window_;
    delete this.cmpFrameWin_;
  }

  /**
   * @return {boolean}
   */
  isCmpAvailable() {
    return isFunction(this.window_['__tcfapi']) || this.findCmpFrame() != null;
  }

  /**
   * Invokes the callback with whatever is available in the current state of the
   * CMP. If CMP is on the same domain, it is expected to be synchronous.
   * @param {function(!./gdpr-tcfv2-constants.TCData): undefined} clientCallback
   * @param {!Array<string>|undefined} vendorIds Which vendors to lookup, or
   *     undefined for all vendors.
   */
  getTCData(clientCallback, vendorIds) {
    let /** !./gdpr-tcfv2-constants.TCData */ tcData = {};
    const onComplete = /** @type {function():undefined} */ (runOnce(() => {
      if (!isTcDataCorrect(tcData) || !isTcDataReady(tcData)) {
        tcData.tcString = TC_STRING_UNAVAILABLE;
      }
      clientCallback(tcData);
    }));
    const callback = (result, isSuccess) => {
      if (isSuccess) {
        tcData = /** @type {!./gdpr-tcfv2-constants.TCData} */ (result);
      }
      onComplete();
    };
    this.callCmpFunction_(
      TcfCommands.GET_TC_DATA,
      callback,
      vendorIds,
      onComplete
    );
    setTimeout(onComplete, this.timeoutMs_);
  }

  /**
   * Invokes the callback with valid TCData.
   * @param {function(!./gdpr-tcfv2-constants.TCData): undefined} clientCallback
   */
  getTcDataWhenAvailable(clientCallback) {
    let /** !./gdpr-tcfv2-constants.TCData */ tcData = {};
    /** @type {function():undefined} */
    const onComplete = runOnce(() => clientCallback(tcData));
    const eventCallback = (result, isSuccess) => {
      if (isSuccess) {
        tcData = /** @type {!./gdpr-tcfv2-constants.TCData} */ (result);
      }
      const isCorrect = isTcDataCorrect(tcData);
      if (!isCorrect || isTcDataReady(tcData)) {
        if (!isCorrect) {
          tcData.tcString = TC_STRING_UNAVAILABLE;
        }
        const callback = unusedIsSuccess => {
          /* no-op */
        };
        this.callCmpFunction_(
          TcfCommands.REMOVE_EVENT_LISTENER,
          callback,
          eventCallback
        );
        onComplete();
      }
    };
    this.callCmpFunction_(TcfCommands.ADD_EVENT_LISTENER, eventCallback);
  }

  /**
   * Invokes the CMP API depending on whether it is cross frame. If the CMP API
   * is unavailable, invoke the fallback function.
   * @param {string} iabTcfCommand
   * @param {function(!./gdpr-tcfv2-constants.TCData, boolean): undefined} callback
   * @param {?=} parameter
   * @param {function(): undefined=} fallback
   * @private
   */
  callCmpFunction_(
    iabTcfCommand,
    callback,
    parameter = undefined,
    fallback = undefined
  ) {
    if (isFunction(this.window_['__tcfapi'])) {
      // same-frame
      const callCmp = this.window_['__tcfapi'];
      callCmp(iabTcfCommand, TCF_VERSION, callback, parameter);
      return;
    }
    if (this.findCmpFrame()) {
      // cross-frame
      // TODO(b/146220490): window.postMessage() cannot pass a function, so
      // we cannot call cross-frame removeEventListener, whose arguments
      // include a function object. This if-statement block stays here until
      // the TCF v2 spec addresses the issue.
      if (iabTcfCommand === TcfCommands.REMOVE_EVENT_LISTENER) {
        return;
      }

      this.maybeInitializePostMessageHandler_();
      const callId = ++this.callbackIndex_;
      this.pendingCalls_[callId] = callback;
      if (this.cmpFrameWin_) {
        const /** @type {!TCPostMessageRequest} */ cmpRequest = {
            command: iabTcfCommand,
            version: TCF_VERSION,
            callId,
            parameter,
          };
        this.cmpFrameWin_.postMessage(
          {
            [TcfConstants.POST_MESSAGE_CALL]: cmpRequest,
          },
          /* targetOrigin= */ '*'
        );
      }
      return;
    }
    // Unable to find a CMP in current or parent frame.
    if (fallback) {
      fallback();
    }
  }

  /**
   * Recursively searches parent frames for a sign that the CMP is there.
   * @return {?Window}
   */
  findCmpFrame() {
    if (this.cmpFrameWin_) {
      return this.cmpFrameWin_;
    }
    this.cmpFrameWin_ = searchIframeInWindowOrAncestors(
      this.window_,
      TcfConstants.FRAME_LOCATOR,
      50
    );
    return this.cmpFrameWin_;
  }

  /**
   * Initialize postmessage handler for cross-domain communication if needed.
   */
  maybeInitializePostMessageHandler_() {
    if (this.boundHandler_) {
      return;
    }
    this.boundHandler_ = this.postMessageHandler_.bind(this);
    registerEventHandler(
      this.window_,
      'message',
      /** @type {!function(?):?} */ (this.boundHandler_)
    );
  }

  /**
   * @param {!Object} event
   * @private
   */
  postMessageHandler_(event) {
    try {
      const payload = this.parseIabTcfPayload_(event);
      this.pendingCalls_[payload.callId](payload.returnValue, payload.success);
    } catch (ignore) {
      // Failed to parse payload or callId we didn't have.
    }
  }

  /**
   * @param {!Object} event
   * @return {!TCPostMessageResponse}
   * @private
   */
  parseIabTcfPayload_(event) {
    let obj;
    if (typeof event.data === 'string') {
      obj = parseJson(event.data);
    } else {
      obj = event.data;
    }
    return obj[TcfConstants.POST_MESSAGE_RESPONSE];
  }
}
