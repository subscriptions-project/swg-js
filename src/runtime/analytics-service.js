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
import {setImportantStyles} from '../utils/style';
import {AnalyticsRequest,
        AnalyticsContext} from '../proto/api_messages';
import {TransactionId} from './transaction-id';
import {parseQueryString, parseUrl} from '../utils/url';

/** @const {!Object<string, string>} */
const iframeStyles = {
  display: 'none',
};


export class AnalyticsService {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {

    /** @private @const {!Doc} */
    this.doc_ = deps.doc();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ =
        /** @type {!HTMLIFrameElement} */ (createElement(
            this.doc_.getWin().document, 'iframe', {}));

    setImportantStyles(this.iframe_, iframeStyles);

    /** @private @const {string} */
    this.src_ = feUrl('/serviceiframe');

    /** @private @const {string} */
    this.publicationId_ = deps.pageConfig().getPublicationId();

    this.args_ = feArgs({
      publicationId: this.publicationId_,
    });

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
     * @private @const {!AnalyticsContext}
     */
    this.context_ = new AnalyticsContext();

    /**
     * @private @const {!TransactionId}
     */
    this.xid_ = new TransactionId(deps);
  }

  /**
   * @param {string} sku
   */
  setSku(sku) {
    this.context_.setSku(sku);
  }

  /**
   * @return {!HTMLIFrameElement}
   */
  getElement() {
    return this.iframe_;
  }

  /**
   * @return {string}
   * @private
   */
  getQueryString_() {
    return this.doc_.getWin().location.search;
  }

  /**
   * @return {string}
   * @private
   */
  getReferrer_() {
    return this.doc_.getWin().document.referrer;
  }

  /**
   * @return {!Promise}
   */
  setContext_() {
    const utmParams = parseQueryString(this.getQueryString_());
    this.context_.setTransactionId(this.xid_.get());
    this.context_.setReferringOrigin(parseUrl(this.getReferrer_()).origin);
    const name = utmParams['utm_name'];
    const medium = utmParams['utm_medium'];
    const source = utmParams['utm_source'];
    if (name) {
      this.context_.setUtmName(name);
    }
    if (medium) {
      this.context_.setUtmMedium(medium);
    }
    if (source) {
      this.context_.setUtmSource(source);
    }
    return this.xid_.get().then(id => {
      this.context_.setTransactionId(id);
    });
  }

  /**
   * @return {!Promise}
   */
  start() {
    this.doc_.getBody().appendChild(this.getElement());
    return this.activityPorts_.openIframe(this.iframe_, this.src_,
        this.args_).then(port => {
          this.portResolver_(port);
          return this.setContext_();
        });
  }

  /**
   */
  close() {
    this.doc_.getBody().removeChild(this.getElement());
  }

  /**
   * @return {!Promise<!web-activities/activity-ports.ActivityIframePort>}
   * @private
   */
  port_() {
    return this.portPromise_;
  }

  /**
   * @param {!AnalyticsEvent} event
   * @return {!AnalyticsRequest}
   */
  createLogRequest_(event) {
    const /* {!AnalyticsRequest} */ request = new AnalyticsRequest();
    request.setEvent(event);
    request.setContext(this.context_);
    return request;
  }

  /**
   * @param {!AnalyticsEvent} event
   */
  logEvent(event) {
    this.port_().then(port => {
      return port.whenReady().then(() => {
        port.message({'buf': this.createLogRequest_(event).toArray()});
      });
    });
  }

  /**
   * Handles the message received by the port.
   * @param {function(!Object<string, string|boolean>)} callback
   */
  onMessage(callback) {
    this.port_().then(port => {
      port.onMessage(callback);
    });
  }
}
