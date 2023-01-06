module.exports = {
  'stories': [
    '../src/**/*.stories.mdx',
    '../src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  'addons': ['@storybook/addon-links', '@storybook/addon-essentials'],
  'framework': '@storybook/html',
  'staticDirs': [
    // HTML
    '../src/stories/static',
    // CSS
    '../assets',
    // JS files
    '../dist',
  ],
  'babel': {
    'plugins': ['./build-system/transform-define-constants'],
  },
  core: {
    builder: 'webpack5',
  },
};
