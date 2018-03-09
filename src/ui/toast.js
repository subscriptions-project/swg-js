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

import {createElement} from '../utils/dom';
import {
  resetStyles,
  setStyles,
  setImportantStyles,
  topFriendlyIframePositionStyles,
} from '../utils/style';
import {feArgs, feUrl} from '../runtime/services';

/** @const {!Object<string, string|number>} */
export const toastImportantStyles = {
  'position': 'fixed',
  'bottom': 0,
  'height': 0,
  'max-height': '46px',
  'z-index': '2147483647',
  'border': 'none',
};

/** @typedef {{
 *    text: string,
 *    action: ({label: string, handler: function()}|undefined)
 *  }}
 */
export let ToastSpecDef;

/** @const {!Object<string, string>} */
const iframeAttributes = {
  'frameborder': '0',
  'scrolling': 'no',
  'class': 'swg-toast',
};

/**
 * The class Notification toast.
 */
export class Toast {

  /**
   * @param {!../runtime/deps.DepsDef} deps
   * @param {{'source': string}} args
   */
  constructor(deps, args) {

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!HTMLDocument} */
    this.doc_ = this.win_.document;

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../runtime/deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {{'source': string}} */
    this.args_ = args;

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ =
        /** @type {!HTMLIFrameElement} */ (
            createElement(this.doc_, 'iframe', iframeAttributes));

    setImportantStyles(this.iframe_, toastImportantStyles);
    setStyles(this.iframe_, topFriendlyIframePositionStyles);

            /** @private @const {!Promise} */
    this.ready_ = new Promise(resolve => {
      this.iframe_.onload = resolve;
    });
  }

  getElement() {
    return this.iframe;
  }

  /**
   * When promise is resolved.
   * @return {!Promise}
   */
  whenReady() {
    return this.ready_;
  }

  /**
   * Opens the notification toast.
   * @return {!Promise}
   */
  open() {
    this.doc_.body.appendChild(this.iframe_);  // Fires onload.

    return this.whenReady().then(() => {
      this.buildToast_();
      return this;
    });
  }

  buildToast_() {
    return this.activityPorts_.openIframe(
        this.iframe_, feUrl('/toastiframe'),
        feArgs({
          'publicationId': this.deps_.pageConfig().getPublicationId(),
          'showNative': this.deps_.callbacks().hasSubscribeRequestCallback(),
          'source': this.args_.source,
        })).then(port => {
          resetStyles(this.iframe_, ['height']);
          setImportantStyles(this.iframe_, {
            'animation': 'swg-notify 1s ease-out normal backwards, '
                  + 'swg-notify-hide 1s ease-out 7s normal forwards',
          });
          return port.acceptResult();
        });
  }

  /**
   * Closes the toast.
   */
  close() {
    this.doc_.body.removeChild(this.iframe_);
  }
}
