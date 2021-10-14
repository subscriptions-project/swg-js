/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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

const argv = require('minimist')(process.argv.slice(2));
const gulp = require('gulp');
const nightwatch = require('gulp-nightwatch');
const {dist} = require('./builders');

async function e2e() {
  // Compile minified js and css so e2e tests will run against local minified js and css.
  await dist();
  return gulp.src('gulpfile.js').pipe(
    nightwatch({
      configFile: 'test/e2e/nightwatch.json',
      cliArgs: {
        tag: argv.tag,
        skiptags: argv.skiptags,
        retries: argv.retries,
      },
    })
  );
}

module.exports = {
  e2e,
};
e2e.description = 'Run e2e tests';
e2e.flags = {
  'tag':
    ' Filter test modules by tags. Only tests that have the specified will be' +
    ' loaded',
  'skiptags':
    ' Skips tests that have the specified tag or tags (comma separated).',
  'retries':
    ' Retries failed or errored testcases up to the specified number of times.',
};
