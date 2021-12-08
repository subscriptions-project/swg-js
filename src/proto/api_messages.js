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
   * @param {boolean=} unusedIncludeLabel
   * @return {!Array<*>}
   */
  toArray(unusedIncludeLabel = true) {}
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
  IMPRESSION_METER_TOAST: 21,
  IMPRESSION_REGWALL: 22,
  IMPRESSION_SHOWCASE_REGWALL: 23,
  IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT: 24,
  IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT: 25,
  IMPRESSION_CONTRIBUTION_OFFERS: 26,
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
  ACTION_USER_CONSENT_DEFERRED_ACCOUNT: 1021,
  ACTION_USER_DENY_DEFERRED_ACCOUNT: 1022,
  ACTION_DEFERRED_ACCOUNT_REDIRECT: 1023,
  ACTION_GET_ENTITLEMENTS: 1024,
  ACTION_METER_TOAST_SUBSCRIBE_CLICK: 1025,
  ACTION_METER_TOAST_EXPANDED: 1026,
  ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION: 1027,
  ACTION_METER_TOAST_CLOSED_BY_SWIPE_DOWN: 1028,
  ACTION_METER_TOAST_CLOSED_BY_X_CLICKED: 1029,
  ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK: 1030,
  ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLICK: 1031,
  ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE: 1032,
  ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE: 1033,
  ACTION_CONTRIBUTION_OFFER_SELECTED: 1034,
  ACTION_SHOWCASE_REGWALL_GSI_CLICK: 1035,
  ACTION_SHOWCASE_REGWALL_EXISTING_ACCOUNT_CLICK: 1036,
  EVENT_PAYMENT_FAILED: 2000,
  EVENT_CUSTOM: 3000,
  EVENT_CONFIRM_TX_ID: 3001,
  EVENT_CHANGED_TX_ID: 3002,
  EVENT_GPAY_NO_TX_ID: 3003,
  EVENT_GPAY_CANNOT_CONFIRM_TX_ID: 3004,
  EVENT_GOOGLE_UPDATED: 3005,
  EVENT_NEW_TX_ID: 3006,
  EVENT_UNLOCKED_BY_SUBSCRIPTION: 3007,
  EVENT_UNLOCKED_BY_METER: 3008,
  EVENT_NO_ENTITLEMENTS: 3009,
  EVENT_HAS_METERING_ENTITLEMENTS: 3010,
  EVENT_OFFERED_METER: 3011,
  EVENT_UNLOCKED_FREE_PAGE: 3012,
  EVENT_INELIGIBLE_PAYWALL: 3013,
  EVENT_UNLOCKED_FOR_CRAWLER: 3014,
  EVENT_SUBSCRIPTION_STATE: 4000,
};
/** @enum {number} */
const EntitlementResult = {
  UNKNOWN_ENTITLEMENT_RESULT: 0,
  UNLOCKED_SUBSCRIBER: 1001,
  UNLOCKED_FREE: 1002,
  UNLOCKED_METER: 1003,
  LOCKED_REGWALL: 2001,
  LOCKED_PAYWALL: 2002,
  INELIGIBLE_PAYWALL: 2003,
};
/** @enum {number} */
const EntitlementSource = {
  UNKNOWN_ENTITLEMENT_SOURCE: 0,
  GOOGLE_SUBSCRIBER_ENTITLEMENT: 1001,
  GOOGLE_SHOWCASE_METERING_SERVICE: 2001,
  PUBLISHER_ENTITLEMENT: 3001,
};
/** @enum {number} */
const EventOriginator = {
  UNKNOWN_CLIENT: 0,
  SWG_CLIENT: 1,
  AMP_CLIENT: 2,
  PROPENSITY_CLIENT: 3,
  SWG_SERVER: 4,
  PUBLISHER_CLIENT: 5,
  SHOWCASE_CLIENT: 6,
};

/**
 * @implements {Message}
 */
