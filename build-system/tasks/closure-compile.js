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
const closureCompiler = require('google-closure-compiler');
const fs = require('fs-extra');
const gulp = require('gulp');
const internalRuntimeVersion = require('./internal-version').VERSION;
const nop = require('gulp-noop');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const resolveConfig = require('./compile-config').resolveConfig;
const sourcemaps = require('gulp-sourcemaps');

const isProdBuild = !!argv.type;
const queue = [];
let inProgress = 0;
const MAX_PARALLEL_CLOSURE_INVOCATIONS = 4;

const {isTravisBuild} = require('../travis');
const {red} = require('ansi-colors');

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
          if (isTravisBuild()) {
            // When printing simplified log in travis, use dot for each task.
            process.stdout.write('.');
          }
          inProgress--;
          next();
          resolve();
        },
        function (e) {
          console.error(e);
          console./*OK*/ error(red(e));
          process.exit(1);
        }
      );
    }
    function next() {
      if (!queue.length) {
        // When printing simplified log in travis, print EOF after
        // all closure compiling task are done.
        if (isTravisBuild()) {
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
    const intermediateFilename =
      'build/cc/' + entryModuleFilename.replace(/\//g, '_').replace(/^\./, '');
    // If undefined/null or false then we're ok executing the deletions
    // and mkdir.
    const unneededFiles = [];
    let wrapper = '(function(){%output%})();';
    if (options.wrapper) {
      wrapper = options.wrapper.replace('<%= contents %>', '%output%');
    }
    wrapper += '\n//# sourceMappingURL=' + outputFilename + '.map\n';
    if (fs.existsSync(intermediateFilename)) {
      fs.unlinkSync(intermediateFilename);
    }
    let sourceMapBase = 'http://localhost:8000/';
    if (isProdBuild || options.isProdBuild) {
      // Point sourcemap to fetch files from correct GitHub tag.
      sourceMapBase =
        'https://raw.githubusercontent.com/' +
        'subscriptions-project/swg-js/' +
        (argv.sourceBranch || internalRuntimeVersion) +
        '/';
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
      compilation_level: options.compilationLevel || 'SIMPLE_OPTIMIZATIONS',
      // Turns on more optimizations.
      assume_function_wrapper: true,
      // Transpile from ES6 to ES5.
      language_in: 'ECMASCRIPT6',
      language_out: 'ECMASCRIPT5',
      // We do not use the polyfills provided by closure compiler.
      // If you need a polyfill. Manually include them in the
      // respective top level polyfills.js files.
      rewrite_polyfills: false,
      externs,
      js_module_root: ['node_modules/', 'build/fake-module/'],
      entry_point: entryModuleFilenames,
      process_common_js_modules: true,
      // This strips all files from the input set that aren't explicitly
      // required.
      only_closure_dependencies: true,
      output_wrapper: wrapper,
      create_source_map: intermediateFilename + '.map',
      source_map_location_mapping: '|' + sourceMapBase,
      warning_level: 'DEFAULT',
      // Turn off warning for "Unknown @define" since we use define to pass
      // args such as FORTESTING to our runner.
      jscomp_off: ['unknownDefines'],
      define: [],
      hide_warnings_for: [
        'src/polyfills/*',
        'src/proto/*',
        'src/components/*',
        'node_modules/',
        'third_party/',
      ],
      jscomp_error: [],
    };

    // For now do type check separately
    if (checkTypes) {
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

      compilerOptions.new_type_inf = true;
      compilerOptions.jscomp_off.push('newCheckTypesExtraChecks');
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

    const pluginOptions = {
      platform: ['java'], // Override the JAR used by closure compiler
      extraArguments: ['-XX:+TieredCompilation'], // Significant speed up!
    };    
    closureCompiler.compiler.JAR_PATH =
        require.resolve('../runner/dist/runner.jar');

    let stream = gulp
        .src(srcs)
        .pipe(closureCompiler.gulp()(compilerOptions, pluginOptions))
        .on('error', function (err) {
          console./*OK*/ error(red('Error compiling', entryModuleFilenames));
          console./*OK*/ error(red(err.message));
          process.exit(1);
        });
    

    if (!checkTypes) {
      stream = stream.pipe(rename(outputFilename));

     // Replacements.
     const replacements = resolveConfig();
     for (const k in replacements) {
       stream = stream.pipe(
         replace(new RegExp('\\$' + k + '\\$', 'g'), replacements[k])
       );
      }      

      // Complete build: dist and source maps.
      stream = stream.pipe(gulp.dest(outputDir)).on('end', function () {
        gulp
          .src(intermediateFilename + '.map')
          .pipe(rename(outputFilename + '.map'))
          .pipe(gulp.dest(outputDir))    
          .on('end', resolve);     
      });    
    }
    return stream;
  });
}
