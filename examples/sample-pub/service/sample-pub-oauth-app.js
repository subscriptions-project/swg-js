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
 * See https://developers.google.com/actions/identity/oauth2-code-flow
 */

const app = module.exports = require('express').Router();

/**
 * The Google client ID and client secret can be any URL-safe string values of
 * your choice. You must ensure that the client secret is visible to only Google
 * and your service.
 */
const PROJECT_ID = 'scenic-2017-gdi';
const CLIENT_ID = 'scenic-2017.appspot.com';


/**
 * Sign-in with Google test.
 */
app.get('/signin-with-google', (req, res) => {
  res.render('../examples/sample-pub/views/signin-with-google');
});


/**
 * OAuth authorization endpoint.
 * The authorization endpoint must accept user traffic.
 * Typical request looks like this:
 * ?client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&state=STATE&scope=SCOPES&response_type=code
 */
app.get('/auth', (req, res) => {
  const params = verifyOauthParams(req);
  res.render('../examples/sample-pub/views/signin', {
    client_id: params['client_id'],
    redirect_uri: params['redirect_uri'],
    state: params['state'],
    scope: params['scope'],
    response_type: params['response_type'],
  });
});


/**
 * OAuth authorization endpoint.
 * The authorization endpoint must accept user traffic.
 */
app.post('/auth-submit', (req, res) => {
  const params = verifyOauthParams(req);
  const email = req.body['email'];
  const password = req.body['password'];
  if (!email || !password) {
    throw new Error('Missing email and/or password');
  }
  const authorizationCode = generateAuthorizationCode(params, email, password);
  const authorizationCodeStr = toBase64(encrypt(authorizationCode));
  const redirectUrl =
      params.redirect_uri +
      `?code=${encodeURIComponent(authorizationCodeStr)}` +
      `&state=${encodeURIComponent(params.state || '')}`;
  res.redirect(302, redirectUrl);
});


/**
 * OAuth token endpoint.
 * The token exchange endpoint only needs to accept traffic from other servers
 * (such as Google's).
 * The token exchange endpoint is responsible for two kinds of token exchanges:
 * - Exchanging authorization codes for access tokens and refresh tokens;
 * - Exchanging refresh tokens for access tokens.
 */
app.post('/token', (req, res) => {
  let grant_type;
  let response;
  try {
    const client_id = getParam(req, 'client_id');
    if (client_id != CLIENT_ID) {
      throw new Error('Invalid client_id: ' + client_id);
    }
    const client_secret = getParam(req, 'client_secret');
    if (!client_secret) {
      throw new Error('Missing client_secret');
    }
    // TODO: Check client secret against expected value.
    grant_type = getParam(req, 'grant_type');
    if (grant_type == 'authorization_code') {
      const authorizationCodeStr = getParam(req, 'code');
      if (!authorizationCodeStr) {
        throw new Error('Missing authorization code');
      }
      const authorizationCode = decrypt(fromBase64(authorizationCodeStr));
      if (authorizationCode['what'] != 'authorizationCode') {
        throw new Error('Invalid authorization code: ' +
            authorizationCode['what']);
      }
      // TODO: check if grant has expired via authorizationCode['exp']
      const refreshToken = generateRefreshToken(authorizationCode);
      const accessToken = generateAccessToken(refreshToken);
      response = JSON.stringify({
        'token_type': 'bearer',
        'refresh_token': toBase64(encrypt(refreshToken)),
        'access_token': toBase64(encrypt(accessToken)),
        'expires_in': 300000,  // 5 min.
      });
    } else if (grant_type == 'refresh_token') {
      const refreshTokenStr = getParam(req, 'refresh_token');
      if (!refreshTokenStr) {
        throw new Error('Missing refresh_token');
      }
      const refreshToken = decrypt(fromBase64(refreshTokenStr));
      if (refreshToken['what'] != 'refreshToken') {
        throw new Error('Invalid refresh_token: ' + refreshToken['what']);
      }
      const accessToken = generateAccessToken(refreshToken);
      response = JSON.stringify({
        'token_type': 'bearer',
        'access_token': toBase64(encrypt(accessToken)),
        'expires_in': 300000,  // 5 min.
      });
    } else {
      throw new Error('Unknown grant_type: ' + grant_type);
    }
  } catch (e) {
    console.log('Error: ', grant_type, e);
    res.status(400).send(JSON.stringify({'error': 'invalid_grant'}));
    return;
  }
  res.send(response);
});


