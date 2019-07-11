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

const argv = require('minimist')(process.argv.slice(2));
const gulp = require('gulp-help')(require('gulp'));
const prettier = require('gulp-prettier');

/** Fixes code formatting using Prettier. */
function fix() {
  if (!argv.files) {
    console.error(
      'Error: The `--files` flag is required. Ex: gulp fix --files=src/**/*js'
    );
    return;
  }

  return gulp
    .src(argv.files)
    .pipe(prettier({ singleQuote: true }))
    .pipe(gulp.dest(file => file.base));
}

gulp.task('fix', 'Fixes code formatting using Prettier', fix, {
  options: {
    files: '  Specifies files to fix. Ex: gulp fix --files=src/**/*js'
  }
});
