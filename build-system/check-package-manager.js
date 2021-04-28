/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
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
 * @fileoverview Checks package manager and Nodejs version;
 */

const https = require('https');
const {getStdout} = require('./exec');
const {isCiBuild} = require('./ci');

const nodeDistributionsUrl = 'https://nodejs.org/dist/index.json';
const warningDelaySecs = 10;
const updatesNeeded = new Set();
const log = console /*OK*/.log;

// Color formatting libraries may not be available when this script is run.
function cyan(text) {
  return '\x1b[36m' + text + '\x1b[0m';
}
function green(text) {
  return '\x1b[32m' + text + '\x1b[0m';
}
function yellow(text) {
  return '\x1b[33m' + text + '\x1b[0m';
}

// Check the node version and print a warning if it is not the latest LTS.
function checkNodeVersion() {
  const nodeVersion = getStdout('node --version').trim();
  return new Promise((resolve) => {
    https
      .get(nodeDistributionsUrl, (res) => {
        res.setEncoding('utf8');
        let distributions = '';
        res.on('data', (data) => {
          distributions += data;
        });
        res.on('end', () => {
          const distributionsJson = JSON.parse(distributions);
          const latestLtsVersion = getNodeLatestLtsVersion(distributionsJson);
          if (latestLtsVersion === '') {
            log(
              yellow(
                'WARNING: Something went wrong. ' +
                  'Could not determine the latest LTS version of node.'
              )
            );
          } else if (nodeVersion !== latestLtsVersion) {
            log(
              yellow('WARNING: Detected node version'),
              cyan(nodeVersion) +
                yellow('. Recommended (latest LTS) version is'),
              cyan(latestLtsVersion) + yellow('.')
            );
            log(
              yellow('⤷ To fix this, run'),
              cyan('"nvm install --lts"'),
              yellow('or see'),
              cyan('https://nodejs.org/en/download/package-manager'),
              yellow('for instructions.')
            );
            updatesNeeded.add('node');
          } else {
            log(
              green('Detected'),
              cyan('node'),
              green('version'),
              cyan(nodeVersion + ' (latest LTS)') + green('.')
            );
          }
          resolve();
        });
      })
      .on('error', () => {
        log(
          yellow(
            'WARNING: Something went wrong. ' +
              'Could not download node version info from ' +
              cyan(nodeDistributionsUrl) +
              yellow('.')
          )
        );
        log(yellow('⤷ Detected node version'), cyan(nodeVersion) + yellow('.'));
        resolve();
      });
  });
}

function getNodeLatestLtsVersion(distributionsJson) {
  if (distributionsJson) {
    // Versions are in descending order, so the first match is the latest lts.
    return distributionsJson.find(function (distribution) {
      return (
        distribution.hasOwnProperty('version') &&
        distribution.hasOwnProperty('lts') &&
        distribution.lts
      );
    }).version;
  } else {
    return '';
  }
}

function main() {
  // The CI already uses Yarn and the latest Nodejs LTS.
  if (isCiBuild()) {
    return 0;
  }
  return checkNodeVersion().then(() => {
    if (updatesNeeded.size > 0) {
      log(
        yellow('\nWARNING: Detected problems with'),
        cyan(Array.from(updatesNeeded).join(', '))
      );
      log(
        yellow('⤷ Continuing install in'),
        cyan(warningDelaySecs),
        yellow('seconds...')
      );
      log(yellow('⤷ Press'), cyan('Ctrl + C'), yellow('to abort and fix...'));
      let resolver;
      const deferred = new Promise((resolverIn) => {
        resolver = resolverIn;
      });
      setTimeout(() => {
        log(yellow('\nAttempting to install packages...'));
        resolver();
      }, warningDelaySecs * 1000);
      return deferred;
    }
  });
}

main();