class AccountCreationRequest {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?boolean} */
    this.complete_ = data[base] == null ? null : data[base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.complete_, // field 1 - complete
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?boolean} */
    this.subscriberOrMember_ = data[base] == null ? null : data[base];

    /** @private {?boolean} */
    this.linkRequested_ = data[1 + base] == null ? null : data[1 + base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.subscriberOrMember_, // field 1 - subscriber_or_member
        this.linkRequested_, // field 2 - link_requested
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?string} */
    this.embedderOrigin_ = data[base] == null ? null : data[base];

    /** @private {?string} */
    this.transactionId_ = data[1 + base] == null ? null : data[1 + base];

    /** @private {?string} */
    this.referringOrigin_ = data[2 + base] == null ? null : data[2 + base];

    /** @private {?string} */
    this.utmSource_ = data[3 + base] == null ? null : data[3 + base];

    /** @private {?string} */
    this.utmCampaign_ = data[4 + base] == null ? null : data[4 + base];

    /** @private {?string} */
    this.utmMedium_ = data[5 + base] == null ? null : data[5 + base];

    /** @private {?string} */
    this.sku_ = data[6 + base] == null ? null : data[6 + base];

    /** @private {?boolean} */
    this.readyToPay_ = data[7 + base] == null ? null : data[7 + base];

    /** @private {!Array<string>} */
    this.label_ = data[8 + base] || [];

    /** @private {?string} */
    this.clientVersion_ = data[9 + base] == null ? null : data[9 + base];

    /** @private {?string} */
    this.url_ = data[10 + base] == null ? null : data[10 + base];

    /** @private {?Timestamp} */
    this.clientTimestamp_ =
      data[11 + base] == null || data[11 + base] == undefined
        ? null
        : new Timestamp(data[11 + base], includesLabel);
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
   * @return {?string}
   */
  getUrl() {
    return this.url_;
  }

  /**
   * @param {string} value
   */
  setUrl(value) {
    this.url_ = value;
  }

  /**
   * @return {?Timestamp}
   */
  getClientTimestamp() {
    return this.clientTimestamp_;
  }

  /**
   * @param {!Timestamp} value
   */
  setClientTimestamp(value) {
    this.clientTimestamp_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.embedderOrigin_, // field 1 - embedder_origin
        this.transactionId_, // field 2 - transaction_id
        this.referringOrigin_, // field 3 - referring_origin
        this.utmSource_, // field 4 - utm_source
        this.utmCampaign_, // field 5 - utm_campaign
        this.utmMedium_, // field 6 - utm_medium
        this.sku_, // field 7 - sku
        this.readyToPay_, // field 8 - ready_to_pay
        this.label_, // field 9 - label
        this.clientVersion_, // field 10 - client_version
        this.url_, // field 11 - url
        this.clientTimestamp_ ? this.clientTimestamp_.toArray(includeLabel) : [], // field 12 - client_timestamp
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?EventOriginator} */
    this.eventOriginator_ = data[base] == null ? null : data[base];

    /** @private {?boolean} */
    this.isFromUserAction_ = data[1 + base] == null ? null : data[1 + base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.eventOriginator_, // field 1 - event_originator
        this.isFromUserAction_, // field 2 - is_from_user_action
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?AnalyticsContext} */
    this.context_ =
      data[base] == null || data[base] == undefined
        ? null
        : new AnalyticsContext(data[base], includesLabel);

    /** @private {?AnalyticsEvent} */
    this.event_ = data[1 + base] == null ? null : data[1 + base];

    /** @private {?AnalyticsEventMeta} */
    this.meta_ =
      data[2 + base] == null || data[2 + base] == undefined
        ? null
        : new AnalyticsEventMeta(data[2 + base], includesLabel);

    /** @private {?EventParams} */
    this.params_ =
      data[3 + base] == null || data[3 + base] == undefined
        ? null
        : new EventParams(data[3 + base], includesLabel);
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.context_ ? this.context_.toArray(includeLabel) : [], // field 1 - context
        this.event_, // field 2 - event
        this.meta_ ? this.meta_.toArray(includeLabel) : [], // field 3 - meta
        this.params_ ? this.params_.toArray(includeLabel) : [], // field 4 - params
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
class EntitlementJwt {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?string} */
    this.jwt_ = data[base] == null ? null : data[base];

    /** @private {?string} */
    this.source_ = data[1 + base] == null ? null : data[1 + base];
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
   * @return {?string}
   */
  getSource() {
    return this.source_;
  }

  /**
   * @param {string} value
   */
  setSource(value) {
    this.source_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.jwt_, // field 1 - jwt
        this.source_, // field 2 - source
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'EntitlementJwt';
  }
}

