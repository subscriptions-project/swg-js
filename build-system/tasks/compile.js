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
const babel = require('babelify');
const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const closureCompile = require('./closure-compile').closureCompile;
const fs = require('fs-extra');
const glob = require('glob');
const gulp = $$.help(require('gulp'));
const jsifyCssAsync = require('./jsify-css').jsifyCssAsync;
const lazypipe = require('lazypipe');
const minimatch = require('minimatch');
const minimist = require('minimist');
const pathLib = require('path');
const resolveConfig = require('./compile-config').resolveConfig;
const source = require('vinyl-source-stream');
const touch = require('touch');
const watchify = require('watchify');
const internalRuntimeVersion = require('./internal-version').VERSION;
const argv = require('minimist')(process.argv.slice(2));

/**
 * @return {!Promise}
 */
exports.compile = function(opt_opts) {
  const opts = opt_opts || {};
  mkdirSync('build');
  mkdirSync('build/cc');
  mkdirSync('build/fake-module');
  mkdirSync('build/fake-module/src');
  mkdirSync('build/css');

  // Compile CSS because we need the css files in compileJs step.
  return compileCss('./src/', './build/css', Object.assign({}, opts || {}))
      .then(() => {
        // For compilation with babel we start with the main-babel entry point,
        // but then rename to the subscriptions.js which we've been using all along.
        return Promise.all([
          compileJs('./src/', 'main', './dist',
              Object.assign({
                toName: 'subscriptions.max.js',
                minifiedName: opts.checkTypes ?
                    'subscriptions.checktypes.js' :
                    (argv.minifiedName || 'subscriptions.js'),
                includePolyfills: true,
                // If there is a sync JS error during initial load,
                // at least try to unhide the body.
                wrapper: '(function(){<%= contents %>})();',
              }, opts)),
        ]);
      });
};


/**
 * @return {!Promise}
 */
exports.checkTypes = function(opts) {
  return exports.compile(Object.assign(opts || {}, {
    toName: 'check-types.max.js',
    minifiedName: 'check-types.js',
    minify: true,
    checkTypes: true,
    includePolyfills: true,
  }));
};


/**
 * Compile a javascript file
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
        srcDir + srcFilename + '.js', destDir, options.minifiedName, options)
        .then(function() {
          fs.writeFileSync(destDir + '/version.txt', internalRuntimeVersion);
          if (options.latestName) {
            fs.copySync(
                destDir + '/' + options.minifiedName,
                destDir + '/' + options.latestName);
          }
        })
        .then(() => {
          endBuildStep('Minified', srcFilename + '.js', startTime);
        });
  }

  let bundler = browserify(srcDir + srcFilename + '-babel.js', {debug: true})
      .transform(babel, {loose: true});
  if (options.watch) {
    bundler = watchify(bundler);
  }

  const wrapper = options.wrapper || '<%= contents %>';

  let lazybuild = lazypipe()
      .pipe(source, srcFilename + '-babel.js')
      .pipe(buffer);

  // Replacements.
  const replacements = resolveConfig();
  for (const k in replacements) {
    lazybuild = lazybuild.pipe(
        $$.replace,
        new RegExp('\\$' + k + '\\$', 'g'),
        replacements[k]);
  }

  // Complete build with wrapper and sourcemaps.
  lazybuild = lazybuild
      .pipe($$.wrap, wrapper)
      .pipe($$.sourcemaps.init.bind($$.sourcemaps), {loadMaps: true});

  const lazywrite = lazypipe()
      .pipe($$.sourcemaps.write.bind($$.sourcemaps), './')
      .pipe(gulp.dest.bind(gulp), destDir);

  const destFilename = options.toName || srcFilename + '.js';
  function rebundle() {
    const startTime = Date.now();
    return toPromise(bundler.bundle()
        .on('error', function(err) {
          if (err instanceof SyntaxError) {
            console.error($$.util.colors.red('Syntax error:', err.message));
          } else {
            console.error($$.util.colors.red(err.message));
          }
        })
        .pipe(lazybuild())
        .pipe($$.rename(destFilename))
        .pipe(lazywrite())
        .on('end', function() {
        })).then(() => {
          endBuildStep('Compiled', srcFilename, startTime);
        });
  }

  if (options.watch) {
    bundler.on('update', function() {
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


/**
 * Compile all the css and drop in the build folder.
 *
 * @param {string} srcDir Path to the src directory.
 * @param {string} outputDir Destination folder for output files.
 * @param {?Object} options
 * @return {!Promise}
 */
function compileCss(srcDir, outputDir, options) {
  options = options || {};

  if (options.watch) {
    $$.watch(srcDir + '**/*.css', function() {
      compileCss(srcDir, outputDir,
          Object.assign({}, options, {watch: false}));
    });
  }

  const startTime = Date.now();
  return new Promise(resolve => {
    glob('**/*.css', {cwd: srcDir}, function(er, files) {
      resolve(files);
    });
  }).then(files => {
    const promises = files.map(file => {
      const srcFile = srcDir + file;
      return jsifyCssAsync(srcFile).then(css => {
        const targetFile = outputDir + '/' + file + '.js';
        mkdirSync(pathLib.dirname(targetFile));
        fs.writeFileSync(targetFile,
            'export const CSS = ' + JSON.stringify(css) + ';');
      });
    });
    return Promise.all(promises);
  }).then(() => {
    endBuildStep('Recompiled CSS', '', startTime);
  });
}


function toPromise(readable) {
  return new Promise(function(resolve, reject) {
    readable.on('error', reject).on('end', resolve);
  });
}


/**
 * Stops the timer for the given build step and prints the execution time,
 * unless we are on Travis.
 * @param {string} stepName Name of the action, like 'Compiled' or 'Minified'
 * @param {string} targetName Name of the target, like a filename or path
 * @param {DOMHighResTimeStamp} startTime Start time of build step
 */
function endBuildStep(stepName, targetName, startTime) {
  const endTime = Date.now();
  const executionTime = new Date(endTime - startTime);
  const secs = executionTime.getSeconds();
  const ms = executionTime.getMilliseconds().toString();
  let timeString = '(';
  if (secs === 0) {
    timeString += ms + ' ms)';
  } else {
    timeString += secs + '.' + ms + ' s)';
  }
  if (!process.env.TRAVIS) {
    $$.util.log(
        stepName,
        $$.util.colors.cyan(targetName),
        $$.util.colors.green(timeString));
  }
}


function mkdirSync(path) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }
}
