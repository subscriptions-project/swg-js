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

var $$ = require('gulp-load-plugins')();
var babel = require('babelify');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var compile = require('./compile').compile;
var compileCheckTypes = require('./compile').checkTypes;
var del = require('del');
var fs = require('fs-extra');
var gulp = $$.help(require('gulp'));
var lazypipe = require('lazypipe');
var minimatch = require('minimatch');
var minimist = require('minimist');
var source = require('vinyl-source-stream');
var touch = require('touch');
var watchify = require('watchify');


/**
 * Clean up the build artifacts.
 * @return {!Promise}
 */
function clean() {
  return del([
    'dist',
    'build',
  ]);
}


/**
 * Enables watching for file changes and re-compiles.
 * @return {!Promise}
 */
function watch() {
  return Promise.all([
    compile({watch: true}),
  ]);
}

/**
 * Main development build.
 * @return {!Promise}
 */
function build() {
  process.env.NODE_ENV = 'development';
  return Promise.all([
    compile(),
  ]);
}

/**
 * Dist build for prod.
 * @return {!Promise}
 */
function dist() {
  process.env.NODE_ENV = 'production';
  return clean().then(() => {
    return Promise.all([
      compile({minify: true, checkTypes: false, isProdBuild: true}),
    ]).then(() => {
      // Check types now.
      return compile({minify: true, checkTypes: true});
    });
  });
}


/**
 * Type check path.
 * @return {!Promise}
 */
function checkTypes() {
  process.env.NODE_ENV = 'production';
  return compileCheckTypes();
}


gulp.task('clean', 'Removes build output', clean);
gulp.task('watch', 'Watches for changes in files, re-build', watch);
gulp.task('build', 'Builds the library', build);
gulp.task('dist', 'Build production binaries', dist, {
  options: {
    pseudo_names: 'Compiles with readable names. ' +
        'Great for profiling and debugging production code.',
  }
});
gulp.task('check-types', 'Check JS types', checkTypes);
