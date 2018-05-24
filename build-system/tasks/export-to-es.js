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
const BBPromise = require('bluebird');
const exec = BBPromise.promisify(require('child_process').exec);
const fs = require('fs-extra');
const gulp = $$.help(require('gulp'));
const resolveConfig = require('./compile-config').resolveConfig;
const version = require('./internal-version').VERSION;


function runAllExportsToEs() {
  return Promise.resolve().then(() => {
    return exportToEs6('exports/config.js', 'dist/exports-config.js');
  }).then(() => {
    return exportToEs6('exports/swg.js', 'dist/exports-swg.js');
  }).then(() => {
    return exportCss('assets/swg-button.css', 'dist/exports-swg-button.css');
  });
}


/**
 * @param {string} inputFile
 * @param {string} outputFile
 * @return {!Promise}
 */
function exportToEs6(inputFile, outputFile) {
  mkdirSync('build');
  mkdirSync('dist');
  let js;
  return exec(
      './node_modules/rollup/bin/rollup' +
      ' "' + inputFile + '"' +
      ' --f es' +
      ' --o build/rollup.js'
  ).then(() => {
    js = fs.readFileSync('build/rollup.js', 'utf8');
    // 1. Rearrange one license on top.
    const license = fs.readFileSync(
        'build-system/tasks/license-header.txt', 'utf8').trim();
    while (true) {
      let start = js.indexOf('Licensed under the');
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
    js = `${license}\n /** Version: ${version} */\n'use strict';\n${js}`;

    // 2. Replace vars.
    const replacements = resolveConfig();
    for (const k in replacements) {
      js = js.replace(new RegExp('\\$' + k + '\\$', 'g'), replacements[k]);
    }

    // 3. Change the export format.
    js = js.replace(/module.exports\s*\=\s*\{/g, 'export {');

    return js;
  }).then(js => {
    // Save.
    fs.writeFileSync(outputFile, js);
  });
}


/**
 * @param {string} inputFile
 * @param {string} outputFile
 */
function exportCss(inputFile, outputFile) {
  mkdirSync('build');
  mkdirSync('dist');
  let css = fs.readFileSync(inputFile, 'utf8');
  // 1. Resolve all URLs to absolute.
  css = css.replace(/url\(([^)]*)\)/ig, (match, value) => {
    if (value[0] == '"') {
      value = value.substring(1, value.length - 1);
    }
    if (/(data|http|https):/i.test(value)) {
      return match;
    }
    return `url("https://news.google.com/swg/js/v1/${value}")`;
  });
  fs.writeFileSync(outputFile, css);
}


function check(js, regex, message, file) {
  if (regex.test(js)) {
    throw new Error(file + ': ' + message + ': ' + regex.exec(js)[0]);
  }
}


function mkdirSync(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
}


gulp.task('export-to-es-all', 'All exports to ES', runAllExportsToEs);
