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
import {
    ActivityOpenOptions,
    ActivityPort
  } from 'web-activities/activity-ports';
  import {deserialize} from '../proto/api_messages';

   export class SwgActivityIframePort {
    /**
     * @param {!web-activities/activity-ports.ActivityIframePort} iframePort
     */
    constructor(iframePort) {
      /** @private @const {!web-activities/activity-ports.ActivityIframePort} */
      this.iframePort_ = iframePort;
      /** @private @const {!Object<string, function(!{Object})>} */
      this.callbackMap_ = {};
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
     * Register a callback to handle resize requests. Once successfully resized,
     * ensure to call `resized()` method.
     * @param {function(number)} callback
     */
    onResizeRequest(callback) {
      return this.iframePort_.onResizeRequest(callback);
    }

     /**
     * @template T
     * @param {T} request
     */
    execute(request) {
      this.iframePort_.message({'REQ': request.toArray()});
    }

     /**
     * @param {string} type
     * @param {function(T)} callback
     * @template T
     */
    on(type, callback) {
      this.callbackMap_[type] = callback;
      this.iframePort_.onMessage(data => {
        const response = data && data['RESPONSE'];
        if (!response) {
          return;
         }
        const cb = this.callbackMap_[response[0]];
        if (cb) {
          cb(deserialize(response));
        }
      });
    }

     /**
     * @param {string} type
     * @param {function(T, string, boolean, boolean)} callback
     */
    onResult(type, callback) {
      this.callbackMap_[type] = callback;
      this.iframePort_.acceptResult().then(result => {
        const data = result.data;
        const response = data && data['RESULT'];
        const cb = this.callbackMap_[response[0]];
        let resultData = null;
        if(response) {
          resultData = deserialize(response);
        }
        if (cb) {
          cb(resultData,
             result.origin,
             result.originVerified,
             result.secureChannel);
          }
        });
    }

     /**
     * Signals back to the activity implementation that the client has updated
     * the activity's size.
     */
    resized() {
      this.iframePort_.resized();
    }

     /**
     * @return {!Promise}
     */
    whenComplete() {
      return this.iframePort_.acceptResult()
        .then(() => Promise.resolve());
    }
  }

   export class SwGActivityPorts {
    /**
     * @param {!ActivityPorts} activityPorts
     */
    constructor(activityPorts) {
      /** @const {!web-activities/activity-ports.ActivityPorts} */
      this.activityPorts_ = activityPorts;
    }

     /**
     * Start an activity within the specified iframe.
     * @param {!HTMLIFrameElement} iframe
     * @param {!TrustedResourceUrl} url
     * @param {?Object=} opt_args
     * @return {!Promise<!SwActivityIframePort>}
     */
    openIframe(iframe, url, opt_args) {
      return this.activityPorts_.openIframe(iframe, url, opt_args).then(port => {
        const swgPort = new SwgActivityIframePort(port)
        return swgPort;
      });
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
     * @param {!Const} target
     * @param {?Object=} opt_args
     * @param {?ActivityOpenOptions=} opt_options
     * @return {{targetWin: ?Window}}
     */
    open(requestId, url, target, opt_args, opt_options) {
      return this.activityPorts_.open(requestId, url, target, opt_args, opt_options);
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
     * @param {function(!ActivityPort)} callback
     */
    onResult(requestId, callback) {
      this.activityPorts_.onResult(requestId, callback);
    }

     /**
     * @param {function(!Error)} handler
     */
    onRedirectError(handler) {
      this.activityPorts_.onRedirectorError(handler);
    }
  }