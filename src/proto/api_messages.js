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
/**
 * @interface
 */
class Message {
  /**
   * @return {string}
   */
  label() {}

  /**
   * @return {!Array}
   */
  toArray() {}
}

/** @enum {number} */
const AnalyticsEvent = {
  UNKNOWN: 0,
  IMPRESSION_PAYWALL: 1,
  IMPRESSION_AD: 2,
  IMPRESSION_OFFERS: 3,
  IMPRESSION_SUBSCRIBE_BUTTON: 4,
  IMPRESSION_SMARTBOX: 5,
  IMPRESSION_SWG_BUTTON: 6,
  IMPRESSION_CLICK_TO_SHOW_OFFERS: 7,
  IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED: 8,
  IMPRESSION_SUBSCRIPTION_COMPLETE: 9,
  IMPRESSION_ACCOUNT_CHANGED: 10,
  IMPRESSION_PAGE_LOAD: 11,
  IMPRESSION_LINK: 12,
  IMPRESSION_SAVE_SUBSCR_TO_GOOGLE: 13,
  IMPRESSION_GOOGLE_UPDATED: 14,
  IMPRESSION_SHOW_OFFERS_SMARTBOX: 15,
  IMPRESSION_SHOW_OFFERS_SWG_BUTTON: 16,
  IMPRESSION_SELECT_OFFER_SMARTBOX: 17,
  IMPRESSION_SELECT_OFFER_SWG_BUTTON: 18,
  IMPRESSION_SHOW_CONTRIBUTIONS_SWG_BUTTON: 19,
  IMPRESSION_SELECT_CONTRIBUTION_SWG_BUTTON: 20,
  ACTION_SUBSCRIBE: 1000,
  ACTION_PAYMENT_COMPLETE: 1001,
  ACTION_ACCOUNT_CREATED: 1002,
  ACTION_ACCOUNT_ACKNOWLEDGED: 1003,
  ACTION_SUBSCRIPTIONS_LANDING_PAGE: 1004,
  ACTION_PAYMENT_FLOW_STARTED: 1005,
  ACTION_OFFER_SELECTED: 1006,
  ACTION_SWG_BUTTON_CLICK: 1007,
  ACTION_VIEW_OFFERS: 1008,
  ACTION_ALREADY_SUBSCRIBED: 1009,
  ACTION_NEW_DEFERRED_ACCOUNT: 1010,
  ACTION_LINK_CONTINUE: 1011,
  ACTION_LINK_CANCEL: 1012,
  ACTION_GOOGLE_UPDATED_CLOSE: 1013,
  ACTION_USER_CANCELED_PAYFLOW: 1014,
  ACTION_SAVE_SUBSCR_TO_GOOGLE_CONTINUE: 1015,
  ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL: 1016,
  ACTION_SWG_BUTTON_SHOW_OFFERS_CLICK: 1017,
  ACTION_SWG_BUTTON_SELECT_OFFER_CLICK: 1018,
  ACTION_SWG_BUTTON_SHOW_CONTRIBUTIONS_CLICK: 1019,
  ACTION_SWG_BUTTON_SELECT_CONTRIBUTION_CLICK: 1020,
  EVENT_PAYMENT_FAILED: 2000,
  EVENT_CUSTOM: 3000,
  EVENT_CONFIRM_TX_ID: 3001,
  EVENT_CHANGED_TX_ID: 3002,
  EVENT_GPAY_NO_TX_ID: 3003,
  EVENT_GPAY_CANNOT_CONFIRM_TX_ID: 3004,
  EVENT_GOOGLE_UPDATED: 3005,
  EVENT_SUBSCRIPTION_STATE: 4000,
};
/** @enum {number} */
const EventOriginator = {
  UNKNOWN_CLIENT: 0,
  SWG_CLIENT: 1,
  AMP_CLIENT: 2,
  PROPENSITY_CLIENT: 3,
  SWG_SERVER: 4,
  PUBLISHER_CLIENT: 5,
};

/**
 * @implements {Message}
 */
class AccountCreationRequest {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?boolean} */
    this.complete_ = (data[1] == null) ? null : data[1];
  }

  /**
   * @return {?boolean}
   */
  getComplete() {
    return this.complete_;
  }

  /**
   * @param {boolean} value
   */
  setComplete(value) {
    this.complete_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.complete_,  // field 1 - complete
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'AccountCreationRequest';
  }
}

