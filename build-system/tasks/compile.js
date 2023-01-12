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

const $$ = require('gulp-load-plugins')();
const argv = require('minimist')(process.argv.slice(2));
const babelify = require('babelify');
const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const closureCompile = require('./closure-compile').closureCompile;
const fs = require('fs-extra');
const gulp = $$.help(require('gulp'));
const internalRuntimeVersion = require('./internal-version').VERSION;
const lazypipe = require('lazypipe');
const resolveConfig = require('./compile-config').resolveConfig;
const source = require('vinyl-source-stream');
const touch = require('touch');
const watchify = require('watchify');
const {endBuildStep, mkdirSync} = require('./helpers');
const {red} = require('ansi-colors');

/**
 * @return {!Promise}
 */
exports.compile = async (options = {}) => {
  mkdirSync('build');
  mkdirSync('build/cc');
  mkdirSync('build/fake-module');
  mkdirSync('build/fake-module/src');
  mkdirSync('build/css');

  // For compilation with babel we start with the main-babel entry point,
  // but then rename to the subscriptions.js which we've been using all along.
  await Promise.all([
    compileJs(
      './src/',
      'main',
      './dist',
      Object.assign(
        {
          toName: 'subscriptions.max.js',
          minifiedName: options.checkTypes
            ? 'subscriptions.checktypes.js'
            : argv.minifiedName || 'subscriptions.js',
          // If there is a sync JS error during initial load,
          // at least try to unhide the body.
          wrapper: '(function(){<%= contents %>})();',
        },
        options
      )
    ),
    compileJs(
      './src/',
      'gaa-main',
      './dist',
      Object.assign(
        {
          toName: 'subscriptions-gaa.max.js',
          minifiedName: options.checkTypes
            ? 'subscriptions-gaa.checktypes.js'
            : argv.minifiedGaaName || 'subscriptions-gaa.js',
          // If there is a sync JS error during initial load,
          // at least try to unhide the body.
          wrapper: '(function(){<%= contents %>})();',
        },
        options
      )
    ),
    compileJs(
      './src/',
      'basic-main',
      './dist',
      Object.assign(
        {
          toName: 'basic-subscriptions.max.js',
          minifiedName: options.checkTypes
            ? 'basic-subscriptions.checktypes.js'
            : argv.minifiedBasicName || 'basic-subscriptions.js',
          // If there is a sync JS error during initial load,
          // at least try to unhide the body.
          wrapper: '(function(){<%= contents %>})();',
        },
        options
      )
    ),
  ]);
};

/**
 * @return {!Promise}
 */
exports.checkTypes = (opts) =>
  exports.compile(
    Object.assign(opts || {}, {
      toName: 'check-types.max.js',
      minifiedName: 'check-types.js',
      minify: true,
      checkTypes: true,
    })
  );

/**
 * Bundles (max) or compiles (min) a javascript file.
 *
 * @param {string} srcDir Path to the src directory
 * @param {string} srcFilename Name of the JS source file
 * @param {string} destDir Destination folder for output script
 * @param {?Object} options
 * @return {!Promise}
 */
function compileJs(srcDir, srcFilename, destDir, options) {
  options = options || {};

  if (options.minify) {
    const startTime = Date.now();
    return closureCompile(
      srcDir + srcFilename + '.js',
      destDir,
      options.minifiedName,
      options
    )
      .then(() => {
        fs.writeFileSync(destDir + '/version.txt', internalRuntimeVersion);
        if (options.latestName) {
          fs.copySync(
            destDir + '/' + options.minifiedName,
            destDir + '/' + options.latestName
          );
        }
      })
      .then(() => {
        endBuildStep('Minified', srcFilename + '.js', startTime);
      });
  }

  let bundler = browserify(srcDir + srcFilename + '.js', {
    debug: true,
  }).transform(
    babelify.configure({
      'presets': [
        [
          '@babel/preset-env',
          {
            'targets': {
              'browsers': ['defaults, not IE 11'],
            },
          },
        ],
      ],
      'plugins': [
        [
          './build-system/transform-define-constants',
          {
            'replacements': resolveConfig(),
          },
        ],
      ],
    })
  );
  if (options.watch) {
    bundler = watchify(bundler);
  }

  const wrapper = options.wrapper || '<%= contents %>';

  let lazybuild = lazypipe()
    .pipe(source, srcFilename + '.js')
    .pipe(buffer);

  // Complete build with wrapper and sourcemaps.
  lazybuild = lazybuild
    .pipe($$.wrap, wrapper)
    .pipe($$.sourcemaps.init.bind($$.sourcemaps), {loadMaps: true});

  const lazywrite = lazypipe()
    .pipe($$.sourcemaps.write.bind($$.sourcemaps), './')
    .pipe(gulp.dest.bind(gulp), destDir);

  const destFilename = options.toName || srcFilename + '.js';
  async function rebundle() {
    const startTime = Date.now();
    await toPromise(
      bundler
        .bundle()
        .on('error', (err) => {
          console.error(red(err));
        })
        .pipe(lazybuild())
        .pipe($$.rename(destFilename))
        .pipe(lazywrite())
    );

    endBuildStep('Compiled', srcFilename, startTime);
  }

  if (options.watch) {
    bundler.on('update', () => {
      rebundle();
      // Touch file in unit test set. This triggers rebundling of tests because
      // karma only considers changes to tests files themselves re-bundle
      // worthy.
      touch('test/_init_tests.js');
    });
  }

  if (options.watch === false) {
    // Due to the two step build process, compileJs() is called twice, once with
    // options.watch set to true and, once with it set to false. However, we do
    // not need to call rebundle() twice. This avoids the duplicate compile seen
    // when you run `gulp watch` and touch a file.
    return Promise.resolve();
  } else {
    // This is the default options.watch === true case, and also covers the
    // `gulp build` / `gulp dist` cases where options.watch is undefined.
    return rebundle();
  }
}

function toPromise(readable) {
  return new Promise((resolve, reject) => {
    readable.on('error', reject).on('end', resolve);
  });
}
