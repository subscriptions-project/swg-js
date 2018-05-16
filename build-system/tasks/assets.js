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

const $$ = require('gulp-load-plugins')();
const babel = require('babelify');
const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const closureCompile = require('./closure-compile').closureCompile;
const fs = require('fs-extra');
const glob = require('glob');
const gulp = $$.help(require('gulp'));
const jsifyCssAsync = require('./jsify-css').jsifyCssAsync;
const lazypipe = require('lazypipe');
const minimatch = require('minimatch');
const minimist = require('minimist');
const pathLib = require('path');
const resolveConfig = require('./compile-config').resolveConfig;
const source = require('vinyl-source-stream');
const touch = require('touch');
const watchify = require('watchify');
const internalRuntimeVersion = require('./internal-version').VERSION;
const argv = require('minimist')(process.argv.slice(2));


function distSwgButton() {
  mkdirSync('dist');
  return compileCss('assets/swg-button.css', 'dist/swg-button.css', {
    sourceMap: false,
  }).then(() => {
    mkdirSync('dist/i18n');
    fs.copySync('assets/i18n/', 'dist/i18n/', {overwrite: true});
  });
}


/**
 * Compile all the css and drop in the build folder.
 *
 * @param {string} srcFile Source file.
 * @param {string} outputFile Destination file.
 * @param {?Object} options
 * @return {!Promise}
 */
function compileCss(srcFile, outputFile, options) {
  options = options || {};

  if (options.watch) {
    $$.watch(srcFile, function() {
      compileCss(srcFile, outputFile,
          Object.assign({}, options, {watch: false}));
    });
  }

  const startTime = Date.now();
  return jsifyCssAsync(srcFile, options).then(css => {
    mkdirSync(pathLib.dirname(outputFile));
    fs.writeFileSync(outputFile, css);
  }).then(() => {
    endBuildStep('Recompiled CSS', '', startTime);
  });
}


/**
 * Stops the timer for the given build step and prints the execution time,
 * unless we are on Travis.
 * @param {string} stepName Name of the action, like 'Compiled' or 'Minified'
 * @param {string} targetName Name of the target, like a filename or path
 * @param {DOMHighResTimeStamp} startTime Start time of build step
 */
function endBuildStep(stepName, targetName, startTime) {
  const endTime = Date.now();
  const executionTime = new Date(endTime - startTime);
  const secs = executionTime.getSeconds();
  const ms = executionTime.getMilliseconds().toString();
  let timeString = '(';
  if (secs === 0) {
    timeString += ms + ' ms)';
  } else {
    timeString += secs + '.' + ms + ' s)';
  }
  if (!process.env.TRAVIS) {
    $$.util.log(
        stepName,
        $$.util.colors.cyan(targetName),
        $$.util.colors.green(timeString));
  }
}


function mkdirSync(path) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }
}


gulp.task('assets:swg-button', 'Prepare button assets', distSwgButton);