/**
 * @implements {Message}
 */
class AlreadySubscribedResponse {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?boolean} */
    this.subscriberOrMember_ = (data[1] == null) ? null : data[1];

    /** @private {?boolean} */
    this.linkRequested_ = (data[2] == null) ? null : data[2];
  }

  /**
   * @return {?boolean}
   */
  getSubscriberOrMember() {
    return this.subscriberOrMember_;
  }

  /**
   * @param {boolean} value
   */
  setSubscriberOrMember(value) {
    this.subscriberOrMember_ = value;
  }

  /**
   * @return {?boolean}
   */
  getLinkRequested() {
    return this.linkRequested_;
  }

  /**
   * @param {boolean} value
   */
  setLinkRequested(value) {
    this.linkRequested_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.subscriberOrMember_,  // field 1 - subscriber_or_member
      this.linkRequested_,  // field 2 - link_requested
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'AlreadySubscribedResponse';
  }
}

/**
 * @implements {Message}
 */
class AnalyticsContext {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?string} */
    this.embedderOrigin_ = (data[1] == null) ? null : data[1];

    /** @private {?string} */
    this.transactionId_ = (data[2] == null) ? null : data[2];

    /** @private {?string} */
    this.referringOrigin_ = (data[3] == null) ? null : data[3];

    /** @private {?string} */
    this.utmSource_ = (data[4] == null) ? null : data[4];

    /** @private {?string} */
    this.utmCampaign_ = (data[5] == null) ? null : data[5];

    /** @private {?string} */
    this.utmMedium_ = (data[6] == null) ? null : data[6];

    /** @private {?string} */
    this.sku_ = (data[7] == null) ? null : data[7];

    /** @private {?boolean} */
    this.readyToPay_ = (data[8] == null) ? null : data[8];

    /** @private {!Array<string>} */
    this.label_ = data[9] || [];

    /** @private {?string} */
    this.clientVersion_ = (data[10] == null) ? null : data[10];
  }

  /**
   * @return {?string}
   */
  getEmbedderOrigin() {
    return this.embedderOrigin_;
  }

  /**
   * @param {string} value
   */
  setEmbedderOrigin(value) {
    this.embedderOrigin_ = value;
  }

  /**
   * @return {?string}
   */
  getTransactionId() {
    return this.transactionId_;
  }

  /**
   * @param {string} value
   */
  setTransactionId(value) {
    this.transactionId_ = value;
  }

  /**
   * @return {?string}
   */
  getReferringOrigin() {
    return this.referringOrigin_;
  }

  /**
   * @param {string} value
   */
  setReferringOrigin(value) {
    this.referringOrigin_ = value;
  }

  /**
   * @return {?string}
   */
  getUtmSource() {
    return this.utmSource_;
  }

  /**
   * @param {string} value
   */
  setUtmSource(value) {
    this.utmSource_ = value;
  }

  /**
   * @return {?string}
   */
  getUtmCampaign() {
    return this.utmCampaign_;
  }

  /**
   * @param {string} value
   */
  setUtmCampaign(value) {
    this.utmCampaign_ = value;
  }

  /**
   * @return {?string}
   */
  getUtmMedium() {
    return this.utmMedium_;
  }

  /**
   * @param {string} value
   */
  setUtmMedium(value) {
    this.utmMedium_ = value;
  }

  /**
   * @return {?string}
   */
  getSku() {
    return this.sku_;
  }

  /**
   * @param {string} value
   */
  setSku(value) {
    this.sku_ = value;
  }

  /**
   * @return {?boolean}
   */
  getReadyToPay() {
    return this.readyToPay_;
  }

  /**
   * @param {boolean} value
   */
  setReadyToPay(value) {
    this.readyToPay_ = value;
  }

  /**
   * @return {!Array<string>}
   */
  getLabelList() {
    return this.label_;
  }

  /**
   * @param {!Array<string>} value
   */
  setLabelList(value) {
    this.label_ = value;
  }

  /**
   * @return {?string}
   */
  getClientVersion() {
    return this.clientVersion_;
  }

  /**
   * @param {string} value
   */
  setClientVersion(value) {
    this.clientVersion_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.embedderOrigin_,  // field 1 - embedder_origin
      this.transactionId_,  // field 2 - transaction_id
      this.referringOrigin_,  // field 3 - referring_origin
      this.utmSource_,  // field 4 - utm_source
      this.utmCampaign_,  // field 5 - utm_campaign
      this.utmMedium_,  // field 6 - utm_medium
      this.sku_,  // field 7 - sku
      this.readyToPay_,  // field 8 - ready_to_pay
      this.label_,  // field 9 - label
      this.clientVersion_,  // field 10 - client_version
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'AnalyticsContext';
  }
}

