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
 * @fileoverview Protos for SwG client/iframe messaging
 * Auto generated, do not edit
 */

/* tslint:disable:enforce-name-casing */
/* tslint:disable:strip-private-property-underscore */

// clang-format off

/** Carries information relating to RRM. */
export interface Message {
  label(): string;

  toArray(includeLabel?: boolean): unknown[];
}

/** Constructor for a message that carries information relating to RRM. */
interface MessageConstructor {
  new (data?: unknown[], includesLabel?: boolean): Message;
}

/** */
export enum ActionType {
  ACTION_TYPE_UNKNOWN = 0,
  ACTION_TYPE_RELOAD_PAGE = 1,
  ACTION_TYPE_UPDATE_COUNTER = 2,
}

/** */
export enum AnalyticsEvent {
  UNKNOWN = 0,
  IMPRESSION_PAYWALL = 1,
  IMPRESSION_AD = 2,
  IMPRESSION_OFFERS = 3,
  IMPRESSION_SUBSCRIBE_BUTTON = 4,
  IMPRESSION_SMARTBOX = 5,
  IMPRESSION_SWG_BUTTON = 6,
  IMPRESSION_CLICK_TO_SHOW_OFFERS = 7,
  IMPRESSION_CLICK_TO_SHOW_OFFERS_OR_ALREADY_SUBSCRIBED = 8,
  IMPRESSION_SUBSCRIPTION_COMPLETE = 9,
  IMPRESSION_ACCOUNT_CHANGED = 10,
  IMPRESSION_PAGE_LOAD = 11,
  IMPRESSION_LINK = 12,
  IMPRESSION_SAVE_SUBSCR_TO_GOOGLE = 13,
  IMPRESSION_GOOGLE_UPDATED = 14,
  IMPRESSION_SHOW_OFFERS_SMARTBOX = 15,
  IMPRESSION_SHOW_OFFERS_SWG_BUTTON = 16,
  IMPRESSION_SELECT_OFFER_SMARTBOX = 17,
  IMPRESSION_SELECT_OFFER_SWG_BUTTON = 18,
  IMPRESSION_SHOW_CONTRIBUTIONS_SWG_BUTTON = 19,
  IMPRESSION_SELECT_CONTRIBUTION_SWG_BUTTON = 20,
  IMPRESSION_METER_TOAST = 21,
  IMPRESSION_REGWALL = 22,
  IMPRESSION_SHOWCASE_REGWALL = 23,
  IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT = 24,
  IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT = 25,
  IMPRESSION_CONTRIBUTION_OFFERS = 26,
  IMPRESSION_TWG_COUNTER = 27,
  IMPRESSION_TWG_SITE_SUPPORTER_WALL = 28,
  IMPRESSION_TWG_PUBLICATION = 29,
  IMPRESSION_TWG_STATIC_BUTTON = 30,
  IMPRESSION_TWG_DYNAMIC_BUTTON = 31,
  IMPRESSION_TWG_STICKER_SELECTION_SCREEN = 32,
  IMPRESSION_TWG_PUBLICATION_NOT_SET_UP = 33,
  IMPRESSION_REGWALL_OPT_IN = 34,
  IMPRESSION_NEWSLETTER_OPT_IN = 35,
  IMPRESSION_SUBSCRIPTION_OFFERS_ERROR = 36,
  IMPRESSION_CONTRIBUTION_OFFERS_ERROR = 37,
  IMPRESSION_TWG_SHORTENED_STICKER_FLOW = 38,
  IMPRESSION_SUBSCRIPTION_LINKING_LOADING = 39,
  IMPRESSION_SUBSCRIPTION_LINKING_COMPLETE = 40,
  IMPRESSION_SUBSCRIPTION_LINKING_ERROR = 41,
  IMPRESSION_SURVEY = 42,
  IMPRESSION_REGWALL_ERROR = 43,
  IMPRESSION_NEWSLETTER_ERROR = 44,
  IMPRESSION_SURVEY_ERROR = 45,
  IMPRESSION_METER_TOAST_ERROR = 46,
  IMPRESSION_MINI_PROMPT = 47,
  IMPRESSION_MINI_PROMPT_ERROR = 48,
  IMPRESSION_REWARDED_AD = 49,
  IMPRESSION_BYOP_NEWSLETTER_OPT_IN = 50,
  IMPRESSION_REWARDED_AD_ERROR = 51,
  IMPRESSION_HOSTED_PAGE_SUBSCRIPTION_OFFERS = 52,
  IMPRESSION_HOSTED_PAGE_CONTRIBUTION_OFFERS = 53,
  IMPRESSION_HOSTED_PAGE_SUBSCRIPTION_OFFERS_ERROR = 54,
  IMPRESSION_HOSTED_PAGE_CONTRIBUTION_OFFERS_ERROR = 55,
  IMPRESSION_BYO_CTA = 56,
  IMPRESSION_BYO_CTA_ERROR = 57,
  ACTION_SUBSCRIBE = 1000,
  ACTION_PAYMENT_COMPLETE = 1001,
  ACTION_ACCOUNT_CREATED = 1002,
  ACTION_ACCOUNT_ACKNOWLEDGED = 1003,
  ACTION_SUBSCRIPTIONS_LANDING_PAGE = 1004,
  ACTION_PAYMENT_FLOW_STARTED = 1005,
  ACTION_OFFER_SELECTED = 1006,
  ACTION_SWG_BUTTON_CLICK = 1007,
  ACTION_VIEW_OFFERS = 1008,
  ACTION_ALREADY_SUBSCRIBED = 1009,
  ACTION_NEW_DEFERRED_ACCOUNT = 1010,
  ACTION_LINK_CONTINUE = 1011,
  ACTION_LINK_CANCEL = 1012,
  ACTION_GOOGLE_UPDATED_CLOSE = 1013,
  ACTION_USER_CANCELED_PAYFLOW = 1014,
  ACTION_SAVE_SUBSCR_TO_GOOGLE_CONTINUE = 1015,
  ACTION_SAVE_SUBSCR_TO_GOOGLE_CANCEL = 1016,
  ACTION_SWG_BUTTON_SHOW_OFFERS_CLICK = 1017,
  ACTION_SWG_BUTTON_SELECT_OFFER_CLICK = 1018,
  ACTION_SWG_BUTTON_SHOW_CONTRIBUTIONS_CLICK = 1019,
  ACTION_SWG_BUTTON_SELECT_CONTRIBUTION_CLICK = 1020,
  ACTION_USER_CONSENT_DEFERRED_ACCOUNT = 1021,
  ACTION_USER_DENY_DEFERRED_ACCOUNT = 1022,
  ACTION_DEFERRED_ACCOUNT_REDIRECT = 1023,
  ACTION_GET_ENTITLEMENTS = 1024,
  ACTION_METER_TOAST_SUBSCRIBE_CLICK = 1025,
  ACTION_METER_TOAST_EXPANDED = 1026,
  ACTION_METER_TOAST_CLOSED_BY_ARTICLE_INTERACTION = 1027,
  ACTION_METER_TOAST_CLOSED_BY_SWIPE_DOWN = 1028,
  ACTION_METER_TOAST_CLOSED_BY_X_CLICKED = 1029,
  ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK = 1030,
  ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLICK = 1031,
  ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE = 1032,
  ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE = 1033,
  ACTION_CONTRIBUTION_OFFER_SELECTED = 1034,
  ACTION_SHOWCASE_REGWALL_GSI_CLICK = 1035,
  ACTION_SHOWCASE_REGWALL_EXISTING_ACCOUNT_CLICK = 1036,
  ACTION_SUBSCRIPTION_OFFERS_CLOSED = 1037,
  ACTION_CONTRIBUTION_OFFERS_CLOSED = 1038,
  ACTION_TWG_STATIC_CTA_CLICK = 1039,
  ACTION_TWG_DYNAMIC_CTA_CLICK = 1040,
  ACTION_TWG_SITE_LEVEL_SUPPORTER_WALL_CTA_CLICK = 1041,
  ACTION_TWG_DIALOG_SUPPORTER_WALL_CTA_CLICK = 1042,
  ACTION_TWG_COUNTER_CLICK = 1043,
  ACTION_TWG_SITE_SUPPORTER_WALL_ALL_THANKS_CLICK = 1044,
  ACTION_TWG_PAID_STICKER_SELECTED_SCREEN_CLOSE_CLICK = 1045,
  ACTION_TWG_PAID_STICKER_SELECTION_CLICK = 1046,
  ACTION_TWG_FREE_STICKER_SELECTION_CLICK = 1047,
  ACTION_TWG_MINI_SUPPORTER_WALL_CLICK = 1048,
  ACTION_TWG_CREATOR_BENEFIT_CLICK = 1049,
  ACTION_TWG_FREE_TRANSACTION_START_NEXT_BUTTON_CLICK = 1050,
  ACTION_TWG_PAID_TRANSACTION_START_NEXT_BUTTON_CLICK = 1051,
  ACTION_TWG_STICKER_SELECTION_SCREEN_CLOSE_CLICK = 1052,
  ACTION_TWG_ARTICLE_LEVEL_SUPPORTER_WALL_CTA_CLICK = 1053,
  ACTION_REGWALL_OPT_IN_BUTTON_CLICK = 1054,
  ACTION_REGWALL_ALREADY_OPTED_IN_CLICK = 1055,
  ACTION_NEWSLETTER_OPT_IN_BUTTON_CLICK = 1056,
  ACTION_NEWSLETTER_ALREADY_OPTED_IN_CLICK = 1057,
  ACTION_REGWALL_OPT_IN_CLOSE = 1058,
  ACTION_NEWSLETTER_OPT_IN_CLOSE = 1059,
  ACTION_SHOWCASE_REGWALL_SIWG_CLICK = 1060,
  ACTION_TWG_CHROME_APP_MENU_ENTRY_POINT_CLICK = 1061,
  ACTION_TWG_DISCOVER_FEED_MENU_ENTRY_POINT_CLICK = 1062,
  ACTION_SHOWCASE_REGWALL_3P_BUTTON_CLICK = 1063,
  ACTION_SUBSCRIPTION_OFFERS_RETRY = 1064,
  ACTION_CONTRIBUTION_OFFERS_RETRY = 1065,
  ACTION_TWG_SHORTENED_STICKER_FLOW_STICKER_SELECTION_CLICK = 1066,
  ACTION_INITIATE_UPDATED_SUBSCRIPTION_LINKING = 1067,
  ACTION_SURVEY_SUBMIT_CLICK = 1068,
  ACTION_SURVEY_CLOSED = 1069,
  ACTION_SURVEY_DATA_TRANSFER = 1070,
  ACTION_REGWALL_PAGE_REFRESH = 1071,
  ACTION_NEWSLETTER_PAGE_REFRESH = 1072,
  ACTION_SURVEY_PAGE_REFRESH = 1073,
  ACTION_METER_TOAST_PAGE_REFRESH = 1074,
  ACTION_MINI_PROMPT_INTERACTION = 1075,
  ACTION_SURVEY_PREVIOUS_BUTTON_CLICK = 1076,
  ACTION_SURVEY_NEXT_BUTTON_CLICK = 1077,
  ACTION_REWARDED_AD_VIEW = 1078,
  ACTION_REWARDED_AD_CLOSE = 1079,
  ACTION_REWARDED_AD_CLOSE_AD = 1080,
  ACTION_REWARDED_AD_SIGN_IN = 1081,
  ACTION_REWARDED_AD_SUPPORT = 1082,
  ACTION_BACK_TO_HOMEPAGE = 1083,
  ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE = 1084,
  ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT = 1085,
  ACTION_SUBSCRIPTION_LINKING_CLOSE = 1086,
  ACTION_BYO_CTA_CLOSE = 1087,
  ACTION_BYO_CTA_BUTTON_CLICK = 1088,
  EVENT_PAYMENT_FAILED = 2000,
  EVENT_REGWALL_OPT_IN_FAILED = 2001,
  EVENT_NEWSLETTER_OPT_IN_FAILED = 2002,
  EVENT_REGWALL_ALREADY_OPT_IN = 2003,
  EVENT_NEWSLETTER_ALREADY_OPT_IN = 2004,
  EVENT_SUBSCRIPTION_LINKING_FAILED = 2005,
  EVENT_SURVEY_ALREADY_SUBMITTED = 2006,
  EVENT_SURVEY_COMPLETION_RECORD_FAILED = 2007,
  EVENT_SURVEY_DATA_TRANSFER_FAILED = 2008,
  EVENT_BYO_CTA_COMPLETION_RECORD_FAILED = 2009,
  EVENT_CUSTOM = 3000,
  EVENT_CONFIRM_TX_ID = 3001,
  EVENT_CHANGED_TX_ID = 3002,
  EVENT_GPAY_NO_TX_ID = 3003,
  EVENT_GPAY_CANNOT_CONFIRM_TX_ID = 3004,
  EVENT_GOOGLE_UPDATED = 3005,
  EVENT_NEW_TX_ID = 3006,
  EVENT_UNLOCKED_BY_SUBSCRIPTION = 3007,
  EVENT_UNLOCKED_BY_METER = 3008,
  EVENT_NO_ENTITLEMENTS = 3009,
  EVENT_HAS_METERING_ENTITLEMENTS = 3010,
  EVENT_OFFERED_METER = 3011,
  EVENT_UNLOCKED_FREE_PAGE = 3012,
  EVENT_INELIGIBLE_PAYWALL = 3013,
  EVENT_UNLOCKED_FOR_CRAWLER = 3014,
  EVENT_TWG_COUNTER_VIEW = 3015,
  EVENT_TWG_SITE_SUPPORTER_WALL_VIEW = 3016,
  EVENT_TWG_STATIC_BUTTON_VIEW = 3017,
  EVENT_TWG_DYNAMIC_BUTTON_VIEW = 3018,
  EVENT_TWG_PRE_TRANSACTION_PRIVACY_SETTING_PRIVATE = 3019,
  EVENT_TWG_POST_TRANSACTION_SETTING_PRIVATE = 3020,
  EVENT_TWG_PRE_TRANSACTION_PRIVACY_SETTING_PUBLIC = 3021,
  EVENT_TWG_POST_TRANSACTION_SETTING_PUBLIC = 3022,
  EVENT_REGWALL_OPTED_IN = 3023,
  EVENT_NEWSLETTER_OPTED_IN = 3024,
  EVENT_SHOWCASE_METERING_INIT = 3025,
  EVENT_DISABLE_MINIPROMPT_DESKTOP = 3026,
  EVENT_SUBSCRIPTION_LINKING_SUCCESS = 3027,
  EVENT_SURVEY_SUBMITTED = 3028,
  EVENT_LINK_ACCOUNT_SUCCESS = 3029,
  EVENT_SAVE_SUBSCRIPTION_SUCCESS = 3030,
  EVENT_SURVEY_DATA_TRANSFER_COMPLETE = 3031,
  EVENT_RUNTIME_IS_READY = 3032,
  EVENT_START_API = 3033,
  EVENT_SHOW_OFFERS_API = 3034,
  EVENT_SHOW_CONTRIBUTION_OPTIONS_API = 3035,
  EVENT_REWARDED_AD_FLOW_INIT = 3048,
  EVENT_REWARDED_AD_READY = 3036,
  EVENT_REWARDED_AD_GPT_MISSING_ERROR = 3037,
  EVENT_REWARDED_AD_CONFIG_ERROR = 3038,
  EVENT_REWARDED_AD_PAGE_ERROR = 3039,
  EVENT_REWARDED_AD_GPT_ERROR = 3040,
  EVENT_REWARDED_AD_GRANTED = 3041,
  EVENT_REWARDED_AD_NOT_FILLED = 3049,
  EVENT_GLOBAL_FREQUENCY_CAP_MET = 3042,
  EVENT_PROMPT_FREQUENCY_CAP_MET = 3043,
  EVENT_ACTION_IMPRESSIONS_STORAGE_KEY_NOT_FOUND_ERROR = 3044,
  EVENT_LOCAL_STORAGE_TIMESTAMPS_PARSING_ERROR = 3052,
  EVENT_FREQUENCY_CAP_CONFIG_NOT_FOUND_ERROR = 3045,
  EVENT_PROMPT_FREQUENCY_CONFIG_NOT_FOUND = 3053,
  EVENT_BYOP_NEWSLETTER_OPT_IN_CONFIG_ERROR = 3046,
  EVENT_BYOP_NEWSLETTER_OPT_IN_CODE_SNIPPET_ERROR = 3047,
  EVENT_SUBSCRIPTION_PAYMENT_COMPLETE = 3050,
  EVENT_CONTRIBUTION_PAYMENT_COMPLETE = 3051,
  EVENT_HOSTED_PAGE_SUBSCRIPTION_PAYMENT_COMPLETE = 3054,
  EVENT_HOSTED_PAGE_CONTRIBUTION_PAYMENT_COMPLETE = 3055,
  EVENT_COMPLETION_COUNT_FOR_REPEATABLE_ACTION_MISSING_ERROR = 3056,
  EVENT_SUBSCRIPTION_STATE = 4000,
}

