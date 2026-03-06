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

const args = require('./args');
const {execOrDie} = require('../exec');

async function e2e() {
  const env = args.env || '';
  const updateSnapshots =
    args['update-screenshots'] || args['update-snapshots']
      ? '--update-snapshots'
      : '';

  const grep = args.tag ? `--grep "@${args.tag}"` : '';
  const grepInvert = args.skiptags
    ? `--grep-invert "@${args.skiptags.split(',').join('|@')}"`
    : '';

  if (env === 'all_experiments_enabled') {
    process.env.SWG_EXPERIMENTS = [
      'logging-audience-activity',
      'disable-desktop-miniprompt',
      'background_click_behavior_experiment',
    ].join(',');
  }

  const cmd = `npx playwright test ${updateSnapshots} ${grep} ${grepInvert}`;
  console.log('Running e2e command:', cmd);
  execOrDie(cmd);
}

module.exports = {
  e2e,
};
e2e.description = 'Run e2e tests via Playwright';
e2e.flags = {
  'tag':
    ' Filter test modules by tags. Only tests that have the specified will be' +
    ' loaded',
  'skiptags':
    ' Skips tests that have the specified tag or tags (comma separated).',
  'update-screenshots':
    'Updates VRT snapshots using playwright --update-snapshots',
};
