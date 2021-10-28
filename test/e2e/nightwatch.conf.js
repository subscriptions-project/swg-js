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

const chromeDriver = require('chromedriver');
const geckoDriver = require('geckodriver');
const seleniumServer = require('selenium-server');

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

      desiredCapabilities: {
        browserName: 'chrome',
        chromeOptions: {
          args: ['--headless'],
        },
      },

      webdriver: {
        start_process: true,
        server_path: chromeDriver.path,
        port: 9515,
      },
    },

    firefox: {
      globals: {
        webdriverProcess: 'geckodriver',
      },

      desiredCapabilities: {
        browserName: 'firefox',
        acceptInsecureCerts: true,
        alwaysMatch: {
          'moz:firefoxOptions': {
            args: ['-headless'],
          },
        },
      },

      webdriver: {
        start_process: true,
        server_path: geckoDriver.path,
        cli_args: ['--log', 'debug'],
        port: 4444,
      },
    },

    safari: {
      globals: {
        webdriverProcess: 'safaridriver',
      },

      desiredCapabilities: {
        browserName: 'safari',
        javascriptEnabled: true,
        acceptSslCerts: true,
      },

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
        server_path: seleniumServer.path,
        cli_args: {
          'webdriver.chrome.driver': chromeDriver.path,
          'webdriver.gecko.driver': geckoDriver.path,
        },
      },
      webdriver: {
        start_process: false,
      },
    },

    'selenium.chrome': {
      extends: 'selenium',
      desiredCapabilities: {
        browserName: 'chrome',
        chromeOptions: {
          w3c: false,
          args: ['--headless'],
        },
      },
    },

    'selenium.firefox': {
      extends: 'selenium',
      desiredCapabilities: {
        browserName: 'firefox',
      },
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
      desiredCapabilities: {
        browserName: 'chrome',
        chromeOptions: {
          w3c: false,
          args: ['--headless'],
        },
      },
    },

    'browserstack.firefox': {
      extends: 'browserstack',
      desiredCapabilities: {
        browserName: 'firefox',
        acceptInsecureCerts: true,
        alwaysMatch: {
          'moz:firefoxOptions': {
            args: ['-headless'],
          },
        },
      },
    },

    'browserstack.ie': {
      extends: 'browserstack',
      desiredCapabilities: {
        browserName: 'IE',
        browserVersion: '11.0',
        'bstack:options': {
          os: 'Windows',
          osVersion: 10,
          local: false,
          seleniumVersion: '3.5.2',
          resolution: '1366x768',
        },
      },
    },

    lambdatest: {
      selenium: {
        host: 'hub.lambdatest.com',
        port: 80,
      },

      username: '${LT_USERNAME}',
      access_key: '${LT_ACCESS_KEY}',

      webdriver: {
        keep_alive: true,
        timeout_options: {
          timeout: 60000,
          retry_attempts: 3,
        },
      },
    },

    'lambdatest.chrome': {
      extends: 'lambdatest',
      desiredCapabilities: {
        browserName: 'chrome',
        headless: true,
      },
    },
  },
};