/** */
export enum EntitlementResult {
  UNKNOWN_ENTITLEMENT_RESULT = 0,
  UNLOCKED_SUBSCRIBER = 1001,
  UNLOCKED_FREE = 1002,
  UNLOCKED_METER = 1003,
  LOCKED_REGWALL = 2001,
  LOCKED_PAYWALL = 2002,
  INELIGIBLE_PAYWALL = 2003,
}

/** */
export enum EntitlementSource {
  UNKNOWN_ENTITLEMENT_SOURCE = 0,
  GOOGLE_SUBSCRIBER_ENTITLEMENT = 1001,
  GOOGLE_SHOWCASE_METERING_SERVICE = 2001,
  SUBSCRIBE_WITH_GOOGLE_METERING_SERVICE = 2002,
  PUBLISHER_ENTITLEMENT = 3001,
}

/** */
export enum EventOriginator {
  UNKNOWN_CLIENT = 0,
  SWG_CLIENT = 1,
  AMP_CLIENT = 2,
  PROPENSITY_CLIENT = 3,
  SWG_SERVER = 4,
  PUBLISHER_CLIENT = 5,
  SHOWCASE_CLIENT = 6,
}

/** */
export enum ReaderSurfaceType {
  READER_SURFACE_TYPE_UNSPECIFIED = 0,
  READER_SURFACE_WORDPRESS = 1,
  READER_SURFACE_CHROME = 2,
  READER_SURFACE_TENOR = 3,
}

