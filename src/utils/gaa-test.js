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

import {
  GOOGLE_SIGN_IN_IFRAME_ID,
  GaaGoogleSignInButton,
  GaaMeteringRegwall,
  GaaUtils,
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
  REGWALL_CONTAINER_ID,
  REGWALL_DIALOG_ID,
  REGWALL_TITLE_ID,
  queryStringHasFreshGaaParams,
} from './gaa';
import {I18N_STRINGS} from '../i18n/strings';
import {tick} from '../../test/tick';

const PUBLISHER_NAME = 'The Scenic';
const IFRAME_URL = 'https://localhost/gsi-iframe';

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

describes.realWin('queryStringHasFreshGaaParams', {}, () => {
  let clock;

  beforeEach(() => {
    clock = sandbox.useFakeTimers();
  });

  it('succeeeds for valid params', () => {
    const queryString = '?gaa_at=at&gaa_n=n&gaa_sig=sig&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.true;
  });

  it('fails without gaa_at', () => {
    const queryString = '?gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails without gaa_n', () => {
    const queryString = '?gaa_at=gaa&gaa_sig=s1gn4tur3&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails without gaa_sig', () => {
    const queryString = '?gaa_at=gaa&gaa_n=n0nc3&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails without gaa_ts', () => {
    const queryString = '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails if GAA URL params are expired', () => {
    // Add GAA URL params with expiration of 7 seconds.
    const queryString = '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=7';
    clock.tick(7001);
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails if gaa_at param specifies "no access"', () => {
    const queryString = '?gaa_at=na&gaa_n=n&gaa_sig=sig&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('succeeds if gaa_at param specifies "no access" but allowAllAccessTypes is true', () => {
    const queryString = '?gaa_at=na&gaa_n=n&gaa_sig=sig&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString, true)).to.be.true;
  });
});

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

    // Mock query string.
    sandbox.stub(GaaUtils, 'getQueryString');
    GaaUtils.getQueryString.returns(
      '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
    );

    // Mock console.warn method.
    sandbox.stub(self.console, 'warn');

    // Add JSON-LD with a publisher name.
    script = self.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = ARTICLE_METADATA;
    self.document.head.appendChild(script);
  });

  afterEach(() => {
    script.remove();
    GaaMeteringRegwall.remove_();
    self.document.documentElement.lang = '';
    self.console.warn.restore();
  });

  describe('show', () => {
    it('shows regwall with publisher name', () => {
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('does not render CASL blurb by default', () => {
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      const caslEl = self.document.querySelector('.gaa-metering-regwall--casl');
      expect(caslEl).to.be.null;
    });

    it('optionally renders CASL blurb', () => {
      const caslUrl = 'https://example.com';
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL, caslUrl});

      const caslEl = self.document.querySelector('.gaa-metering-regwall--casl');
      expect(caslEl.textContent).contains("Review The Scenic's CASL terms");

      const caslLinkEl = caslEl.querySelector('a');
      expect(caslLinkEl.href).contains(caslUrl);
    });

    it('focuses on modal title after the animation completes', () => {
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      // Mock animation ending.
      const dialogEl = self.document.getElementById(REGWALL_DIALOG_ID);
      dialogEl.dispatchEvent(new Event('animationend'));

      const titleEl = self.document.getElementById(REGWALL_TITLE_ID);
      expect(self.document.activeElement).to.equal(titleEl);
    });

    it('adds click handler for publisher sign in button', () => {
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});
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
      expect(subscriptionsMock.triggerLoginRequest).to.be.calledWithExactly({
        linkRequested: false,
      });
    });

    it('throws if article metadata lacks a publisher name', () => {
      script.text = '{}';
      const showingRegwall = () =>
        GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      expect(showingRegwall).throws(
        'Article needs JSON-LD with a publisher name.'
      );
    });

    it('returns GAA User', async () => {
      const gaaUser = {name: 'Hello'};
      const gaaUserPromise = GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_USER,
        gaaUser,
      });

      expect(await gaaUserPromise).to.deep.equal(gaaUser);
    });

    it('removes Regwall from DOM', async () => {
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_USER,
        gaaUser: {},
      });

      await GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
    });

    it('renders supported i18n languages', () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      const titleEl = self.document.querySelector(
        '.gaa-metering-regwall--title'
      );
      expect(titleEl.textContent).to.equal(
        I18N_STRINGS.SHOWCASE_REGWALL_TITLE['pt-br']
      );
    });

    it('renders "en" for non-supported i18n languages', () => {
      self.document.documentElement.lang = 'non-supported';

      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      const titleEl = self.document.querySelector(
        '.gaa-metering-regwall--title'
      );
      expect(titleEl.textContent).to.equal(
        I18N_STRINGS.SHOWCASE_REGWALL_TITLE['en']
      );
    });

    it('adds "lang" URL param to iframe URL', () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      const iframeEl = self.document.getElementById(GOOGLE_SIGN_IN_IFRAME_ID);
      expect(iframeEl.src).to.contain('?lang=pt-br');
    });

    it('fails if GAA URL params are missing', () => {
      // Remove GAA URL params.
      GaaUtils.getQueryString.restore();

      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      expect(self.console.warn).to.have.been.calledWithExactly(
        '[swg-gaa.js:GaaMeteringRegwall.show]: URL needs fresh GAA params.'
      );
    });

    it('fails if GAA URL params are expired', () => {
      // Add GAA URL params with expiration of 7 seconds.
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=7'
      );

      // Move clock a little past 7 seconds.
      clock.tick(7001);

      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      expect(self.console.warn).to.have.been.calledWithExactly(
        '[swg-gaa.js:GaaMeteringRegwall.show]: URL needs fresh GAA params.'
      );
    });

    it('handles GSI error', async () => {
      const gaaUserPromise = GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_ERROR,
      });

      // Reject promise.
      await expect(gaaUserPromise).to.eventually.be.rejectedWith(
        'Google Sign-In could not render'
      );

      // Remove Regwall from DOM.
      expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
    });

    it('logs Showcase event', async () => {
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      // Swgjs should log three events.
      expect(self.SWG.push).to.be.called;
      const logEvent = sandbox.fake();
      const subscriptionsMock = {
        getEventManager: () => Promise.resolve({logEvent}),
      };
      self.SWG.push.callback(subscriptionsMock);
      await tick();

      // Swgjs should have logged these analytics events.
      const eventTypes = [3009, 22, 23];
      expect(logEvent).to.have.callCount(eventTypes.length);
      for (let i = 0; i < eventTypes.length; i++) {
        const eventType = eventTypes[i];
        expect(logEvent.getCall(i)).to.be.calledWithExactly({
          eventType,
          eventOriginator: 1,
          isFromUserAction: null,
          additionalParameters: null,
        });
      }
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

  describe('getGaaUser_', () => {
    it('sends intro postMessage to iframe', async () => {
      // Mock an iframe (as a div to avoid browser security restrictions).
      const mockIframeEl = self.document.createElement('div');
      mockIframeEl.id = GOOGLE_SIGN_IN_IFRAME_ID;
      mockIframeEl.contentWindow = {
        postMessage: sandbox.fake(),
      };
      self.document.body.appendChild(mockIframeEl);

      // Send intro message then trigger mock iframe's onload callback.
      GaaMeteringRegwall.sendIntroMessageToGsiIframe_({iframeUrl: IFRAME_URL});
      mockIframeEl.onload();

      expect(mockIframeEl.contentWindow.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_INTRODUCTION,
          stamp: POST_MESSAGE_STAMP,
        },
        'https://localhost'
      );
    });
  });

  describe('getPublisherNameFromPageConfig_', () => {
    it('gets the publisher name from object page config', () => {
      expect(GaaMeteringRegwall.getPublisherNameFromPageConfig_()).to.equal(
        PUBLISHER_NAME
      );
    });

    it('gets the publisher name from array page config', () => {
      self.document.head.innerHTML = `
        <script type="application/ld+json">
          [${ARTICLE_METADATA}]
        </script>
      `;

      expect(GaaMeteringRegwall.getPublisherNameFromPageConfig_()).to.equal(
        PUBLISHER_NAME
      );
    });
  });
});

