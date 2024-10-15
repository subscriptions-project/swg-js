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

const jsonwebtoken = require('jsonwebtoken');
const {decrypt, encrypt, fromBase64, toBase64} = require('./utils/crypto');

const app = (module.exports = require('express').Router());
app.use(require('cookie-parser')());
const ARTICLES = require('./content').ARTICLES;

app.use('/oauth', require('./service/sample-pub-oauth-app'));
app.use('/api', require('./service/authorization-app'));

const PUBLICATION_ID = process.env.SERVE_PUBID || 'scenic-2017.appspot.com';
const JS_TARGET = process.env.SERVE_JS_TARGET || 'local';

const SWG_JS_URLS = {
  local: '/dist/subscriptions.max.js',
  /* eslint-disable google-camelcase/google-camelcase */
  local_min: '/dist/subscriptions.js',
  /* eslint-enable google-camelcase/google-camelcase */
  prod: 'https://news.google.com/swg/js/v1/swg.js',
  autopush: 'https://news.google.com/swg/js/v1/swg-autopush.js',
  qual: 'https://news.google.com/swg/js/v1/swg-qual.js',
};

const SWG_GAA_JS_URLS = {
  local: '/dist/subscriptions-gaa.max.js',
  /* eslint-disable-next-line google-camelcase/google-camelcase */
  local_min: '/dist/subscriptions-gaa.js',
  prod: 'https://news.google.com/swg/js/v1/swg-gaa.js',
  autopush: 'https://news.google.com/swg/js/v1/swg-gaa-autopush.js',
  qual: 'https://news.google.com/swg/js/v1/swg-gaa-qual.js',
};

const SWG_BASIC_JS_URLS = {
  local: '/dist/basic-subscriptions.max.js',
  /* eslint-disable-next-line google-camelcase/google-camelcase */
  local_min: '/dist/basic-subscriptions.js',
  prod: 'https://news.google.com/swg/js/v1/swg-basic.js',
  autopush: 'https://news.google.com/swg/js/v1/swg-basic-autopush.js',
  qual: 'https://news.google.com/swg/js/v1/swg-basic-qual.js',
};

const AUTH_COOKIE = 'SCENIC_AUTH';
const METER_COOKIE = 'SCENIC_METER';
const MAX_METER = 3;

/**
 * Configs to be used to set publication data by URL param.
 */
const CONFIGS = {
  'rrme-subscriptions-prod': {
    publicationId: 'CAowo5_ZCw',
  },
  'rrme-subscriptions-qual': {
    publicationId: 'CAowwuyEAQ',
  },
  'rrme-contributions-prod': {
    publicationId: 'CAowpJ_ZCw',
  },
  'rrme-contributions-qual': {
    publicationId: 'CAow-Jp5',
  },
};

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
 * An Article.
 */
app.get('/:id(\\d+)', (req, res) => {
  renderArticle(req, res);
});

app.get('/config/:config/:id(\\d+)', (req, res) => {
  renderArticle(req, res);
});

function renderArticle(req, res) {
  const {id, config} = req.params;
  const publicationId = CONFIGS[config]?.publicationId ?? PUBLICATION_ID;
  const article = ARTICLES[id - 1];
  const prevId = id - 1 >= 0 ? String(id - 1) : false;
  const nextId = id + 1 < ARTICLES.length ? String(id + 1) : false;
  const setup = getSetup(req);
  res.render('../examples/sample-pub/views/article', {
    includeLdJson: req.query.manualInitialization === undefined,
    swgJsUrl: SWG_JS_URLS[setup.script],
    swgGaaJsUrl: SWG_GAA_JS_URLS[setup.script],
    setup,
    publicationId,
    id,
    article,
    prev: prevId,
    next: nextId,
    testParams: getTestParams(req),
  });
}

/**
 * Subscribe page. Format:
 * /signin?return=RETURN_URL
 */
app.get('/subscribe', (req, res) => {
  const returnUrl = cleanupReturnUrl(req.query['return'] || null);
  res.render('../examples/sample-pub/views/signin', {
    'type_subscribe': true,
    'returnUrl': returnUrl,
  });
});

/**
 * Signin page. Format:
 * /signin?return=RETURN_URL
 */
app.get('/signin', (req, res) => {
  const returnUrl = cleanupReturnUrl(req.query['return'] || null);
  res.render('../examples/sample-pub/views/signin', {
    'type_signin': true,
    'returnUrl': returnUrl,
  });
});

/**
 * Logs-in user on the publication's domain and redirects to the referrer.
 * Also sets the authorized user's name in the cookie.
 */
app.post('/signin', (req, res) => {
  const returnUrl = cleanupReturnUrl(getParam(req, 'returnUrl'));
  let email = req.body['email'];
  const password = req.body['password'];
  const idToken = req.body['id_token'];
  if ((!email || !password) && !idToken) {
    throw new Error('Missing email and/or password');
  }
  if (idToken) {
    // TODO(dvoytenko): verify token as well.
    const jwt = jsonwebtoken.decode(idToken);
    email = jwt['email'];
  }
  setUserInfoInCookies_(res, email);
  res.redirect(302, returnUrl);
});

