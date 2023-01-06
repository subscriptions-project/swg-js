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

import {GaaMeteringRegwall} from '../runtime/extended-access';
import {STORY_CHANGED} from '@storybook/core-events';
import {addons} from '@storybook/addons';

export default {
  title: 'Showcase Regwall',
};

const channel = addons.getChannel();

const storyListener = (args) => {
  if (args.includes('user-journeys')) {
    self.window.location.reload();
    return '';
  }
};

function setupEventListener() {
  channel.addListener(STORY_CHANGED, storyListener);
}

export const Regwall = (args) => {
  // Set language.
  self.document.body.lang = args['Language'] || 'en';

  // Add publisher metadata.
  self.document.body.insertAdjacentHTML(
    'beforeend',
    `
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "NewsArticle",
  "headline": "16 Top Spots for Hiking",
  "image": "https://scenic-2017.appspot.com/icons/icon-2x.png",
  "datePublished": "2025-02-05T08:00:00+08:00",
  "dateModified": "2025-02-05T09:20:00+08:00",
  "author": {
    "@type": "Person",
    "name": "John Doe"
  },
  "publisher": {
      "name": "The Scenic - USA",
      "@type": "Organization",
      "@id": "scenic-2017.appspot.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://scenic-2017.appspot.com/icons/icon-2x.png"
      }
  },
  "description": "A most wonderful article",
  "isAccessibleForFree": "False",
  "isPartOf": {
    "@type": ["CreativeWork", "Product"],
    "name" : "Scenic News",
    "productID": "scenic-2017.appspot.com:news"
  }
}
</script>
`
  );

  return GaaMeteringRegwall.render_({
    iframeUrl: '/sign-in-button.html',
    caslUrl: args['Show CASL terms'] ? 'https://example.com' : '',
  });
};
Regwall.args = {
  'Language': 'en',
  'Show CASL terms': false,
};
Regwall.decorators = [
  (component) => {
    // Reload wouldn't happen after switching to the user journeys pages, therefore
    // adding a listener here to reload the window when redirecting to user journeys pages.
    setupEventListener();

    return component();
  },
];
