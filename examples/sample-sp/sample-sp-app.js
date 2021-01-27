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
'use strict';

const app = (module.exports = require('express').Router());

/**
 * Default test response.
 * @const {string}
 */
const DEFAULT_RESPONSE = 'metered-full-response';

/**
 * Availabe test responses.
 * @const Set<string>
 */
const RESPONSES = new Set([
  DEFAULT_RESPONSE,
  'metered-avail-response',
  'subscriber-issue-response',
  'subscriber-response',
  'unsigned-response',
]);

/**
 * An Article. ?url=(([^&]+)&test_response=([^&]+).*
 */
app.get(/\/api/, (req, res) => {
  const options = {
    root: __dirname,
    dotfiles: 'deny',
  };

  // TODO(dparikh): req.headers.referer could be flaky. Find better option.
  const referer = req.headers.referer || '';
  let restResponse = getParameterByName_(referer, 'test_response');
  restResponse = RESPONSES.has(restResponse) ? restResponse : DEFAULT_RESPONSE;

  const origin = req.get('origin') || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Credentials', 'true');

  res.sendFile(`views/${restResponse}.json`, options);
});

/**
 * Parses the Url for the value of "test_response" Url parameter.
 * @param {string} url The referer Url.
 * @param {string} param The name of the parameter.
 * @return {string}
 * @private
 */
function getParameterByName_(url, param) {
  const name = param.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(url);
  if (!results) {
    return null;
  }
  if (!results[2]) {
    return '';
  }
  return results[2].replace(/\+/g, ' ');
}