/**
 * Signout page. Format:
 * /signin?return=RETURN_URL
 */
app.get('/signout', (req, res) => {
  setUserInfoInCookies_(res, null);
  res.redirect(302, '/');
});

/**
 * GSI iframe for metering demo.
 */
app.get('/gsi-iframe', (req, res) => {
  const setup = getSetup(req);
  res.render('../examples/google-signin/google-signin-iframe', {
    swgGaaJsUrl: SWG_GAA_JS_URLS[setup.script],
  });
});

/**
 * GIS iframe for metering demo.
 */
app.get('/gis-iframe', (req, res) => {
  const setup = getSetup(req);
  res.render('../examples/google-signin/sign-in-with-google-iframe', {
    swgGaaJsUrl: SWG_GAA_JS_URLS[setup.script],
  });
});

/**
 * Google third party sign in iframe for metering demo.
 */
app.get('/g3p-iframe', (req, res) => {
  const setup = getSetup(req);
  res.render('../examples/google-signin/google-3p-signin-iframe', {
    swgGaaJsUrl: SWG_GAA_JS_URLS[setup.script],
  });
});

/**
 * Setup page.
 */
app.get('/setup', (req, res) => {
  const state = getSetup(req);
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

/** Redirects to SwG JS for the chosen environment. */
app.get('/redirect-to/swg.js', (req, res) => {
  const setup = getSetup(req);
  res.redirect(SWG_JS_URLS[setup.script]);
});

/** Redirects to SwG Showcase JS for the chosen environment. */
app.get('/redirect-to/swg-gaa.js', (req, res) => {
  const setup = getSetup(req);
  res.redirect(SWG_GAA_JS_URLS[setup.script]);
});

/** Redirects to SwG Basic JS for the chosen environment. */
app.get('/redirect-to/swg-basic.js', (req, res) => {
  const setup = getSetup(req);
  res.redirect(SWG_BASIC_JS_URLS[setup.script]);
});

/**
 * Fixed 1st article for Simplified API demo
 */
app.get('/ea-simplified-api', (req, res) => {
  const article = ARTICLES[0];
  const setup = getSetup(req);
  res.render('../examples/sample-pub/views/article-ea-simplified-api', {
    swgJsUrl: SWG_JS_URLS[setup.script],
    swgGaaJsUrl: SWG_GAA_JS_URLS[setup.script],
    setup,
    publicationId: PUBLICATION_ID,
    article,
  });
});

/**
 * @param {!HttpRequest} req
 * @return {{
 *   script: string,
 * }}
 */
function getSetup(req) {
  return {
    script: (req.cookies && req.cookies['script']) || JS_TARGET,
  };
}

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
  return (
    (isLocalReq(req) || req.query.test !== undefined) && req.query.test !== '0'
  );
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
  return req.query[name] || (req.body && req.body[name]) || null;
}

/**
 * Returns subscriber.
 * @param {!HttpRequest} req
 * @return {?string}
 * @private
 */
function getUserInfoFromCookies_(req) {
  const cookie = req.cookies && req.cookies[AUTH_COOKIE];
  if (!cookie) {
    return null;
  }
  return decrypt(fromBase64(cookie));
}

/**
 * Sets user email in the cookie.
 * @param {!HttpResponse} res
 * @param {string} email
 * @private
 */
function setUserInfoInCookies_(res, email) {
  res.clearCookie(AUTH_COOKIE);
  if (email) {
    res.cookie(AUTH_COOKIE, toBase64(encrypt(email)), {
      maxAge: /* 60 minutes */ 1000 * 60 * 60,
    });
  }
}

/**
 * @param {string} returnUrl
 * @return {string}
 */
function cleanupReturnUrl(returnUrl) {
  if (!returnUrl) {
    returnUrl = '/';
  }
  // Make sure we do not introduce a universal unbound redirector.
  if (
    !returnUrl.startsWith('/') &&
    !returnUrl.startsWith('https://scenic-2017.appspot.com') &&
    !returnUrl.startsWith('http://localhost:') &&
    !returnUrl.startsWith('https://localhost:')
  ) {
    returnUrl = '/';
  }
  return returnUrl;
}

/**
 * @param {!HttpRequest} req
 * @return {number}
 */
function getMeterFromCookies(req) {
  const cookie = req.cookies && req.cookies[METER_COOKIE];
  if (!cookie) {
    return MAX_METER;
  }
  return parseInt(cookie, 10);
}

/**
 * @param {!HttpRequest} req
 * @param {!HttpResponse} res
 */
function decMeterInCookies(req, res) {
  const oldMeter = getMeterFromCookies(req);
  const newMeter = Math.max(oldMeter - 1, 0);
  res.cookie(METER_COOKIE, String(newMeter), {
    maxAge: /* 60 minutes */ 1000 * 60 * 60,
  });
}
