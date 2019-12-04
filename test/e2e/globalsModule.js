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

const {startServer, stopServer} = require('../../build-system/tasks/serve');

/**
 * @fileoverview Global settings for all tests.
 */
module.exports = {
  before: function() {
    startServer();
  },
  after: function() {
    stopServer();
  },
  // Let tests to continue if an assertion fails.
  abortOnAssertionFailure: false,
};
