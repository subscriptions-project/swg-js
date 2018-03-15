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
const gulp = require('gulp-help')(require('gulp'));
const util = require('gulp-util');
const nodemon = require('nodemon');

const host = argv.host || 'localhost';
const port = argv.port || process.env.PORT || 8000;
const useHttps = argv.https != undefined;
const quiet = argv.quiet != undefined;
const publicationId = argv.publicationId || 'com.appspot.scenic-2017-test';
const ampLocal = argv.ampLocal != undefined;

/**
 * Starts a simple http server at the repository root
 */
function serve() {
  util.log(util.colors.green('Serving unminified js'));

  nodemon({
    script: require.resolve('../server/server.js'),
    watch: [
      require.resolve('../server/server.js'),
    ],
    env: {
      'NODE_ENV': 'development',
      'SERVE_PORT': port,
      'SERVE_HOST': host,
      'SERVE_USEHTTPS': useHttps,
      'SERVE_PROCESS_ID': process.pid,
      'SERVE_QUIET': quiet,
      'SERVE_PUBID': publicationId,
      'SERVE_AMP_LOCAL': ampLocal,
    },
  })
      .once('quit', function() {
        util.log(util.colors.green('Shutting down server'));
      });
  if (!quiet) {
    util.log(util.colors.yellow('Run `gulp build` then go to '
        + getHost() + '/examples/article.html'
    ));
  }
}

process.on('SIGINT', function() {
  process.exit();
});

gulp.task(
    'serve',
    'Serves content in root dir over ' + getHost() + '/',
    serve,
    {
      options: {
        'host': '  Hostname or IP address to bind to (default: localhost)',
        'port': '  Specifies alternative port (default: 8000)',
        'https': '  Use HTTPS server (default: false)',
        'quiet': '  Do not log HTTP requests (default: false)',
        'publicationId': '  Sample publicationId',
        'ampLocal': '  Run against local AMP installation',
      },
    }
);

function getHost() {
  return (useHttps ? 'https' : 'http') + '://' + host + ':' + port;
}
