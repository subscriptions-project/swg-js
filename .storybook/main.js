module.exports = {
  'stories': [
    '../src/**/*.stories.mdx',
    '../src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  'addons': ['@storybook/addon-links', '@storybook/addon-essentials'],
  'framework': '@storybook/html',
  'staticDirs': ['../src/stories/static', '../assets'],
};
