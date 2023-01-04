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

/**
 * This file contains a set of variables that can be overriden by the compiler.
 */

/** @define {string} */
const FRONTEND = goog.define('FRONTEND', 'https://news.google.com');

/** @define {string} */
const PAY_ENVIRONMENT = goog.define('PAY_ENVIRONMENT', 'SANDBOX');

/** @define {string} */
const PLAY_ENVIRONMENT = goog.define('PLAY_ENVIRONMENT', 'STAGING');

/** @define {string} */
const FRONTEND_CACHE = goog.define('FRONTEND_CACHE', 'nocache');

/** @define {string} */
const INTERNAL_RUNTIME_VERSION = goog.define(
  'INTERNAL_RUNTIME_VERSION',
  '0.0.0'
);

/** @define {string} */
const ASSETS = goog.define('ASSETS', '/assets');

/** @define {string} */
const ADS_SERVER = goog.define(
  'ADS_SERVER',
  'https://pubads.g.doubleclick.net'
);

/** @define {string} */
const EXPERIMENTS = goog.define('EXPERIMENTS', '');

export {
  FRONTEND,
  PAY_ENVIRONMENT,
  PLAY_ENVIRONMENT,
  FRONTEND_CACHE,
  INTERNAL_RUNTIME_VERSION,
  ASSETS,
  ADS_SERVER,
  EXPERIMENTS,
};
