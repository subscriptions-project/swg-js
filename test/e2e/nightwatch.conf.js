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

/* eslint-disable google-camelcase/google-camelcase */
module.exports = {
  src_folders: ['test/e2e/tests'],
  globals_path: 'globals.js',
  page_objects_path: 'test/e2e/pages',
  plugins: ['@nightwatch/vrt'],
  '@nightwatch/vrt': {
    baseline_screenshots_path: 'test/e2e/vrt/baseline',
    latest_screenshots_path: 'vrt-report/latest',
    diff_screenshots_path: 'vrt-report/diff',
    threshold: 0.02,
  },

  test_settings: {
    default: {
      launch_url: 'http://localhost:8000',
      custom_commands_path: 'test/e2e/commands',
      skip_testcases_on_fail: false,

      desiredCapabilities: {
        browserName: 'chrome',
        chromeOptions: {
          args: [
            'disable-dev-shm-usage',
            'disable-gpu',
            'headless',
            'no-sandbox',
            'window-size=1280,800',
          ],
        },
      },

      webdriver: {
        keep_alive: true,
        port: 9515,
        server_path: require('chromedriver').path,
        start_process: true,
        timeout_options: {
          timeout: 60000,
          retry_attempts: 3,
        },
      },
    },
    all_experiments_enabled: {
      globals: {
        swg_experiments: [
          'logging-audience-activity',
          'disable-desktop-miniprompt',
          'background_click_behavior_experiment',
        ],
      },
      '@nightwatch/vrt': {
        baseline_suffix: '_all_experiments_on',
        diff_suffix: '_all_experiments_on',
        latest_suffix: '_all_experiments_on',
      },
    },
  },
};