/**
 * @implements {Message}
 */
class EntitlementsRequest {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?EntitlementJwt} */
    this.usedEntitlement_ =
      data[base] == null || data[base] == undefined
        ? null
        : new EntitlementJwt(data[base], includesLabel);

    /** @private {?Timestamp} */
    this.clientEventTime_ =
      data[1 + base] == null || data[1 + base] == undefined
        ? null
        : new Timestamp(data[1 + base], includesLabel);

    /** @private {?EntitlementSource} */
    this.entitlementSource_ = data[2 + base] == null ? null : data[2 + base];

    /** @private {?EntitlementResult} */
    this.entitlementResult_ = data[3 + base] == null ? null : data[3 + base];

    /** @private {?string} */
    this.token_ = data[4 + base] == null ? null : data[4 + base];

    /** @private {?boolean} */
    this.isUserRegistered_ = data[5 + base] == null ? null : data[5 + base];
  }

  /**
   * @return {?EntitlementJwt}
   */
  getUsedEntitlement() {
    return this.usedEntitlement_;
  }

  /**
   * @param {!EntitlementJwt} value
   */
  setUsedEntitlement(value) {
    this.usedEntitlement_ = value;
  }

  /**
   * @return {?Timestamp}
   */
  getClientEventTime() {
    return this.clientEventTime_;
  }

  /**
   * @param {!Timestamp} value
   */
  setClientEventTime(value) {
    this.clientEventTime_ = value;
  }

  /**
   * @return {?EntitlementSource}
   */
  getEntitlementSource() {
    return this.entitlementSource_;
  }

  /**
   * @param {!EntitlementSource} value
   */
  setEntitlementSource(value) {
    this.entitlementSource_ = value;
  }

  /**
   * @return {?EntitlementResult}
   */
  getEntitlementResult() {
    return this.entitlementResult_;
  }

  /**
   * @param {!EntitlementResult} value
   */
  setEntitlementResult(value) {
    this.entitlementResult_ = value;
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
   * @return {?boolean}
   */
  getIsUserRegistered() {
    return this.isUserRegistered_;
  }

  /**
   * @param {boolean} value
   */
  setIsUserRegistered(value) {
    this.isUserRegistered_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.usedEntitlement_ ? this.usedEntitlement_.toArray(includeLabel) : [], // field 1 - used_entitlement
        this.clientEventTime_ ? this.clientEventTime_.toArray(includeLabel) : [], // field 2 - client_event_time
        this.entitlementSource_, // field 3 - entitlement_source
        this.entitlementResult_, // field 4 - entitlement_result
        this.token_, // field 5 - token
        this.isUserRegistered_, // field 6 - is_user_registered
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'EntitlementsRequest';
  }
}

/**
 * @implements {Message}
 */