/** */
export class AccountCreationRequest implements Message {
  private complete_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.complete_ = data[base] == null ? null : (data[base] as boolean);
  }

  getComplete(): boolean | null {
    return this.complete_;
  }

  setComplete(value: boolean): void {
    this.complete_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.complete_, // field 1 - complete
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'AccountCreationRequest';
  }
}

/** */
export class ActionRequest implements Message {
  private action_: ActionType | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.action_ = data[base] == null ? null : (data[base] as ActionType);
  }

  getAction(): ActionType | null {
    return this.action_;
  }

  setAction(value: ActionType): void {
    this.action_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.action_, // field 1 - action
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'ActionRequest';
  }
}

/** */
export class AlreadySubscribedResponse implements Message {
  private subscriberOrMember_: boolean | null;
  private linkRequested_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.subscriberOrMember_ =
      data[base] == null ? null : (data[base] as boolean);

    this.linkRequested_ =
      data[1 + base] == null ? null : (data[1 + base] as boolean);
  }

  getSubscriberOrMember(): boolean | null {
    return this.subscriberOrMember_;
  }

  setSubscriberOrMember(value: boolean): void {
    this.subscriberOrMember_ = value;
  }

  getLinkRequested(): boolean | null {
    return this.linkRequested_;
  }

  setLinkRequested(value: boolean): void {
    this.linkRequested_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.subscriberOrMember_, // field 1 - subscriber_or_member
      this.linkRequested_, // field 2 - link_requested
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'AlreadySubscribedResponse';
  }
}

/** */
export class AnalyticsContext implements Message {
  private embedderOrigin_: string | null;
  private transactionId_: string | null;
  private referringOrigin_: string | null;
  private utmSource_: string | null;
  private utmCampaign_: string | null;
  private utmMedium_: string | null;
  private sku_: string | null;
  private readyToPay_: boolean | null;
  private label_: string[] | null;
  private clientVersion_: string | null;
  private url_: string | null;
  private clientTimestamp_: Timestamp | null;
  private readerSurfaceType_: ReaderSurfaceType | null;
  private integrationVersion_: string | null;
  private pageLoadBeginTimestamp_: Timestamp | null;
  private loadEventStartDelay_: Duration | null;
  private runtimeCreationTimestamp_: Timestamp | null;
  private isLockedContent_: boolean | null;
  private urlFromMarkup_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.embedderOrigin_ = data[base] == null ? null : (data[base] as string);

