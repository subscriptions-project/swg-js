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

const args = require('./args');
const internalRuntimeVersion = require('./internal-version').VERSION;

const ASSETS = '/assets';
const FRONTEND = 'https://news.google.com';
const FRONTEND_CACHE = 'nocache';
const PAY_ENVIRONMENT = 'SANDBOX';
const PLAY_ENVIRONMENT = 'STAGING';
const ADS_SERVER = 'https://pubads.g.doubleclick.net';
const EXPERIMENTS = '';
const {cyan, green} = require('ansi-colors');

const overrides = {};

/**
 * @return {!Object<string, string>}
 */
exports.resolveConfig = () => {
  const swgServerOrigin = args.frontend || FRONTEND;

  console.log(green('Configuration'));
  console.log(green('  --frontend ') + cyan(swgServerOrigin));

  const config = {
    'FRONTEND': swgServerOrigin,
    'INTERNAL_RUNTIME_VERSION': internalRuntimeVersion,
    'FRONTEND_CACHE': args.frontendCache || FRONTEND_CACHE,
    'ASSETS': args.assets || ASSETS,
    'PAY_ENVIRONMENT': args.payEnvironment || PAY_ENVIRONMENT,
    'PLAY_ENVIRONMENT': args.playEnvironment || PLAY_ENVIRONMENT,
    'EXPERIMENTS': args.experiments || EXPERIMENTS,
    'ADS_SERVER': args.adsServer || ADS_SERVER,
  };
  return Object.assign(config, overrides);
};

/**
 * @param {!Object<string, string>} config
 */
exports.overrideConfig = (config) => {
  for (const k in config) {
    overrides[k] = config[k];
  }
};
