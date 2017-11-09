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
'use strict';


/**
 * @fileoverview
 *
 * This file provides support for publisher defined subscription status. By
 * default, a few email addresses are treated as subscribers but others can be
 * added over time.
 */

const {decrypt, fromBase64} = require('../utils/crypto');
const app = module.exports = require('express').Router();
app.use(require('cookie-parser')())


const DEFAULT_ENTITLELMENT = {
  'subscribed': false,
  'metering': {
    'quotaLeft': 3,
    'quotaMax': 3,
    'quotaPeriod': 'month',
    'display': true,
  },
};


let users = {
  'subscriber@gmail.com': { 'subscribed': true, },
  'metered@gmail.com': {
    subscribed: false,
    metering: {
      quotaLeft: 2,
      quotaMax: 3,
      quotaPeriod: 'month',
      display: true
    },
  },
};


const meteringMeta = {};


app.get('/', (req, res) => {
  const user = getUser(req);
  const articleLink = req.headers.referer || '';
  let response = {};
  if (user) {
    users[user] = users[user] || DEFAULT_ENTITLELMENT;
  }
  if (user && articleLink) {
    var metering = users[user]['metering'];
    if ((users[user] && users[user]['subscribed']) ||
        (metering && metering['quotaLeft'] == 0)) {
      // Nothing to do here.
    } else {
      // Not a subscribed user but has read access through metering. Update meta.
      var articlesRead = meteringMeta[user] || [];
      if (articlesRead.indexOf(articleLink) == -1) {
        articlesRead.push(articleLink);
      }
      meteringMeta[user] = articlesRead;
      users[user]['metering']['quotaLeft'] = Math.max(0,
          metering.quotaMax - articlesRead.length);
    }
    response = users[user];
  }

  const origin = req.get('origin') || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Credentials', 'true');
  res.send(response);
});


app.get('/subscribers', (req, res) => {
  const USERS = [];
  let i = 0;
  for (let u in users) {
    USERS[i] = users[u];
    USERS[i]['id'] = u;
    USERS[i]['index'] = i + 1;
    i++;
  }
  res.render('../examples/sample-pub/views/subscribers', {users: USERS});
});


function getUser(req) {
  if (!req.cookies || !req.cookies['G_PUB_USER']) {
    return '';
  }
  return decrypt(fromBase64(req.cookies['G_PUB_USER']));
}
