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

const $$ = require('gulp-load-plugins')();
const fs = require('fs-extra');
const gulp = $$.help(require('gulp'));
const gulpSequence = require('gulp-sequence')
const lazypipe = require('lazypipe');
const minimatch = require('minimatch');
const minimist = require('minimist');
const source = require('vinyl-source-stream');
const touch = require('touch');
const watchify = require('watchify');

/**
 * @const {!Object}
 */
const argv =
    minimist(process.argv.slice(2), {boolean: ['strictBabelTransform']});

/** @const {number} */
const NODE_MIN_VERSION = 4;

require('./build-system/tasks');

const internalRuntimeVersion =
    require('./build-system/tasks/internal-version').VERSION;

/**
 * Checks if installed local Node.js version is > NODE_MIN_VERSION.
 */
checkMinVersion();

/**
 * Exits the process if gulp is running with a node version lower than
 * the required version. This has to run very early to avoid parse
 * errors from modules that e.g. use let.
 */
function checkMinVersion() {
  const majorVersion = Number(process.version.replace(/v/, '').split('.')[0]);
  if (majorVersion < NODE_MIN_VERSION) {
    $$.util.log('Please run Subscribe with Google with node.js version ' +
        `${NODE_MIN_VERSION} or newer.`);
    $$.util.log('Your version is', process.version);
    process.exit(1);
  }
}

function printVersion() {
  fs.writeFileSync('dist/version.txt', internalRuntimeVersion);
}


// Gulp tasks.
gulp.task('check', 'Run through all checks',
    gulpSequence('lint', 'check-types', 'check-rules'));
gulp.task('presubmit', 'Run through all checks and tests',
    gulpSequence('check', 'test'));
gulp.task('default', 'Same as "watch"', ['watch', 'serve']);
gulp.task('print-version', 'SwG version', printVersion);
