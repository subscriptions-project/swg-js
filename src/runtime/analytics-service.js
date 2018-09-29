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

import {feArgs, feUrl} from './services';
import {createElement} from '../utils/dom';
import {isCancelError} from '../utils/errors';
import {FriendlyIframe} from '../components/friendly-iframe';

/** @const {!Object<string, string>} */
const iframeAttributes = {
  'visibility': 'hidden',
  'opacity': 0,
};

export class AnalyticsService {
  /**
   * @param {!../model/doc.Doc} doc
   * @param {!web-activities/activity-ports.ActivityPorts} activityPorts
   * @param {!Object<string, ?>=} args
   */
  constructor(doc, activityPorts, args) {

    /** @private @const {!Doc} */
    this.doc_ = doc;

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = activityPorts;

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ =
        /** @type {!HTMLIFrameElement} */ (createElement(
            this.doc_.getWin().document, 'iframe', iframeAttributes));

    /** @private @const {string} */
    this.src_ = feUrl('/serviceiframe');

    this.args_ = feArgs({
      publicationId: args['publicationId'],
      // TODO(sohanirao): Add analytics context here
    });
    /** @private {?web-activities/activity-ports.ActivityIframePort} */
    this.port_ = null;

    /**
     * @private
     * {?function<!web-activities/activity-ports.ActivityIframePort|!Promise>}
     */
    this.portResolver_ = null;

    /**
     * @private @const
     * {!Promise<!web-activities/activity-ports.ActivityIframePort>}
     */
    this.portPromise_ = new Promise(resolve => {
      this.portResolver_ = resolve;
    });

    /**
     * @private @constant
     * {!FriendlyIframe}
     */
    this.friendlyIframe_ = new FriendlyIframe(this.doc_.getWin().document,
        {'visibility': 'hidden'});

    this.container_ = null;
  }

  /**
   * @return {!HTMLIFrameElement}
   */
  getElement() {
    return this.iframe_;
  }

  /**
   * Build the iframe with the styling after iframe is loaded.
   * @private
   */
  buildIframe_() {
    const iframeBody = this.friendlyIframe_.getBody();
    const iframeDoc =
        /** @type {!HTMLDocument} */ (this.friendlyIframe_.getDocument());
    // Container for all dynamic content, including 3P iframe.
    const container = createElement(iframeDoc, 'swg-container',
        {'visibility': 'hidden'});
    iframeBody.appendChild(container);
    return container;
  }

  getIframe() {
    return this.friendlyIframe_;
  }

  open_() {
    // Attach.
    this.doc_.getBody().appendChild(this.friendlyIframe_.getElement());  // Fires onload.
    return this.friendlyIframe_.whenReady().then(() => {
      this.container_ = this.buildIframe_();
    });
  }

  /**
   * @return {!Promise}
   */
  init_() {
    this.container_.appendChild(this.getElement());
    return this.activityPorts_.openIframe(this.iframe_, this.src_,
        this.args_).then(port => this.onOpenIframeResponse_(port));
  }

  /**
   * @param {!web-activities/activity-ports.ActivityIframePort} port
   * @return {!Promise}
   */
  onOpenIframeResponse_(port) {
    this.port_ = port;
    this.portResolver_(port);
    return this.port_.whenReady();
  }

  /**
   */
  close() {
    this.doc_.getBody().removeChild(this.iframe_.getElement());
  }

  /**
   * @return {!Promise}
   */
  start() {
    /* TODO(sohanirao): Determine if completion must be handled and how.
    this.whenComplete().then(() => {
      this.close_();
    }, reason => {
      this.close_();
      throw reason;
    }); */
    return this.open_().then(() => {
      return this.init_();
    });
  }

  /**
   * @return {!Promise<!web-activities/activity-ports.ActivityIframePort>}
   */
  port() {
    return this.portPromise_;
  }

  /**
   * @param {!Object} data
   */
  message(data) {
    this.port().then(port => {
      port.message(data);
    });
  }

  /**
   * Handles the message received by the port.
   * @param {function(!Object<string, string|boolean>)} callback
   */
  onMessage(callback) {
    this.port().then(port => {
      port.onMessage(callback);
    });
  }

  /**
   * Accepts results from the caller.
   * @return {!Promise<!web-activities/activity-ports.ActivityResult>}
   */
  acceptResult() {
    return this.port().then(port => port.acceptResult());
  }

  /**
   * @param {function()} callback
   */
  onCancel(callback) {
    this.acceptResult().catch(reason => {
      if (isCancelError(reason)) {
        callback();
      }
      throw reason;
    });
  }
}
