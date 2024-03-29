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

/** @externs */

/**
 * @template T
 * @constructor
 */
const ArrayLike = function () {};

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
 * Google JS APIs.
 * @type {{
 *   load: function(string, function(): void),
 *   auth2: {
 *     init: function(!Object=): !Promise,
 *     getAuthInstance: function(): {
 *       signOut: function(): !Promise,
 *     },
 *   },
 *   signin2: {
 *     render: function(string, !Object): void
 *   },
 * }}
 */
window.gapi;

/**
 * GIS (Google Identity Services) API.
 * @type {{
 *  accounts: {
 *    id: {
 *      initialize: function(!Object): !Promise,
 *      renderButton: function(Element, !Object): !Promise,
 *    },
 *  },
 * }}
 */
window.google;
