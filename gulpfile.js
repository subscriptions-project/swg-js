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

// Install dependencies before anything else.
const {execOrDie} = require('./build-system/exec');
const {isCiBuild} = require('./build-system/ci');
if (!isCiBuild()) {
  // CI systems will have already installed dependencies.
  execOrDie('npm i');
}

const $$ = require('gulp-load-plugins')();
require('dotenv').config(); // eslint-disable-line
const gulp = $$.help(require('gulp'));
const {assets} = require('./build-system/tasks/assets');
const {build, clean, watch} = require('./build-system/tasks/builders');
const {changelog} = require('./build-system/tasks/changelog');
const {checkRules} = require('./build-system/tasks/check-rules');
const {e2e} = require('./build-system/tasks/e2e');
const {lint} = require('./build-system/tasks/lint');
const {publish} = require('./build-system/tasks/publish');
const {serve} = require('./build-system/tasks/serve');
const {unit} = require('./build-system/tasks/unit');

// Gulp tasks.
gulp.task('assets', assets);
gulp.task('build', build);
gulp.task('changelog', changelog);
gulp.task('publish', publish);
gulp.task('lint', lint);
gulp.task('check-rules', checkRules);
gulp.task('unit', unit);
gulp.task('watch', watch);
gulp.task('serve', serve);
gulp.task('clean', clean);
gulp.task('e2e', e2e);

gulp.task('default', gulp.series(['watch', 'serve']));

const check = gulp.series('lint', 'check-rules');
check.description = 'Run through all checks';
gulp.task('check', check);

const presubmit = gulp.series('check', 'unit');
presubmit.description = 'Run through all checks and tests';
gulp.task('presubmit', presubmit);
