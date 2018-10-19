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
/** @enum {number} */
const AnalyticsEvent = {
  UNKNOWN: 0,
  IMPRESSION_PAYWALL: 1,
  ACTION_SUBSCRIBE: 1000,
  ACTION_PAYMENT_COMPLETE: 1001,
  ACTION_ACCOUNT_CREATED: 1002,
  ACTION_ACCOUNT_ACKNOWLEDGED: 1003,
};

class AnalyticsContext {
 /**
  * @param {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>=} data
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
    this.utmName_ = (data[5] == null) ? null : data[5];

    /** @private {?string} */
    this.utmMedium_ = (data[6] == null) ? null : data[6];

    /** @private {?string} */
    this.sku_ = (data[7] == null) ? null : data[7];

    /** @private {?boolean} */
    this.readyToPay_ = (data[8] == null) ? null : data[8];

    /** @private {!Array<string>} */
    this.label_ = data[9] || [];
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
  getUtmName() {
    return this.utmName_;
  }

  /**
   * @param {string} value
   */
  setUtmName(value) {
    this.utmName_ = value;
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
  getLabel() {
    return this.label_;
  }

  /**
   * @param {!Array<string>} value
   */
  setLabel(value) {
    this.label_ = value;
  }

  /**
   * @return {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>}
   */
  toArray() {
    return [
      'AnalyticsContext',  // message type
      this.embedderOrigin_,  // field 1 - embedder_origin
      this.transactionId_,  // field 2 - transaction_id
      this.referringOrigin_,  // field 3 - referring_origin
      this.utmSource_,  // field 4 - utm_source
      this.utmName_,  // field 5 - utm_name
      this.utmMedium_,  // field 6 - utm_medium
      this.sku_,  // field 7 - sku
      this.readyToPay_,  // field 8 - ready_to_pay
      this.label_,  // field 9 - label
    ];
  }
}


class AnalyticsRequest {
 /**
  * @param {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>=} data
  */
  constructor(data = []) {

    /** @private {?AnalyticsContext} */
    this.context_ = (data[1] == null || data[1] == undefined) ? null : new
        AnalyticsContext(data[1]);

    /** @private {?AnalyticsEvent} */
    this.event_ = (data[2] == null) ? null : data[2];
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
   * @return {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>}
   */
  toArray() {
    return [
      'AnalyticsRequest',  // message type
      this.context_ ? this.context_.toArray() : [], // field 1 - context
      this.event_,  // field 2 - event
    ];
  }
}


const PROTO_MAP = {
  'AnalyticsContext': AnalyticsContext,
  'AnalyticsRequest': AnalyticsRequest,
};

/**
 * Utility to deserialize a buffer
 * @param {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>} data
 * @return {?Object}
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

export {
  AnalyticsContext,
  AnalyticsRequest,
  AnalyticsEvent,
  deserialize,
};
