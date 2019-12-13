/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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
 * @fileoverview Page object for Google login page.
 */
const constants = require('../constants');

const login = {
  login: function(browser) {
    this.api.pause(1000);
    return this.log('Signing into Google Account')
      .assert.containsText('@headingText', 'Sign in')
      .waitForElementPresent('@username')
      .setValue('@username', [constants.login.username, browser.Keys.ENTER])
      .assert.elementPresent('@profileIdentifier')
      .waitForElementPresent('@password')
      .pause(5000)
      .setValue('@password', [constants.login.password, browser.Keys.ENTER])
      .assert.containsText('h1', 'Welcome');
  },
};

module.exports = {
  url: constants.login.url,
  commands: [login],
  elements: {
    headingText: {
      selector: '#headingText',
    },
    username: {
      selector: 'input[type=email]',
    },
    usernameNext: {
      selector: '#identifierNext',
    },
    password: {
      selector: 'input[type=password]',
    },
    passwordNext: {
      selector: '#passwordNext',
    },
    profileIdentifier: {
      selector: '#profileIdentifier',
    },
  },
};