/**
 * @implements {Message}
 */
class AnalyticsEventMeta {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?EventOriginator} */
    this.eventOriginator_ = (data[1] == null) ? null : data[1];

    /** @private {?boolean} */
    this.isFromUserAction_ = (data[2] == null) ? null : data[2];
  }

  /**
   * @return {?EventOriginator}
   */
  getEventOriginator() {
    return this.eventOriginator_;
  }

  /**
   * @param {!EventOriginator} value
   */
  setEventOriginator(value) {
    this.eventOriginator_ = value;
  }

  /**
   * @return {?boolean}
   */
  getIsFromUserAction() {
    return this.isFromUserAction_;
  }

  /**
   * @param {boolean} value
   */
  setIsFromUserAction(value) {
    this.isFromUserAction_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.eventOriginator_,  // field 1 - event_originator
      this.isFromUserAction_,  // field 2 - is_from_user_action
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'AnalyticsEventMeta';
  }
}

/**
 * @implements {Message}
 */
class AnalyticsRequest {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?AnalyticsContext} */
    this.context_ = (data[1] == null || data[1] == undefined) ? null : new
        AnalyticsContext(data[1]);

    /** @private {?AnalyticsEvent} */
    this.event_ = (data[2] == null) ? null : data[2];

    /** @private {?AnalyticsEventMeta} */
    this.meta_ = (data[3] == null || data[3] == undefined) ? null : new
        AnalyticsEventMeta(data[3]);

    /** @private {?EventParams} */
    this.params_ = (data[4] == null || data[4] == undefined) ? null : new
        EventParams(data[4]);
  }

  /**
   * @return {?AnalyticsContext}
   */
  getContext() {
    return this.context_;
  }

  /**
   * @param {!AnalyticsContext} value
   */
  setContext(value) {
    this.context_ = value;
  }

  /**
   * @return {?AnalyticsEvent}
   */
  getEvent() {
    return this.event_;
  }

  /**
   * @param {!AnalyticsEvent} value
   */
  setEvent(value) {
    this.event_ = value;
  }

  /**
   * @return {?AnalyticsEventMeta}
   */
  getMeta() {
    return this.meta_;
  }

  /**
   * @param {!AnalyticsEventMeta} value
   */
  setMeta(value) {
    this.meta_ = value;
  }

  /**
   * @return {?EventParams}
   */
  getParams() {
    return this.params_;
  }

  /**
   * @param {!EventParams} value
   */
  setParams(value) {
    this.params_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.context_ ? this.context_.toArray() : [], // field 1 - context
      this.event_,  // field 2 - event
      this.meta_ ? this.meta_.toArray() : [], // field 3 - meta
      this.params_ ? this.params_.toArray() : [], // field 4 - params
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'AnalyticsRequest';
  }
}

/**
 * @implements {Message}
 */
class EntitlementsResponse {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?string} */
    this.jwt_ = (data[1] == null) ? null : data[1];
  }

  /**
   * @return {?string}
   */
  getJwt() {
    return this.jwt_;
  }

  /**
   * @param {string} value
   */
  setJwt(value) {
    this.jwt_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.jwt_,  // field 1 - jwt
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'EntitlementsResponse';
  }
}

/**
 * @implements {Message}
 */