    this.transactionId_ =
      data[1 + base] == null ? null : (data[1 + base] as string);

    this.referringOrigin_ =
      data[2 + base] == null ? null : (data[2 + base] as string);

    this.utmSource_ =
      data[3 + base] == null ? null : (data[3 + base] as string);

    this.utmCampaign_ =
      data[4 + base] == null ? null : (data[4 + base] as string);

    this.utmMedium_ =
      data[5 + base] == null ? null : (data[5 + base] as string);

    this.sku_ = data[6 + base] == null ? null : (data[6 + base] as string);

    this.readyToPay_ =
      data[7 + base] == null ? null : (data[7 + base] as boolean);

    this.label_ = (data[8 + base] as string[]) || [];

    this.clientVersion_ =
      data[9 + base] == null ? null : (data[9 + base] as string);

    this.url_ = data[10 + base] == null ? null : (data[10 + base] as string);

    this.clientTimestamp_ =
      data[11 + base] == null
        ? null
        : new Timestamp(data[11 + base] as unknown[], includesLabel);

    this.readerSurfaceType_ =
      data[12 + base] == null ? null : (data[12 + base] as ReaderSurfaceType);

    this.integrationVersion_ =
      data[13 + base] == null ? null : (data[13 + base] as string);

    this.pageLoadBeginTimestamp_ =
      data[14 + base] == null
        ? null
        : new Timestamp(data[14 + base] as unknown[], includesLabel);

    this.loadEventStartDelay_ =
      data[15 + base] == null
        ? null
        : new Duration(data[15 + base] as unknown[], includesLabel);

    this.runtimeCreationTimestamp_ =
      data[16 + base] == null
        ? null
        : new Timestamp(data[16 + base] as unknown[], includesLabel);

    this.isLockedContent_ =
      data[17 + base] == null ? null : (data[17 + base] as boolean);

    this.urlFromMarkup_ =
      data[18 + base] == null ? null : (data[18 + base] as string);
  }

  getEmbedderOrigin(): string | null {
    return this.embedderOrigin_;
  }

  setEmbedderOrigin(value: string): void {
    this.embedderOrigin_ = value;
  }

  getTransactionId(): string | null {
    return this.transactionId_;
  }

  setTransactionId(value: string): void {
    this.transactionId_ = value;
  }

  getReferringOrigin(): string | null {
    return this.referringOrigin_;
  }

  setReferringOrigin(value: string): void {
    this.referringOrigin_ = value;
  }

  getUtmSource(): string | null {
    return this.utmSource_;
  }

  setUtmSource(value: string): void {
    this.utmSource_ = value;
  }

  getUtmCampaign(): string | null {
    return this.utmCampaign_;
  }

  setUtmCampaign(value: string): void {
    this.utmCampaign_ = value;
  }

  getUtmMedium(): string | null {
    return this.utmMedium_;
  }

  setUtmMedium(value: string): void {
    this.utmMedium_ = value;
  }

  getSku(): string | null {
    return this.sku_;
  }

  setSku(value: string): void {
    this.sku_ = value;
  }

  getReadyToPay(): boolean | null {
    return this.readyToPay_;
  }

  setReadyToPay(value: boolean): void {
    this.readyToPay_ = value;
  }

  getLabelList(): string[] | null {
    return this.label_;
  }

  setLabelList(value: string[]): void {
    this.label_ = value;
  }

  getClientVersion(): string | null {
    return this.clientVersion_;
  }

  setClientVersion(value: string): void {
    this.clientVersion_ = value;
  }

  getUrl(): string | null {
    return this.url_;
  }

  setUrl(value: string): void {
    this.url_ = value;
  }

  getClientTimestamp(): Timestamp | null {
    return this.clientTimestamp_;
  }

  setClientTimestamp(value: Timestamp): void {
    this.clientTimestamp_ = value;
  }

  getReaderSurfaceType(): ReaderSurfaceType | null {
    return this.readerSurfaceType_;
  }

  setReaderSurfaceType(value: ReaderSurfaceType): void {
    this.readerSurfaceType_ = value;
  }

  getIntegrationVersion(): string | null {
    return this.integrationVersion_;
  }

  setIntegrationVersion(value: string): void {
    this.integrationVersion_ = value;
  }

  getPageLoadBeginTimestamp(): Timestamp | null {
    return this.pageLoadBeginTimestamp_;
  }

  setPageLoadBeginTimestamp(value: Timestamp): void {
    this.pageLoadBeginTimestamp_ = value;
  }

  getLoadEventStartDelay(): Duration | null {
    return this.loadEventStartDelay_;
  }

  setLoadEventStartDelay(value: Duration): void {
    this.loadEventStartDelay_ = value;
  }

  getRuntimeCreationTimestamp(): Timestamp | null {
    return this.runtimeCreationTimestamp_;
  }

  setRuntimeCreationTimestamp(value: Timestamp): void {
    this.runtimeCreationTimestamp_ = value;
  }

  getIsLockedContent(): boolean | null {
    return this.isLockedContent_;
  }

  setIsLockedContent(value: boolean): void {
    this.isLockedContent_ = value;
  }

  getUrlFromMarkup(): string | null {
    return this.urlFromMarkup_;
  }

  setUrlFromMarkup(value: string): void {
    this.urlFromMarkup_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
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
      this.readerSurfaceType_, // field 13 - reader_surface_type
      this.integrationVersion_, // field 14 - integration_version
      this.pageLoadBeginTimestamp_
        ? this.pageLoadBeginTimestamp_.toArray(includeLabel)
        : [], // field 15 - page_load_begin_timestamp
      this.loadEventStartDelay_
        ? this.loadEventStartDelay_.toArray(includeLabel)
        : [], // field 16 - load_event_start_delay
      this.runtimeCreationTimestamp_
        ? this.runtimeCreationTimestamp_.toArray(includeLabel)
        : [], // field 17 - runtime_creation_timestamp
      this.isLockedContent_, // field 18 - is_locked_content
      this.urlFromMarkup_, // field 19 - url_from_markup
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'AnalyticsContext';
  }
}

/** */
export class AnalyticsEventMeta implements Message {
  private eventOriginator_: EventOriginator | null;
  private isFromUserAction_: boolean | null;
  private configurationId_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.eventOriginator_ =
      data[base] == null ? null : (data[base] as EventOriginator);

    this.isFromUserAction_ =
      data[1 + base] == null ? null : (data[1 + base] as boolean);

