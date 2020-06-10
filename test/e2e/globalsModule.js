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
 * @fileoverview Global settings for all tests.
 */
const childProcess = require('child_process');
const {startServer, stopServer} = require('../../build-system/tasks/serve');

module.exports = {
  before: function () {
    startServer();
  },
  after: function () {
    // Chromedriver does not automatically exit after test ends.
    childProcess.exec('pkill chromedriver');

    stopServer();
  },
  // Let tests to continue if an assertion fails.
  abortOnAssertionFailure: false,

  // Wait 30 seconds for conditions to become true.
  waitForConditionTimeout: 30000,
};