class EventParams {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?string} */
    this.smartboxMessage_ = (data[1] == null) ? null : data[1];

    /** @private {?string} */
    this.gpayTransactionId_ = (data[2] == null) ? null : data[2];

    /** @private {?boolean} */
    this.hadLogged_ = (data[3] == null) ? null : data[3];

    /** @private {?string} */
    this.sku_ = (data[4] == null) ? null : data[4];
  }

  /**
   * @return {?string}
   */
  getSmartboxMessage() {
    return this.smartboxMessage_;
  }

  /**
   * @param {string} value
   */
  setSmartboxMessage(value) {
    this.smartboxMessage_ = value;
  }

  /**
   * @return {?string}
   */
  getGpayTransactionId() {
    return this.gpayTransactionId_;
  }

  /**
   * @param {string} value
   */
  setGpayTransactionId(value) {
    this.gpayTransactionId_ = value;
  }

  /**
   * @return {?boolean}
   */
  getHadLogged() {
    return this.hadLogged_;
  }

  /**
   * @param {boolean} value
   */
  setHadLogged(value) {
    this.hadLogged_ = value;
  }

  /**
   * @return {?string}
   */
  getSku() {
    return this.sku_;
  }

  /**
   * @param {string} value
   */
  setSku(value) {
    this.sku_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.smartboxMessage_,  // field 1 - smartbox_message
      this.gpayTransactionId_,  // field 2 - gpay_transaction_id
      this.hadLogged_,  // field 3 - had_logged
      this.sku_,  // field 4 - sku
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'EventParams';
  }
}

/**
 * @implements {Message}
 */
class FinishedLoggingResponse {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?boolean} */
    this.complete_ = (data[1] == null) ? null : data[1];

    /** @private {?string} */
    this.error_ = (data[2] == null) ? null : data[2];
  }

  /**
   * @return {?boolean}
   */
  getComplete() {
    return this.complete_;
  }

  /**
   * @param {boolean} value
   */
  setComplete(value) {
    this.complete_ = value;
  }

  /**
   * @return {?string}
   */
  getError() {
    return this.error_;
  }

  /**
   * @param {string} value
   */
  setError(value) {
    this.error_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.complete_,  // field 1 - complete
      this.error_,  // field 2 - error
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'FinishedLoggingResponse';
  }
}

/**
 * @implements {Message}
 */
class LinkSaveTokenRequest {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?string} */
    this.authCode_ = (data[1] == null) ? null : data[1];

    /** @private {?string} */
    this.token_ = (data[2] == null) ? null : data[2];
  }

  /**
   * @return {?string}
   */
  getAuthCode() {
    return this.authCode_;
  }

  /**
   * @param {string} value
   */
  setAuthCode(value) {
    this.authCode_ = value;
  }

  /**
   * @return {?string}
   */
  getToken() {
    return this.token_;
  }

  /**
   * @param {string} value
   */
  setToken(value) {
    this.token_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.authCode_,  // field 1 - auth_code
      this.token_,  // field 2 - token
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'LinkSaveTokenRequest';
  }
}

/**
 * @implements {Message}
 */
class LinkingInfoResponse {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?boolean} */
    this.requested_ = (data[1] == null) ? null : data[1];
  }

  /**
   * @return {?boolean}
   */
  getRequested() {
    return this.requested_;
  }

  /**
   * @param {boolean} value
   */
  setRequested(value) {
    this.requested_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.requested_,  // field 1 - requested
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'LinkingInfoResponse';
  }
}

/**
 * @implements {Message}
 */
class SkuSelectedResponse {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?string} */
    this.sku_ = (data[1] == null) ? null : data[1];

    /** @private {?string} */
    this.oldSku_ = (data[2] == null) ? null : data[2];

    /** @private {?boolean} */
    this.oneTime_ = (data[3] == null) ? null : data[3];

    /** @private {?string} */
    this.playOffer_ = (data[4] == null) ? null : data[4];

    /** @private {?string} */
    this.oldPlayOffer_ = (data[5] == null) ? null : data[5];
  }

  /**
   * @return {?string}
   */
  getSku() {
    return this.sku_;
  }

  /**
   * @param {string} value
   */
  setSku(value) {
    this.sku_ = value;
  }

  /**
   * @return {?string}
   */
  getOldSku() {
    return this.oldSku_;
  }

  /**
   * @param {string} value
   */
  setOldSku(value) {
    this.oldSku_ = value;
  }

  /**
   * @return {?boolean}
   */
  getOneTime() {
    return this.oneTime_;
  }

  /**
   * @param {boolean} value
   */
  setOneTime(value) {
    this.oneTime_ = value;
  }

  /**
   * @return {?string}
   */
  getPlayOffer() {
    return this.playOffer_;
  }

  /**
   * @param {string} value
   */
  setPlayOffer(value) {
    this.playOffer_ = value;
  }

  /**
   * @return {?string}
   */
  getOldPlayOffer() {
    return this.oldPlayOffer_;
  }

  /**
   * @param {string} value
   */
  setOldPlayOffer(value) {
    this.oldPlayOffer_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.sku_,  // field 1 - sku
      this.oldSku_,  // field 2 - old_sku
      this.oneTime_,  // field 3 - one_time
      this.playOffer_,  // field 4 - play_offer
      this.oldPlayOffer_,  // field 5 - old_play_offer
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'SkuSelectedResponse';
  }
}

