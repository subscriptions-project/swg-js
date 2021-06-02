/**
65;6203;1c * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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
 * some change
 */

// Install dependencies before anything else.
const {execOrDie} = require('./build-system/exec');
const {isCiBuild} = require('./build-system/ci');
if (!isCiBuild()) {
  // CI systems will have already installed dependencies.
  execOrDie('npx yarn');
}

const $$ = require('gulp-load-plugins')();
const gulp = $$.help(require('gulp'));
const {
  build,
  checkTypes,
  clean,
  dist,
  watch,
} = require('./build-system/tasks/builders');
const {
  runAllExportsToEs,
  runAllExportsToAmp,
} = require('./build-system/tasks/export-to-es');
const {assets} = require('./build-system/tasks/assets');
const {changelog} = require('./build-system/tasks/changelog');
const {checkRules} = require('./build-system/tasks/check-rules');
const {e2e} = require('./build-system/tasks/e2e');
const {lint} = require('./build-system/tasks/lint');
const {serve} = require('./build-system/tasks/serve');
const {unit} = require('./build-system/tasks/unit');

// Gulp tasks.
gulp.task('assets', assets);
gulp.task('build', build);
gulp.task('changelog', changelog);
gulp.task('lint', lint);
gulp.task('check-types', checkTypes);
gulp.task('check-rules', checkRules);
gulp.task('unit', unit);
gulp.task('watch', watch);
gulp.task('serve', serve);
gulp.task('clean', clean);
gulp.task('e2e', e2e);
gulp.task('dist', dist);
gulp.task('export-to-es-all', runAllExportsToEs);
gulp.task('export-to-amp', runAllExportsToAmp);

gulp.task('default', gulp.series(['watch', 'serve']));

const check = gulp.series('lint', 'check-types', 'check-rules');
check.description = 'Run through all checks';
gulp.task('check', check);

const presubmit = gulp.series('check', 'unit');
presubmit.description = 'Run through all checks and tests';
gulp.task('presubmit', presubmit);
