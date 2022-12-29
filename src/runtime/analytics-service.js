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
import {ExperimentFlags} from './experiment-flags';
import {INTERNAL_RUNTIME_VERSION} from '../constants';
import {createElement} from '../utils/dom';
import {feUrl} from './services';
import {getCanonicalUrl} from '../utils/url';
import {getOnExperiments, isExperimentOn} from './experiments';
import {getSwgTransactionId, getUuid} from '../utils/string';
import {log} from '../utils/log';
import {parseQueryString, parseUrl} from '../utils/url';
import {setImportantStyles} from '../utils/style';
import {toTimestamp} from '../utils/date-utils';

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
   * @param {!./fetcher.Fetcher} fetcher
   */
  constructor(deps, fetcher) {
    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;

    /** @private @const {!../model/doc.Doc} */
    this.doc_ = deps.doc();

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ = /** @type {!HTMLIFrameElement} */ (
      createElement(this.doc_.getWin().document, 'iframe', {})
    );
    setImportantStyles(this.iframe_, iframeStyles);
    this.doc_.getBody().appendChild(this.getElement());

    /** @private @type {!boolean} */
    this.everFinishedLog_ = false;

    /**
     * @private @const {!AnalyticsContext}
     */
    this.context_ = new AnalyticsContext();
    this.setStaticContext_();

    /** @private {?Promise<?../components/activities.ActivityIframePort>} */
    this.portPromise_ = null;

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

    // A callback for setting the client timestamp before sending requests.
    /** @private {function():!../proto/api_messages.Timestamp} */
    this.getTimestamp_ = () => {
      return toTimestamp(Date.now());
    };

    // While false, we will buffer logs instead of sending them to the analytics service.
    /** @private {boolean} */
    this.readyForLogging_ = false;

    // Stores log events while we wait to be ready for logging.
    /** @private {!Array<!../api/client-event-manager-api.ClientEvent>}*/
    this.logs_ = [];
  }

  /**
   * Sets ready for logging to true and logs all the client events that were previously buffered.
   */
  setReadyForLogging() {
    this.readyForLogging_ = true;
    for (const event of this.logs_) {
      this.handleClientEvent_(event);
    }
  }

  /**
   * @param {string} transactionId
   */
  setTransactionId(transactionId) {
    const oldTransactionId = this.context_.getTransactionId();
    this.context_.setTransactionId(transactionId);
    if (oldTransactionId != null && oldTransactionId != transactionId) {
      const eventType = AnalyticsEvent.EVENT_NEW_TX_ID;
      const eventParams = new EventParams();
      eventParams.setOldTransactionId(oldTransactionId);
      this.eventManager_.logSwgEvent(
        eventType,
        /* isFromUserAction= */ true,
        eventParams
      );
    }
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
   * @param {string} url
   */
  setUrl(url) {
    this.context_.setUrl(url);
  }

  /**
   * @param {!Array<string>} labels
   */
  addLabels(labels) {
    if (labels && labels.length > 0) {
      const newLabels = [].concat(this.context_.getLabelList());
      for (const label of labels) {
        if (newLabels.indexOf(label) == -1) {
          newLabels.push(label);
        }
      }
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
  setStaticContext_() {
    const context = this.context_;
    // These values should all be available during page load.
    if (
      isExperimentOn(
        this.doc_.getWin(),
        ExperimentFlags.UPDATE_GOOGLE_TRANSACTION_ID
      )
    ) {
      context.setTransactionId(getSwgTransactionId());
    } else {
      context.setTransactionId(getUuid());
    }
    context.setReferringOrigin(parseUrl(this.getReferrer_()).origin);
    context.setClientVersion(`SwG ${INTERNAL_RUNTIME_VERSION}`);
    context.setUrl(getCanonicalUrl(this.doc_));

    const utmParams = parseQueryString(this.getQueryString_());
    const campaign = utmParams['utm_campaign'];
    const medium = utmParams['utm_medium'];
    const source = utmParams['utm_source'];
    if (campaign) {
      context.setUtmCampaign(campaign);
    }
    if (medium) {
      context.setUtmMedium(medium);
    }
    if (source) {
      context.setUtmSource(source);
    }
  }

  /**
   * @return {!Promise<?../components/activities.ActivityIframePort>}
   */
  start() {
    // Only prepare port once.
    if (!this.portPromise_) {
      // Please note that currently openIframe reads the current analytics
      // context and that it may not contain experiments activated late during
      // the publisher's code lifecycle.
      this.addLabels(getOnExperiments(this.doc_.getWin()));
      this.portPromise_ = this.preparePort();
    }

    return this.portPromise_;
  }

  /**
   * @return {!Promise<?../components/activities.ActivityIframePort>}
   */
  async preparePort() {
    // Open iframe.
    let port;
    try {
      port = await this.activityPorts_.openIframe(
        this.iframe_,
        feUrl('/serviceiframe'),
        null,
        true
      );
    } catch (message) {
      // If the port doesn't open register that logging is broken so
      // nothing is just waiting.
      this.loggingBroken_ = true;
      this.afterLogging_(
        createErrorResponse('Could not connect [' + message + ']')
      );
      return null;
    }

    // Register a listener for the logging to code indicate it is
    // finished logging.
    port.on(FinishedLoggingResponse, this.afterLogging_.bind(this));
    await port.whenReady();

    // The publisher should be done setting experiments but runtime
    // will forward them here if they aren't.
    this.addLabels(getOnExperiments(this.doc_.getWin()));

    return port;
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
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @return {!AnalyticsRequest}
   */
  createLogRequest_(event) {
    const meta = new AnalyticsEventMeta();
    meta.setEventOriginator(event.eventOriginator);
    meta.setIsFromUserAction(!!event.isFromUserAction);
    // Update the of the analytics context to the current time.
    // This needs to be current for log analysis.
    this.context_.setClientTimestamp(this.getTimestamp_());
    const request = new AnalyticsRequest();
    request.setEvent(/** @type {!AnalyticsEvent} */ (event.eventType));
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
   * Listens for new events from the events manager and handles logging
   * @param {!../api/client-event-manager-api.ClientEvent} event
   */
  handleClientEvent_(event) {
    //this event is just used to communicate information internally.  It should
    //not be reported to the SwG analytics service.
    if (event.eventType === AnalyticsEvent.EVENT_SUBSCRIPTION_STATE) {
      return;
    }

    // Permission should be asked from a privacy workgroup before this originator
    // can be submitted to the analytics service.  It should most likely be treated
    // as another kind of publisher event here though.
    if (event.eventOriginator === EventOriginator.SHOWCASE_CLIENT) {
      return;
    }

    const blockedByPublisherConfig =
      ClientEventManager.isPublisherEvent(event) &&
      !this.shouldLogPublisherEvents_();
    if (blockedByPublisherConfig) {
      return;
    }

    if (!this.readyForLogging_) {
      // If we're not ready to log events yet,
      // store the event so we can log it later.
      this.logs_.push(event);
      return;
    }

    // Register we sent a log. The port will call this.afterLogging_ when done.
    this.unfinishedLogs_++;

    // Send log.
    this.lastAction_ = this.sendLog_(event);
  }

  /**
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @return {!Promise}
   */
  async sendLog_(event) {
    const port = await this.start();
    const analyticsRequest = this.createLogRequest_(event);
    port.execute(analyticsRequest);
  }

  /**
   * This function is called by the iframe after it sends the log to the server.
   * @param {../proto/api_messages.Message=} message
   */
  afterLogging_(message) {
    const response = /** @type {!FinishedLoggingResponse} */ (message);
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
      this.promiseToLog_ = new Promise((resolve) => {
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
