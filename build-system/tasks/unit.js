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
const argv = require('minimist')(process.argv.slice(2));
const config = require('../config');
const glob = require('glob');
const gulp = require('gulp-help')(require('gulp'));
const Karma = require('karma').Server;
const karmaDefault = require('./karma.conf');
const log = require('fancy-log');
const shuffleSeed = require('shuffle-seed');
const webserver = require('gulp-webserver');

const {build} = require('./builders');
const {green, yellow, cyan, red} = require('ansi-colors');
const {isTravisBuild} = require('../travis');

/**
 * Read in and process the configuration settings for karma
 * @return {!Object} Karma configuration
 */
function getConfig() {
  if (argv.safari) {
    return Object.assign({}, karmaDefault, {browsers: ['Safari']});
  }
  if (argv.firefox) {
    return Object.assign({}, karmaDefault, {browsers: ['Firefox']});
  }
  if (argv.edge) {
    return Object.assign({}, karmaDefault, {browsers: ['Edge']});
  }
  if (argv.ie) {
    return Object.assign({}, karmaDefault, {browsers: ['IE']});
  }
  return karmaDefault;
}

/**
 * Prints help messages for args if tests are being run for local development.
 */
function printArgvMessages() {
  if (argv.nohelp || isTravisBuild()) {
    return;
  }

  const argvMessages = {
    safari: 'Running tests on Safari.',
    firefox: 'Running tests on Firefox.',
    ie: 'Running tests on IE.',
    edge: 'Running tests on Edge.',
    nobuild: 'Skipping build.',
    watch:
      'Enabling watch mode. Editing and saving a file will cause the' +
      ' tests for that file to be re-run in the same browser instance.',
    verbose: 'Enabling verbose mode. Expect lots of output!',
    testnames: 'Listing the names of all tests being run.',
    files: 'Running tests in the file(s): ' + cyan(argv.files),
    compiled: 'Running tests against minified code.',
    grep:
      'Only running tests that match the pattern "' + cyan(argv.grep) + '".',
    coverage: 'Running tests in code coverage mode.',
  };

  log(
    green('Run'),
    cyan('gulp help'),
    green('to see a list of all test flags.')
  );
  log(green('⤷ Use'), cyan('--nohelp'), green('to silence these messages.'));

  if (!argv.testnames && !argv.files) {
    log(
      green('⤷ Use'),
      cyan('--testnames'),
      green('to see the names of all tests being run.')
    );
  }

  if (argv.compiled || !argv.nobuild) {
    log(green('Running tests against minified code.'));
  } else {
    log(green('Running tests against unminified code.'));
  }

  Object.keys(argv).forEach(arg => {
    const message = argvMessages[arg];
    if (message) {
      log(yellow('--' + arg + ':'), green(message));
    }
  });
}

/**
 * Get the set of unit tests that should be run.
 * @param {!RuntimeTestConfig} c
 */
function getUnitTestsToRun(c) {
  if (argv.testnames) {
    c.reporters = ['mocha'];
    c.mochaReporter.output = 'full';
  }

  if (argv.files) {
    c.files = [].concat(config.commonTestPaths, argv.files);
    c.reporters = ['mocha'];
    c.mochaReporter.output = 'full';
  } else {
    const unitTestPaths = config.basicTestPaths;

    let testFiles = [];
    for (const index in unitTestPaths) {
      testFiles = testFiles.concat(glob.sync(unitTestPaths[index]));
    }

    const seed = argv.seed || Math.random();
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

  c.singleRun = !argv.watch && !argv.w;
  c.client.captureConsole = !!argv.verbose || !!argv.v || !!argv.files;

  getUnitTestsToRun(c);

  // c.client is available in test browser via window.parent.karma.config
  c.client.subscriptions = {
    useCompiledJs: !!argv.compiled,
    mochaTimeout: c.client.mocha.timeout,
  };

  if (argv.compiled) {
    process.env.SERVE_MODE = 'compiled';
  } else {
    process.env.SERVE_MODE = 'default';
  }

  if (argv.grep) {
    c.client.mocha = {
      'grep': argv.grep,
    };
  }

  if (argv.coverage) {
    c.reporters.push('coverage-istanbul');
    c.plugins.push('karma-coverage-istanbul-reporter');

    c.coverageIstanbulReporter = {
      dir: 'test/coverage',
      reports: isTravisBuild()
        ? ['lcovonly']
        : ['html', 'text', 'text-summary'],
      'report-config': {lcovonly: {file: `lcov-unit.info`}},
    };

    const instanbulPlugin = [
      'istanbul',
      {
        exclude: [
          'build-system/**/*.js',
          'third_party/**/*.js',
          'test/**/*.js',
        ],
      },
    ];

    // Install Instanbul plugin.
    c.browserify.transform.forEach(transform => {
      if (transform[0] === 'babelify') {
        if (!transform[1].plugins) {
          transform[1].plugins = [];
        }
        transform[1].plugins.push(instanbulPlugin);
      }
    });
  }

  // Run fake-server to test XHR responses.
  const server = gulp.src(process.cwd()).pipe(
    webserver({
      port: 31862,
      host: 'localhost',
      directoryListing: true,
      middleware: [app],
    }).on('kill', function() {
      log(yellow('Shutting down test responses server on localhost:31862'));
      process.nextTick(function() {
        process.exit();
      });
    })
  );
  log(yellow('Started test responses server on localhost:31862'));

  new Karma(c, function(exitCode) {
    server.emit('kill');
    if (exitCode) {
      log(red('ERROR:'), yellow('Karma test failed with exit code', exitCode));
      process.exit(exitCode);
    }
  }).start();
}

async function unit() {
  printArgvMessages();

  if (!argv.nobuild) {
    await build();
  }
  runTests();
}

module.exports = {
  unit,
};
unit.description = 'Runs tests';
unit.flags = {
  'coverage': '  Run tests in code coverage mode',
  'verbose': '  With logging enabled',
  'testnames': '  Lists the name of each test being run',
  'watch': '  Watches for changes in files, runs corresponding test(s)',
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
