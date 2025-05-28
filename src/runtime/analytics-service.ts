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

import {ActivityIframePort, ActivityPorts} from '../components/activities';
import {
  AnalyticsContext,
  AnalyticsEvent,
  AnalyticsEventMeta,
  AnalyticsRequest,
  EventOriginator,
  EventParams,
  FinishedLoggingResponse,
  Timestamp,
} from '../proto/api_messages';
import {ClientEvent} from '../api/client-event-manager-api';
import {ClientEventManager} from './client-event-manager';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {INTERNAL_RUNTIME_VERSION} from '../constants';
import {createElement} from '../utils/dom';
import {feUrl} from './services';
import {getCanonicalTag, getCanonicalUrl} from '../utils/url';
import {getOnExperiments} from './experiments';
import {getSwgTransactionId} from '../utils/string';
import {log} from '../utils/log';
import {parseQueryString, parseUrl} from '../utils/url';
import {setImportantStyles} from '../utils/style';
import {toDuration, toTimestamp} from '../utils/date-utils';

const iframeStyles = {
  opacity: '0',
  position: 'absolute',
  top: '-10px',
  left: '-10px',
  height: '1px',
  width: '1px',
};

/**
 * The initial iframe load takes ~500 ms. We will wait at least that long
 * before a page redirect. Subsequent logs are much faster.
 */
const MAX_FIRST_WAIT = 500;

/** We will wait at most 200 ms. */
const MAX_WAIT = 200;

/**
 * If we logged and rapidly redirected, we will add a short delay in case
 * a message hasn't been transmitted yet.
 */
const TIMEOUT_ERROR = 'AnalyticsService timed out waiting for a response';

function createErrorResponse(error: string): FinishedLoggingResponse {
  const response = new FinishedLoggingResponse();
  response.setComplete(false);
  response.setError(error);
  return response;
}

export class AnalyticsService {
  private readonly activityPorts_: ActivityPorts;
  private readonly context_ = new AnalyticsContext();
  private readonly runtimeCreationTimestamp_: Timestamp;
  private readonly doc_: Doc;
  private readonly eventManager_: ClientEventManager;
  private readonly iframe_: HTMLIFrameElement;

  private everFinishedLog_ = false;
  /** If logging doesn't work don't force the user to wait. */
  private loggingBroken_ = false;
  private loggingResolver_: ((success: boolean) => void) | null = null;
  /** Stores log events while we wait to be ready for logging. */
  private logs_: ClientEvent[] = [];
  private portPromise_: Promise<ActivityIframePort | null> | null = null;
  private promiseToLog_: Promise<boolean> | null = null;
  /** While false, we will buffer logs instead of sending them to the analytics service. */
  private readyForLogging_ = false;
  /**
   * If logging exceeds the timeouts (see const comments above) don't make
   * the user wait too long.
   */
  private timeout_: number | null = null;
  /**
   * This code creates a 'promise to log' that we can use to ensure all
   * logging is finished prior to redirecting the page.
   */
  private unfinishedLogs_ = 0;

  lastAction: Promise<void> | null = null;

