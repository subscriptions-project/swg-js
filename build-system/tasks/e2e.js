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

const gulp = require('gulp');
const nightwatch = require('gulp-nightwatch');
const {build} = require('./builders');

async function e2e() {
  // Compile js and css so e2e tests will run against local js and css.
  await build();
  return gulp.src('gulpfile.js')
    .pipe(nightwatch({
      configFile: 'test/e2e/nightwatch.json'
    }));
}

module.exports = {
  e2e,
};
e2e.description = 'Run e2e tests';
