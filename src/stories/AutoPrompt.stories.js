import {STORY_CHANGED} from '@storybook/core-events';
import {addons} from '@storybook/addons';

import '../basic-main';

export default {
  title: 'User Journeys/Auto Prompt',
  argTypes: {
    'Theme': {
      control: 'select',
      options: ['dark', 'light'],
    },
    'AutoPromptType': {
      control: 'select',
      options: ['contribution', 'subscription'],
    },
  },
  decorators: [
    (component) => {
      // Reload window when changing stories.
      addons.getChannel().addListener(STORY_CHANGED, () => {
        self.window.location.reload();
      });

      return component();
    },
  ],
};

const Template = (args) => {
  const el = self.document.createElement('script');
  el.innerHTML = `
        (self.SWG_BASIC = self.SWG_BASIC || []).push(basicSubscriptions => {
            basicSubscriptions.init({
              type: "NewsArticle",
              isAccessibleForFree: ${args.IsAccessibleForFree},
              isPartOfType: ["Product"],
              isPartOfProductId: "${args.PublicationId}:${args.ProductId}",
              autoPromptType: "${args.AutoPromptType}",
              clientOptions: { theme: "${args.Theme}", lang: "${args.Language}" },
            });
          });
      `;
  return el;
};

export const Contribution = Template.bind({});
Contribution.args = {
  Language: 'en',
  PublicationId: 'CAowz7enCw',
  ProductId: 'cool',
  AutoPromptType: 'contribution',
  Theme: 'dark',
  IsAccessibleForFree: false,
};

export const Subscription = Template.bind({});
Subscription.args = {
  ...Contribution.args,
  PublicationId: 'CAow6YGuCw',
  AutoPromptType: 'subscription',
};
