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
 * @fileoverview Creates an http server to handle responses for different test cases.
 */
const app = require('express')();
const bodyParser = require('body-parser');

app.use(bodyParser.json());

function setCorsHeaders(req, res, next) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
}
app.use(setCorsHeaders);

app.use('/get', (req, res) => {
  res.json({
    args: req.query,
    headers: req.headers,
  });
});

app.use('/redirect-to', (req, res) => {
  res.redirect(302, req.query.url);
});

app.use('/status/404', (req, res) => {
  res.status(404).end();
});

app.use('/status/500', (req, res) => {
  res.status(500).end();
});

app.use('/cookies/set', (req, res) => {
  for (const name in req.query) {
    res./*OK*/ cookie(name, req.query[name]);
  }
  res.json({
    cookies: req.cookies || {},
  });
});

app.use('/response-headers', (req, res) => {
  for (const name in req.query) {
    res.setHeader(name, req.query[name]);
  }
  res.json({});
});

app.use('/post', (req, res) => {
  res.json({
    json: req.body,
  });
});

exports.app = app;
