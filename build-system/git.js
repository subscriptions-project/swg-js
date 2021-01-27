/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
 * Copyright 2018 The AMP HTML Authors. All Rights Reserved.
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

/**
 * @fileoverview Provides functions for executing various git commands.
 */

const {getStdout} = require('./exec');

/**
 * Returns the list of files changed relative to the branch point off of main,
 * one on each line.
 * @return {!Array<string>}
 */
exports.gitDiffNameOnlyMain = function () {
  const mainBaseline = gitMainBaseline();
  return getStdout(`git diff --name-only ${mainBaseline}`).trim().split('\n');
};

/**
 * Returns the main baseline commit.
 * @return {string}
 */
function gitMainBaseline() {
  return getStdout('git merge-base main HEAD').trim();
}
