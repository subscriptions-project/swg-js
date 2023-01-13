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
const log = require('fancy-log');
const nodemon = require('nodemon');

const host = args.host || 'localhost';
const port = args.port || process.env.PORT || 8000;
const useHttps = args.https != undefined;
const quiet = args.quiet != undefined;
const publicationId = args.publicationId || 'scenic-2017.appspot.com';
const useStorybook = args.storybook === true;

const {green} = require('ansi-colors');

/**
 * Starts a simple http server at the repository root
 */
function serve(done) {
  if (useStorybook) {
    // Load this on-demand to support optional dependencies.
    const storybook = require('@storybook/html/standalone');
    storybook({
      port,
      mode: 'dev',
      configDir: './.storybook',
    });
  } else {
    startServer();
  }
  done();
}

function startServer({jsTarget} = {}) {
  return nodemon({
    script: require.resolve('../server/server.js'),
    watch: [require.resolve('../server/server.js')],
    env: {
      'NODE_ENV': 'development',
      'SERVE_PORT': port,
      'SERVE_HOST': host,
      'SERVE_USEHTTPS': useHttps,
      'SERVE_PROCESS_ID': process.pid,
      'SERVE_QUIET': quiet,
      'SERVE_PUBID': publicationId,
      'SERVE_JS_TARGET': jsTarget,
    },
  }).once('quit', stopServer);
}

/**
 * Stops the currently running server
 */
function stopServer() {
  log(green('Shutting down server'));
  process.exit();
}

module.exports = {
  serve,
  startServer,
  stopServer,
};
serve.description = 'Serves content in root dir over ' + getHost() + '/';
serve.flags = {
  'host': '  Hostname or IP address to bind to (default: localhost)',
  'port': '  Specifies alternative port (default: 8000)',
  'https': '  Use HTTPS server (default: false)',
  'quiet': '  Do not log HTTP requests (default: false)',
  'publicationId': '  Sample publicationId',
  'storybook': 'Run storybook instead of demo apps',
};

function getHost() {
  return (useHttps ? 'https' : 'http') + '://' + host + ':' + port;
}
