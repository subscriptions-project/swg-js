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
const autoprefixer = require('autoprefixer');
const cssnanoDecl = require('cssnano');
const fs = require('fs-extra');
const postcss = require('postcss');
const postcssImport = require('postcss-import');

// NOTE: see https://github.com/ai/browserslist#queries for `browsers` list
const cssprefixer = autoprefixer({
  browsers: [
    'last 5 ChromeAndroid versions',
    'last 5 iOS versions',
    'last 3 FirefoxAndroid versions',
    'last 5 Android versions',
    'last 2 ExplorerMobile versions',
    'last 2 OperaMobile versions',
    'last 2 OperaMini versions',
  ],
});

// See http://cssnano.co/optimisations/ for full list.
// We try and turn off any optimization that is marked unsafe.
const cssnano = cssnanoDecl({
  autoprefixer: false,
  convertValues: false,
  discardUnused: false,
  // `mergeIdents` this is only unsafe if you rely on those animation names in JavaScript.
  mergeIdents: true,
  reduceIdents: false,
  zindex: false,
  svgo: {
    encode: true,
  },
});


/**
 * 'Jsify' a CSS file - Adds vendor specific css prefixes to the css file,
 * compresses the file, removes the copyright comment, and adds the sourceURL
 * to the stylesheet
 *
 * @param {string} filename css file
 * @param {?Object=} opt_options
 * @return {!Promise<string>} that resolves with the css content after
 *    processing
 */
exports.jsifyCssAsync = function(filename, opt_options) {
  const options = Object.assign({
    sourceMap: true,
  }, opt_options || {});
  const css = fs.readFileSync(filename, 'utf8');
  const transformers = [cssprefixer, cssnano];
  return postcss(transformers).use(postcssImport).process(css.toString(), {
    'from': filename,
  }).then(function(result) {
    result.warnings().forEach(function(warn) {
      $$.util.log($$.util.colors.red(warn.toString()));
    });
    let css = result.css;
    if (options.sourceMap) {
      css += '\n/*# sourceURL=/' + filename + '*/';
    }
    return css;
  });
};
