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

/**
 * @fileoverview
 * See https://developers.google.com/actions/identity/oauth2-code-flow
 * and https://developers.google.com/actions/identity/oauth2-implicit-flow
 */

const app = (module.exports = require('express').Router());
const jsonwebtoken = require('jsonwebtoken');
const {encrypt, decrypt, fromBase64, toBase64} = require('../utils/crypto');

const PUBLICATION_ID = process.env.SERVE_PUBID || 'scenic-2017.appspot.com';

/**
 * The Google client ID and client secret can be any URL-safe string values of
 * your choice. You must ensure that the client secret is visible to only Google
 * and your service.
 */
/** @const {string} */
// const PROJECT_ID = 'scenic-2017-gdi';

/** @const {string} */
const CLIENT_ID = 'scenic-2017.appspot.com';

/** @const {string} */
const GSI_CLIENT_ID =
  '520465458218-e9vp957krfk2r0i4ejeh6aklqm7c25p4' +
  '.apps.googleusercontent.com';

/**
 * Sign-in with Google test.
 */
app.get('/signin-with-google', (req, res) => {
  res.render('../examples/sample-pub/views/signin-with-google');
});

/**
 * Smart-lock test.
 */
app.get('/signin-smartlock', (req, res) => {
  res.render('../examples/sample-pub/views/signin-smartlock');
});

/**
 * OAuth authorization endpoint.
 * The authorization endpoint must accept user traffic.
 * Typical request looks like this:
 * ?client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&state=STATE&scope=SCOPES&response_type=code
 */
app.get('/auth', (req, res) => {
  const params = verifyOauthParams(req);
  res.render('../examples/sample-pub/views/signin-oauth', {
    'client_id': params.clientId,
    'redirect_uri': params.redirectUri,
    'state': params.state,
    'scope': params.scope,
    'response_type': params.responseType,
  });
});

/**
 * OAuth debug authorization endpoint. Simply returns back.
 */
app.get('/auth.debug', (req, res) => {
  res.render('../examples/sample-pub/views/signin-debug');
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
  if (params.responseType == 'code') {
    // Authorization code (server-side) flow.
    // See https://developers.google.com/actions/identity/oauth2-code-flow
    const authorizationCode = generateAuthorizationCode(
      params,
      email,
      password
    );
    const authorizationCodeStr = toBase64(encrypt(authorizationCode));
    const redirectUrl =
      params.redirectUri +
      `?code=${encodeURIComponent(authorizationCodeStr)}` +
      `&state=${encodeURIComponent(params.state || '')}`;
    res.redirect(302, redirectUrl);
  } else if (params.responseType == 'token') {
    // Implicit flow.
    // See https://developers.google.com/actions/identity/oauth2-implicit-flow
    // Notice that access token never expires. Not clear how it can be revoked
    // either.
    const refreshToken = generateRefreshToken(params.scope, {email, password});
    const accessToken = generateAccessToken(refreshToken);
    const accessTokenStr = toBase64(encrypt(accessToken));
    const redirectUrl =
      params.redirectUri +
      '#token_type=bearer' +
      `&access_token=${encodeURIComponent(accessTokenStr)}` +
      `&state=${encodeURIComponent(params.state || '')}`;
    res.redirect(302, redirectUrl);
  } else {
    throw new Error('Invalid response_type: ' + params.responseType);
  }
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
  let grantType;
  let response;
  try {
    const clientId = getParam(req, 'client_id');
    if (clientId != CLIENT_ID) {
      throw new Error('Invalid client_id: ' + clientId);
    }
    const clientSecret = getParam(req, 'client_secret');
    if (!clientSecret) {
      throw new Error('Missing client_secret');
    }
    // TODO: Check client secret against expected value.
    grantType = getParam(req, 'grant_type');
    if (grantType == 'authorization_code') {
      const authorizationCodeStr = getParam(req, 'code');
      if (!authorizationCodeStr) {
        throw new Error('Missing authorization code');
      }
      const authorizationCode = decrypt(fromBase64(authorizationCodeStr));
      if (authorizationCode.what != 'authorizationCode') {
        throw new Error(
          'Invalid authorization code: ' + authorizationCode.what
        );
      }
      // TODO: check if grant has expired via `authorizationCode.exp`.
      const refreshToken = generateRefreshToken(
        authorizationCode.scope,
        authorizationCode.data
      );
      const accessToken = generateAccessToken(refreshToken);
      response = JSON.stringify({
        'token_type': 'bearer',
        'refresh_token': toBase64(encrypt(refreshToken)),
        'access_token': toBase64(encrypt(accessToken)),
        'expires_in': 300, // 5 min in seconds.
      });
    } else if (grantType == 'refresh_token') {
      const refreshTokenStr = getParam(req, 'refresh_token');
      if (!refreshTokenStr) {
        throw new Error('Missing refresh_token');
      }
      const refreshToken = decrypt(fromBase64(refreshTokenStr));
      if (refreshToken.what != 'refreshToken') {
        throw new Error('Invalid refresh_token: ' + refreshToken.what);
      }
      const accessToken = generateAccessToken(refreshToken);
      response = JSON.stringify({
        'token_type': 'bearer',
        'access_token': toBase64(encrypt(accessToken)),
        'expires_in': 300, // 5 min in seconds.
      });
    } else if (grantType == 'urn:ietf:params:oauth:grant-type:jwt-bearer') {
      // See https://developers.google.com/actions/identity/oauth2-assertion-flow
      const intent = getParam(req, 'intent');
      if (intent != 'get') {
        throw new Error('Invalid intent: ' + intent);
      }
      const jwtStr = getParam(req, 'assertion');
      if (!jwtStr) {
        throw new Error('Missing jwt assertion.');
      }
      const scope = getParam(req, 'scope');
      // TODO: This is an example only.
      if (scope && scope.indexOf('broken-jwt') != -1) {
        throw new Error('Broken JWT example. Not prod code.');
      }
      // TODO: Use `verify()` instead of `decode()`.
      const jwt = jsonwebtoken.decode(jwtStr);
      if (jwt['iss'] != 'https://accounts.google.com') {
        throw new Error('Unsupported iss: ' + jwt['iss']);
      }
      if (jwt['aud'] != GSI_CLIENT_ID) {
        throw new Error('Invalid aud: ' + jwt['aud']);
      }
      // TODO: Check `jwt['exp']`.
      const refreshToken = generateRefreshToken(scope, jwt);
      const accessToken = generateAccessToken(refreshToken);
      response = JSON.stringify({
        'token_type': 'bearer',
        'refresh_token': toBase64(encrypt(refreshToken)),
        'access_token': toBase64(encrypt(accessToken)),
        'expires_in': 300, // 5 min in seconds.
      });
    } else {
      const info = [];
      for (const k in req.body) {
        info.push(`${k}={${req.body[k]}}`);
      }
      throw new Error(
        'Unknown grant_type: ' + grantType + ': ' + info.join('; ')
      );
    }
  } catch (e) {
    res.status(400).send(
      JSON.stringify({
        'error': 'invalid_grant: ' + grantType,
        'details': e,
      })
    );
    return;
  }
  res.send(response);
});

