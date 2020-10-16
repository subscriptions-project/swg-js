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

import {GaaMeteringRegwall} from './gaa';

const ARTICLE_URL = '/article';
const REDIRECT_URI = '/redirect-uri';
const PUBLISHER_NAME = 'The Scenic';

/** Article metadata in ld+json form. */
const ARTICLE_METADATA = `
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
      "name": "${PUBLISHER_NAME}",
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
}`;

describes.realWin('GaaMeteringRegwall', {}, () => {
  let script;
  let signOutFake;

  beforeEach(() => {
    // Mock Google Sign-In API.
    signOutFake = sandbox.fake.resolves();
    let authInstance;
    self.gapi = {
      load: sandbox.fake((name, callback) => {
        callback();
      }),
      auth2: {
        init: sandbox.fake(() => {
          authInstance = {
            signOut: signOutFake,
          };
        }),
        getAuthInstance: sandbox.fake(() => authInstance),
      },
    };

    // Mock SwG API.
    self.SWG = {
      push: sandbox.fake(),
    };

    // Mock location.
    GaaMeteringRegwall.location_ = {
      href: ARTICLE_URL,
    };

    // Add JSON-LD with a publisher name.
    script = self.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = ARTICLE_METADATA;
    self.document.head.appendChild(script);
  });

  afterEach(() => {
    script.remove();
    delete sessionStorage.gaaRegwallArticleUrl;
  });

  describe('show', () => {
    it('shows regwall with publisher name', () => {
      GaaMeteringRegwall.show({redirectUri: REDIRECT_URI});

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('adds click handler for publisher sign in button', () => {
      GaaMeteringRegwall.show({redirectUri: REDIRECT_URI});
      const publisherSignInButtonEl = self.document.querySelector(
        '#swg-publisher-sign-in-button'
      );
      publisherSignInButtonEl.click();

      // GAA JS should call SwG's triggerLoginRequest API.
      expect(self.SWG.push).to.be.called;
      const subscriptionsMock = {
        triggerLoginRequest: sandbox.fake(),
      };
      self.SWG.push.callback(subscriptionsMock);
      expect(subscriptionsMock.triggerLoginRequest).to.be.calledWith({
        linkRequested: false,
      });
    });

    it('saves article URL to session storage', () => {
      GaaMeteringRegwall.show({redirectUri: REDIRECT_URI});

      expect(sessionStorage.gaaRegwallArticleUrl).equals(ARTICLE_URL);
    });

    it('throws if article metadata lacks a publisher name', () => {
      script.text = '{}';
      const showingRegwall = () =>
        GaaMeteringRegwall.show({redirectUri: REDIRECT_URI});

      expect(showingRegwall).throws(
        'Article needs JSON-LD with a publisher name.'
      );
    });
  });

  describe('redirectToArticle', () => {
    it('redirects user to article', () => {
      sessionStorage.gaaRegwallArticleUrl = ARTICLE_URL;
      GaaMeteringRegwall.redirectToArticle();

      expect(GaaMeteringRegwall.location_.href).equals(ARTICLE_URL);
    });

    it('throws if article URL is missing', () => {
      const redirecting = () => GaaMeteringRegwall.redirectToArticle();

      expect(redirecting).throws(
        'Article URL is missing from session storage.'
      );
    });
  });

  describe('configureGoogleSignIn', () => {
    it('configures GSI correctly', async () => {
      await GaaMeteringRegwall.configureGoogleSignIn({
        redirectUri: REDIRECT_URI,
      });

      expect(self.gapi.load).to.be.calledWith('auth2');
      expect(self.gapi.auth2.getAuthInstance).to.be.called;
      expect(self.gapi.auth2.init).to.be.calledWith({
        'ux_mode': 'redirect',
        'redirect_uri': REDIRECT_URI,
      });
    });
  });

  describe('signOut', () => {
    it('tells GSI to sign user out', async () => {
      await GaaMeteringRegwall.signOut();

      expect(signOutFake).to.be.called;
    });
  });
});
