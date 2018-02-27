/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import {View} from '../components/view';
import {createElement} from '../utils/dom';

/** @const {!Object<string, string>} */
const iframeAttributes = {
  'frameborder': '0',
  'scrolling': 'no',
};


/**
 * Class to build and render Activity iframe view.
 */
export class ActivityIframeView extends View {

  /**
   * @param {!Window} win
   * @param {!web-activities/activity-ports.ActivityPorts} activityPorts
   * @param {string} src
   * @param {!Object<string, ?string|number>=} args
   * @param {boolean=} shouldFadeBody
   */
  constructor(
      win,
      activityPorts,
      src,
      args,
      shouldFadeBody = false) {
    super();

    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Document} */
    this.doc_ = this.win_.document;

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ =
        /** @type {!HTMLIFrameElement} */ (
            createElement(this.doc_, 'iframe', iframeAttributes));

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = activityPorts;

    /** @private @const {string} */
    this.src_ = src;

    /** @private @const {!Object<string, ?string|number>} */
    this.args_ = args || {};

    /** @private @const {boolean} */
    this.shouldFadeBody_ = shouldFadeBody;

    /** @private {?web-activities/activity-ports.ActivityIframePort} */
    this.port_ = null;

    /* @private {?function<!Object<string, string|number>} */
    this.onMessage_ = null;

    /**
     * @private
     * {?function((!web-activities/activity-ports.ActivityResult|!Promise))}
     */
    this.resolve_ = null;

    /**
     * @private @const
     * {!Promise<!web-activities/activity-ports.ActivityResult>}
     */
    this.promise_ = new Promise(resolve => {
      this.resolve_ = resolve;
    });
  }

  /** @override */
  getElement() {
    return this.iframe_;
  }

  /** @override */
  init(dialog) {
    return this.activityPorts_.openIframe(this.iframe_, this.src_, this.args_)
        .then(port => this.onOpenIframeResponse_(port, dialog));
  }

  /**
   * Returns if document should fade for this view.
   * @return {boolean}
   */
  shouldFadeBody() {
    return this.shouldFadeBody_;
  }

  /**
   * @param {!web-activities/activity-ports.ActivityIframePort} port
   * @param {!../components/dialog.Dialog} dialog
   * @return {!Promise}
   */
  onOpenIframeResponse_(port, dialog) {
    this.port_ = port;

    this.port_.onResizeRequest(height => {
      dialog.resizeView(this, height);
    });

    this.resolve_(this.port_.acceptResult());

    this.port_.onMessage(message => {
      if (this.onMessage_) {
        this.onMessage_(message);
      }
    });

    return this.port_.whenReady();
  }

  /**
   * Handles the message received by the port.
   * @param {function(!Object<string, string|boolean>)} callback
   */
  onMessage(callback) {
    this.onMessage_ = callback;
  }

  /**
   * Accepts results from the caller.
   * @return {!Promise<!web-activities/activity-ports.ActivityResult>}
   */
  acceptResult() {
    return this.promise_;
  }

  /**
   * Completes the flow.
   * @return {!Promise}
   */
  whenComplete() {
    return this.promise_;
  }

  /** @override */
  resized() {
    if (this.port_) {
      this.port_.resized();
    }
  }
}
