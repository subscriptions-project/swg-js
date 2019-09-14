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
  AnalyticsEventMeta,
  AnalyticsEvent,
  EventParams,
} from '../proto/api_messages';
import {createElement} from '../utils/dom';
import {feArgs, feUrl} from './services';
import {getOnExperiments} from './experiments';
import {parseQueryString, parseUrl} from '../utils/url';
import {setImportantStyles} from '../utils/style';
import {getUuid} from '../utils/string';
import {ClientEventManager} from './client-event-manager';

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

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ = /** @type {!HTMLIFrameElement} */ (createElement(
      this.doc_.getWin().document,
      'iframe',
      {}
    ));

    setImportantStyles(this.iframe_, iframeStyles);

    /** @private @const {string} */
    this.src_ = feUrl('/serviceiframe');

    /** @private @const {string} */
    this.publicationId_ = deps.pageConfig().getPublicationId();

    this.args_ = feArgs({
      publicationId: this.publicationId_,
    });

    /** @private @type {!boolean} */
    this.everLogged_ = false;

    /**
     * @private @const {!AnalyticsContext}
     */
    this.context_ = new AnalyticsContext();

    this.context_.setTransactionId(getUuid());

    /** @private {?Promise<!web-activities/activity-ports.ActivityIframePort>} */
    this.serviceReady_ = null;

    /** @private {?Promise} */
    this.lastAction_ = null;

    /** @private @const {!ClientEventManager} */
    this.eventManager_ = deps.eventManager();
    this.eventManager_.registerEventListener(
      this.handleClientEvent_.bind(this)
    );
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
   * @return {!Promise<!../components/activities.ActivityIframePort>}
   * @private
   */
  start_() {
    if (!this.serviceReady_) {
      // TODO(sohanirao): Potentially do this even earlier
      this.doc_.getBody().appendChild(this.getElement());
      this.serviceReady_ = this.activityPorts_
        .openIframe(this.iframe_, this.src_, this.args_)
        .then(port => {
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
   * @return {!AnalyticsContext}
   */
  getContext() {
    return this.context_;
  }

  /**
   * Returns true if any logs have already be sent to the analytics server.
   * @return {boolean}
   */
  getHasLogged() {
    return this.everLogged_;
  }

  /**
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @return {!AnalyticsRequest}
   */
  createLogRequest_(event) {
    const meta = new AnalyticsEventMeta();
    meta.setEventOriginator(event.eventOriginator);
    meta.setIsFromUserAction(event.isFromUserAction);

    const request = new AnalyticsRequest();
    request.setEvent(event.eventType);
    request.setContext(this.context_);
    request.setMeta(meta);
    if (event.additionalParameters instanceof EventParams) {
      request.setParams(event.additionalParameters);
    } // Ignore event.additionalParameters.  It may have data we shouldn't log.
    return request;
  }

  /**
   * Handles the message received by the port.
   * @param {function(!Object<string, string|boolean>)} callback
   */
  onMessage(callback) {
    this.lastAction_ = this.start_().then(port => {
      port.onMessageDeprecated(callback);
    });
  }

  /**
   * @return {boolean}
   */
  shouldLogPublisherEvents_() {
    return this.deps_.config().enableSwgAnalytics === true;
  }

  /**
   *  Listens for new events from the events manager and handles logging
   * @param {!../api/client-event-manager-api.ClientEvent} event
   */
  handleClientEvent_(event) {
    //this event is just used to communicate information internally.  It should
    //not be reported to the SwG analytics service.
    if (event.eventType === AnalyticsEvent.EVENT_SUBSCRIPTION_STATE) {
      return;
    }

    if (
      ClientEventManager.isPublisherEvent(event) &&
      !this.shouldLogPublisherEvents_()
    ) {
      return;
    }
    this.lastAction_ = this.start_().then(port => {
      const request = this.createLogRequest_(event);
      this.everLogged_ = true;
      port.execute(request);
    });
  }
}