  constructor(private readonly deps_: Deps) {
    this.runtimeCreationTimestamp_ = toTimestamp(deps_.creationTimestamp());
    this.doc_ = deps_.doc();

    this.activityPorts_ = deps_.activities();

    this.iframe_ = createElement(this.doc_.getWin().document, 'iframe', {});
    setImportantStyles(this.iframe_, iframeStyles);
    this.doc_.getBody()?.appendChild(this.getElement());

    this.setStaticContext_();

    this.eventManager_ = deps_.eventManager();
    this.eventManager_.registerEventListener(
      this.handleClientEvent_.bind(this)
    );
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

  setTransactionId(transactionId: string): void {
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

  getTransactionId(): string | null {
    return this.context_.getTransactionId();
  }

  getSku(): string | null {
    return this.context_.getSku();
  }

  setSku(sku: string): void {
    this.context_.setSku(sku);
  }

  setUrl(url: string): void {
    this.context_.setUrl(url);
  }

  addLabels(labels: string[]): void {
    if (labels && labels.length > 0) {
      const newLabels = ([] as string[]).concat(this.context_.getLabelList()!);
      for (const label of labels) {
        if (newLabels.indexOf(label) == -1) {
          newLabels.push(label);
        }
      }
      this.context_.setLabelList(newLabels);
    }
  }

  getElement(): HTMLIFrameElement {
    return this.iframe_;
  }

  private getQueryString_(): string {
    return this.doc_.getWin().location.search;
  }

  private getReferrer_(): string {
    return this.doc_.getWin().document.referrer;
  }

  private getLoadEventStartDelay_(): number {
    const performanceEntryList = this.getPerformanceEntryList_();
    if (!!performanceEntryList && !!performanceEntryList.length) {
      const timing = performanceEntryList[0] as PerformanceNavigationTiming;
      const eventStartDelay = timing.loadEventStart - timing.unloadEventEnd;
      if (eventStartDelay > 0) {
        return eventStartDelay;
      }
    }
    return 0;
  }

  private getPerformanceEntryList_(): PerformanceEntryList {
    return performance.getEntriesByType('navigation');
  }

  private setStaticContext_(): void {
    const context = this.context_;
    // These values should all be available during page load.
    context.setTransactionId(getSwgTransactionId());
    context.setReferringOrigin(parseUrl(this.getReferrer_()).origin);
    context.setClientVersion(`SwG ${INTERNAL_RUNTIME_VERSION}`);
    context.setUrl(getCanonicalUrl(this.doc_));
    context.setIsLockedContent(this.deps_.pageConfig().isLocked());

    // Default to empty, this is for investigative purposes only
    context.setUrlFromMarkup(getCanonicalTag(this.doc_) || '');

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

  start(): Promise<ActivityIframePort | null> {
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

  async preparePort(): Promise<ActivityIframePort | null> {
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

  setReadyToPay(isReadyToPay: boolean): void {
    this.context_.setReadyToPay(isReadyToPay);
  }

  close(): void {
    this.doc_.getBody()?.removeChild(this.getElement());
  }

  getContext(): AnalyticsContext {
    return this.context_;
  }

  private createLogRequest_(event: ClientEvent): AnalyticsRequest {
    const meta = new AnalyticsEventMeta();
    meta.setEventOriginator(event.eventOriginator);
    meta.setIsFromUserAction(!!event.isFromUserAction);
    if (!!event.configurationId) {
      meta.setConfigurationId(event.configurationId);
    }
    // Update the request's timestamp.
    this.context_.setClientTimestamp(toTimestamp(event.timestamp!));
    const loadEventStartDelay = this.getLoadEventStartDelay_();
    if (loadEventStartDelay > 0) {
      this.context_.setLoadEventStartDelay(toDuration(loadEventStartDelay));
    }
    this.context_.setRuntimeCreationTimestamp(this.runtimeCreationTimestamp_);
    const request = new AnalyticsRequest();
    request.setEvent(event.eventType!);
    request.setContext(this.context_);
    request.setMeta(meta);
    if (event.additionalParameters instanceof EventParams) {
      request.setParams(event.additionalParameters);
    } // Ignore event.additionalParameters.  It may have data we shouldn't log.
    return request;
  }

  private shouldLogPublisherEvents_(): boolean {
    return this.deps_.config().enableSwgAnalytics === true;
  }

  /**
   * Listens for new events from the events manager and handles logging
   */
  private handleClientEvent_(event: ClientEvent): void {
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
    this.lastAction = this.sendLog_(event);
  }

  async sendLog_(event: ClientEvent): Promise<void> {
    const port = await this.start();
    const analyticsRequest = this.createLogRequest_(event);
    port?.execute(analyticsRequest);
  }

  /**
   * This function is called by the iframe after it sends the log to the server.
   */
  afterLogging_(message?: FinishedLoggingResponse): void {
    const success = message?.getComplete() || false;
    const error = message?.getError() || 'Unknown logging Error';
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
   */
  getLoggingPromise(): Promise<boolean | void> {
    if (this.unfinishedLogs_ === 0 || this.loggingBroken_) {
      return Promise.resolve(true);
    }
    if (this.promiseToLog_ === null) {
      this.promiseToLog_ = new Promise<boolean>((resolve) => {
        this.loggingResolver_ = resolve;
      });

      // The promise above should not wait forever if things go wrong.  Let
      // the user proceed!
      this.timeout_ = self.setTimeout(
        () => {
          this.timeout_ = null;
          this.afterLogging_(createErrorResponse(TIMEOUT_ERROR));
        },
        this.everFinishedLog_ ? MAX_WAIT : MAX_FIRST_WAIT
      );
    }

    return this.promiseToLog_;
  }
}
