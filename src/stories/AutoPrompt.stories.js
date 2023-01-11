import {STORY_CHANGED} from '@storybook/core-events';
import {addons} from '@storybook/addons';

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
      // Reload window when directing outside of this page.
      setupEventListener();
      // Since our snippet modifies parts of the page outside of the actual snippet,
      // we need to reload in order for the view to properly reflect changes. This block
      // is meant to add some debouncing to allow a dev to change params in order to
      // see them reflected properly.
      if (self.SWG_BASIC) {
        if (self.__RESET_SWG_TIMEOUT__) {
          self.clearTimeout(self.__RESET_SWG_TIMEOUT__);
        }

        self.__RESET_SWG_TIMEOUT__ = setTimeout(() => {
          self.window.location.reload();
        }, 200);
        return '';
      }
      return component();
    },
  ],
};

const channel = addons.getChannel();

const storyListener = () => {
  if (self.SWG_BASIC) {
    self.window.location.reload();
    return '';
  }
};

function setupEventListener() {
  channel.addListener(STORY_CHANGED, storyListener);
}

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
  const returnNode = self.document.createDocumentFragment();
  const scriptEl = self.document.createElement('script');
  scriptEl.src = `/basic-subscriptions.max.js?_=${Math.random()}`;
  scriptEl.async = true;
  returnNode.appendChild(scriptEl);
  returnNode.appendChild(el);
  return returnNode;
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