    this.configurationId_ =
      data[2 + base] == null ? null : (data[2 + base] as string);
  }

  getEventOriginator(): EventOriginator | null {
    return this.eventOriginator_;
  }

  setEventOriginator(value: EventOriginator): void {
    this.eventOriginator_ = value;
  }

  getIsFromUserAction(): boolean | null {
    return this.isFromUserAction_;
  }

  setIsFromUserAction(value: boolean): void {
    this.isFromUserAction_ = value;
  }

  getConfigurationId(): string | null {
    return this.configurationId_;
  }

  setConfigurationId(value: string): void {
    this.configurationId_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.eventOriginator_, // field 1 - event_originator
      this.isFromUserAction_, // field 2 - is_from_user_action
      this.configurationId_, // field 3 - configuration_id
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'AnalyticsEventMeta';
  }
}

/** */
export class AnalyticsRequest implements Message {
  private context_: AnalyticsContext | null;
  private event_: AnalyticsEvent | null;
  private meta_: AnalyticsEventMeta | null;
  private params_: EventParams | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.context_ =
      data[base] == null
        ? null
        : new AnalyticsContext(data[base] as unknown[], includesLabel);

    this.event_ =
      data[1 + base] == null ? null : (data[1 + base] as AnalyticsEvent);

    this.meta_ =
      data[2 + base] == null
        ? null
        : new AnalyticsEventMeta(data[2 + base] as unknown[], includesLabel);

    this.params_ =
      data[3 + base] == null
        ? null
        : new EventParams(data[3 + base] as unknown[], includesLabel);
  }

  getContext(): AnalyticsContext | null {
    return this.context_;
  }

  setContext(value: AnalyticsContext): void {
    this.context_ = value;
  }

  getEvent(): AnalyticsEvent | null {
    return this.event_;
  }

  setEvent(value: AnalyticsEvent): void {
    this.event_ = value;
  }

  getMeta(): AnalyticsEventMeta | null {
    return this.meta_;
  }

  setMeta(value: AnalyticsEventMeta): void {
    this.meta_ = value;
  }

  getParams(): EventParams | null {
    return this.params_;
  }

  setParams(value: EventParams): void {
    this.params_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
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

  label(): string {
    return 'AnalyticsRequest';
  }
}

/** */
export class AudienceActivityClientLogsRequest implements Message {
  private event_: AnalyticsEvent | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.event_ = data[base] == null ? null : (data[base] as AnalyticsEvent);
  }

  getEvent(): AnalyticsEvent | null {
    return this.event_;
  }

  setEvent(value: AnalyticsEvent): void {
    this.event_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.event_, // field 1 - event
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'AudienceActivityClientLogsRequest';
  }
}

/** */
export class CompleteAudienceActionResponse implements Message {
  private swgUserToken_: string | null;
  private actionCompleted_: boolean | null;
  private userEmail_: string | null;
  private alreadyCompleted_: boolean | null;
  private displayName_: string | null;
  private givenName_: string | null;
  private familyName_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.swgUserToken_ = data[base] == null ? null : (data[base] as string);

    this.actionCompleted_ =
      data[1 + base] == null ? null : (data[1 + base] as boolean);

    this.userEmail_ =
      data[2 + base] == null ? null : (data[2 + base] as string);

    this.alreadyCompleted_ =
      data[3 + base] == null ? null : (data[3 + base] as boolean);

    this.displayName_ =
      data[4 + base] == null ? null : (data[4 + base] as string);

    this.givenName_ =
      data[5 + base] == null ? null : (data[5 + base] as string);

    this.familyName_ =
      data[6 + base] == null ? null : (data[6 + base] as string);
  }

  getSwgUserToken(): string | null {
    return this.swgUserToken_;
  }

  setSwgUserToken(value: string): void {
    this.swgUserToken_ = value;
  }

  getActionCompleted(): boolean | null {
    return this.actionCompleted_;
  }

  setActionCompleted(value: boolean): void {
    this.actionCompleted_ = value;
  }

  getUserEmail(): string | null {
    return this.userEmail_;
  }

  setUserEmail(value: string): void {
    this.userEmail_ = value;
  }

  getAlreadyCompleted(): boolean | null {
    return this.alreadyCompleted_;
  }

  setAlreadyCompleted(value: boolean): void {
    this.alreadyCompleted_ = value;
  }

  getDisplayName(): string | null {
    return this.displayName_;
  }

  setDisplayName(value: string): void {
    this.displayName_ = value;
  }

  getGivenName(): string | null {
    return this.givenName_;
  }

  setGivenName(value: string): void {
    this.givenName_ = value;
  }

  getFamilyName(): string | null {
    return this.familyName_;
  }

  setFamilyName(value: string): void {
    this.familyName_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.swgUserToken_, // field 1 - swg_user_token
      this.actionCompleted_, // field 2 - action_completed
      this.userEmail_, // field 3 - user_email
      this.alreadyCompleted_, // field 4 - already_completed
      this.displayName_, // field 5 - display_name
      this.givenName_, // field 6 - given_name
      this.familyName_, // field 7 - family_name
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'CompleteAudienceActionResponse';
  }
}

/** */
export class Duration implements Message {
  private seconds_: number | null;
  private nanos_: number | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.seconds_ = data[base] == null ? null : (data[base] as number);

    this.nanos_ = data[1 + base] == null ? null : (data[1 + base] as number);
  }

  getSeconds(): number | null {
    return this.seconds_;
  }

  setSeconds(value: number): void {
    this.seconds_ = value;
  }

  getNanos(): number | null {
    return this.nanos_;
  }

  setNanos(value: number): void {
    this.nanos_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.seconds_, // field 1 - seconds
      this.nanos_, // field 2 - nanos
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'Duration';
  }
}

/** */
export class EntitlementJwt implements Message {
  private jwt_: string | null;
  private source_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.jwt_ = data[base] == null ? null : (data[base] as string);

    this.source_ = data[1 + base] == null ? null : (data[1 + base] as string);
  }

  getJwt(): string | null {
    return this.jwt_;
  }

  setJwt(value: string): void {
    this.jwt_ = value;
  }

  getSource(): string | null {
    return this.source_;
  }

  setSource(value: string): void {
    this.source_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.jwt_, // field 1 - jwt
      this.source_, // field 2 - source
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'EntitlementJwt';
  }
}

/** */
export class EntitlementsRequest implements Message {
  private usedEntitlement_: EntitlementJwt | null;
  private clientEventTime_: Timestamp | null;
  private entitlementSource_: EntitlementSource | null;
  private entitlementResult_: EntitlementResult | null;
  private token_: string | null;
  private isUserRegistered_: boolean | null;
  private subscriptionTimestamp_: Timestamp | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.usedEntitlement_ =
      data[base] == null
        ? null
        : new EntitlementJwt(data[base] as unknown[], includesLabel);

    this.clientEventTime_ =
      data[1 + base] == null
        ? null
        : new Timestamp(data[1 + base] as unknown[], includesLabel);

    this.entitlementSource_ =
      data[2 + base] == null ? null : (data[2 + base] as EntitlementSource);

