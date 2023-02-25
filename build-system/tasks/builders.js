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

const compile = require('./compile').compile;

/**
 * Clean up the build artifacts.
 * @return {!Promise}
 */
async function clean() {
  const {deleteAsync} = await import('del');
  return deleteAsync(['dist', 'build']);
}

/**
 * Enables watching for file changes and re-compiles.
 * @return {!Promise}
 */
function watch() {
  return compile({watch: true});
}

/**
 * Main development build.
 * @return {!Promise}
 */
function build(options = {}) {
  process.env.NODE_ENV = 'development';
  return compile(options);
}

module.exports = {
  build,
  clean,
  watch,
};
watch.description = 'Watches for changes in files, re-build';

clean.description = 'Removes build output';

build.description = 'Builds the library';
