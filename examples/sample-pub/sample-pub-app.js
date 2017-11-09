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
// To resolve 'exports', 'Buffers' is not defined no-undef error.
/*eslint-env node*/
'use strict';

const {encrypt, toBase64} = require('./utils/crypto');

const app = module.exports = require('express').Router();
const ARTICLES = require('./content').ARTICLES;
ARTICLES.forEach((a, index) => {
  a.id = index + 1;
});

app.use('/oauth', require('./service/sample-pub-oauth-app'));
app.use('/api', require('./service/subscriber-app'));

/** @const {string} */
const AUTH_URL_TEST = '/examples/sample-sp/api';

/** @const {string} */
const AUTH_URL_PUB = '/examples/sample-pub/api';

/** @const {string} */
const AUTH_URL_PROD =
    'https://swg-staging.sandbox.google.com/_/v1/swg/entitlement';

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
 * Publisher viewer page.
 */
app.get('/viewer', (req, res) => {
  res.render('../examples/sample-pub/views/viewer', {});
});

/**
 * Logs-in user on the publisher's domain and redirects to the referrer.
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
  // TODO: Restrict correct redirect URL for the current publisher.
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
  res.render('../examples/sample-pub/views/article', {
    authUrl: getAuthUrl(req),
    pubAuthUrl: getPubAuthUrl(req),
    id,
    article,
    prev: prevId,
    next: nextId,
    testParams: getTestParams(req),
  });
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
function getAuthUrl(req) {
  const isTest = isTestReq(req);
  if (isTest) {
    const isLocal = isLocalReq(req);
    const host = req.headers.host;
    if (isLocal) {
      return `//${host.replace(/.*localhost/, 'sp.localhost')}${AUTH_URL_TEST}`;
    }
    return `//${host}${AUTH_URL_TEST}`;
  }
  return AUTH_URL_PROD;
}

/**
 * @param {!HttpRequest} req
 * @return {string}
 */
function getPubAuthUrl(req) {
  const isLocal = isLocalReq(req);
  const host = req.headers.host;
  if (isLocal) {
    return `//${host.replace(/.*localhost/, 'pub.localhost')}${AUTH_URL_PUB}`;
  }
  return `//${host}${AUTH_URL_PUB}`;
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
