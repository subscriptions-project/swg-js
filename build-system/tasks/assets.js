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
const fs = require('fs-extra');
const jsifyCssAsync = require('./jsify-css').jsifyCssAsync;
const pathLib = require('path');
const {endBuildStep, mkdirSync} = require('./helpers');

function assets() {
  mkdirSync('dist');
  fs.copySync('assets/loader.svg', 'dist/loader.svg', {overwrite: true});
  return Promise.all([
    compileCss('assets/swg-button.css', 'dist/swg-button.css', {
      sourceMap: false,
    }),
    compileCss('assets/swg-mini-prompt.css', 'dist/swg-mini-prompt.css', {
      sourceMap: false,
    }),
  ]).then(() => {
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
    $$.watch(srcFile, function () {
      compileCss(
        srcFile,
        outputFile,
        Object.assign({}, options, {watch: false})
      );
    });
  }

  const startTime = Date.now();
  return jsifyCssAsync(srcFile, options)
    .then((css) => {
      mkdirSync(pathLib.dirname(outputFile));
      fs.writeFileSync(outputFile, css);
    })
    .then(() => {
      endBuildStep('Recompiled CSS', '', startTime);
    });
}

module.exports = {
  assets,
};
assets.description = 'Prepare assets';
