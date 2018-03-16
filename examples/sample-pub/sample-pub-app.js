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
const {
  decrypt,
  encrypt,
  fromBase64,
  toBase64,
} = require('./utils/crypto');

const app = module.exports = require('express').Router();
app.use(require('cookie-parser')())
const ARTICLES = require('./content').ARTICLES;

app.use('/oauth', require('./service/sample-pub-oauth-app'));
app.use('/api', require('./service/authorization-app'));

const AUTH_URL_TEST = '/examples/sample-sp/api';
const AUTH_URL_PUB = '/examples/sample-pub/api';

const PUBLICATION_ID = process.env.SERVE_PUBID || 'scenic-2017.appspot.com';
const AMP_LOCAL = process.env.SERVE_AMP_LOCAL == 'true';

const SWG_JS_URLS = {
  local: '/dist/subscriptions.max.js',
  prod: 'https://news.google.com/swg/js/v1/swg.js',
  autopush: 'https://news.google.com/swg/js/v1/swg-autopush.js',
  tt: 'https://news.google.com/swg/js/v1/swg-tt.js',
};

const AUTH_COOKIE = 'SCENIC_AUTH';
const METER_COOKIE = 'SCENIC_METER';
const MAX_METER = 3;

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
app.get('/((\\d+))', (req, res) => {
  const id = parseInt(req.params[0], 10);
  const article = ARTICLES[id - 1];
  const prevId = (id - 1) >= 0 ? String(id - 1) : false;
  const nextId = (id + 1) < ARTICLES.length ? String(id + 1) : false;
  const setup = getSetup(req);
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
 * An AMP Article.
 */
app.get('/((\\d+))\.amp', (req, res) => {
  const id = parseInt(req.params[0], 10);
  const article = ARTICLES[id - 1];
  const prevId = (id - 1) >= 0 ? String(id - 1) + '.amp' : false;
  const nextId = (id + 1) < ARTICLES.length ? String(id + 1) + '.amp' : false;
  const setup = getSetup(req);
  const amp = {
    'amp_js': ampJsUrl('amp'),
    'subscriptions_js': ampJsUrl('amp-subscriptions'),
    'subscriptions_google_js': ampJsUrl('amp-subscriptions-google'),
    'mustache_js': ampJsUrl('amp-mustache'),
  };
  res.render('../examples/sample-pub/views/article-amp', {
    amp: amp,
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
 * AMP entitlements request.
 */
app.get('/amp-entitlements', (req, res) => {
  const pubId = req.query.pubid;
  // TODO(dvoytenko): test if the origin is actually allowed.
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Expose-Headers',
      'AMP-Access-Control-Allow-Source-Origin');
  if (req.query.__amp_source_origin) {
    res.setHeader('AMP-Access-Control-Allow-Source-Origin',
        req.query.__amp_source_origin);
  }
  const email = getUserInfoFromCookies_(req);
  if (email) {
    res.json({
      'products': [pubId + ':news'],
      'subscriptionToken': 'subtok-' + pubId + '-' + toBase64(encrypt(email)),
    });
  } else if (req.query.meter == '1') {
    const meter = getMeterFromCookies(req);
    if (meter > 0) {
      res.json({
        'products': [pubId + ':news'],
        'metering': {
          'left': meter,
          'total': MAX_METER,
        },
      });
    } else {
      res.json({});
    }
  } else {
    res.json({});
  }
});

/**
 * AMP pingback request.
 */
app.post('/amp-pingback', (req, res) => {
  const pubId = req.query.pubid;
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Expose-Headers',
      'AMP-Access-Control-Allow-Source-Origin');
  if (req.query.__amp_source_origin) {
    res.setHeader('AMP-Access-Control-Allow-Source-Origin',
        req.query.__amp_source_origin);
  }
  decMeterInCookies(req, res);
  res.json({});
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

/**
 * @param {!HttpRequest} req
 * @return {{
 *   script: string,
 * }}
 */
function getSetup(req) {
  return {
    script: req.cookies && req.cookies['script'] || 'local',
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
    res.cookie(AUTH_COOKIE, toBase64(encrypt(email)),
        {maxAge: /* 60 minutes */1000 * 60 * 60});
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
  if (!returnUrl.startsWith('/') &&
      !returnUrl.startsWith('https://cdn.ampproject.org') &&
      !returnUrl.startsWith('https://scenic-2017.appspot.com') &&
      !returnUrl.startsWith('http://localhost:') &&
      !returnUrl.startsWith('https://localhost:')) {
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
  res.cookie(METER_COOKIE, String(newMeter),
      {maxAge: /* 60 minutes */ 1000 * 60 * 60});
}

/**
 * @param {string} name
 * @return {string}
 */
function ampJsUrl(name) {
  if (name == 'amp') {
    return AMP_LOCAL ?
        'http://localhost:8001/dist/amp.js' :
        'https://cdn.ampproject.org/v0.js';
  }
  return AMP_LOCAL ?
      'http://localhost:8001/dist/v0/' + name + '-0.1.max.js' :
      'https://cdn.ampproject.org/v0/' + name + '-0.1.js';
}
