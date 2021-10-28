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
const browserstackLocal = require('browserstack-local');
const childProcess = require('child_process');
const {startServer, stopServer} = require('../../build-system/tasks/serve');

let browserStackLocalInstance;

module.exports = {
  before: async function () {
    // Wait for server to start.
    await new Promise((resolve) => {
      startServer().once('start', () => {
        // Give server an extra few seconds to startup.
        // Otherwise, Nightwatch requests pages too soon,
        // and then the first E2E tests fail.
        // In testing, one extra second was enough,
        // so three seems pretty safe.
        setTimeout(resolve, 3000);
      });
    });

    if (this.browserstack) {
      await new Promise((resolve) => {
        browserStackLocalInstance = new browserstackLocal.Local();
        browserStackLocalInstance.start(
          {key: process.env.BROWSERSTACK_KEY},
          (error) => {
            if (error) {
              throw error;
            }

            // Give the browserstack local interface time to start up and bind to local server
            setTimeout(resolve, 3000);
          }
        );
      });
    }
  },
  after: async function () {
    // Chrome/Gecko drivers do not automatically exit after test ends.
    if (this.webdriverProcess) {
      childProcess.exec(`pkill ${this.webdriverProcess}`);
    }

    if (browserStackLocalInstance) {
      await new Promise((resolve, reject) => {
        browserStackLocalInstance.stop((error) => {
          if (error) {
            return reject(error);
          }

          resolve();
        });
      });
    }

    stopServer();
  },

  // Let tests to continue if an assertion fails.
  abortOnAssertionFailure: false,

  // Wait 30 seconds for conditions to become true.
  waitForConditionTimeout: 30000,
};
