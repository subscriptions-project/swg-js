import {defineConfig} from 'vite';
import {resolveConfig} from './build-system/tasks/compile-config';
import replace from '@rollup/plugin-replace';

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
      plugins: [
        replace({
          delimiters: ['\\$', '\\$'],
          values: resolveConfig(),
        }),
      ],
    },
  },
});
