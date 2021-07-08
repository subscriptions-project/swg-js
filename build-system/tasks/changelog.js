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

/**
 * @fileoverview A gulp task that fetches the titles and files
 * of pull requests using the github API from the last release's git tag.
 */

const argv = require('minimist')(process.argv.slice(2));
const BBPromise = require('bluebird');
const git = require('gulp-git');
const gitExec = BBPromise.promisify(git.exec);
const githubRequest = require('./github').githubRequest;
const logger = require('fancy-log');

const {blue, red, yellow} = require('ansi-colors');

/**
 * @typedef {{
 *   id: string,
 *   publishedAt: string,
 *   name: string,
 *   author: string,
 *   tag: string,
 *   logs: !Array<{sha: string, title: string}>,
 *   prs: !Array<!Object>,
 *   changelog: string,
 *   version: string,
 * }} ReleaseMetadata
 */

/**
 * @return {!Promise<!ReleaseMetadata>}
 */
function changelog() {
  return getLastGithubRelease()
    .then(getGitLog)
    .then(getGithubPullRequestsMetadata)
    .then(buildChangelog)
    .then((response) => {
      logger(blue('\n' + response.changelog));
      return response;
    })
    .catch(errHandler);
}

/**
 * Get the latest git tag from a normal release.
 * @return {!Promise<!ReleaseMetadata>}
 */
function getLastGithubRelease() {
  return githubRequest({
    path: '/releases/latest',
  }).then((res) => {
    const id = res['id'];
    const tag = res['tag_name'];
    if (res['draft']) {
      throw new Error('This is a draft release: ' + id);
    }
    if (res['prerelease']) {
      throw new Error('This is a prerelease: ' + id);
    }
    if (!tag) {
      if (!process.env.GITHUB_ACCESS_TOKEN) {
        throw new Error(
          'Please add your GitHub personal access token as an environment variable named `GITHUB_ACCESS_TOKEN`. For more details, see https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token'
        );
      }

      throw new Error('No tag: ' + id);
    }
    return {
      id,
      tag,
      publishedAt: res['published_at'],
      name: res['name'],
      author: res['author'] && res['author']['login'],
    };
  });
}

/**
 * Extracts the log on the current branch since the release.
 * @param {!ReleaseMetadata} release
 * @return {!Promise<!ReleaseMetadata>}
 */
function getGitLog(release) {
  const tag = release.tag;
  return gitExec({
    args: `log ${tag}... --pretty=oneline --first-parent`,
  }).then((logs) => {
    if (!logs) {
      throw new Error(
        'No logs found "git log ' +
          tag +
          '...".\n' +
          'Is it possible that there is no delta?\n' +
          'Make sure to fetch and rebase (or reset --hard) the latest ' +
          'from remote upstream.'
      );
    }
    const commits = logs.split('\n').filter((log) => !!log.length);
    release.logs = commits.map((log) => {
      const words = log.split(' ');
      return {
        sha: words.shift(),
        title: words.join(' '),
      };
    });
    return release;
  });
}

/**
 * @param {!ReleaseMetadata} release
 * @return {!Promise<!GitMetadataDef>}
 */
function getGithubPullRequestsMetadata(release) {
  /**
   * Fetches pulls?page=${page}
   * @param {number} page
   * @return {!Promise<!Array<!PrMetadataDef>}
   */
  function getClosedPullRequests(page) {
    return githubRequest({
      path: '/pulls',
      qs: {
        page,
        state: 'closed',
      },
    });
  }

  // TODO(erwinm): Github seems to only return data for the first 3 pages
  // from my manual testing.
  return BBPromise.all([
    getClosedPullRequests(1),
    getClosedPullRequests(2),
    getClosedPullRequests(3),
  ])
    .then((requests) => {
      return [].concat.apply([], requests);
    })
    .then((prs) => {
      release.prs = prs;
      const githubPrRequest = release.logs.map((log) => {
        const pr = prs.filter((pr) => pr.merge_commit_sha == log.sha)[0];
        if (pr) {
          log.pr = {
            id: pr['number'],
            title: pr['title'],
            body: pr['body'],
            // eslint-disable-next-line google-camelcase/google-camelcase
            merge_commit_sha: pr['merge_commit_sha'],
            url: pr['_links']['self']['href'],
          };
        } else {
          // TODO(dvoytenko): try to find PR from the GitHub API.
          logger.warn(yellow('PR not found for commit: ' + log.sha));
        }
        return BBPromise.resolve();
      });
      return BBPromise.all(githubPrRequest).then(() => release);
    });
}

/**
 * @param {!ReleaseMetadata} release
 * @return {!ReleaseMetadata}
 */
function buildChangelog(release) {
  // Suggest a version number.
  let version = '';
  if (argv.swgVersion) {
    // Use the --swgVersion CLI param, if present.
    version = String(argv.swgVersion);
  } else {
    // Increment the last number.
    const versionSegments = release.tag.split('.');
    const lastNumber = Number(versionSegments.pop()) + 1;
    versionSegments.push(lastNumber);
    version = versionSegments.join('.');
  }

  let changelog = `## Version: ${version}\n\n`;

  changelog +=
    '## Previous release: ' +
    `[${release.tag}]` +
    '(' +
    `https://github.com/subscriptions-project/swg-js/releases/tag/${release.tag}` +
    ')\n\n';

  // Append all titles.
  changelog += release.logs
    .map((log) => {
      const pr = log.pr;
      return '  - ' + (pr ? `${pr.title.trim()} (#${pr.id})` : log.title);
    })
    .join('\n');

  release.changelog = changelog;
  release.version = version;
  return release;
}

function errHandler(err) {
  let msg = err;
  if (err.message) {
    msg = err.message;
  }
  logger(red(msg));
}

module.exports = {
  changelog,
};
changelog.description = 'Change log since last release';
