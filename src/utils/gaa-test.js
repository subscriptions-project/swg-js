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
import {tick} from '../../test/tick';

const ARTICLE_URL = '/article';
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
  let clock;
  let script;
  let signOutFake;

  beforeEach(() => {
    // Mock clock.
    clock = sandbox.useFakeTimers();

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
      signin2: {
        render: sandbox.fake(),
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
      GaaMeteringRegwall.show();

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('renders Google Sign-In button', async () => {
      const googleSignInUser = {};

      const googleSignInUserPromise = GaaMeteringRegwall.show();
      clock.tick(100);
      await tick(10);

      const args = self.gapi.signin2.render.args;
      // Verify onsuccess callback is a function.
      expect(typeof args[0][1].onsuccess).to.equal('function');

      // Call onsuccess callback, to continue flow.
      args[0][1].onsuccess(googleSignInUser);

      // Remove onsuccess callback for easier comparisons.
      delete args[0][1].onsuccess;

      // Verify remaining args.
      expect(args).to.deep.equal([
        [
          'swg-google-sign-in-button',
          {
            longtitle: true,
            scope: 'profile email',
            theme: 'dark',
          },
        ],
      ]);

      // Verify the method returns a Google Sign-In user.
      expect(await googleSignInUserPromise).to.equal(googleSignInUser);
    });

    it('adds click handler for publisher sign in button', () => {
      GaaMeteringRegwall.show();
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
      GaaMeteringRegwall.show();

      expect(sessionStorage.gaaRegwallArticleUrl).equals(ARTICLE_URL);
    });

    it('throws if article metadata lacks a publisher name', () => {
      script.text = '{}';
      const showingRegwall = () => GaaMeteringRegwall.show();

      expect(showingRegwall).throws(
        'Article needs JSON-LD with a publisher name.'
      );
    });

    it('configures GSI correctly', async () => {
      GaaMeteringRegwall.show();

      expect(self.gapi.load).to.be.calledWith('auth2');
      expect(self.gapi.auth2.getAuthInstance).to.be.called;
      expect(self.gapi.auth2.init).to.be.called;
    });
  });

  describe('redirectToArticle', () => {
    it('redirects user to article', () => {
      sessionStorage.gaaRegwallArticleUrl = ARTICLE_URL;
      GaaMeteringRegwall.redirectToArticle();

      expect(GaaMeteringRegwall.location_.href).equals(ARTICLE_URL);
    });

    it('throws if article URL is missing from session storage', () => {
      const redirecting = () => GaaMeteringRegwall.redirectToArticle();

      expect(redirecting).throws(
        'Article URL is missing from session storage.'
      );
    });
  });

  describe('signOut', () => {
    it('tells GSI to sign user out', async () => {
      const promise = GaaMeteringRegwall.signOut();
      clock.tick(100);
      await promise;

      expect(signOutFake).to.be.called;
    });
  });
});
