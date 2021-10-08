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
const closureCompiler = require('@ampproject/google-closure-compiler');
const fs = require('fs-extra');
const gulp = require('gulp');
const path = require('path');
const pumpify = require('pumpify');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const resolveConfig = require('./compile-config').resolveConfig;
const sourcemaps = require('gulp-sourcemaps');
const {isCiBuild} = require('../ci');
const {red} = require('ansi-colors');
const {VERSION: internalRuntimeVersion} = require('./internal-version');
const through = require('through2');
const os = require('os');

const queue = [];
let inProgress = 0;
const MAX_PARALLEL_CLOSURE_INVOCATIONS = 4;

// Compiles code with the closure compiler. This is intended only for
// production use. During development we intent to continue using
// babel, as it has much faster incremental compilation.
exports.closureCompile = function (
  entryModuleFilename,
  outputDir,
  outputFilename,
  options
) {
  // Rate limit closure compilation to MAX_PARALLEL_CLOSURE_INVOCATIONS
  // concurrent processes.
  return new Promise(function (resolve) {
    function start() {
      inProgress++;
      compile(entryModuleFilename, outputDir, outputFilename, options).then(
        function () {
          if (isCiBuild()) {
            // When printing simplified log in CI, use dot for each task.
            process.stdout.write('.');
          }
          inProgress--;
          next();
          resolve();
        },
        function (e) {
          console./*OK*/ error(red('Compilation error', e.message));
          process.exit(1);
        }
      );
    }
    function next() {
      if (!queue.length) {
        // When printing simplified log in CI, print EOF after
        // all closure compiling task are done.
        if (isCiBuild()) {
          process.stdout.write('\n');
        }
        return;
      }
      if (inProgress < MAX_PARALLEL_CLOSURE_INVOCATIONS) {
        queue.shift()();
      }
    }
    queue.push(start);
    next();
  });
};

