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

const {encrypt, toBase64} = require('./utils/crypto');

const app = module.exports = require('express').Router();
app.use(require('cookie-parser')())
const ARTICLES = require('./content').ARTICLES;

app.use('/oauth', require('./service/sample-pub-oauth-app'));
app.use('/api', require('./service/authorization-app'));

const AUTH_URL_TEST = '/examples/sample-sp/api';
const AUTH_URL_PUB = '/examples/sample-pub/api';

const PUBLICATION_ID = process.env.SERVE_PUBID || 'scenic-2017.appspot.com';

const SWG_JS_URLS = {
  local: '/dist/subscriptions.max.js',
  prod: 'https://news.google.com/swg/js/v1/swg.js',
  autopush: 'https://news.google.com/swg/js/v1/swg-autopush.js',
  tt: 'https://news.google.com/swg/js/v1/swg-tt.js',
};

/** @const {string} */
const G_PUB_USER = 'G_PUB_USER';

/**
 * List all Articles.
 */
app.get('/', (req, res) => {
  let originalUrl = req.originalUrl;
  let originalQuery = '';
  const queryIndex = originalUrl.indexOf('?');
  if (queryIndex != -1) {
    originalQuery = originalUrl.substring(queryIndex);
    originalUrl = originalUrl.substring(0, queryIndex);
  }
  if (originalUrl.charAt(originalUrl.length - 1) != '/') {
    res.redirect(302, originalUrl + '/' + originalQuery);
    return;
  }
  res.render('../examples/sample-pub/views/list', {
    title: 'Select an article to get started',
    articles: ARTICLES,
    testParams: getTestParams(req),
  });
});

/**
 * Signin page.
 */
app.get('/pub-signin', (req, res) => {
  const params = getVerifiedSigninParams(req);
  res.render('../examples/sample-pub/views/pub-signin', {
    'redirectUri': params.redirectUri,
  });
});

/**
 * Publication viewer page.
 */
app.get('/viewer', (req, res) => {
  res.render('../examples/sample-pub/views/viewer', {});
});

/**
 * Logs-in user on the publication's domain and redirects to the referrer.
 * Also sets the authorized user's name in the cookie.
 */
app.post('/pub-signin-submit', (req, res) => {
  const redirectUri = getParam(req, 'redirect_uri');
  if (!redirectUri) {
    throw new Error('No redirect URL specified!');
  }
  const email = req.body['email'];
  const password = req.body['password'];
  if (!email || !password) {
    throw new Error('Missing email and/or password');
  }
  setUserInfoInCookies_(res, email);
  res.redirect(302, redirectUri);
});

/**
 * Sets user email in the cookie.
 * @param {!HttpRequest} req
 * @param {string} email
 * @private
 */
function setUserInfoInCookies_(res, email) {
  res.clearCookie(G_PUB_USER);
  res.cookie(G_PUB_USER, toBase64(encrypt(email)),
      {maxAge: /* 60 minutes */1000 * 60 * 60});
}

/**
 * Checks the validity and return request parameters.
 * @param {!HttpRequest} req
 * @return {!Object<string, ?string>}
 */
function getVerifiedSigninParams(req) {
  const params = {
    redirectUri: req.query['redirect_uri'] || null,
    state: req.query['state'] || null,
  };
  if (!params.redirectUri) {
    throw new Error('Missing redirect_uri in request.');
  }
  // TODO: Restrict correct redirect URL for the current publication.
  return params;
}

/**
 * An Article.
 */
app.get('/((\\d+))', (req, res) => {
  const id = parseInt(req.params[0], 10);
  const article = ARTICLES[id - 1];
  const prevId = (id - 1) >= 0 ? String(id - 1) : false;
  const nextId = (id + 1) < ARTICLES.length ? String(id + 1) : false;
  const setup = {
    script: req.cookies && req.cookies['script'] || 'local',
  };
  res.render('../examples/sample-pub/views/article', {
    swgJsUrl: SWG_JS_URLS[setup.script],
    setup: setup,
    publicationId: PUBLICATION_ID,
    id,
    article,
    prev: prevId,
    next: nextId,
    testParams: getTestParams(req),
  });
});

/**
 * Setup page.
 */
app.get('/setup', (req, res) => {
  const state = {
    script: req.cookies && req.cookies['script'] || 'local',
  };
  const args = {};
  args['script'] = state.script;
  args['script_' + state.script] = true;
  res.render('../examples/sample-pub/views/setup', args);
});

/**
 * Update setup page.
 */
app.post('/update-setup', (req, res) => {
  // Update data.
  const state = {
    script: req.body['script'] || 'local',
  };
  res.clearCookie('script');
  res.cookie('script', state.script);

  // Redirect back.
  res.redirect(302, '/examples/sample-pub/setup');
});

/**
 * @param {!HttpRequest} req
 * @return {boolean}
 */
function isLocalReq(req) {
  const host = req.headers.host;
  return host.indexOf('localhost') != -1;
}

/**
 * @param {!HttpRequest} req
 * @return {boolean}
 */
function isTestReq(req) {
  return (isLocalReq(req) || req.query.test !== undefined)
      && req.query.test !== '0';
}


/**
 * @param {!HttpRequest} req
 * @return {string}
 */
function getTestParams(req) {
  if (isTestReq(req)) {
    return isLocalReq(req) ? '' : 'test=1';
  }
  return isLocalReq(req) ? 'test=0' : '';
}

/**
 * @param {!HttpRequest} req
 * @param {string} name
 * @return {?string}
 */
function getParam(req, name) {
  return req.query[name] || req.body && req.body[name] || null;
}
