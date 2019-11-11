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

/**
 * @fileoverview
 *
 * This file provides support for publication defined subscription status. By
 * default, a few email addresses are treated as subscribers but others can be
 * added over time.
 */

const {decrypt, fromBase64} = require('../utils/crypto');
const app = (module.exports = require('express').Router());
app.use(require('cookie-parser')());

/** @const {SubscriptionMetering} Default metering configuration. */
const metering = {
  'quotaLeft': 3,
  'quotaMax': 3,
  'quotaPeriod': 'month',
  'display': true,
};

/** @const {SubscriptionResponse} Default metering configuration. */
const DEFAULT_ENTITLEMENT = {'entitled': false};

/**
 * @const {Object<string, SubscriptionResponse>} List of users and their auth
 *   state.
 */
const users = {
  'subscriber@gmail.com': {'entitled': true},
  'metered@gmail.com': {
    entitled: false,
    metering: map(metering),
  },
};

/** @const {Object} Meta information about the users. */
const meteringMeta = {};

app.get('/', (req, res) => {
  const user = getUser(req);
  const articleLink = req.headers.referer || '';
  let response = {};
  if (user && !users[user]) {
    users[user] = users[user] || map(DEFAULT_ENTITLEMENT);
    users[user]['metering'] = map(metering);
  }
  if (user && articleLink) {
    const metering = users[user]['metering'];
    if (
      (users[user] && users[user]['entitled']) ||
      (metering && metering['quotaLeft'] == 0)
    ) {
      // Nothing to do here.
    } else {
      // Not a subscribed user but has read access through metering. Update meta.
      const articlesRead = meteringMeta[user] || [];
      if (articlesRead.indexOf(articleLink) == -1) {
        articlesRead.push(articleLink);
      }
      meteringMeta[user] = articlesRead;
      users[user]['metering']['quotaLeft'] = Math.max(
        0,
        metering.quotaMax - articlesRead.length
      );
    }
    response = users[user];
  }

  const origin = req.get('origin') || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Credentials', 'true');
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.send(response);
});

app.get('/debug-subscribers', (req, res) => {
  const displayUsers = [];
  let i = 0;
  for (const u in users) {
    displayUsers[i] = map(users[u]);
    displayUsers[i]['id'] = u;
    displayUsers[i]['index'] = i + 1;
    i++;
  }
  res.render('../examples/sample-pub/views/subscribers', {users: displayUsers});
});

function getUser(req) {
  if (!req.cookies || !req.cookies['G_PUB_USER']) {
    return '';
  }
  return decrypt(fromBase64(req.cookies['G_PUB_USER']));
}

function map(initial) {
  const obj = Object.create(null);
  if (initial) {
    Object.assign(obj, initial);
  }
  return obj;
}