class EntitlementsResponse {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?string} */
    this.jwt_ = data[base] == null ? null : data[base];

    /** @private {?string} */
    this.swgUserToken_ = data[1 + base] == null ? null : data[1 + base];
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
   * @return {?string}
   */
  getSwgUserToken() {
    return this.swgUserToken_;
  }

  /**
   * @param {string} value
   */
  setSwgUserToken(value) {
    this.swgUserToken_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.jwt_, // field 1 - jwt
        this.swgUserToken_, // field 2 - swg_user_token
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?string} */
    this.smartboxMessage_ = data[base] == null ? null : data[base];

    /** @private {?string} */
    this.gpayTransactionId_ = data[1 + base] == null ? null : data[1 + base];

    /** @private {?boolean} */
    this.hadLogged_ = data[2 + base] == null ? null : data[2 + base];

    /** @private {?string} */
    this.sku_ = data[3 + base] == null ? null : data[3 + base];

    /** @private {?string} */
    this.oldTransactionId_ = data[4 + base] == null ? null : data[4 + base];

    /** @private {?boolean} */
    this.isUserRegistered_ = data[5 + base] == null ? null : data[5 + base];

    /** @private {?string} */
    this.subscriptionFlow_ = data[6 + base] == null ? null : data[6 + base];
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
   * @return {?string}
   */
  getOldTransactionId() {
    return this.oldTransactionId_;
  }

  /**
   * @param {string} value
   */
  setOldTransactionId(value) {
    this.oldTransactionId_ = value;
  }

  /**
   * @return {?boolean}
   */
  getIsUserRegistered() {
    return this.isUserRegistered_;
  }

  /**
   * @param {boolean} value
   */
  setIsUserRegistered(value) {
    this.isUserRegistered_ = value;
  }

  /**
   * @return {?string}
   */
  getSubscriptionFlow() {
    return this.subscriptionFlow_;
  }

  /**
   * @param {string} value
   */
  setSubscriptionFlow(value) {
    this.subscriptionFlow_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.smartboxMessage_, // field 1 - smartbox_message
        this.gpayTransactionId_, // field 2 - gpay_transaction_id
        this.hadLogged_, // field 3 - had_logged
        this.sku_, // field 4 - sku
        this.oldTransactionId_, // field 5 - old_transaction_id
        this.isUserRegistered_, // field 6 - is_user_registered
        this.subscriptionFlow_, // field 7 - subscription_flow
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?boolean} */
    this.complete_ = data[base] == null ? null : data[base];

    /** @private {?string} */
    this.error_ = data[1 + base] == null ? null : data[1 + base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.complete_, // field 1 - complete
        this.error_, // field 2 - error
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?string} */
    this.authCode_ = data[base] == null ? null : data[base];

    /** @private {?string} */
    this.token_ = data[1 + base] == null ? null : data[1 + base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.authCode_, // field 1 - auth_code
        this.token_, // field 2 - token
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?boolean} */
    this.requested_ = data[base] == null ? null : data[base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.requested_, // field 1 - requested
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
class OpenDialogRequest {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?string} */
    this.urlPath_ = data[base] == null ? null : data[base];
  }

  /**
   * @return {?string}
   */
  getUrlPath() {
    return this.urlPath_;
  }

  /**
   * @param {string} value
   */
  setUrlPath(value) {
    this.urlPath_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.urlPath_, // field 1 - url_path
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'OpenDialogRequest';
  }
}

/**
 * @implements {Message}
 */