    this.entitlementResult_ =
      data[3 + base] == null ? null : (data[3 + base] as EntitlementResult);

    this.token_ = data[4 + base] == null ? null : (data[4 + base] as string);

    this.isUserRegistered_ =
      data[5 + base] == null ? null : (data[5 + base] as boolean);

    this.subscriptionTimestamp_ =
      data[6 + base] == null
        ? null
        : new Timestamp(data[6 + base] as unknown[], includesLabel);
  }

  getUsedEntitlement(): EntitlementJwt | null {
    return this.usedEntitlement_;
  }

  setUsedEntitlement(value: EntitlementJwt): void {
    this.usedEntitlement_ = value;
  }

  getClientEventTime(): Timestamp | null {
    return this.clientEventTime_;
  }

  setClientEventTime(value: Timestamp): void {
    this.clientEventTime_ = value;
  }

  getEntitlementSource(): EntitlementSource | null {
    return this.entitlementSource_;
  }

  setEntitlementSource(value: EntitlementSource): void {
    this.entitlementSource_ = value;
  }

  getEntitlementResult(): EntitlementResult | null {
    return this.entitlementResult_;
  }

  setEntitlementResult(value: EntitlementResult): void {
    this.entitlementResult_ = value;
  }

  getToken(): string | null {
    return this.token_;
  }

  setToken(value: string): void {
    this.token_ = value;
  }

  getIsUserRegistered(): boolean | null {
    return this.isUserRegistered_;
  }

  setIsUserRegistered(value: boolean): void {
    this.isUserRegistered_ = value;
  }

  getSubscriptionTimestamp(): Timestamp | null {
    return this.subscriptionTimestamp_;
  }

  setSubscriptionTimestamp(value: Timestamp): void {
    this.subscriptionTimestamp_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.usedEntitlement_ ? this.usedEntitlement_.toArray(includeLabel) : [], // field 1 - used_entitlement
      this.clientEventTime_ ? this.clientEventTime_.toArray(includeLabel) : [], // field 2 - client_event_time
      this.entitlementSource_, // field 3 - entitlement_source
      this.entitlementResult_, // field 4 - entitlement_result
      this.token_, // field 5 - token
      this.isUserRegistered_, // field 6 - is_user_registered
      this.subscriptionTimestamp_
        ? this.subscriptionTimestamp_.toArray(includeLabel)
        : [], // field 7 - subscription_timestamp
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'EntitlementsRequest';
  }
}

/** */
export class EntitlementsResponse implements Message {
  private jwt_: string | null;
  private swgUserToken_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.jwt_ = data[base] == null ? null : (data[base] as string);

    this.swgUserToken_ =
      data[1 + base] == null ? null : (data[1 + base] as string);
  }

  getJwt(): string | null {
    return this.jwt_;
  }

  setJwt(value: string): void {
    this.jwt_ = value;
  }

  getSwgUserToken(): string | null {
    return this.swgUserToken_;
  }

  setSwgUserToken(value: string): void {
    this.swgUserToken_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.jwt_, // field 1 - jwt
      this.swgUserToken_, // field 2 - swg_user_token
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'EntitlementsResponse';
  }
}

/** */
export class EventParams implements Message {
  private smartboxMessage_: string | null;
  private gpayTransactionId_: string | null;
  private hadLogged_: boolean | null;
  private sku_: string | null;
  private oldTransactionId_: string | null;
  private isUserRegistered_: boolean | null;
  private subscriptionFlow_: string | null;
  private subscriptionTimestamp_: Timestamp | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.smartboxMessage_ = data[base] == null ? null : (data[base] as string);

    this.gpayTransactionId_ =
      data[1 + base] == null ? null : (data[1 + base] as string);

    this.hadLogged_ =
      data[2 + base] == null ? null : (data[2 + base] as boolean);

    this.sku_ = data[3 + base] == null ? null : (data[3 + base] as string);

    this.oldTransactionId_ =
      data[4 + base] == null ? null : (data[4 + base] as string);

    this.isUserRegistered_ =
      data[5 + base] == null ? null : (data[5 + base] as boolean);

    this.subscriptionFlow_ =
      data[6 + base] == null ? null : (data[6 + base] as string);

    this.subscriptionTimestamp_ =
      data[7 + base] == null
        ? null
        : new Timestamp(data[7 + base] as unknown[], includesLabel);
  }

  getSmartboxMessage(): string | null {
    return this.smartboxMessage_;
  }

  setSmartboxMessage(value: string): void {
    this.smartboxMessage_ = value;
  }

  getGpayTransactionId(): string | null {
    return this.gpayTransactionId_;
  }

  setGpayTransactionId(value: string): void {
    this.gpayTransactionId_ = value;
  }

  getHadLogged(): boolean | null {
    return this.hadLogged_;
  }

  setHadLogged(value: boolean): void {
    this.hadLogged_ = value;
  }

  getSku(): string | null {
    return this.sku_;
  }

  setSku(value: string): void {
    this.sku_ = value;
  }

  getOldTransactionId(): string | null {
    return this.oldTransactionId_;
  }

  setOldTransactionId(value: string): void {
    this.oldTransactionId_ = value;
  }

  getIsUserRegistered(): boolean | null {
    return this.isUserRegistered_;
  }

  setIsUserRegistered(value: boolean): void {
    this.isUserRegistered_ = value;
  }

  getSubscriptionFlow(): string | null {
    return this.subscriptionFlow_;
  }

  setSubscriptionFlow(value: string): void {
    this.subscriptionFlow_ = value;
  }

  getSubscriptionTimestamp(): Timestamp | null {
    return this.subscriptionTimestamp_;
  }

  setSubscriptionTimestamp(value: Timestamp): void {
    this.subscriptionTimestamp_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.smartboxMessage_, // field 1 - smartbox_message
      this.gpayTransactionId_, // field 2 - gpay_transaction_id
      this.hadLogged_, // field 3 - had_logged
      this.sku_, // field 4 - sku
      this.oldTransactionId_, // field 5 - old_transaction_id
      this.isUserRegistered_, // field 6 - is_user_registered
      this.subscriptionFlow_, // field 7 - subscription_flow
      this.subscriptionTimestamp_
        ? this.subscriptionTimestamp_.toArray(includeLabel)
        : [], // field 8 - subscription_timestamp
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'EventParams';
  }
}

/** */
export class FinishedLoggingResponse implements Message {
  private complete_: boolean | null;
  private error_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.complete_ = data[base] == null ? null : (data[base] as boolean);

    this.error_ = data[1 + base] == null ? null : (data[1 + base] as string);
  }

  getComplete(): boolean | null {
    return this.complete_;
  }

  setComplete(value: boolean): void {
    this.complete_ = value;
  }

  getError(): string | null {
    return this.error_;
  }

  setError(value: string): void {
    this.error_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.complete_, // field 1 - complete
      this.error_, // field 2 - error
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'FinishedLoggingResponse';
  }
}

