
/**
 * @fileoverview Description of this file.
 */

 import {
    AnalyticsEvent,
    AudienceActivityClientLogsRequest,
  } from '../proto/api_messages';
  import {serviceUrl} from './services';
  import {Storage} from './storage';
  import {Constants} from '../utils/constants';

 export class AudienceActivityEventListener {
    /**
     * @param {!./deps.DepsDef} deps
     * @param {!./fetcher.Fetcher} fetcher
     */
    constructor(deps, fetcher) {
      /** @private @const {!Window} */
      this.win_ = deps.win();

      /** @private @const {!./deps.DepsDef} */
      this.deps_ = deps;
  
      /** @private @const {!./client-event-manager.ClientEventManager} */
      this.eventManager_ = deps.eventManager();

      /** @private @const {!./fetcher.Fetcher} */
      this.fetcher_ = fetcher;

      /** @private @const {!Storage} */
      this.storage_ = new Storage(this.win_);
    }
  
    /**
     * Start listening to client events
     */
    start() {
      this.eventManager_.registerEventListener(
        this.handleClientEvent_.bind(this)
      );
    }
  
    /**
     *  Listens for new events from the events manager and logs appropriate events to Google Analytics.
     * @param {!../api/client-event-manager-api.ClientEvent} event
     */
    handleClientEvent_(event) {
      const audienceActivityLoggingEvents = [AnalyticsEvent.IMPRESSION_PAGE_LOAD, AnalyticsEvent.IMPRESSION_PAYWALL, AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED, AnalyticsEvent.ACTION_CONTRIBUTION_OFFER_SELECTED];
      if (audienceActivityLoggingEvents.includes(event.eventType)) {
        const pubId = encodeURIComponent(this.deps_.pageConfig().getPublicationId());
        const audienceActivityClientLogsRequest = this.createLogRequest(event);
        const url = serviceUrl('/publication/' + pubId + '/audienceactivitylogs');
        this.fetcher_.sendBeacon(url, audienceActivityClientLogsRequest);
     }
   }

   /**
   * @param {!../api/client-event-manager-api.ClientEvent} event
   * @return {!AudienceActivityLogRequest}
   */
   createLogRequest(event) {
      const request = new AudienceActivityClientLogsRequest();
      request.setEvent(/** @type {!AnalyticsEvent} */ (event.eventType));
      return request;
  }
  
  
  }
  
  
  