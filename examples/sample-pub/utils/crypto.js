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

// To resolve 'exports', 'Buffers' is not defined no-undef error.
/*eslint-env node*/

/**
 * @param {!Object<string, *>} object
 * @return {string}
 */
exports.encrypt = function (object) {
  return 'encrypted(' + JSON.stringify(object) + ')';
};

/**
 * @param {string} s
 * @return {!Object<string, *>}
 */
exports.decrypt = function (s) {
  if (s.indexOf('encrypted(') != 0) {
    throw new Error('Cannot decrypt "' + s + '"');
  }
  const decrypted = s.substring('encrypted('.length, s.length - 1);
  try {
    return JSON.parse(decrypted);
  } catch (e) {
    throw new Error('Cannot parse decrypted blob: "' + decrypted + '": ' + e);
  }
};

/**
 * @param {string} s
 * @return {string}
 */
exports.toBase64 = function (s) {
  return Buffer.from(s).toString('base64');
};

/**
 * @param {string} s
 * @return {string}
 */
exports.fromBase64 = function (s) {
  return Buffer.from(s, 'base64').toString();
};
