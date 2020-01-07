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
'use strict';

const through = require('through2');
const {isTravisBuild} = require('../travis');

/**
 * @param {!Object} config
 */
module.exports = {
  frameworks: ['fixture', 'browserify', 'mocha', 'sinon-chai', 'chai'],

  preprocessors: {
    'src/**/*.js': ['browserify'],
    'test/**/*.js': ['browserify'],
  },

  browserify: {
    watch: true,
    debug: true,
    fast: true,
    transform: [
      ['babelify', {presets: ['@babel/preset-env']}],
      () =>
        through(function(buf, enc, next) {
          // Set Pay environment to indicate we're in a Karma test.
          this.push(
            buf.toString('utf8').replace(/\$payEnvironment\$/g, 'TEST')
          );
          next();
        }),
    ],
    bundleDelay: 900,
  },

  reporters: ['super-dots', 'mocha'],

  superDotsReporter: {
    color: {
      success: 'green',
      failure: 'red',
      ignore: 'yellow',
    },
    icon: {
      success: '●',
      failure: '●',
      ignore: '○',
    },
  },

  mochaReporter: {
    output: 'minimal',
    colors: {
      success: 'green',
      error: 'red',
      info: 'yellow',
    },
    symbols: {
      success: '●',
      error: '●',
      info: '○',
    },
  },

  port: 9876,

  colors: true,

  proxies: {
    '/dist/': '/base/dist/',
    '/examples/': '/base/examples/',
    '/src/': '/base/src/',
    '/test/': '/base/test/',
  },

  // Can't import the Karma constant config.LOG_ERROR, so we hard code it here.
  // Hopefully it'll never change.
  logLevel: 'ERROR',

  autoWatch: true,

  browsers: [isTravisBuild() ? 'Chrome_travis_ci' : 'Chrome_no_extensions'],

  // Number of sauce tests to start in parallel
  concurrency: 6,

  customLaunchers: {
    /*eslint "google-camelcase/google-camelcase": 0*/
    Chrome_travis_ci: {
      base: 'Chrome',
      flags: ['--no-sandbox', '--disable-extensions'],
    },
    Chrome_no_extensions: {
      base: 'Chrome',
      // Dramatically speeds up iframe creation time.
      flags: ['--disable-extensions'],
    },
  },

  client: {
    mocha: {
      reporter: 'html',
      // Longer timeout on Travis; fail quickly at local.
      timeout: isTravisBuild() ? 10000 : 2000,
    },
    captureConsole: false,
  },

  singleRun: true,
  browserDisconnectTimeout: 10000,
  browserDisconnectTolerance: 2,
  browserNoActivityTimeout: 4 * 60 * 1000,
  captureTimeout: 4 * 60 * 1000,

  // Import our gulp webserver as a Karma server middleware
  // So we instantly have all the custom server endpoints available
  plugins: [
    'karma-browserify',
    'karma-chai',
    'karma-chrome-launcher',
    'karma-coverage',
    'karma-edge-launcher',
    'karma-firefox-launcher',
    'karma-fixture',
    'karma-html2js-preprocessor',
    'karma-ie-launcher',
    'karma-mocha',
    'karma-mocha-reporter',
    'karma-safari-launcher',
    'karma-sinon-chai',
    'karma-super-dots-reporter',
  ],
};
