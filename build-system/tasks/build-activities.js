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
'use strict';

var $$ = require('gulp-load-plugins')();
var BBPromise = require('bluebird');
var argv = require('minimist')(process.argv.slice(2));
var babel = require('babelify');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var compile = require('./compile').compile;
var compileCheckTypes = require('./compile').checkTypes;
var del = require('del');
var exec = BBPromise.promisify(require('child_process').exec);
var fs = require('fs-extra');
var gulp = $$.help(require('gulp'));
var lazypipe = require('lazypipe');
var minimatch = require('minimatch');
var minimist = require('minimist');
var source = require('vinyl-source-stream');
var touch = require('touch');
var watchify = require('watchify');


/**
 * @return {!Promise}
 */
function rollupActivities() {
  mkdirSync('build');
  mkdirSync('dist');
  return exec(
    './node_modules/rollup/bin/rollup' +
    ' src/activities/activities.js' +
    ' --f es' +//cjs
    ' --no-treeshake --no-strict' +
    ' --o build/activities-rollup.js'
  ).then(() => {
    let js = fs.readFileSync('build/activities-rollup.js', 'utf8');
    // 1. Rearrange one license on top.
    const license = fs.readFileSync(
        'build-system/tasks/license-header.txt', 'utf8').trim();
    while (true) {
      let start = js.indexOf('@license');
      if (start == -1) {
        break;
      }
      for (; start >= 0; start--) {
        if (js.substring(start, start + 2) == '/*') {
          break;
        }
      }
      let end = js.indexOf('*/', start) + 2;
      if (js.substring(end) == '\n') {
        end++;
      }
      js = js.substring(0, start) + js.substring(end);
    }
    js = license + '\n' + js;

    // 2. Strip "Def"
    js = js.replace(/Def/g, '');

    // 3. Strip exports.
    js = js.replace(/export \{.*\}\;/, '');
    return js;
  }).then(js => {
    fs.writeFileSync('dist/activities-es6.js', js);
  });
}


function mkdirSync(path) {
  try {
    fs.mkdirSync(path);
  } catch(e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }
}


gulp.task('activities-to-es6', 'Rollup activities to a ES6 module',
    rollupActivities);
