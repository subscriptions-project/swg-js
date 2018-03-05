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

var argv = require('minimist')(process.argv.slice(2));
var gulp = require('gulp-help')(require('gulp'));
var glob = require('glob');
var Karma = require('karma').Server;
var config = require('../config');
var read = require('file-reader');
var fs = require('fs');
var path = require('path');
var util = require('gulp-util');
var webserver = require('gulp-webserver');
var app = require('../server/test-server').app;
var karmaDefault = require('./karma.conf');
var shuffleSeed = require('shuffle-seed');


const green = util.colors.green;
const yellow = util.colors.yellow;
const cyan = util.colors.cyan;


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
  const argvMessages = {
    safari: 'Running tests on Safari.',
    firefox: 'Running tests on Firefox.',
    ie: 'Running tests on IE.',
    edge: 'Running tests on Edge.',
    nobuild: 'Skipping build.',
    watch: 'Enabling watch mode. Editing and saving a file will cause the' +
        ' tests for that file to be re-run in the same browser instance.',
    verbose: 'Enabling verbose mode. Expect lots of output!',
    testnames: 'Listing the names of all tests being run.',
    files: 'Running tests in the file(s): ' + cyan(argv.files),
    integration: 'Running only the integration tests. Requires ' +
        cyan('gulp build') +  ' to have been run first.',
    unit: 'Running only the unit tests. Requires ' +
        cyan('gulp css') +  ' to have been run first.',
    randomize: 'Randomizing the order in which tests are run.',
    seed: 'Randomizing test order with seed ' + cyan(argv.seed) + '.',
    compiled:  'Running tests against minified code.',
    grep: 'Only running tests that match the pattern "' +
        cyan(argv.grep) + '".'
  };
  if (!process.env.TRAVIS) {
    util.log(green('Run', cyan('gulp help'),
        'to see a list of all test flags. (Use', cyan('--nohelp'),
        'to silence these messages.)'));
    if (!argv.unit && !argv.integration && !argv.files) {
      util.log(green('Running all tests. Use',
          cyan('--unit'), 'or', cyan('--integration'),
          'to run just the unit tests or integration tests.'));
    }
    if (!argv.compiled) {
      util.log(green('Running tests against unminified code.'));
    }
    Object.keys(argv).forEach(arg => {
      const message = argvMessages[arg];
      if (message) {
        util.log(yellow('--' + arg + ':'), green(message));
      }
    });
  }
}


/**
 * Run tests.
 */
gulp.task('test', 'Runs tests',
    argv.nobuild ? [] : (argv.unit ? ['css'] : ['build']), function(done) {
  if (!argv.nohelp) {
    printArgvMessages();
  }

  var c = getConfig();

  if (argv.watch || argv.w) {
    c.singleRun = false;
  }

  if (argv.verbose || argv.v) {
    c.client.captureConsole = true;
  }

  if (argv.testnames) {
    c.reporters = ['mocha'];
    c.mochaReporter.output = 'full';
  }

  if (argv.files) {
    c.files = [].concat(config.commonTestPaths, argv.files);
    c.reporters = ['mocha'];
    c.mochaReporter.output = 'full';
  } else if (argv.integration) {
    c.files = config.integrationTestPaths;
  } else if (argv.unit) {
    c.files = config.unitTestPaths;
  } else if (argv.randomize || argv.glob) {
    const testPaths = config.basicTestPaths;

    var testFiles = [];
    for (var index in testPaths) {
      testFiles = testFiles.concat(glob.sync(testPaths[index]));
    }

    if (argv.randomize) {
      const seed = argv.seed || Math.random();
      util.log(
          util.colors.yellow('Randomizing:'),
          util.colors.cyan('Seeding with value', seed));
      util.log(
          util.colors.yellow('To rerun same ordering, append'),
          util.colors.cyan(`--seed=${seed}`),
          util.colors.yellow('to your invocation of'),
          util.colors.cyan('gulp test'));
      testFiles = shuffleSeed.shuffle(testFiles, seed);
    }

    testFiles.splice(testFiles.indexOf('test/_init_tests.js'), 1);
    c.files = config.commonTestPaths.concat(testFiles);
  } else {
    c.files = config.testPaths;
  }

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
    util.log(util.colors.blue('Including code coverage tests'));
    c.browserify.transform.push(
        ['browserify-istanbul', { instrumenterConfig: { embedSource: true }}]);
    c.reporters = c.reporters.concat(['progress', 'coverage']);
    if (c.preprocessors['src/**/*.js']) {
      c.preprocessors['src/**/*.js'].push('coverage');
    }
    c.coverageReporter = {
      dir: 'test/coverage',
      reporters: [
        { type: 'html', subdir: 'report-html' },
        { type: 'lcov', subdir: 'report-lcov' },
        { type: 'lcovonly', subdir: '.', file: 'report-lcovonly.txt' },
        { type: 'text', subdir: '.', file: 'text.txt' },
        { type: 'text-summary', subdir: '.', file: 'text-summary.txt' },
      ],
      instrumenterOptions: {
        istanbul: {
          noCompact: true,
        }
      }
    };
  }

  // Run fake-server to test XHR responses.
  var server = gulp.src(process.cwd())
      .pipe(webserver({
        port: 31862,
        host: 'localhost',
        directoryListing: true,
        middleware: [app],
      })
      .on('kill', function () {
        util.log(yellow(
            'Shutting down test responses server on localhost:31862'));
        process.nextTick(function() {
          process.exit();
        });
      }));
  util.log(yellow(
      'Started test responses server on localhost:31862'));

  new Karma(c, function(exitCode) {
    server.emit('kill');
    if (exitCode) {
      util.log(
          util.colors.red('ERROR:'),
          yellow('Karma test failed with exit code', exitCode));
      process.exit(exitCode);
    } else {
      done();
    }
  }).start();
}, {
  options: {
    'verbose': '  With logging enabled',
    'testnames': '  Lists the name of each test being run',
    'watch': '  Watches for changes in files, runs corresponding test(s)',
    'safari': '  Runs tests on Safari',
    'firefox': '  Runs tests on Firefox',
    'edge': '  Runs tests on Edge',
    'ie': '  Runs tests on IE',
    'unit': '  Run only unit tests.',
    'integration': '  Run only integration tests.',
    'compiled': '  Changes integration tests to use production JS ' +
        'binaries for execution',
    'grep': '  Runs tests that match the pattern',
    'files': '  Runs tests for specific files',
    'randomize': '  Runs entire test suite in random order',
    'seed': '  Seeds the test order randomization. Use with --randomize',
    'glob': '  Explicitly expands test paths using glob before passing ' +
        'to Karma',
    'nohelp': '  Silence help messages that are printed prior to test run',
  }
});