/**
 * Authorization sync endpoint.
 * Query parameters:
 * - publication_id={publication_id}
 * - access_token={access_token}
 */
app.all('/entitlements', (req, res) => {
  const publicationId = PUBLICATION_ID;
  const accessToken = getParam(req, 'access_token');
  const decryptedAccessToken = decrypt(fromBase64(accessToken));
  const email = decryptedAccessToken.data['email'];
  const response = JSON.stringify({
    'products': [publicationId + ':premium', publicationId + ':news'],
    'subscriptionToken':
      'subtok-' + publicationId + '-' + email + '-' + new Date().toISOString(),
    'detail': 'For ' + email,
  });
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  const accessTokenStr = authorizationHeader
    .substring('BEARER'.length + 1)
    .trim();
  const accessToken = decrypt(fromBase64(accessTokenStr));
  if (accessToken.what != 'accessToken') {
    throw new Error('Invalid access token: ' + accessToken.what);
  }
  res.send('access is granted');
});

/**
 * @param {!HttpRequest} req
 * @return {!OauthParams}
 */
function verifyOauthParams(req) {
  const params = {
    clientId: getParam(req, 'client_id'),
    redirectUri: getParam(req, 'redirect_uri'),
    state: getParam(req, 'state'),
    scope: getParam(req, 'scope'),
    responseType: getParam(req, 'response_type'),
  };
  if (params.clientId != CLIENT_ID) {
    throw new Error('Invalid client_id: ' + params.clientId);
  }
  if (!params.responseType) {
    throw new Error('Missing response_type');
  }
  if (!params.redirectUri) {
    throw new Error('Missing redirect_uri');
  }
  // TODO: restrict redirects to few predefined destinations.
  // const expectedRedirectUri =
  //     `https://oauth-redirect.googleusercontent.com/r/${PROJECT_ID}`;
  // if (params.redirectUri.indexOf(expectedRedirectUri) != 0 &&
  //     params.redirectUri != 'https://developers.google.com/oauthplayground') {
  //   throw new Error('Invalid redirect_uri: ' + params.redirectUri);
  // }
  return params;
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
 * @param {!OauthParams} params
 * @param {string} email
 * @param {string} password
 * @return {!AuthorizationCode}
 */
function generateAuthorizationCode(params, email, password) {
  return {
    what: 'authorizationCode',
    clientId: CLIENT_ID,
    exp: Date.now() + 600000, // Expiration in 10 min.
    redirectUri: params.redirectUri,
    state: params.state,
    scope: params.scope,
    responseType: params.responseType,
    data: {
      email,
      password,
    },
  };
}

/**
 * @param {string} scope
 * @param {!Object} data
 * @return {!RefreshToken}
 */
function generateRefreshToken(scope, data) {
  return {
    what: 'refreshToken',
    clientId: CLIENT_ID,
    scope,
    data,
  };
}

/**
 * @param {!RefreshToken} refreshToken
 * @return {!AccessToken}
 */
function generateAccessToken(refreshToken) {
  return {
    what: 'accessToken',
    clientId: CLIENT_ID,
    scope: refreshToken.scope,
    data: refreshToken.data,
  };
}
