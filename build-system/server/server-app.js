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

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.set('view engine', 'html');
app.engine('html', require('hogan-express'));
app.locals.delimiters = '<% %>';

// HTTPS redirect.
app.use((req, res, next) => {
  let host = req.headers.host || req.host;
  const secure =
    req.secure ||
    req.connection.encrypted ||
    req.get('X-Forwarded-Proto') === 'https';
  if (secure || host.indexOf('localhost') != -1) {
    // Skip localhost or if already secure.
    next();
    return;
  }
  if (host.indexOf(':80') == host.length - 3) {
    host = host.substring(0, host.length - 3);
  }
  res.writeHead(301, {location: 'https://' + host + req.originalUrl});
  res.end();
});

// X-Frame-Options and CSP
app.use((req, res, next) => {
  if (req.query['--X-Frame-Options']) {
    res.set({
      'X-Frame-Options': req.query['--X-Frame-Options'],
    });
  }
  if (req.query['--CSP']) {
    res.set({
      'Content-Security-Policy': req.query['--CSP'],
    });
  }
  next();
});

/**
 * Redirect to sample-pub.
 */
app.get('/', (req, res) => {
  res.redirect(
    302,
    '/examples/sample-pub/' +
      (req.query.test !== undefined ? `?test=${req.query.test}` : '')
  );
});

/**
 */
app.get('/env', (req, res) => {
  res.json({
    'NODE_ENV': process.env.NODE_ENV,
  });
});

app.use(
  '/examples/sample-pub',
  require('../../examples/sample-pub/sample-pub-app')
);

app.use(
  '/examples/sample-sp',
  require('../../examples/sample-sp/sample-sp-app')
);

app.use(
  '/test/auth-header/service',
  require('../../test/auth-header/service-app')
);

module.exports = app;
