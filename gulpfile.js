/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

checkMinVersion();

var $$ = require('gulp-load-plugins')();
var fs = require('fs-extra');
var gulp = $$.help(require('gulp'));
var gulpSequence = require('gulp-sequence')
var lazypipe = require('lazypipe');
var minimatch = require('minimatch');
var minimist = require('minimist');
var source = require('vinyl-source-stream');
var touch = require('touch');
var watchify = require('watchify');

var argv = minimist(process.argv.slice(2), {boolean: ['strictBabelTransform']});

require('./build-system/tasks');

/**
 * Exits the process if gulp is running with a node version lower than
 * the required version. This has to run very early to avoid parse
 * errors from modules that e.g. use let.
 */
function checkMinVersion() {
  var majorVersion = Number(process.version.replace(/v/, '').split('.')[0]);
  if (majorVersion < 4) {
    $$.util.log('Please run __PROJECT__ with node.js version 4 or newer.');
    $$.util.log('Your version is', process.version);
    process.exit(1);
  }
}


//
// Gulp tasks
//
gulp.task('check', 'Run through all checks',
    gulpSequence('lint', 'check-types', 'check-rules'));
gulp.task('presubmit', 'Run through all checks and tests',
    gulpSequence('check-rules', 'test'));
gulp.task('default', 'Same as "watch"',
    ['watch', 'serve']);
