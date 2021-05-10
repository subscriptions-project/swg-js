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
import {resetStyles, setImportantStyles} from '../utils/style';
import {transition} from '../utils/animation';

/** @const {!Object<string, string|number>} */
export const toastImportantStyles = {
  'height': 0,
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
   * @param {?Object<string, ?>=} args
   */
  constructor(deps, src, args) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = deps.doc();

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {string} */
    this.src_ = src;

    /** @private {?Object<string, ?>} */
    this.args_ = args || {};

    /** @private {?Promise} */
    this.animating_ = null;

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ = /** @type {!HTMLIFrameElement} */ (createElement(
      this.doc_.getWin().document,
      'iframe',
      iframeAttributes
    ));

    setImportantStyles(this.iframe_, toastImportantStyles);

    /** @private @const {!Promise} */
    this.ready_ = new Promise((resolve) => {
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
    this.doc_.getBody().appendChild(this.iframe_); // Fires onload.
    return this.buildToast_();
  }

  /**
   * Builds the content of the iframe. On load, animates the toast.
   */
  buildToast_() {
    const toastDurationSeconds = 7;
    return this.activityPorts_
      .openIframe(this.iframe_, this.src_, this.args_)
      .then((port) => {
        return port.whenReady();
      })
      .then(() => {
        resetStyles(this.iframe_, ['height']);

        this.animate_(() => {
          setImportantStyles(this.iframe_, {
            'transform': 'translateY(100%)',
            'opactiy': 1,
            'visibility': 'visible',
          });
          return transition(
            this.iframe_,
            {
              'transform': 'translateY(0)',
              'opacity': 1,
              'visibility': 'visible',
            },
            400,
            'ease-out'
          );
        });

        // Close the Toast after the specified duration.
        this.doc_.getWin().setTimeout(() => {
          this.close();
        }, (toastDurationSeconds + 1) * 1000);
      });
  }

  /**
   * @param {function():!Promise} callback
   * @return {!Promise}
   * @private
   */
  animate_(callback) {
    const wait = this.animating_ || Promise.resolve();
    return (this.animating_ = wait
      .then(() => callback())
      // Ignore errors to make sure animations don't get stuck.
      .catch(() => {})
      .then(() => {
        this.animating_ = null;
      }));
  }

  /**
   * Closes the toast.
   * @return {!Promise}
   */
  close() {
    return this.animate_(() => {
      // Remove the toast from the DOM after animation is complete.
      this.doc_.getWin().setTimeout(() => {
        this.doc_.getBody().removeChild(this.iframe_);
        return Promise.resolve();
      }, 500);

      return transition(
        this.iframe_,
        {
          'transform': 'translateY(100%)',
          'opacity': 1,
          'visibility': 'visible',
        },
        400,
        'ease-out'
      );
    });
  }
}
