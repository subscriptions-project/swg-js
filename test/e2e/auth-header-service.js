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
'use strict';

const app = (module.exports = require('express').Router());
app.use(require('cookie-parser')());

/**
 */
app.get('/set-cookie', (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.cookie('test-auth-header', '1', {
    maxAge: /* 24 hours */ 24 * 1000 * 60 * 60,
  });
  res.send('Done.');
});

/**
 */
app.get('/echo', echoHandler);
app.post('/echo', echoHandler);

/**
 */
function echoHandler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.send(
    JSON.stringify({
      method: req.method,
      cookie: req.cookies && req.cookies['test-auth-header'],
      authorization: req.headers['authorization'],
    })
  );
}
