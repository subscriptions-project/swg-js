/**
 * @fileoverview Description of this file.
 */
/** {string} */
const target = "esm";

if (target == 'google3') {
  goog.module.declareNamespace('protobuf_lite.shim');
}

/**
 * message {
 *   optional string product_id;
 *   optional ShowOffers offers;
 * }
 */
class _MessageEnvelope {
  /**
   * @param {?Array<(string|boolean|number|undefined|!Array<(string|boolean|number|undefined)>)>} data
   */
  constructor(data) {
    /*
     * {!Array<(string|boolean|number|undefined|!Array<(string|boolean|number|undefined)>)>}
     */
    const array = data || [];

    /** @private {?string} */
    this.publicationId_ = array[1] || null;

    /** @private {?ShowOffers} */
    this.showOffers_ = array[2] ? new ShowOffers(array[2]) : null;
  }

  /**
   * @return {?string}
   */
  getPublicationId() {
    return this.publicationId_;
  }

  /**
   * @param {string} value
   */
  setPublicationId(value) {
    this.publicationId_ = value;
  }

  /**
   * @param {!ShowOffers} showOffers
   */
  setShowOffers(showOffers) {
    this.showOffers_ = showOffers;
  }

  /**
   * @return {?ShowOffers}
   */
  getShowOffers() {
    return this.showOffers_;
  }

  /**
   * @return {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>}
   */
  toArray() {
    return [
      'messageEnvelope',    // message type
      this.publicationId_,  // field 1 - publication_id
      this.showOffers_ ? this.showOffers_.toArray() :
                         null,  // field 2 - show_offers
    ];
  }
}

/**
 * message ShowOffers {
 *   optional string productId;
 *   repeated string skus;
 * }
 */
class _ShowOffers {
  /**
   * @param {?Array<(string|boolean|number|undefined|!Array<(string|boolean|number|undefined)>)>} data
   */
  constructor(data) {
    /*
     * {!Array<(string|boolean|number|undefined|Array<(string|boolean|number|undefined)>)>}
     */
    const array = data || [];

    /** @private {?string} */
    this.productId_ = array[1] || null;

    /** @private {!Array<string>} */
    this.skus_ = array[2] || [];
  }

  /**
   * @return {?string}
   */
  getProductId() {
    return this.productId_;
  }

  /**
   * @param {string} value
   */
  setProductId(value) {
    this.productId_ = value;
  }

  /**
   * @return {!Array<string>}
   */
  getSkus() {
    return this.skus_;
  }

  /**
   * @param {(string|!Array<string>)} skus
   */
  addSkus(skus) {
    const newSkus = new Array(skus);
    this.skus_ = this.skus_.concat(newSkus);
  }

  /**
   * @return {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>}
   */
  toArray() {
    return [
      'showOffers',     // message type
      this.productId_,  // field 1 - product_id
      this.skus_,       // field_2 - skus
    ];
  }
}

/**
 * Utility to deserialize a buffer
 * @param {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>} data
 * @return {?Object}
 */
function _deserializer(data) {
  /** {?string} */
  const key = data ? data[0] : null;
  if (key) {
    const ctor = PROTO_MAP[key];
    if (ctor) {
      return new ctor(data);
    }
  }
  throw 'Deserialization failed for ' + data;
}

/**
 * Compare two protos
 * @param {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>} thisArray
 * @param {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>} otherArray
 * @return {boolean}
 */
function _isEqual(thisArray, otherArray) {
  if (!otherArray || !thisArray) {
    return false;
  }
  for (let i = 0; i < otherArray.length; i++) {
    if (Array.isArray(thisArray[i])) {
      if (!Array.isArray(otherArray[i])) {
        return false;
      }
      const arr = thisArray[i];
      const otherArr = otherArray[i];
      if (arr.length != otherArr.length) {
        return false;
      }
      for (let j = 0; j < arr.length; j++) {
        if (arr[j] != otherArr[j]) {
          return false;
        }
      }
    } else {
      if (thisArray[i] != otherArray[i]) {
        return false;
      }
    }
  }
  return true;
}

const PROTO_MAP = {
  'showOffers': _ShowOffers,
  'messageEnvelope': _MessageEnvelope,
};

// Can't export from since that transpiles to a getter which breaks type
// checking.
export const ShowOffers = _ShowOffers;
export const MessageEnvelope = _MessageEnvelope;
export const deserializer = _deserializer;
export const isEqual = _isEqual;
