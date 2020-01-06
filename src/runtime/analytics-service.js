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
  AnalyticsContext,
  AnalyticsEvent,
  AnalyticsEventMeta,
  AnalyticsRequest,
  EventOriginator,
  EventParams,
  FinishedLoggingResponse,
} from '../proto/api_messages';
import {ClientEventManager} from './client-event-manager';
import {createElement} from '../utils/dom';
import {feUrl} from './services';
import {getOnExperiments} from './experiments';
import {getUuid} from '../utils/string';
import {log} from '../utils/log';
import {parseQueryString, parseUrl} from '../utils/url';
import {setImportantStyles} from '../utils/style';

/** @const {!Object<string, string>} */
const iframeStyles = {
  opacity: '0',
  position: 'absolute',
  top: '-10px',
  left: '-10px',
  height: '1px',
  width: '1px',
};

// The initial iframe load takes ~500 ms.  We will wait at least that long
// before a page redirect.  Subsequent logs are much faster.  We will wait at
// most 100 ms.
const MAX_FIRST_WAIT = 500;
const MAX_WAIT = 200;
// If we logged and rapidly redirected, we will add a short delay in case
// a message hasn't been transmitted yet.
const TIMEOUT_ERROR = 'AnalyticsService timed out waiting for a response';

/**
 *
 * @param {!string} error
 */
function createErrorResponse(error) {
  const response = new FinishedLoggingResponse();
  response.setComplete(false);
  response.setError(error);
  return response;
}

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
    this.doc_.getBody().appendChild(this.getElement());

    /** @private @type {!boolean} */
    this.everStartedLog_ = false;

    /** @private @type {!boolean} */
    this.everFinishedLog_ = false;

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

    // This code creates a 'promise to log' that we can use to ensure all
    // logging is finished prior to redirecting the page.
    /** @private {!number} */
    this.unfinishedLogs_ = 0;

    /** @private {?function(boolean)} */
    this.loggingResolver_ = null;

    /** @private {?Promise} */
    this.promiseToLog_ = null;

    // If logging doesn't work don't force the user to wait
    /** @private {!boolean} */
    this.loggingBroken_ = false;

    // If logging exceeds the timeouts (see const comments above) don't make
    // the user wait too long.
    /** @private {?number} */
    this.timeout_ = null;
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
    this.context_.setClientVersion('SwG $internalRuntimeVersion$');
    this.addLabels(getOnExperiments(this.doc_.getWin()));
  }

  /**
   * @return {!Promise<!../components/activities.ActivityIframePort>}
   */
  start() {
    if (!this.serviceReady_) {
      this.serviceReady_ = this.activityPorts_
        .openIframe(this.iframe_, feUrl('/serviceiframe'), null, true)
        .then(
          port => {
            // Register a listener for the logging to code indicate it is
            // finished logging.
            port.on(FinishedLoggingResponse, this.afterLogging_.bind(this));
            this.setContext_();
            return port.whenReady().then(() => port);
          },
          message => {
            // If the port doesn't open register that logging is broken so
            // nothing is just waiting.
            this.loggingBroken_ = true;
            this.afterLogging_(
              createErrorResponse('Could not connect [' + message + ']')
            );
          }
        );
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
    return this.everStartedLog_;
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
   * @return {boolean}
   */
  shouldLogPublisherEvents_() {
    return this.deps_.config().enableSwgAnalytics === true;
  }

  /**
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @return {boolean}
   */
  shouldAlwaysLogEvent_(event) {
    /* AMP_CLIENT events are considered publisher events and we generally only
     * log those if the publisher decided to enable publisher event logging for
     * privacy purposes.  The page load event is not private and is necessary
     * just so we know the user is in AMP, so we will log it regardless of
     * configuration.
     */
    return (
      event.eventType === AnalyticsEvent.IMPRESSION_PAGE_LOAD &&
      event.eventOriginator === EventOriginator.AMP_CLIENT
    );
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
      !this.shouldLogPublisherEvents_() &&
      !this.shouldAlwaysLogEvent_(event)
    ) {
      return;
    }
    // Register we sent a log, the port will call this.afterLogging_ when done.
    this.unfinishedLogs_++;
    this.everStartedLog_ = true;
    const request = this.createLogRequest_(event);
    this.lastAction_ = this.start().then(port => port.execute(request));
  }

  /**
   * This function is called by the iframe after it sends the log to the server.
   * @param {FinishedLoggingResponse=} response
   */
  afterLogging_(response) {
    const success = (response && response.getComplete()) || false;
    const error = (response && response.getError()) || 'Unknown logging Error';
    const isTimeout = error === TIMEOUT_ERROR;

    if (!success) {
      log('Error when logging: ' + error);
    }

    this.unfinishedLogs_--;
    if (!isTimeout) {
      this.everFinishedLog_ = true;
    }

    // Nothing is waiting
    if (this.loggingResolver_ === null) {
      return;
    }

    if (this.unfinishedLogs_ === 0 || this.loggingBroken_ || isTimeout) {
      if (this.timeout_ !== null) {
        clearTimeout(this.timeout_);
        this.timeout_ = null;
      }
      this.loggingResolver_(success);
      this.promiseToLog_ = null;
      this.loggingResolver_ = null;
    }
  }

  /**
   * Please note that logs sent after getLoggingPromise is called are not
   * guaranteed to be finished when the promise is resolved.  You should call
   * this function just prior to redirecting the page after SwG is finished
   * logging.
   * @return {!Promise}
   */
  getLoggingPromise() {
    if (this.unfinishedLogs_ === 0 || this.loggingBroken_) {
      return Promise.resolve(true);
    }
    if (this.promiseToLog_ === null) {
      this.promiseToLog_ = new Promise(resolve => {
        this.loggingResolver_ = resolve;
      });

      // The promise above should not wait forever if things go wrong.  Let
      // the user proceed!
      const whenDone = this.afterLogging_.bind(this);
      this.timeout_ = setTimeout(
        () => {
          this.timeout_ = null;
          whenDone(createErrorResponse(TIMEOUT_ERROR));
        },
        this.everFinishedLog_ ? MAX_WAIT : MAX_FIRST_WAIT
      );
    }

    return this.promiseToLog_;
  }
}
