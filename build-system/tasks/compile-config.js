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

const argv = require('minimist')(process.argv.slice(2));
const internalRuntimeVersion = require('./internal-version').VERSION;

const FRONTEND = 'https://subscribe-autopush.sandbox.google.com';
const FRONTEND_CACHE = 'nocache';
const PAY_ENVIRONMENT = 'SANDBOX';
const PLAY_ENVIRONMENT = 'STAGING';


/**
 * @return {!Object<string, string>}
 */
exports.resolveConfig = function() {
  return {
    'internalRuntimeVersion': internalRuntimeVersion,
    'frontend': argv.frontend || FRONTEND,
    'frontendCache': argv.frontendCache || FRONTEND_CACHE,
    'payEnvironment': argv.payEnvironment || PAY_ENVIRONMENT,
    'playEnvironment': argv.playEnvironment || PLAY_ENVIRONMENT,
  };
}
