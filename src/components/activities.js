/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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
import {deserialize, getLabel} from '../proto/api_messages';
import {
  ActivityPorts as WebActivityPorts,
  ActivityIframePort as WebActivityIframePort,
} from 'web-activities/activity-ports';

/**
 * @interface
 */
export class ActivityPortDef {
  /**
   * @return {!Promise<!web-activities/activity-ports.ActivityResult>}
   */
  acceptResult() {}
}
/**
 * @interface
 */
export class ActivityPort extends ActivityPortDef {
  /**
   * Returns the mode of the activity: iframe, popup or redirect.
   * @return {!web-activities/activity-ports.ActivityMode}
   */
  getMode() {}

  /**
   * Accepts the result when ready. The client should verify the activity's
   * mode, origin, verification and secure channel flags before deciding
   * whether or not to trust the result.
   *
   * Returns the promise that yields when the activity has been completed and
   * either a result, a cancelation or a failure has been returned.
   *
   * @return {!Promise<!web-activities/activity-ports.ActivityResult>}
   * @override
   */
  acceptResult() {}

  /**
   * Returns a promise that yields when the iframe is ready to be interacted
   * with.
   * @return {!Promise}
   */
  whenReady() {}

  /**
   * Waits until the activity port is connected to the host.
   * @return {!Promise}
   */
  connect() {}

  /**
   * Disconnect the activity binding and cleanup listeners.
   */
  disconnect() {}

  /**
   * Register a callback to handle resize requests. Once successfully resized,
   * ensure to call `resized()` method.
   * @param {function(number)} unusedCallback
   */
  onResizeRequest(unusedCallback) {}

  /**
   * Sends a message to the host.
   * @param {!Object} unusedPayload
   */
  messageDeprecated(unusedPayload) {}

  /**
   * Registers a callback to receive messages from the host.
   * @param {function(!Object)} unusedCallback
   */
  onMessageDeprecated(unusedCallback) {}

  /**
   * @param {!../proto/api_messages.Message} unusedRequest
   */
  execute(unusedRequest) {}

  /**
   * @param {!function(new: T)} unusedMessage
   * @param {function(Object)} unusedCallback
   * @template T
   */
  on(unusedMessage, unusedCallback) {}

  /**
   * Signals back to the activity implementation that the client has updated
   * the activity's size.
   */
  resized() {}
}
/**
 * @implements {ActivityPortDef}
 */
class ActivityPortDeprecated {
  /**
   * @param {!web-activities/activity-ports.ActivityPort} port
   */
  constructor(port) {
    /** @private @const {!web-activities/activity-ports.ActivityPort} */
    this.port_ = port;
  }

  /**
   * @return {!Promise<!web-activities/activity-ports.ActivityResult>}
   */
  acceptResult() {
    return this.port_.acceptResult();
  }
}

/**
 * @implements {ActivityPortDef}
 */
export class ActivityIframePort {
  /**
   * @param {!HTMLIFrameElement} iframe
   * @param {string} url
   * @param {?Object=} opt_args
   */
  constructor(iframe, url, opt_args) {
    /** @private @const {!web-activities/activity-ports.ActivityIframePort} */
    this.iframePort_ = new WebActivityIframePort(iframe, url, opt_args);
    /** @private @const {!Object<string, function(!Object)>} */
    this.callbackMap_ = {};
    /** @private {?function(!../proto/api_messages.Message)} */
    this.callbackOriginal_ = null;
  }

  /**
   * Returns a promise that yields when the iframe is ready to be interacted
   * with.
   * @return {!Promise}
   */
  whenReady() {
    return this.iframePort_.whenReady();
  }

  /**
   * Waits until the activity port is connected to the host.
   * @return {!Promise}
   */
  connect() {
    return this.iframePort_.connect().then(() => {
      // Attach a callback to receive messages after connection complete
      this.iframePort_.onMessage(data => {
        if (this.callbackOriginal_) {
          this.callbackOriginal_(data);
        }
        const response = data && data['RESPONSE'];
        if (!response) {
          return;
        }
        const cb = this.callbackMap_[response[0]];
        if (cb) {
          cb(deserialize(response));
        }
      });
    });
  }

  /**
   * Disconnect the activity binding and cleanup listeners.
   */
  disconnect() {
    this.iframePort_.disconnect();
  }

  /**
   * Returns the mode of the activity: iframe, popup or redirect.
   * @return {!web-activities/activity-ports.ActivityMode}
   */
  getMode() {
    return this.iframePort_.getMode();
  }

