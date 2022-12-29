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
import {resolveConfig} from './build-system/tasks/compile-config';
import replace from '@rollup/plugin-replace';
import {visualizer} from 'rollup-plugin-visualizer';

// Choose Rollup plugins.
const replacementValues = Object.entries(resolveConfig()).reduce(
  (obj, [key, value]) => {
    obj[key] = `export const ${key} = '${value}'; //`;
    return obj;
  },
  {}
);
const rollupPlugins = [
  replace({
    delimiters: ['export const ', ' = '],
    include: ['./src/constants.js'],
    preventAssignment: false,
    values: replacementValues,
  }),
];
if (process.argv.includes('--visualize')) {
  // Visualize bundle to see which modules are taking up space.
  rollupPlugins.push(
    visualizer({
      filename: './build/rollup-visualization.html',
    })
  );
}

const builds = {
  basic: {output: 'basic-subscriptions.js', input: './src/basic-main.js'},
  classic: {output: 'subscriptions.js', input: './src/main.js'},
  gaa: {output: 'subscriptions-gaa.js', input: './src/gaa-main.js'},
};

const {input, output} = builds[process.env.TARGET || 'classic'];

export default defineConfig({
  build: {
    emptyOutDir: false,
    commonjsOptions: {
      sourceMap: true,
    },

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
        },
      ],
      plugins: rollupPlugins,
    },
  },
});
