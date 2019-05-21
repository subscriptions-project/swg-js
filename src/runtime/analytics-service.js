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

import {
  AnalyticsRequest,
  AnalyticsContext,
} from '../proto/api_messages';
import {createElement} from '../utils/dom';
import {feArgs, feUrl} from './services';
import {getOnExperiments} from './experiments';
import {parseQueryString, parseUrl} from '../utils/url';
import {setImportantStyles} from '../utils/style';
import {uuidFast} from '../../third_party/random_uuid/uuid-swg';

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
     * @private @const {!AnalyticsContext}
     */
    this.context_ = new AnalyticsContext();

    this.context_.setTransactionId(uuidFast());

    /** @private {?Promise<!web-activities/activity-ports.ActivityIframePort>} */
    this.serviceReady_ = null;

    /** @private {?Promise} */
    this.lastAction_ = null;
  }

  /**
   * @param {string} transactionId
   */
  setTransactionId(transactionId) {
    this.context_.setTransactionId(transactionId);
  }

  /**
   * @return {string}
   */
  getTransactionId() {
    return /** @type {string} */ (this.context_.getTransactionId());
  }

  /**
   * @return {?string}
   */
  getSku() {
    return this.context_.getSku();
  }

  /**
   * @param {string} sku
   */
  setSku(sku) {
    this.context_.setSku(sku);
  }

  /**
   * @param {!Array<string>} labels
   */
  addLabels(labels) {
    if (labels && labels.length > 0) {
      const newLabels = [].concat(this.context_.getLabelList());
      labels.forEach(label => {
        if (newLabels.indexOf(label) == -1) {
          newLabels.push(label);
        }
      });
      this.context_.setLabelList(newLabels);
    }
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
    const utmParams = parseQueryString(this.getQueryString_());
    this.context_.setReferringOrigin(parseUrl(this.getReferrer_()).origin);
    const campaign = utmParams['utm_campaign'];
    const medium = utmParams['utm_medium'];
    const source = utmParams['utm_source'];
    if (campaign) {
      this.context_.setUtmCampaign(campaign);
    }
    if (medium) {
      this.context_.setUtmMedium(medium);
    }
    if (source) {
      this.context_.setUtmSource(source);
    }
    this.addLabels(getOnExperiments(this.doc_.getWin()));
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
    this.context_.setReadyToPay(isReadyToPay);
  }

  /**
   */
  close() {
    this.doc_.getBody().removeChild(this.getElement());
  }

  /**
   * @param {!../proto/api_messages.AnalyticsEvent} event
   * @return {!AnalyticsRequest}
   */
  createLogRequest(event) {
    console.log('AnalyticsEvent: ', event);
    const request = new AnalyticsRequest();
    request.setEvent(event);
    request.setContext(this.context_);
    console.log('AnalyticsRequest: ', request);
    return request;
  }

  /**
   * @param {!../proto/api_messages.AnalyticsEvent} event
   */
  logEvent(event) {
    this.lastAction_ = this.start_().then(port => {
      port.message({'buf': this.createLogRequest(event).toArray()});
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