describes.realWin('GaaGoogleSignInButton', {}, () => {
  const allowedOrigins = [location.origin];

  let clock;

  beforeEach(() => {
    // Mock clock.
    clock = sandbox.useFakeTimers();

    self.gapi = {
      load: sandbox.fake((name, callback) => {
        callback();
      }),
      auth2: {
        init: sandbox.fake(),
        getAuthInstance: sandbox.fake(),
      },
      signin2: {
        render: sandbox.fake(),
      },
    };

    // Mock query string.
    sandbox.stub(GaaUtils, 'getQueryString');
    GaaUtils.getQueryString.returns('?lang=en');

    // Mock console.warn method.
    sandbox.stub(self.console, 'warn');
  });

  afterEach(() => {
    if (self.postMessage.restore) {
      self.postMessage.restore();
    }
    GaaUtils.getQueryString.restore();

    // Remove the injected style from GaaGoogleSignInButton.show.
    self.document.head.querySelector('style').remove();

    self.console.warn.restore();
  });

  describe('show', () => {
    it('renders Google Sign-In button', async () => {
      GaaGoogleSignInButton.show({allowedOrigins});
      clock.tick(100);
      await tick(10);

      const args = self.gapi.signin2.render.args;
      expect(typeof args[0][1].onsuccess).to.equal('function');
      expect(args).to.deep.equal([
        [
          'swg-google-sign-in-button',
          {
            longtitle: true,
            onsuccess: args[0][1].onsuccess,
            prompt: 'select_account',
            scope: 'profile email',
            theme: 'dark',
          },
        ],
      ]);
    });

    it('renders supported i18n languages', async () => {
      GaaUtils.getQueryString.returns('?lang=pt-br');

      GaaGoogleSignInButton.show({allowedOrigins});
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['pt-br']
      );
    });

    it('renders English by default, if "lang" URL param is missing', async () => {
      GaaUtils.getQueryString.returns('?');

      GaaGoogleSignInButton.show({allowedOrigins});
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['en']
      );
    });

    it('sends post message with GAA user', async () => {
      GaaGoogleSignInButton.show({allowedOrigins});

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Mock Google Sign-In response with GoogleUser object.
      const gaaUser = {
        idToken: 'idToken',
        name: 'name',
        givenName: 'givenName',
        familyName: 'familyName',
        imageUrl: 'imageUrl',
        email: 'email',
        authorizationData: {
          /* eslint-disable google-camelcase/google-camelcase */
          access_token: 'accessToken',
          id_token: 'idToken',
          scope: 'scope',
          expires_in: 0,
          first_issued_at: 0,
          expires_at: 0,
          /* eslint-enable google-camelcase/google-camelcase */
        },
      };
      const googleUser = {
        getBasicProfile: () => ({
          getName: () => gaaUser.name,
          getGivenName: () => gaaUser.givenName,
          getFamilyName: () => gaaUser.familyName,
          getImageUrl: () => gaaUser.imageUrl,
          getEmail: () => gaaUser.email,
        }),
        getAuthResponse: () => gaaUser.authorizationData,
      };
      const args = self.gapi.signin2.render.args;
      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);
      // Send GoogleUser.
      args[0][1].onsuccess(googleUser);

      // Wait for post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_USER,
          gaaUser: {
            email: 'email',
            familyName: 'familyName',
            givenName: 'givenName',
            idToken: 'idToken',
            imageUrl: 'imageUrl',
            name: 'name',
            authorizationData: {
              /* eslint-disable google-camelcase/google-camelcase */
              access_token: 'accessToken',
              id_token: 'idToken',
              scope: 'scope',
              expires_in: 0,
              first_issued_at: 0,
              expires_at: 0,
              /* eslint-enable google-camelcase/google-camelcase */
            },
          },
          stamp: POST_MESSAGE_STAMP,
        },
        location.origin
      );
    });

    it('sends errors to parent', async () => {
      self.gapi.signin2.render = sandbox.fake.throws('I need cookies');

      GaaGoogleSignInButton.show({allowedOrigins});

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);

      // Wait for post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_ERROR,
          stamp: POST_MESSAGE_STAMP,
        },
        location.origin
      );
    });

    it('fails and warns when passed invalid origins', async () => {
      const invalidOrigins = [
        // Bad protocol, should be http or https.
        'ftp://localhost:8080',
        // Includes path.
        'http://localhost:8080/',
      ];

      for (const invalidOrigin of invalidOrigins) {
        GaaGoogleSignInButton.show({allowedOrigins: [invalidOrigin]});

        // Send intro post message.
        postMessage({
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_INTRODUCTION,
        });

        // Wait for promises and intervals to resolve.
        clock.tick(100);
        await tick(10);

        expect(self.console.warn).to.have.been.calledWithExactly(
          `[swg-gaa.js:GaaGoogleSignInButton.show]: You specified an invalid origin: ${invalidOrigin}`
        );
      }
    });
  });
});