/** */
export class LinkSaveTokenRequest implements Message {
  private authCode_: string | null;
  private token_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.authCode_ = data[base] == null ? null : (data[base] as string);

    this.token_ = data[1 + base] == null ? null : (data[1 + base] as string);
  }

  getAuthCode(): string | null {
    return this.authCode_;
  }

  setAuthCode(value: string): void {
    this.authCode_ = value;
  }

  getToken(): string | null {
    return this.token_;
  }

  setToken(value: string): void {
    this.token_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.authCode_, // field 1 - auth_code
      this.token_, // field 2 - token
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'LinkSaveTokenRequest';
  }
}

/** */
export class LinkingInfoResponse implements Message {
  private requested_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.requested_ = data[base] == null ? null : (data[base] as boolean);
  }

  getRequested(): boolean | null {
    return this.requested_;
  }

  setRequested(value: boolean): void {
    this.requested_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.requested_, // field 1 - requested
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'LinkingInfoResponse';
  }
}

/** */
export class OpenDialogRequest implements Message {
  private urlPath_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.urlPath_ = data[base] == null ? null : (data[base] as string);
  }

  getUrlPath(): string | null {
    return this.urlPath_;
  }

  setUrlPath(value: string): void {
    this.urlPath_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.urlPath_, // field 1 - url_path
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'OpenDialogRequest';
  }
}

/** */
export class SkuSelectedResponse implements Message {
  private sku_: string | null;
  private oldSku_: string | null;
  private oneTime_: boolean | null;
  private playOffer_: string | null;
  private oldPlayOffer_: string | null;
  private customMessage_: string | null;
  private anonymous_: boolean | null;
  private sharingPolicyEnabled_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.sku_ = data[base] == null ? null : (data[base] as string);

    this.oldSku_ = data[1 + base] == null ? null : (data[1 + base] as string);

    this.oneTime_ = data[2 + base] == null ? null : (data[2 + base] as boolean);

    this.playOffer_ =
      data[3 + base] == null ? null : (data[3 + base] as string);

    this.oldPlayOffer_ =
      data[4 + base] == null ? null : (data[4 + base] as string);

    this.customMessage_ =
      data[5 + base] == null ? null : (data[5 + base] as string);

    this.anonymous_ =
      data[6 + base] == null ? null : (data[6 + base] as boolean);

    this.sharingPolicyEnabled_ =
      data[7 + base] == null ? null : (data[7 + base] as boolean);
  }

  getSku(): string | null {
    return this.sku_;
  }

  setSku(value: string): void {
    this.sku_ = value;
  }

  getOldSku(): string | null {
    return this.oldSku_;
  }

  setOldSku(value: string): void {
    this.oldSku_ = value;
  }

  getOneTime(): boolean | null {
    return this.oneTime_;
  }

  setOneTime(value: boolean): void {
    this.oneTime_ = value;
  }

  getPlayOffer(): string | null {
    return this.playOffer_;
  }

  setPlayOffer(value: string): void {
    this.playOffer_ = value;
  }

  getOldPlayOffer(): string | null {
    return this.oldPlayOffer_;
  }

  setOldPlayOffer(value: string): void {
    this.oldPlayOffer_ = value;
  }

  getCustomMessage(): string | null {
    return this.customMessage_;
  }

  setCustomMessage(value: string): void {
    this.customMessage_ = value;
  }

  getAnonymous(): boolean | null {
    return this.anonymous_;
  }

  setAnonymous(value: boolean): void {
    this.anonymous_ = value;
  }

  getSharingPolicyEnabled(): boolean | null {
    return this.sharingPolicyEnabled_;
  }

  setSharingPolicyEnabled(value: boolean): void {
    this.sharingPolicyEnabled_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.sku_, // field 1 - sku
      this.oldSku_, // field 2 - old_sku
      this.oneTime_, // field 3 - one_time
      this.playOffer_, // field 4 - play_offer
      this.oldPlayOffer_, // field 5 - old_play_offer
      this.customMessage_, // field 6 - custom_message
      this.anonymous_, // field 7 - anonymous
      this.sharingPolicyEnabled_, // field 8 - sharing_policy_enabled
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SkuSelectedResponse';
  }
}

/** */
export class SmartBoxMessage implements Message {
  private isClicked_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.isClicked_ = data[base] == null ? null : (data[base] as boolean);
  }

  getIsClicked(): boolean | null {
    return this.isClicked_;
  }

  setIsClicked(value: boolean): void {
    this.isClicked_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.isClicked_, // field 1 - is_clicked
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SmartBoxMessage';
  }
}

/** */
export class SubscribeResponse implements Message {
  private subscribe_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.subscribe_ = data[base] == null ? null : (data[base] as boolean);
  }

  getSubscribe(): boolean | null {
    return this.subscribe_;
  }

  setSubscribe(value: boolean): void {
    this.subscribe_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.subscribe_, // field 1 - subscribe
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SubscribeResponse';
  }
}

/** */
export class SubscriptionLinkingCompleteResponse implements Message {
  private publisherProvidedId_: string | null;
  private success_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.publisherProvidedId_ =
      data[base] == null ? null : (data[base] as string);

    this.success_ = data[1 + base] == null ? null : (data[1 + base] as boolean);
  }

  getPublisherProvidedId(): string | null {
    return this.publisherProvidedId_;
  }

  setPublisherProvidedId(value: string): void {
    this.publisherProvidedId_ = value;
  }

  getSuccess(): boolean | null {
    return this.success_;
  }

  setSuccess(value: boolean): void {
    this.success_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.publisherProvidedId_, // field 1 - publisher_provided_id
      this.success_, // field 2 - success
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SubscriptionLinkingCompleteResponse';
  }
}

/** */
export class SubscriptionLinkingResponse implements Message {
  private publisherProvidedId_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.publisherProvidedId_ =
      data[base] == null ? null : (data[base] as string);
  }

  getPublisherProvidedId(): string | null {
    return this.publisherProvidedId_;
  }

  setPublisherProvidedId(value: string): void {
    this.publisherProvidedId_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.publisherProvidedId_, // field 1 - publisher_provided_id
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SubscriptionLinkingResponse';
  }
}

/** */
export class SurveyAnswer implements Message {
  private answerId_: number | null;
  private answerText_: string | null;
  private answerCategory_: string | null;
  private ppsValue_: string | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.answerId_ = data[base] == null ? null : (data[base] as number);

    this.answerText_ =
      data[1 + base] == null ? null : (data[1 + base] as string);

    this.answerCategory_ =
      data[2 + base] == null ? null : (data[2 + base] as string);