/**
 * @implements {Message}
 */
class SmartBoxMessage {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?boolean} */
    this.isClicked_ = (data[1] == null) ? null : data[1];
  }

  /**
   * @return {?boolean}
   */
  getIsClicked() {
    return this.isClicked_;
  }

  /**
   * @param {boolean} value
   */
  setIsClicked(value) {
    this.isClicked_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.isClicked_,  // field 1 - is_clicked
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'SmartBoxMessage';
  }
}

/**
 * @implements {Message}
 */
class SubscribeResponse {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?boolean} */
    this.subscribe_ = (data[1] == null) ? null : data[1];
  }

  /**
   * @return {?boolean}
   */
  getSubscribe() {
    return this.subscribe_;
  }

  /**
   * @param {boolean} value
   */
  setSubscribe(value) {
    this.subscribe_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.subscribe_,  // field 1 - subscribe
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'SubscribeResponse';
  }
}

/**
 * @implements {Message}
 */
class ViewSubscriptionsResponse {
 /**
  * @param {!Array=} data
  */
  constructor(data = []) {

    /** @private {?boolean} */
    this.native_ = (data[1] == null) ? null : data[1];
  }

  /**
   * @return {?boolean}
   */
  getNative() {
    return this.native_;
  }

  /**
   * @param {boolean} value
   */
  setNative(value) {
    this.native_ = value;
  }

  /**
   * @return {!Array}
   * @override
   */
  toArray() {
    return [
      this.label(),  // message label
      this.native_,  // field 1 - native
    ];
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'ViewSubscriptionsResponse';
  }
}

const PROTO_MAP = {
  'AccountCreationRequest': AccountCreationRequest,
  'AlreadySubscribedResponse': AlreadySubscribedResponse,
  'AnalyticsContext': AnalyticsContext,
  'AnalyticsEventMeta': AnalyticsEventMeta,
  'AnalyticsRequest': AnalyticsRequest,
  'EntitlementsResponse': EntitlementsResponse,
  'EventParams': EventParams,
  'FinishedLoggingResponse': FinishedLoggingResponse,
  'LinkSaveTokenRequest': LinkSaveTokenRequest,
  'LinkingInfoResponse': LinkingInfoResponse,
  'SkuSelectedResponse': SkuSelectedResponse,
  'SmartBoxMessage': SmartBoxMessage,
  'SubscribeResponse': SubscribeResponse,
  'ViewSubscriptionsResponse': ViewSubscriptionsResponse,
};

/**
 * Utility to deserialize a buffer
 * @param {!Array} data
 * @return {!Message}
 */
function deserialize(data) {
  /** {?string} */
  const key = data ? data[0] : null;
  if (key) {
    const ctor = PROTO_MAP[key];
    if (ctor) {
      return new ctor(data);
    }
  }
  throw new Error('Deserialization failed for ' + data);
}

/**
 * @param {function(new: T)} messageType
 * @return {string}
 * @template T
 */
function getLabel(messageType) {
  const message = /** @type {!Message} */ (new messageType());
  return message.label();
}

export {
  AccountCreationRequest,
  AlreadySubscribedResponse,
  AnalyticsContext,
  AnalyticsEvent,
  AnalyticsEventMeta,
  AnalyticsRequest,
  EntitlementsResponse,
  EventOriginator,
  EventParams,
  FinishedLoggingResponse,
  LinkSaveTokenRequest,
  LinkingInfoResponse,
  Message,
  SkuSelectedResponse,
  SmartBoxMessage,
  SubscribeResponse,
  ViewSubscriptionsResponse,
  deserialize,
  getLabel,
};

