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
const rollup = require('rollup');
const resolveNodeModules = require('rollup-plugin-node-resolve');
const commonJS = require('rollup-plugin-commonjs');
const util = require('util');
const cleanup = require('rollup-plugin-cleanup');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);

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
async function exportToEs6(inputFile, outputFile) {
  await mkdirs(['build', 'dist']);

  const license = (await
    readFile('build-system/tasks/license-header.txt', 'utf8')).trim();
  const bundle = await rollup.rollup({
    input: inputFile,
    plugins: [
      resolveNodeModules(),
      commonJS(),
      // #TODO create externs file to make closure compiler happy
      // during AMP build
      // Commented out per kbax to allow AMP to build.
      // cleanup({comments:'none'}),
    ],
  });
  const {code} = await bundle.generate({
    format: 'es',
    sourcemap: true,
  });

  let output = `${license}\n/** Version: ${version} */\n${code}`;
  // Replacements (TBD Rollup Plugin replacements instead)
  const replacements = resolveConfig();
  for (const k in replacements) {
    output = output.replace(
        new RegExp('\\$' + k + '\\$', 'g'), replacements[k]
    );
  }

  // Change the export format.	
  output = output.replace(/module.exports\s*\=\s*\{/g, 'export {');

  return writeFile(outputFile, output);
}

/**
 * @param {string} inputFile
 * @param {string} outputFile
 */
async function exportCss(inputFile, outputFile) {
  await mkdirs(['build', 'dist']);

  let css = (await readFile(inputFile, 'utf8'));
  // Resolve all URLs to absolute paths.
  css = css.replace(/url\(([^)]*)\)/ig, (match, value) => {
    if (value[0] == '"') {
      value = value.substring(1, value.length - 1);
    }
    if (/(data|http|https):/i.test(value)) {
      return match;
    }
    return `url("https://news.google.com/swg/js/v1/${value}")`;
  });

  return writeFile(outputFile, css);
}

async function mkdirs(paths) {
  for (const path in paths) {
    const pathExists = await exists(path);

    if (!pathExists) {
      await mkdir(path);
    }
  }
}


gulp.task('export-to-es-all', 'All exports to ES', runAllExportsToEs);