    this.ppsValue_ = data[3 + base] == null ? null : (data[3 + base] as string);
  }

  getAnswerId(): number | null {
    return this.answerId_;
  }

  setAnswerId(value: number): void {
    this.answerId_ = value;
  }

  getAnswerText(): string | null {
    return this.answerText_;
  }

  setAnswerText(value: string): void {
    this.answerText_ = value;
  }

  getAnswerCategory(): string | null {
    return this.answerCategory_;
  }

  setAnswerCategory(value: string): void {
    this.answerCategory_ = value;
  }

  getPpsValue(): string | null {
    return this.ppsValue_;
  }

  setPpsValue(value: string): void {
    this.ppsValue_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.answerId_, // field 1 - answer_id
      this.answerText_, // field 2 - answer_text
      this.answerCategory_, // field 3 - answer_category
      this.ppsValue_, // field 4 - pps_value
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SurveyAnswer';
  }
}

/** */
export class SurveyDataTransferRequest implements Message {
  private surveyQuestions_: SurveyQuestion[] | null;
  private storePpsInLocalStorage_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.surveyQuestions_ = ((data[base] as unknown[][]) || []).map(
      (item) => new SurveyQuestion(item, includesLabel)
    );

    this.storePpsInLocalStorage_ =
      data[1 + base] == null ? null : (data[1 + base] as boolean);
  }

  getSurveyQuestionsList(): SurveyQuestion[] | null {
    return this.surveyQuestions_;
  }

  setSurveyQuestionsList(value: SurveyQuestion[]): void {
    this.surveyQuestions_ = value;
  }

  getStorePpsInLocalStorage(): boolean | null {
    return this.storePpsInLocalStorage_;
  }

  setStorePpsInLocalStorage(value: boolean): void {
    this.storePpsInLocalStorage_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.surveyQuestions_
        ? this.surveyQuestions_.map((item) => item.toArray(includeLabel))
        : [], // field 1 - survey_questions
      this.storePpsInLocalStorage_, // field 2 - store_pps_in_local_storage
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SurveyDataTransferRequest';
  }
}

/** */
export class SurveyDataTransferResponse implements Message {
  private success_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.success_ = data[base] == null ? null : (data[base] as boolean);
  }

  getSuccess(): boolean | null {
    return this.success_;
  }

  setSuccess(value: boolean): void {
    this.success_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.success_, // field 1 - success
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SurveyDataTransferResponse';
  }
}

/** */
export class SurveyQuestion implements Message {
  private questionId_: number | null;
  private questionText_: string | null;
  private questionCategory_: string | null;
  private surveyAnswers_: SurveyAnswer[] | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.questionId_ = data[base] == null ? null : (data[base] as number);

    this.questionText_ =
      data[1 + base] == null ? null : (data[1 + base] as string);

    this.questionCategory_ =
      data[2 + base] == null ? null : (data[2 + base] as string);

    this.surveyAnswers_ = ((data[3 + base] as unknown[][]) || []).map(
      (item) => new SurveyAnswer(item, includesLabel)
    );
  }

  getQuestionId(): number | null {
    return this.questionId_;
  }

  setQuestionId(value: number): void {
    this.questionId_ = value;
  }

  getQuestionText(): string | null {
    return this.questionText_;
  }

  setQuestionText(value: string): void {
    this.questionText_ = value;
  }

  getQuestionCategory(): string | null {
    return this.questionCategory_;
  }

  setQuestionCategory(value: string): void {
    this.questionCategory_ = value;
  }

  getSurveyAnswersList(): SurveyAnswer[] | null {
    return this.surveyAnswers_;
  }

  setSurveyAnswersList(value: SurveyAnswer[]): void {
    this.surveyAnswers_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.questionId_, // field 1 - question_id
      this.questionText_, // field 2 - question_text
      this.questionCategory_, // field 3 - question_category
      this.surveyAnswers_
        ? this.surveyAnswers_.map((item) => item.toArray(includeLabel))
        : [], // field 4 - survey_answers
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'SurveyQuestion';
  }
}

/** */
export class Timestamp implements Message {
  private seconds_: number | null;
  private nanos_: number | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.seconds_ = data[base] == null ? null : (data[base] as number);

    this.nanos_ = data[1 + base] == null ? null : (data[1 + base] as number);
  }

  getSeconds(): number | null {
    return this.seconds_;
  }

  setSeconds(value: number): void {
    this.seconds_ = value;
  }

  getNanos(): number | null {
    return this.nanos_;
  }

  setNanos(value: number): void {
    this.nanos_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.seconds_, // field 1 - seconds
      this.nanos_, // field 2 - nanos
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'Timestamp';
  }
}

/** */
export class ToastCloseRequest implements Message {
  private close_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.close_ = data[base] == null ? null : (data[base] as boolean);
  }

  getClose(): boolean | null {
    return this.close_;
  }

  setClose(value: boolean): void {
    this.close_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.close_, // field 1 - close
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'ToastCloseRequest';
  }
}

/** */
export class ViewSubscriptionsResponse implements Message {
  private native_: boolean | null;

  constructor(data: unknown[] = [], includesLabel = true) {
    const base = includesLabel ? 1 : 0;

    this.native_ = data[base] == null ? null : (data[base] as boolean);
  }

  getNative(): boolean | null {
    return this.native_;
  }

  setNative(value: boolean): void {
    this.native_ = value;
  }

  toArray(includeLabel = true): unknown[] {
    const arr: unknown[] = [
      this.native_, // field 1 - native
    ];
    if (includeLabel) {
      arr.unshift(this.label());
    }
    return arr;
  }

  label(): string {
    return 'ViewSubscriptionsResponse';
  }
}

const PROTO_MAP: {[key: string]: MessageConstructor} = {
  'AccountCreationRequest': AccountCreationRequest,
  'ActionRequest': ActionRequest,
  'AlreadySubscribedResponse': AlreadySubscribedResponse,
  'AnalyticsContext': AnalyticsContext,
  'AnalyticsEventMeta': AnalyticsEventMeta,
  'AnalyticsRequest': AnalyticsRequest,
  'AudienceActivityClientLogsRequest': AudienceActivityClientLogsRequest,
  'CompleteAudienceActionResponse': CompleteAudienceActionResponse,
  'Duration': Duration,
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
  'SubscriptionLinkingCompleteResponse': SubscriptionLinkingCompleteResponse,
  'SubscriptionLinkingResponse': SubscriptionLinkingResponse,
  'SurveyAnswer': SurveyAnswer,
  'SurveyDataTransferRequest': SurveyDataTransferRequest,
  'SurveyDataTransferResponse': SurveyDataTransferResponse,
  'SurveyQuestion': SurveyQuestion,
  'Timestamp': Timestamp,
  'ToastCloseRequest': ToastCloseRequest,
  'ViewSubscriptionsResponse': ViewSubscriptionsResponse,
};

/**
 * Utility to deserialize a buffer
 */
export function deserialize(data: unknown[]): Message {
  const key = data ? (data[0] as string) : null;
  if (key) {
    const ctor = PROTO_MAP[key];
    if (ctor) {
      return new ctor(data);
    }
  }
  throw new Error(`Deserialization failed for ${data}`);
}

/**
 * Gets a message's label.
 */
export function getLabel(messageType: MessageConstructor): string {
  return messageType.prototype.label();
}