class SkuSelectedResponse {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?string} */
    this.sku_ = data[base] == null ? null : data[base];

    /** @private {?string} */
    this.oldSku_ = data[1 + base] == null ? null : data[1 + base];

    /** @private {?boolean} */
    this.oneTime_ = data[2 + base] == null ? null : data[2 + base];

    /** @private {?string} */
    this.playOffer_ = data[3 + base] == null ? null : data[3 + base];

    /** @private {?string} */
    this.oldPlayOffer_ = data[4 + base] == null ? null : data[4 + base];

    /** @private {?string} */
    this.customMessage_ = data[5 + base] == null ? null : data[5 + base];

    /** @private {?boolean} */
    this.anonymous_ = data[6 + base] == null ? null : data[6 + base];
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
   * @return {?string}
   */
  getCustomMessage() {
    return this.customMessage_;
  }

  /**
   * @param {string} value
   */
  setCustomMessage(value) {
    this.customMessage_ = value;
  }

  /**
   * @return {?boolean}
   */
  getAnonymous() {
    return this.anonymous_;
  }

  /**
   * @param {boolean} value
   */
  setAnonymous(value) {
    this.anonymous_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.sku_, // field 1 - sku
        this.oldSku_, // field 2 - old_sku
        this.oneTime_, // field 3 - one_time
        this.playOffer_, // field 4 - play_offer
        this.oldPlayOffer_, // field 5 - old_play_offer
        this.customMessage_, // field 6 - custom_message
        this.anonymous_, // field 7 - anonymous
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?boolean} */
    this.isClicked_ = data[base] == null ? null : data[base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.isClicked_, // field 1 - is_clicked
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?boolean} */
    this.subscribe_ = data[base] == null ? null : data[base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.subscribe_, // field 1 - subscribe
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
class Timestamp {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?number} */
    this.seconds_ = data[base] == null ? null : data[base];

    /** @private {?number} */
    this.nanos_ = data[1 + base] == null ? null : data[1 + base];
  }

  /**
   * @return {?number}
   */
  getSeconds() {
    return this.seconds_;
  }

  /**
   * @param {number} value
   */
  setSeconds(value) {
    this.seconds_ = value;
  }

  /**
   * @return {?number}
   */
  getNanos() {
    return this.nanos_;
  }

  /**
   * @param {number} value
   */
  setNanos(value) {
    this.nanos_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.seconds_, // field 1 - seconds
        this.nanos_, // field 2 - nanos
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'Timestamp';
  }
}

/**
 * @implements {Message}
 */
class ToastCloseRequest {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?boolean} */
    this.close_ = data[base] == null ? null : data[base];
  }

  /**
   * @return {?boolean}
   */
  getClose() {
    return this.close_;
  }

  /**
   * @param {boolean} value
   */
  setClose(value) {
    this.close_ = value;
  }

  /**
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.close_, // field 1 - close
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  /**
   * @return {string}
   * @override
   */
  label() {
    return 'ToastCloseRequest';
  }
}

/**
 * @implements {Message}
 */
class ViewSubscriptionsResponse {
  /**
   * @param {!Array<*>=} data
   * @param {boolean=} includesLabel
   */
  constructor(data = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    /** @private {?boolean} */
    this.native_ = data[base] == null ? null : data[base];
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
   * @param {boolean=} includeLabel
   * @return {!Array<?>}
   * @override
   */
  toArray(includeLabel = true) {
    const arr = [
        this.native_, // field 1 - native
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
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
  'EntitlementJwt': EntitlementJwt,
  'EntitlementsRequest': EntitlementsRequest,
  'EntitlementsResponse': EntitlementsResponse,
  'EventParams': EventParams,
  'FinishedLoggingResponse': FinishedLoggingResponse,
  'LinkSaveTokenRequest': LinkSaveTokenRequest,
  'LinkingInfoResponse': LinkingInfoResponse,
  'OpenDialogRequest': OpenDialogRequest,
  'SkuSelectedResponse': SkuSelectedResponse,
  'SmartBoxMessage': SmartBoxMessage,
  'SubscribeResponse': SubscribeResponse,
  'Timestamp': Timestamp,
  'ToastCloseRequest': ToastCloseRequest,
  'ViewSubscriptionsResponse': ViewSubscriptionsResponse,
};

/**
 * Utility to deserialize a buffer
 * @param {!Array<*>} data
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
  AudienceActivityClientLogsRequest,
  EntitlementJwt,
  EntitlementResult,
  EntitlementSource,
  EntitlementsRequest,
  EntitlementsResponse,
  EventOriginator,
  EventParams,
  FinishedLoggingResponse,
  LinkSaveTokenRequest,
  LinkingInfoResponse,
  Message,
  OpenDialogRequest,
  SkuSelectedResponse,
  SmartBoxMessage,
  SubscribeResponse,
  Timestamp,
  ToastCloseRequest,
  ViewSubscriptionsResponse,
  deserialize,
  getLabel,
};
