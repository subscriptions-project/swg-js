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

const commonTestPaths = [
  'test/_init_tests.js',
  '!node_modules',
  'test/chai-as-promised/chai-as-promised.js',
  {
    pattern: 'test/fixtures/*.html',
    included: false,
    nocache: false,
    watched: true,
  },
  {
    pattern: 'dist/**/*.js',
    included: false,
    nocache: false,
    watched: true,
  },
  {
    pattern: 'examples/**/*',
    included: false,
    nocache: false,
    watched: true,
  },
  {
    pattern: 'test/coverage/**/*',
    included: false,
    nocache: false,
    watched: false,
  },
];

const basicTestPaths = ['src/**/*-test.js'];

const unitTestPaths = commonTestPaths.concat(basicTestPaths);

/** @const  */
module.exports = {
  commonTestPaths,
  basicTestPaths,
  unitTestPaths,
  lintGlobs: [
    '**/*.js',
    '!**/*.extern.js',
    '!exports/*.js', // Exports only.
    '!src/api/*.js', // Avoid "unused" prefixes in APIs.
    '!src/proto/*.js', // Auto generated code,
    '!{node_modules,build,dist,third_party}/**/*.*',
    '!{testing,examples}/**/*.*',
    '!eslint-rules/**/*.*',
    '!test/coverage/**/*.*',
    '!test/describes.js',
    '!build-system/extern.js',
  ],
  jsonGlobs: [
    '**/*.json',
    '!{node_modules,build,dist,third_party,build-system}/**/*.*',
  ],
  presubmitGlobs: [
    '**/*.{css,js,go}',
    '!{node_modules,build,dist}/**/*.*',
    '!build-system/tasks/*.js',
    '!build-system/server/*.js',
    '!build/polyfills.js',
    '!build/polyfills/*.js',
    '!examples/sample-pub/**/*',
    '!gulpfile.js',
    '!third_party/**/*.*',
    '!test/coverage/**/*.*',
  ],
  changelogIgnoreFileTypes: /\.md|\.json|\.yaml|LICENSE|CONTRIBUTORS$/,
};