  /**
   * Accepts the result when ready. The client should verify the activity's
   * mode, origin, verification and secure channel flags before deciding
   * whether or not to trust the result.
   *
   * Returns the promise that yields when the activity has been completed and
   * either a result, a cancelation or a failure has been returned.
   *
   * @return {!Promise<!web-activities/activity-ports.ActivityResult>}
   * @override
   */
  acceptResult() {
    return this.iframePort_.acceptResult();
  }

  /**
   * Register a callback to handle resize requests. Once successfully resized,
   * ensure to call `resized()` method.
   * @param {function(number)} callback
   */
  onResizeRequest(callback) {
    return this.iframePort_.onResizeRequest(callback);
  }

  /**
   * Sends a message to the host.
   * @param {!Object} payload
   */
  messageDeprecated(payload) {
    this.iframePort_.message(payload);
  }

  /**
   * Registers a callback to receive messages from the host.
   * @param {function(!Object)} callback
   */
  onMessageDeprecated(callback) {
    this.callbackOriginal_ = callback;
  }

  /**
   * @param {!../proto/api_messages.Message} request
   */
  execute(request) {
    this.iframePort_.message({'REQUEST': request.toArray()});
  }

  /**
   * @param {!function(new: T)} message
   * @param {function(!../proto/api_messages.Message)} callback
   * @template T
   */
  on(message, callback) {
    const label = getLabel(message);
    if (!label) {
      throw new Error('Invalid data type');
    } else if (this.callbackMap_[label]) {
      throw new Error('Invalid type or duplicate callback for ', label);
    }
    this.callbackMap_[label] = callback;
  }

  /**
   * Signals back to the activity implementation that the client has updated
   * the activity's size.
   */
  resized() {
    this.iframePort_.resized();
  }
}

export class ActivityPorts {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = new WebActivityPorts(win);
  }

  /**
   * Start an activity within the specified iframe.
   * @param {!HTMLIFrameElement} iframe
   * @param {string} url
   * @param {?Object=} opt_args
   * @return {!Promise<!ActivityIframePort>}
   */
  openIframe(iframe, url, opt_args) {
    const activityPort = new ActivityIframePort(iframe, url, opt_args);
    return activityPort.connect().then(() => activityPort);
  }

  /**
   * Start an activity in a separate window. The result will be delivered
   * to the `onResult` callback.
   *
   * The activity can be opened in two modes: "popup" and "redirect". This
   * depends on the `target` value, but also on the browser/environment.
   *
   * The allowed `target` values are `_blank`, `_top` and name targets. The
   * `_self`, `_parent` and similar targets are not allowed.
   *
   * The `_top` target indicates that the activity should be opened as a
   * "redirect", while other targets indicate that the activity should be
   * opened as a popup. The activity client will try to honor the requested
   * target. However, it's not always possible. Some environments do not
   * allow popups and they either force redirect or fail the window open
   * request. In this case, the activity will try to fallback to the "redirect"
   * mode.
   *
   * @param {string} requestId
   * @param {string} url
   * @param {string} target
   * @param {?Object=} opt_args
   * @param {?web-activities/activity-ports.ActivityOpenOptions=} opt_options
   * @return {{targetWin: ?Window}}
   */
  open(requestId, url, target, opt_args, opt_options) {
    return this.activityPorts_.open(
      requestId,
      url,
      target,
      opt_args,
      opt_options
    );
  }

  /**
   * Registers the callback for the result of the activity opened with the
   * specified `requestId` (see the `open()` method). The callback is a
   * function that takes a single `ActivityPort` argument. The client
   * can use this object to verify the port using it's origin, verified and
   * secure channel flags. Then the client can call
   * `ActivityPort.acceptResult()` method to accept the result.
   *
   * The activity result is handled via a separate callback because of a
   * possible redirect. So use of direct callbacks and/or promises is not
   * possible in that case.
   *
   * A typical implementation would look like:
   * ```
   * ports.onResult('request1', function(port) {
   *   port.acceptResult().then(function(result) {
   *     // Only verified origins are allowed.
   *     if (result.origin == expectedOrigin &&
   *         result.originVerified &&
   *         result.secureChannel) {
   *       handleResultForRequest1(result);
   *     }
   *   });
   * })
   *
   * ports.open('request1', request1Url, '_blank');
   * ```
   *
   * @param {string} requestId
   * @param {function(!ActivityPortDef)} callback
   */
  onResult(requestId, callback) {
    this.activityPorts_.onResult(requestId, port => {
      callback(new ActivityPortDeprecated(port));
    });
  }

  /**
   * @param {function(!Error)} handler
   */
  onRedirectError(handler) {
    this.activityPorts_.onRedirectError(handler);
  }

  /**
   * @return {!web-activities/activity-ports.ActivityPorts}
   */
  getOriginalWebActivityPorts() {
    return this.activityPorts_;
  }
}
