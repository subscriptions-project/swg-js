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

    /** @private @const {!../model/doc.Doc} */
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
     * @private {?AnalyticsContext}
     */
    this.context_ = null;

    /**
     * @private @const {!TransactionId}
     */
    this.xid_ = new TransactionId(deps);

    /** @private {?Promise<!web-activities/activity-ports.ActivityIframePort>} */
    this.serviceReady_ = null;

    /** @private {?Promise} */
    this.lastAction_ = null;

    /** @private {?boolean} */
    this.isReadyToPay_ = null;

    /** @private {?string} */
    this.sku_ = null;
  }

  /**
   * @param {string} sku
   */
  setSku(sku) {
    this.sku_ = sku;
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
   * @private
   */
  setContext_() {
    if (!this.context_) {
      this.getContext().then(context => {
        // clone into member variable
        this.context_ = new AnalyticsContext(context.toArray());
      });
    }
  }

  /**
   * @return {!Promise<!AnalyticsContext>}
   */
  getContext() {
    const /* {!AnalyticsContext} */ context = new AnalyticsContext();
    context.setReferringOrigin(parseUrl(this.getReferrer_()).origin);
    const utmParams = parseQueryString(this.getQueryString_());
    const name = utmParams['utm_name'];
    const medium = utmParams['utm_medium'];
    const source = utmParams['utm_source'];
    if (name) {
      context.setUtmName(name);
    }
    if (medium) {
      context.setUtmMedium(medium);
    }
    if (source) {
      context.setUtmSource(source);
    }
    if (this.isReadyToPay_ != null) {
      context.setReadyToPay(this.isReadyToPay_);
    }
    if (this.sku_) {
      context.setSku(this.sku_);
    }
    return this.xid_.get().then(id => {
      context.setTransactionId(id);
      return context;
    });
  }

  /**
   * @return {!Promise<!web-activities/activity-ports.ActivityIframePort>}
   * @private
   */
  start_() {
    if (!this.serviceReady_) {
      // TODO(sohanirao): Potentially do this even earlier
      this.doc_.getBody().appendChild(this.getElement());
      this.serviceReady_ = this.activityPorts_.openIframe(
          this.iframe_, this.src_, this.args_).then(port => {
            this.setContext_();
            return port.whenReady().then(() => port);
          });
    }
    return this.serviceReady_;
  }

  /**
   * @param {boolean} isReadyToPay
   */
  setReadyToPay(isReadyToPay) {
    this.isReadyToPay_ = isReadyToPay;
  }

  /**
   */
  close() {
    this.doc_.getBody().removeChild(this.getElement());
  }

  /**
   * @param {!../proto/api_messages.AnalyticsEvent} event
   */
  logEvent(event) {
    this.lastAction_ = this.start_().then(port => {
      const /* {!AnalyticsRequest} */ request = new AnalyticsRequest();
      request.setEvent(event);
      // Context is guaranteed to be created by now
      request.setContext(this.context_);
      port.message({'buf': request.toArray()});
    });
  }

  /**
   * Handles the message received by the port.
   * @param {function(!Object<string, string|boolean>)} callback
   */
  onMessage(callback) {
    this.lastAction_ = this.start_().then(port => {
      port.onMessage(callback);
    });
  }
}
