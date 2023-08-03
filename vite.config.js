/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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

import {defineConfig} from 'vite';
import {readFileSync, readdirSync, writeFileSync} from 'fs';
import {visualizer} from 'rollup-plugin-visualizer';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

import {resolveConfig} from './build-system/tasks/compile-config';
const args = require('./build-system/tasks/args');

// Choose plugins.
const config = resolveConfig();
const replacementValues = Object.entries(config).reduce((obj, [key, value]) => {
  obj[key] = `const ${key} = '${value}' ??`;
  return obj;
}, {});
const plugins = [
  commonjs({
    transformMixedEsModules: true,
  }),
  replace({
    delimiters: ['const ', ' = '],
    include: ['./src/constants.ts'],
    preventAssignment: false,
    values: replacementValues,
  }),
  // Wrap generated code in outer function to avoid leaking into global scope.
  // b/293444391.
  {
    name: 'add-outer-iife',
    apply: 'build',
    generateBundle(options, bundle) {
      const chunks = Object.values(bundle).filter(
        (entry) => entry.type === 'chunk' && entry.code
      );
      for (const chunk of chunks) {
        chunk.code = `(() => { ${chunk.code} })();`;
      }
    },
  },
  // Point sourcemaps to a Swgjs release on GitHub.
  {
    name: 'fix-sourcemaps',
    apply: 'build',
    writeBundle(outputConfig) {
      const outputDir = outputConfig.dir || '';

      const filenames = readdirSync(outputDir).filter((filename) =>
        filename.endsWith('.map')
      );
      for (const filename of filenames) {
        // Load sourcemap.
        const path = outputDir + '/' + filename;
        const sourcemap = JSON.parse(
          readFileSync(outputDir + '/' + filename).toString()
        );

        // Point to a Swgjs release on GitHub.
        sourcemap.sourceRoot = `https://raw.githubusercontent.com/subscriptions-project/swg-js/${config.INTERNAL_RUNTIME_VERSION}/`;

        // Fix relative paths.
        sourcemap.sources = sourcemap.sources.map((source) =>
          source.replace(/^\.\.\/src\//, 'src/')
        );

        // Save changes.
        writeFileSync(path, JSON.stringify(sourcemap) + '\n');
      }
    },
  },
];
if (args.visualize) {
  // Visualize bundle to see which modules are taking up space.
  plugins.push(
    visualizer({
      filename: './build/rollup-visualization.html',
    })
  );
}

const builds = {
  basic: {
    output: args.minifiedBasicName || 'basic-subscriptions.js',
    input: './src/basic-main.ts',
  },
  classic: {
    output: args.minifiedName || 'subscriptions.js',
    input: './src/main.ts',
  },
  gaa: {
    output: args.minifiedGaaName || 'subscriptions-gaa.js',
    input: './src/gaa-main.ts',
  },
};

const {input, output} = builds[args.target || 'classic'];

export default defineConfig({
  plugins,

  build: {
    emptyOutDir: false,
    commonjsOptions: {
      sourceMap: true,
    },
    target: 'ios12',

    minify: 'terser',
    terserOptions: {
      // eslint-disable-next-line google-camelcase/google-camelcase
      mangle: {properties: {keep_quoted: true, regex: '_$'}},

      // Disables converting computed properties ({['hello']: 5}) into regular prop ({ hello: 5}).
      // This was an assumption baked into closure.
      compress: {
        // eslint-disable-next-line google-camelcase/google-camelcase
        computed_props: false,

        // Settled on this count by incrementing number until there was no more
        // effect on minification quality.
        passes: 3,
      },
    },

    rollupOptions: {
      input,
      output: [
        {
          format: 'iife',
          entryFileNames: output,
          sourcemap: true,
        },
      ],
    },
  },
});
