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
   * @param {string} src
   * @param {!Object<string, ?>} args
   */
  constructor(deps, src, args) {

    /** @private @const {!../model/doc.Doc} */
    this.doc_ = deps.doc();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {string} */
    this.src_ = src;

    /** @private @const {!Object<string, ?>} */
    this.args_ = args;

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ =
        /** @type {!HTMLIFrameElement} */ (
            createElement(
                this.doc_.getWin().document,
                'iframe',
                iframeAttributes));

    setImportantStyles(this.iframe_, toastImportantStyles);
    setStyles(this.iframe_, topFriendlyIframePositionStyles);

    /** @private @const {!Promise} */
    this.ready_ = new Promise(resolve => {
      this.iframe_.onload = resolve;
    });
  }

  /**
   * Returns the iframe element.
   * @return {!HTMLIFrameElement}
   */
  getElement() {
    return this.iframe_;
  }

  /**
   * Opens the notification toast.
   * @return {!Promise}
   */
  open() {
    this.doc_.getBody().appendChild(this.iframe_);  // Fires onload.
    return this.buildToast_();
  }

  /**
   * Builds the content of the iframe. On load, animates the toast.
   */
  buildToast_() {
    const toastDurationSeconds = 7;
    return this.activityPorts_.openIframe(
        this.iframe_, this.src_, this.args_).then(port => {
          return port.whenReady();
        }).then(() => {
          resetStyles(this.iframe_, ['height']);
          setImportantStyles(this.iframe_, {
            'animation': 'swg-notify .3s ease-out normal backwards, '
                  + 'swg-notify-hide .3s ease-out ' + toastDurationSeconds +
                  's normal forwards',
          });
          this.doc_.getWin().setTimeout(() => {
            this.close();
          }, (toastDurationSeconds + 1) * 1000);
        });
  }

  /**
   * Closes the toast.
   */
  close() {
    this.doc_.getBody().removeChild(this.iframe_);
  }
}
