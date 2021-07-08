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

const BBPromise = require('bluebird');
const request = BBPromise.promisify(require('request'));

const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const GITHUB_BASE = 'https://api.github.com/repos/subscriptions-project/swg-js';

/**
 * @param {!{path: string, qs: Object, json: Object, method: string | undefined}} req
 */
exports.githubRequest = function (req) {
  return request({
    url: GITHUB_BASE + req.path,
    qs: req.qs || {},
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${GITHUB_ACCESS_TOKEN}`,
      'User-Agent': 'swg-changelog-gulp-task',
    },
    json: req.json ? req.json : undefined,
    method: req.method || 'GET',
  }).then((res) => {
    if (res.statusCode >= 400) {
      throw new Error(`Failed calling ${res.request.path}\nError: ${res.statusCode}`);
    }

    // If request has already transformed this into an object, we 
    // don't need to parse
    if (typeof res.body === 'object') return res.body;
    if (typeof res.body === 'string') return JSON.parse(res.body);
  });
};
