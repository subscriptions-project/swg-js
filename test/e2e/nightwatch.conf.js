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

// Set up (paths to) services and browser drivers (based on environment)
const Services = {
  chromeDriver: '',
  firefoxDriver: '',
  safariDriver: '',
  seleniumServer: '',
};
loadServices();

const ANDROID_CAPABILITIES = {
  browserName: 'chrome',
  deviceName: 'Google Pixel 5',
  osVersion: '12.0',
  realMobile: true,
};

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

const IOS_CAPABILITIES = {
  browserName: 'safari',
  deviceName: 'iPhone 12',
  osVersion: '14.0',
  realMobile: true,
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
        server_path: Services.chromeDriver,
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
        server_path: Services.firefoxDriver,
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
        server_path: Services.safariDriver,
      },
    },

    selenium: {
      // Selenium Server is running locally and is managed by Nightwatch
      selenium: {
        start_process: true,
        port: 4444,
        server_path: Services.seleniumServer,
        cli_args: {
          'webdriver.chrome.driver': Services.chromeDriver,
          'webdriver.gecko.driver': Services.firefoxDriver,
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

    'browserstack.android': {
      extends: 'browserstack',
      desiredCapabilities: ANDROID_CAPABILITIES,
    },

    'browserstack.chrome': {
      extends: 'browserstack',
      desiredCapabilities: CHROME_CAPABILITIES,
    },

    'browserstack.firefox': {
      extends: 'browserstack',
      desiredCapabilities: FIREFOX_CAPABILITIES,
    },

    'browserstack.ios': {
      extends: 'browserstack',
      desiredCapabilities: IOS_CAPABILITIES,
    },

    'browserstack.safari': {
      extends: 'browserstack',
      desiredCapabilities: SAFARI_CAPABILITIES,
    },
  },
};

// Check if env has specific installed path matching installed version, else load npm dep
function loadServices() {
  Services.chromeDriver = process.env.CHROMEWEBDRIVER
    ? `${process.env.CHROMEWEBDRIVER}/chromedriver`
    : require('chromedriver').path;

  Services.firefoxDriver = process.env.GECKOWEBDRIVER
    ? `${process.env.GECKOWEBDRIVER}/geckodriver`
    : require('geckodriver').path;

  // hardcoded for local mac only as not installed by npm
  Services.safariDriver = '/usr/bin/safaridriver';

  Services.seleniumServer = require('selenium-server').path;

  console.log('Services: %o', Services);
}
