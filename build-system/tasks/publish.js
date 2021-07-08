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
  * @fileoverview A gulp task that uses the GitHub API to publish and tag a new
  * release based off the generated changelog.
  */

const githubRequest = require('./github').githubRequest;
const changelog = require('./changelog').changelog;
const logger = require('fancy-log');
const argv = require('minimist')(process.argv.slice(2), {
  default: {
    draft: false
  }
});

const {red} = require('ansi-colors');

/**
 * @return {!Promise}
 */
async function publish() {
  try {
    const release = await changelog();
    await publishRelease(release);
  } catch (err) {
    errHandler(err);
  }
}

/** 
 * @param {import('./changelog').ReleaseMetadata} release
*/
async function publishRelease(release) {
  const response = await githubRequest({
    path: '/releases',
    method: 'POST',
    json: {
      tag_name: release.version,
      target_commitish: 'main',
      name: `SwG Release ${release.version}`,
      body: release.changelog,
      prerelease: true,
      draft: argv.draft,
    }
  });
}

function errHandler(err) {
  let msg = err;
  if (err.message) {
    msg = err.message;
  }
  logger(red(msg));
}

module.exports = {
  publish,
};
publish.description = 'Publish latest release to GitHub';
