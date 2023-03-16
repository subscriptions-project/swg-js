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

const app = require('../server/test-server').app;
const args = require('./args');
const config = require('../config');
const gulp = require('gulp-help')(require('gulp'));
const Karma = require('karma').Server;
const karmaDefault = require('./karma.conf');
const log = require('fancy-log');
const shuffleSeed = require('shuffle-seed');
const webserver = require('gulp-webserver');
const {globSync} = require('glob');
const {green, yellow, cyan, red} = require('ansi-colors');
const {isCiBuild} = require('../ci');

/**
 * Read in and process the configuration settings for karma
 * @return {!Object} Karma configuration
 */
function getConfig() {
  if (args.safari) {
    return Object.assign({}, karmaDefault, {browsers: ['Safari']});
  }
  if (args.firefox) {
    return Object.assign({}, karmaDefault, {browsers: ['Firefox']});
  }
  if (args.edge) {
    return Object.assign({}, karmaDefault, {browsers: ['Edge']});
  }
  if (args.ie) {
    return Object.assign({}, karmaDefault, {browsers: ['IE']});
  }
  return karmaDefault;
}

/**
 * Prints help messages for args if tests are being run for local development.
 */
function printArgvMessages() {
  if (args.nohelp || isCiBuild()) {
    return;
  }

  const argvMessages = {
    safari: 'Running tests on Safari.',
    firefox: 'Running tests on Firefox.',
    ie: 'Running tests on IE.',
    edge: 'Running tests on Edge.',
    nobuild: 'Skipping build.',
    w:
      'Enabling watch mode. Editing and saving a file will cause the' +
      ' tests for that file to be re-run in the same browser instance.',
    verbose: 'Enabling verbose mode. Expect lots of output!',
    testnames: 'Listing the names of all tests being run.',
    files: 'Running tests in the file(s): ' + cyan(args.files),
    compiled: 'Running tests against minified code.',
    grep:
      'Only running tests that match the pattern "' + cyan(args.grep) + '".',
    coverage: 'Running tests in code coverage mode.',
  };

  log(
    green('Run'),
    cyan('gulp help'),
    green('to see a list of all test flags.')
  );
  log(green('⤷ Use'), cyan('--nohelp'), green('to silence these messages.'));

  if (!args.testnames && !args.files) {
    log(
      green('⤷ Use'),
      cyan('--testnames'),
      green('to see the names of all tests being run.')
    );
  }

  if (args.compiled || !args.nobuild) {
    log(green('Running tests against minified code.'));
  } else {
    log(green('Running tests against unminified code.'));
  }

  for (const arg of Object.keys(args)) {
    const message = argvMessages[arg];
    if (message) {
      log(yellow('--' + arg + ':'), green(message));
    }
  }
}

/**
 * Get the set of unit tests that should be run.
 * @param {!RuntimeTestConfig} c
 */
function getUnitTestsToRun(c) {
  if (args.testnames) {
    c.reporters = ['mocha'];
    c.mochaReporter.output = 'full';
  }

  if (args.files) {
    c.files = [].concat(config.commonTestPaths, args.files);
    c.reporters = ['mocha'];
    c.mochaReporter.output = 'full';
  } else {
    const unitTestPaths = config.basicTestPaths;

    let testFiles = [];
    for (const index in unitTestPaths) {
      testFiles = testFiles.concat(globSync(unitTestPaths[index]));
    }

    const seed = args.seed || Math.random();
    log(
      yellow('Running tests in randomized order.'),
      yellow('To rerun same ordering, use command'),
      cyan('gulp unit'),
      cyan(`--seed=${seed}`)
    );
    testFiles = shuffleSeed.shuffle(testFiles, seed);

    c.files = config.commonTestPaths.concat(testFiles);
  }
}

/**
 * Run tests.
 */
function runTests() {
  const c = getConfig();

  c.singleRun = !args.watch && !args.w;
  c.client.captureConsole = !!args.verbose || !!args.v || !!args.files;

  getUnitTestsToRun(c);

  // c.client is available in test browser via window.parent.karma.config
  c.client.subscriptions = {
    useCompiledJs: !!args.compiled,
    mochaTimeout: c.client.mocha.timeout,
  };

  if (args.compiled) {
    process.env.SERVE_MODE = 'compiled';
  } else {
    process.env.SERVE_MODE = 'default';
  }

  if (args.grep) {
    c.client.mocha = {
      'grep': args.grep,
    };
  }

  if (args.coverage) {
    c.reporters.push('coverage-istanbul');
    c.plugins.push('karma-coverage-istanbul-reporter');

    c.coverageIstanbulReporter = {
      dir: 'test/coverage',
      reports: isCiBuild() ? ['lcovonly'] : ['html', 'text', 'text-summary'],
      'report-config': {lcovonly: {file: `lcov-unit.info`}},
    };

    const instanbulPlugin = [
      'istanbul',
      {
        exclude: [
          'build-system/**/*',
          'src/**/*-test.{js,ts}',
          'src/**/*.stories.{js,ts}',
          'test/**/*',
          'third_party/**/*',
          // This file is auto-generated.
          'src/proto/api_messages.js',
          // Tell istanbul not to instrument the constants file.
          // This is needed because we update it at build time for tests.
          'src/constants.ts',
        ],
      },
    ];

    // Install Instanbul plugin.
    for (const transform of c.browserify.transform) {
      if (transform[0] === 'babelify') {
        if (!transform[1].plugins) {
          transform[1].plugins = [];
        }
        transform[1].plugins.push(instanbulPlugin);
      }
    }
  }

  // Run fake-server to test XHR responses.
  const server = gulp.src(process.cwd()).pipe(
    webserver({
      port: 31862,
      host: 'localhost',
      directoryListing: true,
      middleware: [app],
    }).on('kill', () => {
      log(yellow('Shutting down test responses server on localhost:31862'));
      process.nextTick(() => {
        process.exit();
      });
    })
  );
  log(yellow('Started test responses server on localhost:31862'));

  new Karma(c, (exitCode) => {
    server.emit('kill');
    if (exitCode) {
      log(red('ERROR:'), yellow('Karma test failed with exit code', exitCode));
      process.exit(exitCode);
    }
  }).start();
}

async function unit() {
  printArgvMessages();
  runTests();
}

module.exports = {
  unit,
};
unit.description = 'Runs tests';
unit.flags = {
  'headless': '  Runs the browser in headless mode',
  'coverage': '  Run tests in code coverage mode',
  'verbose': '  With logging enabled',
  'testnames': '  Lists the name of each test being run',
  'w': '  Watches for changes in files, runs corresponding test(s)',
  'safari': '  Runs tests on Safari',
  'firefox': '  Runs tests on Firefox',
  'edge': '  Runs tests on Edge',
  'ie': '  Runs tests on IE',
  'compiled':
    '  Changes integration tests to use production JS ' +
    'binaries for execution',
  'grep': '  Runs tests that match the pattern',
  'files': '  Runs tests for specific files',
  'nohelp': '  Silence help messages that are printed prior to test run',
};
