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

app.use('/oauth',
    require('./service/sample-pub-oauth-app'));

/** @const {string} */
const AUTH_URL_TEST = '/examples/sample-sp/api';

/** @const {string} */
const AUTH_URL_PROD = 'https://swg-staging.sandbox.google.com/_/v1/swg/entitlement';


/** @const {string} */
const G_PUB_USER = 'G_PUB_USER';

const ARTICLES = [
  {
    title: '16 Top Spots for Hiking',
    hero: 'hero/21.jpeg',
    category: 'Top Spots',
    kicker: 'Don\'t forget your walking stick',
    author: 'Demetria T. Edwards',
    date: 'Sep 24, 2016 10:04 AM',
  },
  {
    title: 'Vancouver in 48 Hours',
    category: '48 Hours',
    kicker: 'A Marvel in British Columbia',
    author: 'Todd M. Smallwood',
    date: 'Sep 22, 2016 5:04 AM',
    hero: 'hero/6.jpeg',
  },
  {
    title: '18 Top Spots for Backpacking',
    category: 'Top Spots',
    kicker: 'Pack your backpack',
    author: 'Demetria T. Edwards',
    date: 'Sep 20, 2016 7:06 AM',
    hero: 'hero/29.jpeg',
  },
  {
    title: 'Bucket List: New Zealand',
    category: 'Bucket List Adventures',
    kicker: 'This majestic land is offers everything from volcanic terrain to lush pastures',
    author: 'Nolan C. Sundquist',
    date: 'Sep 18, 2016 7:02 AM',
    hero: 'hero/12.jpeg',
  },
  {
    title: 'Bucket List: Sweden',
    category: 'Bucket List Adventures',
    kicker: 'Go Nordic and be amazed',
    author: 'Nolan C. Sundquist',
    date: 'Sep 16, 2016 1:37 PM',
    hero: 'hero/20.jpeg',
  },
  {
    title: 'Bucket List: Scotland',
    category: 'Bucket List Adventures',
    kicker: 'Venture into the highlands and see some truly remarkable sights',
    author: 'Nolan C. Sundquist',
    date: 'Sep 16, 2016 7:21 AM',
    hero: 'hero/17.jpeg',
  },
  {
    title: 'Bucket List: Grand Canyon',
    category: 'Bucket List Adventures',
    kicker: 'How to spend days exploring this US national treasure',
    author: 'Carol R. Wright',
    date: 'Sep 16, 2016 2:34 AM',
    hero: 'hero/16.jpeg',
  },
  {
    title: 'Bucket List: UK Countryside',
    category: 'Bucket List Adventures',
    kicker: 'Get outside the cities to relax in the idyllic heartland of the country',
    author: 'Shannon W. Marshall',
    date: 'Sep 14, 2016 9:25 AM',
    hero: 'hero/15.jpeg',
  },
  {
    title: 'Paris in 48 Hours',
    category: '48 Hours',
    kicker: 'The City of Lights',
    author: 'Joan P. Cypert',
    date: 'Sep 13, 2016 2:14 PM',
    hero: 'hero/3.jpeg',
  },
  {
    title: 'Bucket List: Banff',
    category: 'Bucket List Adventures',
    kicker: 'Don\'t miss all that this scenic spot in Alberta\'s Rockies can offer',
    author: 'Shannon W. Marshall',
    date: 'Sep 13, 2016 1:56 PM',
    hero: 'hero/14.jpeg',
  },
  {
    title: 'Bucket List: Romania',
    category: 'Bucket List Adventures',
    kicker: 'Some of the most scenic spots on earth',
    author: 'Nolan C. Sundquist',
    date: 'Sep 12, 2016 6:19 AM',
    hero: 'hero/19.jpeg',
  },
  {
    title: 'Hamburg in 48 Hours',
    category: '48 Hours',
    kicker: 'Gateway to the World',
    author: 'Joan P. Cypert',
    date: 'Sep 10, 2016 10:15 PM',
    hero: 'hero/1.jpeg',
  },
  {
    title: 'Chicago in 48 Hours',
    category: '48 Hours',
    kicker: 'The Windy City',
    author: 'Joan P. Cypert',
    date: 'Sep 7, 2016 9:14 AM',
    hero: 'hero/7.jpeg',
  },
  {
    title: 'Montreal in 48 Hours',
    category: '48 Hours',
    kicker: 'The City of Saints',
    author: 'Joan P. Cypert',
    date: 'Sep 7, 2016 4:39 AM',
    hero: 'hero/4.jpeg',
  },
  {
    title: 'Melbourne in 48 Hours',
    category: '48 Hours',
    kicker: 'Australia\'s Second City',
    author: 'Todd M. Smallwood',
    date: 'Sep 6, 2016 4:37 PM',
    hero: 'hero/2.jpeg',
  },
  {
    title: '14 Top Spots for a Music-Loving Adventurer',
    category: 'Top Spots',
    kicker: 'From EDM to sitars',
    author: 'Russell D. Hogan',
    date: 'Sep 6, 2016 5:50 AM',
    hero: 'hero/28.jpeg',
  },
  {
    title: '8 Top Spots to Experience America\'s Heartland',
    category: 'Top Spots',
    kicker: 'Sooie!',
    author: 'Russell D. Hogan',
    date: 'Sep 4, 2016 5:45 PM',
    hero: 'hero/22.jpeg',
  },
  {
    title: 'San Francisco in 48 Hours',
    category: '48 Hours',
    kicker: 'The City By the Bay',
    author: 'Joan P. Cypert',
    date: 'Sep 4, 2016 11:41 AM',
    hero: 'hero/9.jpeg',
  },
  {
    title: '11 Top Spots for Woodsy Splendor',
    category: 'Top Spots',
    kicker: 'Pitch your tent',
    author: 'Russell D. Hogan',
    date: 'Sep 3, 2016 1:16 PM',
    hero: 'hero/27.jpeg',
  },
  {
    title: 'New York City in 48 Hours',
    category: '48 Hours',
    kicker: 'The Big Apple',
    author: 'Joan P. Cypert',
    date: 'Sep 2, 2016 3:51 PM',
    hero: 'hero/11.jpeg',
  },
  {
    title: 'Seattle in 48 Hours',
    category: '48 Hours',
    kicker: 'The Emerald City',
    author: 'Todd M. Smallwood',
    date: 'Aug 29, 2016 1:46 PM',
    hero: 'hero/5.jpeg',
  },
  {
    title: '23 Top Spots to Just Relax',
    category: 'Top Spots',
    kicker: 'Ahhhhhh...',
    author: 'Demetria T. Edwards',
    date: 'Aug 28, 2016 2:18 PM',
    hero: 'hero/23.jpeg',
  },
  {
    title: '15 Top Spots for Underwater Adventuring',
    category: 'Top Spots',
    kicker: 'Grab your snorkel',
    author: 'Demetria T. Edwards',
    date: 'Aug 28, 2016 12:18 PM',
    hero: 'hero/26.jpeg',
  },
  {
    title: 'Bucket List: Yosemite',
    category: 'Bucket List Adventures',
    kicker: 'From Mariposa Grove to Glacier Point, beautiful waterfalls and rock formations await you',
    author: 'Carol R. Wright',
    date: 'Aug 28, 2016 11:12 AM',
    hero: 'hero/13.jpeg',
  },
  {
    title: 'Bucket List: Switzerland',
    category: 'Bucket List Adventures',
    kicker: 'From gorgeous lakes to the beautiful Alps',
    author: 'Nolan C. Sundquist',
    date: 'Aug 26, 2016 4:10 PM',
    hero: 'hero/18.jpeg',
  },
  {
    title: 'Kuala Lumpur in 48 Hours',
    category: '48 Hours',
    kicker: 'The Garden City of Lights',
    author: 'Todd M. Smallwood',
    date: 'Aug 25, 2016 4:47 PM',
    hero: 'hero/10.jpeg',
  },
  {
    title: '12 Top Spots for Surfing',
    category: 'Top Spots',
    kicker: 'Hang Ten!',
    author: 'Demetria T. Edwards',
    date: 'Aug 23, 2016 3:07 PM',
    hero: 'hero/25.jpeg',
  },
  {
    title: '17 Top Spots for Incredible Wildlife',
    category: 'Top Spots',
    kicker: 'W-hoot knew?',
    author: 'Demetria T. Edwards',
    date: 'Aug 23, 2016 8:41 AM',
    hero: 'hero/30.jpeg',
  },
  {
    title: 'Kyoto in 48 Hours',
    category: '48 Hours',
    kicker: 'Japan\'s Former Thousand-Year Capital',
    author: 'Todd M. Smallwood',
    date: 'Aug 22, 2016 11:26 PM',
    hero: 'hero/8.jpeg',
  },
  {
    title: '11 Top Spots for Incredible Photography',
    category: 'Top Spots',
    kicker: 'Say cheese!',
    author: 'Russell D. Hogan',
    date: 'Aug 21, 2016 10:57 AM',
    hero: 'hero/24.jpeg',
  },
];
ARTICLES.forEach((a, index) => {
  a.id = index + 1;
});


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
  const authUrl = getAuthUrl(req);
  res.render('../examples/sample-pub/views/article', {
    authUrl,
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
