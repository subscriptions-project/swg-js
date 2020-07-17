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

const {
  isTravisBuild,
  isTravisPullRequestBuild,
  travisPullRequestBranch,
  travisPullRequestSha,
} = require('./travis');
const {getStdout} = require('./exec');

/**
 * Returns the commit at which the current branch was forked off of main.
 * On Travis, there is an additional merge commit, so we must pick the first of
 * the boundary commits (prefixed with a -) returned by git rev-list.
 * On local branches, this is merge base of the current branch off of main.
 * @return {string}
 */
exports.gitBranchCreationPoint = function () {
  if (isTravisBuild()) {
    const traviPrSha = travisPullRequestSha();
    return getStdout(
      `git rev-list --boundary ${traviPrSha}...main | grep "^-" | head -n 1 | cut -c2-`
    ).trim();
  }
  return gitMergeBaseLocalMain();
};

/**
 * Returns the `main` parent of the merge commit (current HEAD) on Travis.
 * @return {string}
 */
exports.gitTravisMainBaseline = function () {
  return getStdout('git rev-parse origin/main').trim();
};

/**
 * Shortens a commit SHA to 7 characters for human readability.
 * @param {string} sha 40 characters SHA.
 * @return {string} 7 characters SHA.
 */
exports.shortSha = function (sha) {
  return sha.substr(0, 7);
};

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
 * Returns the list of files changed relative to the branch point off of main,
 * in diffstat format.
 * @return {string}
 */
exports.gitDiffStatMain = function () {
  const mainBaseline = gitMainBaseline();
  return getStdout(`git -c color.ui=always diff --stat ${mainBaseline}`);
};

/**
 * Returns a detailed log of commits included in a PR check, starting with (and
 * including) the branch point off of main. Limited to commits in the past
 * 30 days to keep the output sane.
 *
 * @return {string}
 */
exports.gitDiffCommitLog = function () {
  const branchCreationPoint = exports.gitBranchCreationPoint();
  const commitLog = getStdout(`git -c color.ui=always log --graph \
--pretty=format:"%C(red)%h%C(reset) %C(bold cyan)%an%C(reset) \
-%C(yellow)%d%C(reset) %C(reset)%s%C(reset) %C(green)(%cr)%C(reset)" \
--abbrev-commit ${branchCreationPoint}^...HEAD --since "30 days ago"`).trim();
  return commitLog;
};

/**
 * Returns the list of files added by the local branch relative to the branch
 * point off of main, one on each line.
 * @return {!Array<string>}
 */
exports.gitDiffAddedNameOnlyMain = function () {
  const branchPoint = gitMergeBaseLocalMain();
  return getStdout(`git diff --name-only --diff-filter=ARC ${branchPoint}`)
    .trim()
    .split('\n');
};

/**
 * Returns the full color diff of the uncommited changes on the local branch.
 * @return {string}
 */
exports.gitDiffColor = function () {
  return getStdout('git -c color.ui=always diff').trim();
};

/**
 * Returns the name of the branch from which the PR originated.
 * @return {string}
 */
exports.gitBranchName = function () {
  return isTravisPullRequestBuild()
    ? travisPullRequestBranch()
    : getStdout('git rev-parse --abbrev-ref HEAD').trim();
};

/**
 * Returns the commit hash of the latest commit.
 * @return {string}
 */
exports.gitCommitHash = function () {
  if (isTravisPullRequestBuild()) {
    return travisPullRequestSha();
  }
  return getStdout('git rev-parse --verify HEAD').trim();
};

/**
 * Returns the email of the author of the latest commit on the local branch.
 * @return {string}
 */
exports.gitCommitterEmail = function () {
  return getStdout('git log -1 --pretty=format:"%ae"').trim();
};

/**
 * Returns the timestamp of the latest commit on the local branch.
 * @return {number}
 */
exports.gitCommitFormattedTime = function () {
  return getStdout(
    'TZ=UTC git log -1 --pretty="%cd" --date=format-local:%y%m%d%H%M%S'
  ).trim();
};

/**
 * Returns the merge base of the current branch off of main when running on
 * a local workspace.
 * @return {string}
 */
function gitMergeBaseLocalMain() {
  return getStdout('git merge-base main HEAD').trim();
}

/**
 * Returns the main baseline commit, regardless of running environment.
 * @return {string}
 */
function gitMainBaseline() {
  if (isTravisBuild()) {
    return exports.gitTravisMainBaseline();
  }
  return gitMergeBaseLocalMain();
}
