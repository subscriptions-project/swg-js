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

const Services = {};
loadServices();

const CHROME_CAPABILITIES = {
  browserName: 'chrome',
  chromeOptions: {
    w3c: false,
    args: ['--headless'],
  },
};

const FIREFOX_CAPABILITIES = {
  browserName: 'firefox',
  acceptInsecureCerts: true,
  alwaysMatch: {
    'moz:firefoxOptions': {
      args: ['-headless'],
    },
  },
};

const SAFARI_CAPABILITIES = {
  browserName: 'safari',
  javascriptEnabled: true,
  acceptSslCerts: true,
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
        server_path: Services.chromedriver ? Services.chromedriver.path : '',
        port: 9515,
      },
    },

    firefox: {
      globals: {
        webdriverProcess: 'geckodriver',
      },

      desiredCapabilities: FIREFOX_CAPABILITIES,

      webdriver: {
        start_process: true,
        server_path: 'node_modules/.bin/geckodriver',
        // server_path: Services.geckodriver ? Services.geckodriver.path : '',
        cli_args: ['--log', 'debug'],
        port: 4444,
      },
    },

    safari: {
      globals: {
        webdriverProcess: 'safaridriver',
      },

      desiredCapabilities: SAFARI_CAPABILITIES,

      webdriver: {
        port: 4445,
        start_process: true,
        server_path: '/usr/bin/safaridriver',
      },
    },

    selenium: {
      // Selenium Server is running locally and is managed by Nightwatch
      selenium: {
        start_process: true,
        port: 4444,
        server_path: Services.seleniumServer
          ? Services.seleniumServer.path
          : '',
        cli_args: {
          'webdriver.gecko.driver': Services.geckodriver
            ? Services.geckodriver.path
            : '',
          'webdriver.chrome.driver': Services.chromedriver
            ? Services.chromedriver.path
            : '',
        },
      },
      webdriver: {
        start_process: false,
      },
    },

    'selenium.chrome': {
      extends: 'selenium',
      desiredCapabilities: CHROME_CAPABILITIES,
    },

    'selenium.firefox': {
      extends: 'selenium',
      desiredCapabilities: FIREFOX_CAPABILITIES,
    },

    'selenium.safari': {
      extends: 'selenium',
      desiredCapabilities: SAFARI_CAPABILITIES,
    },

    browserstack: {
      globals: {
        browserstack: true,
      },

      selenium: {
        host: 'hub-cloud.browserstack.com',
        port: 443,
      },

      desiredCapabilities: {
        'browserstack.local': true,
        'bstack:options': {
          local: 'false',
          userName: '${BROWSERSTACK_USER}',
          accessKey: '${BROWSERSTACK_KEY}',
        },
      },

      webdriver: {
        keep_alive: true,
        timeout_options: {
          timeout: 60000,
          retry_attempts: 3,
        },
      },
    },

    'browserstack.chrome': {
      extends: 'browserstack',
      desiredCapabilities: CHROME_CAPABILITIES,
    },

    'browserstack.firefox': {
      extends: 'browserstack',
      desiredCapabilities: FIREFOX_CAPABILITIES,
    },

    'browserstack.safari': {
      extends: 'browserstack',
      desiredCapabilities: SAFARI_CAPABILITIES,
    },
  },
};

function loadServices() {
  try {
    Services.seleniumServer = require('selenium-server');
  } catch (err) {}

  try {
    Services.chromedriver = require('chromedriver');
  } catch (err) {}

  try {
    Services.geckodriver = require('geckodriver');
  } catch (err) {}
}