/**
 * Handle authorized request.
 */
app.all('/authorized', (req, res) => {
  // Authorization: Bearer ACCESS_TOKEN
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader) {
    throw new Error('Missing authorization header');
  }
  if (authorizationHeader.toUpperCase().indexOf('BEARER') != 0) {
    throw new Error('Invalid authorization header: ' + authorizationHeader);
  }
  const accessTokenStr =
      authorizationHeader.substring('BEARER'.length + 1).trim();
  const accessToken = decrypt(fromBase64(accessTokenStr));
  if (accessToken['what'] != 'accessToken') {
    throw new Error('Invalid access token: ' + accessToken['what']);
  }
  res.send('access is granted');
});


/**
 * @param {!HttpRequest} req
 * @return {!OauthParams}
 */
function verifyOauthParams(req) {
  const params = {
    client_id: getParam(req, 'client_id'),
    redirect_uri: getParam(req, 'redirect_uri'),
    state: getParam(req, 'state'),
    scope: getParam(req, 'scope'),
    response_type: getParam(req, 'response_type'),
  };
  if (params.client_id != CLIENT_ID) {
    throw new Error('Invalid client_id: ' + params.client_id);
  }
  if (params.response_type != 'code') {
    throw new Error('Invalid response_type: ' + params.response_type);
  }
  if (!params.redirect_uri) {
    throw new Error('Missing redirect_uri');
  }
  // TODO: restrict redirects to few predefined destinations.
  // const expectedRedirectUri =
  //     `https://oauth-redirect.googleusercontent.com/r/${PROJECT_ID}`;
  // if (params.redirect_uri.indexOf(expectedRedirectUri) != 0 &&
  //     params.redirect_uri != 'https://developers.google.com/oauthplayground') {
  //   throw new Error('Invalid redirect_uri: ' + params.redirect_uri);
  // }
  return params;
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
 * @param {!OauthParams} params
 * @param {string} email
 * @param {string} password
 * @return {!AuthorizationCode}
 */
function generateAuthorizationCode(params, email, password) {
  return {
    what: 'authorizationCode',
    exp: Date.now() + 600000,  // Expiration in 10 min.
    email,
    password,
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    state: params.state,
    scope: params.scope,
    response_type: params.response_type,
  };
}


/**
 * @param {!AuthorizationCode} params
 * @return {!RefreshToken}
 */
function generateRefreshToken(authorizationCode) {
  return {
    what: 'refreshToken',
    email: authorizationCode['email'],
    password: authorizationCode['password'],
    client_id: authorizationCode['client_id'],
    scope: authorizationCode['scope'],
  };
}


/**
 * @param {!RefreshToken} refreshToken
 * @return {!AccessToken}
 */
function generateAccessToken(refreshToken) {
  return {
    what: 'accessToken',
    email: refreshToken['email'],
    password: refreshToken['password'],
    client_id: refreshToken['client_id'],
    scope: refreshToken['scope'],
  };
}


/**
 * @param {!Object<string, *>} object
 * @return {string}
 */
function encrypt(object) {
  return 'encrypted(' + JSON.stringify(object) + ')';
}


/**
 * @param {string} s
 * @return {!Object<string, *>}
 */
function decrypt(s) {
  if (s.indexOf('encrypted(') != 0) {
    throw new Error('Cannot decrypt "' + s + '"');
  }
  const decrypted = s.substring('encrypted('.length, s.length - 1);
  try {
    return JSON.parse(decrypted);
  } catch (e) {
    throw new Error('Cannot parse decrypted blob: "' + decrypted + '": ' + e);
  }
}


/**
 * @param {string} s
 * @return {string}
 */
function toBase64(s) {
  return Buffer.from(s).toString('base64');
}


/**
 * @param {string} s
 * @return {string}
 */
function fromBase64(s) {
  return Buffer.from(s, 'base64').toString();
}
