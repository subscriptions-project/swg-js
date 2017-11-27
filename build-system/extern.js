/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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


/** @externs */

/**
 * @template T
 * @constructor
 */
var ArrayLike = function() {}

/**
 * @type {number}
 */
ArrayLike.prototype.length;


/**
 * A type for Objects that can be JSON serialized or that come from
 * JSON serialization. Requires the objects fields to be accessed with
 * bracket notation object['name'] to make sure the fields do not get
 * obfuscated.
 * @constructor
 * @dict
 */
function JsonObject() {}


/**
 * Subscription metering.
 * TODO(dparikh): "quotaMax" is not available at:
 * https://docs.google.com/document/d/1PrNTKzpkFja8LA27tHeqqG8hm918aI5wPI41Ykc1lBE/edit#heading=h.12wjaxir6me2
 * @typedef {{
 *   quotaLeft: number,
 *   quotaMax: number,
 *   quotaPeriod: string,
 *   display: boolean
 * }}
 */
var SubscriptionMetering;


/**
 * Subscription status.
 * @typedef {{
 *   healthy: boolean,
 *   entitlementId: string,
 *   types: (!Array<string>|undefined),
 *   source: string
 * }}
 */
var SubscriptionStatus;


/**
 * Subscription details and Offer response from Offers Api.
 * Includes:
 *   - Is user Logged-in to google
 *   - Is user a subscriber and healthy status
 *   - metering data
 *   - Abbriviated offers related to the publisher  // TODO(dparikh): Confirm
 *   - Offers related to the publisher
 *
 *  @typedef {{
 *    entitled: boolean,
 *    subscriber: (SubscriptionStatus|undefined),
 *    metering: (SubscriptionMetering|undefined),
 *    abbreviatedOffers: (!Array<!Object>|undefined),
 *    offers: (!Array<!Object>|undefined)
 *  }}
 */
var SubscriptionResponse;
