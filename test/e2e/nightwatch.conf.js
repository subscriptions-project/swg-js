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

const CHROME_CAPABILITIES = {
  browserName: 'chrome',
  chromeOptions: {
    w3c: false,
    args: ['--headless'],
  },
};

/* eslint-disable google-camelcase/google-camelcase */
module.exports = {
  src_folders: ['test/e2e/tests'],
  globals_path: 'globals.js',
  page_objects_path: 'test/e2e/pages',

  test_settings: {
    default: {
      launch_url: 'http://localhost:8000/examples/sample-pub/1',
      custom_commands_path: 'test/e2e/commands',
      skip_testcases_on_fail: false,
    },

    chrome: {
      globals: {
        webdriverProcess: 'chromedriver',
      },

      desiredCapabilities: CHROME_CAPABILITIES,

      webdriver: {
        start_process: true,
        server_path: require('chromedriver').path,
        port: 9515,
        timeout_options: {
          timeout: 60000,
          retry_attempts: 3,
        },
      },
    },
  },
};