function compile(entryModuleFilenames, outputDir, outputFilename, options) {
  return new Promise((resolve) => {
    let entryModuleFilename;
    if (entryModuleFilenames instanceof Array) {
      entryModuleFilename = entryModuleFilenames[0];
    } else {
      entryModuleFilename = entryModuleFilenames;
      entryModuleFilenames = [entryModuleFilename];
    }
    const checkTypes = options.checkTypes || argv.typecheck_only;
    const intermediateFilename = entryModuleFilename
      .replace(/\//g, '_')
      .replace(/^\./, '');
    // If undefined/null or false then we're ok executing the deletions
    // and mkdir.
    const unneededFiles = [];
    if (fs.existsSync(intermediateFilename)) {
      fs.unlinkSync(intermediateFilename);
    }
    const srcs = [
      // Files under build/. Should be sparse.
      'build/css/**/*.css.js',
      'src/*.js',
      'src/**/*.js',
      '!src/*-babel.js',
      'third_party/gpay/**/*.js',
      'node_modules/promise-pjs/promise.js',
      'node_modules/web-activities/activity-ports.js',
      //'node_modules/core-js/modules/**.js',
      // Not sure what these files are, but they seem to duplicate code
      // one level below and confuse the compiler.
      '!node_modules/core-js/modules/library/**.js',
      // Don't include tests.
      '!**-test.js',
      '!**_test.js',
      '!**/test-*.js',
      '!**/*-test.js',
      '!**/*.extern.js',
    ];
    if (options.extraGlobs) {
      srcs.push.apply(srcs, options.extraGlobs);
    }
    // Many files include the polyfills, but we only want to deliver them
    // once. Since all files automatically wait for the main binary to load
    // this works fine.
    if (options.includePolyfills) {
      srcs.push(
        '!build/fake-module/src/polyfills.js',
        '!build/fake-module/src/polyfills/**/*.js'
      );
    } else {
      srcs.push('!src/polyfills.js');
      unneededFiles.push('build/fake-module/src/polyfills.js');
    }
    unneededFiles.forEach(function (fake) {
      if (!fs.existsSync(fake)) {
        fs.writeFileSync(
          fake,
          '// Not needed in closure compiler\n' +
            'export function deadCode() {}'
        );
      }
    });

    let externs = ['build-system/extern.js'];
    if (options.externs) {
      externs = externs.concat(options.externs);
    }

    /*eslint "google-camelcase/google-camelcase": 0*/
    const compilerOptions = {
      compilation_level: options.compilationLevel || 'SIMPLE',
      // Turns on more optimizations.
      assume_function_wrapper: true,
      // Transpile from modern JavaScript to ES5.
      language_in: 'ECMASCRIPT_2020',
      language_out: 'ECMASCRIPT5',
      // We do not use the polyfills provided by closure compiler.
      // If you need a polyfill. Manually include them in the
      // respective top level polyfills.js files.
      rewrite_polyfills: false,
      externs,
      js_module_root: ['build/fake-module/'],
      entry_point: entryModuleFilenames,
      module_resolution: 'NODE',
      package_json_entry_names: 'module,main',
      process_common_js_modules: true,
      // This strips all files from the input set that aren't explicitly
      // required.
      dependency_mode: 'PRUNE',
      isolation_mode: 'IIFE',
      warning_level: 'DEFAULT',
      // Turn off warning for "Unknown @define" since we use define to pass
      // args such as FORTESTING to our runner.
      // Turn off warning for "Partial alias" since it's unavoidable with
      // certain dependencies.
      jscomp_off: ['unknownDefines', 'partialAlias'],
      define: [],
      hide_warnings_for: [
        'src/polyfills/',
        'src/proto/',
        'node_modules/',
        'third_party/',
      ],
      jscomp_error: [],
    };

    // Apply AMP's optimizations, reducing binary size by roughly 25%.
    // https://github.com/ampproject/amp-closure-compiler/blob/a2c1262c6bb2acfafb5f6672283bbac5623e4a1d/src/org/ampproject/AmpCodingConvention.java#L71
    compilerOptions.define.push('AMP_MODE=true');

    // For now do type check separately
    if (argv.typecheck_only || checkTypes) {
      // Don't modify compilation_level to a lower level since
      // it won't do strict type checking if its whitespace only.
      compilerOptions.define.push('TYPECHECK_ONLY=true');
      compilerOptions.jscomp_error.push(
        'checkTypes',
        'accessControls',
        'const',
        'constantProperty',
        'globalThis'
      );
      compilerOptions.conformance_configs =
        'build-system/conformance-config.textproto';
    }
    if (argv.pseudoNames) {
      compilerOptions.define.push('PSEUDO_NAMES=true');
    }
    if (argv.fortesting) {
      compilerOptions.define.push('FORTESTING=true');
    }

    if (compilerOptions.define.length == 0) {
      delete compilerOptions.define;
    }

    let stream = gulp
      .src(srcs, {base: './'})
      .pipe(sourcemaps.init())
      .pipe(makeSourcemapsRelative(closureCompiler.gulp()(compilerOptions)))
      .pipe(rename(intermediateFilename))
      .pipe(gulp.dest('build/cc/'))
      .on('error', function (err) {
        console./*OK*/ error(red('Error compiling', entryModuleFilenames));
        console./*OK*/ error(red(err.message));
        process.exit(1);
      });

    // If we're only doing type checking, no need to output the files.
    if (!argv.typecheck_only) {
      stream = stream.pipe(rename(outputFilename)).pipe(
        sourcemaps.write('.', {
          sourceRoot: `https://raw.githubusercontent.com/subscriptions-project/swg-js/${internalRuntimeVersion}/`,
          includeContent: false,
        })
      );

      // Replacements.
      const replacements = resolveConfig();
      for (const k in replacements) {
        stream = stream.pipe(
          replace(new RegExp('\\$' + k + '\\$', 'g'), replacements[k])
        );
      }

      // Appends a newline terminator to .map files
      stream = stream.pipe(through.obj((file, _, cb) => {
        if(file.sourceMap && file.path.endsWith('.map')) {
          file.contents = Buffer.concat([
            file.contents,
            Buffer.from(os.EOL)
          ]);
        }
        
        cb(null, file);
      }));

      // Complete build: dist and source maps.
      stream = stream.pipe(gulp.dest(outputDir)).on('end', resolve);
    }
    return stream;
  });
}

/**
 * Normalize the sourcemap file paths before pushing into Closure.
 * Closure don't follow Gulp's normal sourcemap "root" pattern. Gulp considers
 * all files to be relative to the CWD by default, meaning a file `src/foo.js`
 * with a sourcemap alongside points to `src/foo.js`. Closure considers each
 * file relative to the sourcemap. Since the sourcemap for `src/foo.js` "lives"
 * in `src/`, it ends up resolving to `src/src/foo.js`.
 *
 * @param {!NodeJS.WritableStream} closureStream
 * @return {!NodeJS.WritableStream}
 */
function makeSourcemapsRelative(closureStream) {
  const relativeSourceMap = sourcemaps.mapSources((source, file) => {
    const dir = path.dirname(file.sourceMap.file);
    return path.relative(dir, source);
  });

  return pumpify.obj(relativeSourceMap, closureStream);
}
