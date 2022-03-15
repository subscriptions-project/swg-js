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

import {AnalyticsEvent} from '../proto/api_messages';
import {
  GOOGLE_3P_SIGN_IN_BUTTON_ID,
  GOOGLE_SIGN_IN_BUTTON_ID,
  GOOGLE_SIGN_IN_IFRAME_ID,
  GaaGoogle3pSignInButton,
  GaaGoogleSignInButton,
  GaaMetering,
  GaaMeteringRegwall,
  GaaSignInWithGoogleButton,
  GaaUtils,
  POST_MESSAGE_COMMAND_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
  REGWALL_CONTAINER_ID,
  REGWALL_DIALOG_ID,
  REGWALL_TITLE_ID,
  SIGN_IN_WITH_GOOGLE_BUTTON_ID,
  gaaNotifySignIn,
  queryStringHasFreshGaaParams,
} from './gaa';
import {I18N_STRINGS} from '../i18n/strings';
import {JwtHelper} from './jwt';
import {tick} from '../../test/tick';

const PUBLISHER_NAME = 'The Scenic';
const PRODUCT_ID = 'scenic-2017.appspot.com:news';
const IFRAME_URL = 'https://localhost/gsi-iframe';
const GOOGLE_3P_AUTH_URL = 'https://fabulous-3p-authserver.glitch.me/auth';
const GOOGLE_API_CLIENT_ID =
  '520465458218-e9vp957krfk2r0i4ejeh6aklqm7c25p4.apps.googleusercontent.com';

/** Article metadata in ld+json form. */
const ARTICLE_LD_JSON_METADATA = `
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
    "productID": "${PRODUCT_ID}"
  }
}`;

const ARTICLE_LD_JSON_METADATA_FREE_ARTICLE = `
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
  "isAccessibleForFree": true,
  "isPartOf": {
    "@type": ["CreativeWork", "Product"],
    "name" : "Scenic News",
    "productID": "${PRODUCT_ID}"
  }
}`;

const ARTICLE_LD_JSON_METADATA_NULL = `
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
  "isAccessibleForFree": null,
  "isPartOf": {
    "@type": ["CreativeWork", "Product"],
    "name" : "Scenic News",
    "productID": "${PRODUCT_ID}"
  }
}`;

/** Article metadata in microdata form. */
const ARTICLE_MICRODATA_METADATA = `
<div itemscope itemtype="http://schema.org/NewsArticle">
  <span itemscope itemprop="publisher" itemtype="https://schema.org/Organization" aria-hidden="true">
    <meta itemprop="name" content="${PUBLISHER_NAME}"/>
  </span>
  <meta itemprop="isAccessibleForFree" content="False"/>
  <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
    <meta itemprop="productID" content="${PRODUCT_ID}"/>
  </div>
</div>`;

const ARTICLE_MICRODATA_METADATA_TRUE = `
<div itemscope itemtype="http://schema.org/NewsArticle">
  <span itemscope itemprop="publisher" itemtype="https://schema.org/Organization" aria-hidden="true">
    <meta itemprop="name" content="${PUBLISHER_NAME}"/>
  </span>
  <meta itemprop="isAccessibleForFree" content=true />
  <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
    <meta itemprop="productID" content="${PRODUCT_ID}"/>
  </div>
</div>`;

const SIGN_IN_WITH_GOOGLE_JWT = {
  credential: {
    /* eslint-disable google-camelcase/google-camelcase */
    payload: {
      iss: 'https://accounts.google.com', // The JWT's issuer
      nbf: 161803398874,
      aud: '314159265-pi.apps.googleusercontent.com', // Your server's client ID
      sub: '3141592653589793238', // The unique ID of the user's Google Account
      hd: 'gmail.com', // If present, the host domain of the user's GSuite email address
      email: 'elisa.g.beckett@gmail.com', // The user's email address
      email_verified: true, // true, if Google has verified the email address
      azp: '314159265-pi.apps.googleusercontent.com',
      name: 'Elisa Beckett',
      // If present, a URL to user's profile picture
      picture:
        'https://lh3.googleusercontent.com/a-/e2718281828459045235360uler',
      given_name: 'Elisa',
      family_name: 'Beckett',
      iat: 1596474000, // Unix timestamp of the assertion's creation time
      exp: 1596477600, // Unix timestamp of the assertion's expiration time
      jti: 'abc161803398874def',
    },
    /* eslint-enable google-camelcase/google-camelcase */
  },
};

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
  let logEvent;
  let microdata;
  let script;
  let signOutFake;
  let subscriptionsMock;

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

    // Mock Sign In with Google API.
    self.google = {
      accounts: {
        id: {
          initialize: sandbox.fake(),
          renderButton: sandbox.fake(),
        },
      },
    };

    // Mock SwG API.
    logEvent = sandbox.fake();
    subscriptionsMock = {
      triggerLoginRequest: sandbox.fake(),
      getEventManager: () => Promise.resolve({logEvent}),
    };
    self.SWG = {
      push: sandbox.fake((callback) => void callback(subscriptionsMock)),
    };

    // Mock query string.
    sandbox.stub(GaaUtils, 'getQueryString');
    GaaUtils.getQueryString.returns(
      '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
    );

    // Mock console.warn & log methods.
    sandbox.stub(self.console, 'warn');
    sandbox.stub(self.console, 'log');

    // Add JSON-LD with a publisher name.
    script = self.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = ARTICLE_LD_JSON_METADATA;
    self.document.head.appendChild(script);

    // Add container for Microdata.
    microdata = self.document.createElement('div');
    self.document.head.appendChild(microdata);
  });

  afterEach(() => {
    script.remove();
    microdata.remove();
    GaaMeteringRegwall.remove();
    self.document.documentElement.lang = '';
    // Remove the injected style from GaaMeteringRegwall.createNativeRegistrationButton.
    self.document.head.querySelectorAll('style').forEach((e) => {
      e.remove();
    });

    self.console.warn.restore();
    self.console.log.restore();
  });

  /**
   * Expects a list of Analytics events.
   * @param {!Array<{
   *   analyticsEvent: !ShowcaseEvent,
   *   isFromUserAction: boolean,
   * }>} events
   */
  function expectAnalyticsEvents(events) {
    expect(logEvent).to.have.callCount(events.length);
    for (let i = 0; i < events.length; i++) {
      const {analyticsEvent, isFromUserAction} = events[i];
      expect(logEvent.getCall(i)).to.be.calledWithExactly({
        eventType: analyticsEvent,
        eventOriginator: 1,
        isFromUserAction,
        additionalParameters: null,
      });
    }
  }

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

    it('handles clicks on publisher sign in link', async () => {
      // Show Regwall.
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});
      await tick();
      logEvent.resetHistory();

      // Click publisher link to trigger a login request.
      const publisherSignInButtonEl = self.document.querySelector(
        '#swg-publisher-sign-in-button'
      );
      publisherSignInButtonEl.click();
      expect(subscriptionsMock.triggerLoginRequest).to.be.calledWithExactly({
        linkRequested: false,
      });
      await tick();

      // Verify analytics event.
      expectAnalyticsEvents([
        {
          analyticsEvent:
            AnalyticsEvent.ACTION_SHOWCASE_REGWALL_EXISTING_ACCOUNT_CLICK,
          isFromUserAction: true,
        },
      ]);
    });

    it('parses publisher name from microdata', () => {
      // Remove JSON-LD.
      script.text = '{}';

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA;

      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('throws if article metadata lacks a publisher name', () => {
      // Remove JSON-LD.
      script.text = '{}';

      const showingRegwall = () =>
        GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});

      expect(showingRegwall).throws(
        'Showcase articles must define a publisher name with either JSON-LD or Microdata.'
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

    it('logs Showcase impression events', async () => {
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});
      await tick();

      // Verify analytics events.
      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.EVENT_NO_ENTITLEMENTS,
          isFromUserAction: false,
        },
        {
          analyticsEvent: AnalyticsEvent.IMPRESSION_REGWALL,
          isFromUserAction: false,
        },
        {
          analyticsEvent: AnalyticsEvent.IMPRESSION_SHOWCASE_REGWALL,
          isFromUserAction: false,
        },
      ]);
    });
  });

  describe('showWithNativeRegistrationButton', () => {
    it('shows regwall with publisher name', () => {
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('does not render CASL blurb by default', () => {
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });

      const caslEl = self.document.querySelector('.gaa-metering-regwall--casl');
      expect(caslEl).to.be.null;
    });

    it('optionally renders CASL blurb', () => {
      const caslUrl = 'https://example.com';
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
        caslUrl,
      });

      const caslEl = self.document.querySelector('.gaa-metering-regwall--casl');
      expect(caslEl.textContent).contains("Review The Scenic's CASL terms");

      const caslLinkEl = caslEl.querySelector('a');
      expect(caslLinkEl.href).contains(caslUrl);
    });

    it('focuses on modal title after the animation completes', () => {
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });

      // Mock animation ending.
      const dialogEl = self.document.getElementById(REGWALL_DIALOG_ID);
      dialogEl.dispatchEvent(new Event('animationend'));

      const titleEl = self.document.getElementById(REGWALL_TITLE_ID);
      expect(self.document.activeElement).to.equal(titleEl);
    });

    it('handles clicks on publisher sign in link', async () => {
      // Show Regwall.
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });
      await tick();
      logEvent.resetHistory();

      // Click publisher link to trigger a login request.
      const publisherSignInButtonEl = self.document.querySelector(
        '#swg-publisher-sign-in-button'
      );
      publisherSignInButtonEl.click();
      expect(subscriptionsMock.triggerLoginRequest).to.be.calledWithExactly({
        linkRequested: false,
      });
      await tick();

      // Verify analytics event.
      expectAnalyticsEvents([
        {
          analyticsEvent:
            AnalyticsEvent.ACTION_SHOWCASE_REGWALL_EXISTING_ACCOUNT_CLICK,
          isFromUserAction: true,
        },
      ]);
    });

    it('parses publisher name from microdata', () => {
      // Remove JSON-LD.
      script.text = '{}';

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA;

      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('throws if article metadata lacks a publisher name', () => {
      // Remove JSON-LD.
      script.text = '{}';

      const showingRegwall = () =>
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          clientId: GOOGLE_API_CLIENT_ID,
        });

      expect(showingRegwall).throws(
        'Showcase articles must define a publisher name with either JSON-LD or Microdata.'
      );
    });

    it('resolves with a gaaUser removes Regwall from DOM on click', async () => {
      const gaaUserPromise =
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          clientId: GOOGLE_API_CLIENT_ID,
        });
      clock.tick(100);
      await tick(10);

      // Click button.
      self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID).click();

      // Simulate the click resolving
      const args = self.google.accounts.id.initialize.args;
      args[0][0].callback(SIGN_IN_WITH_GOOGLE_JWT);

      expect(await gaaUserPromise).to.deep.equal(SIGN_IN_WITH_GOOGLE_JWT);
      expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
    });

    it('renders supported i18n languages', () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });

      const titleEl = self.document.querySelector(
        '.gaa-metering-regwall--title'
      );
      expect(titleEl.textContent).to.equal(
        I18N_STRINGS.SHOWCASE_REGWALL_TITLE['pt-br']
      );
    });

    it('renders "en" for non-supported i18n languages', () => {
      self.document.documentElement.lang = 'non-supported';

      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });

      const titleEl = self.document.querySelector(
        '.gaa-metering-regwall--title'
      );
      expect(titleEl.textContent).to.equal(
        I18N_STRINGS.SHOWCASE_REGWALL_TITLE['en']
      );
    });

    it('handles Sign In with Google errors', async () => {
      self.google.accounts.id.initialize = sandbox.fake.throws(
        'Function not loaded'
      );

      const gaaUserPromise =
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          clientId: GOOGLE_API_CLIENT_ID,
        });
      clock.tick(100);
      await tick(10);

      // Reject promise.
      await gaaUserPromise;
      expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
    });

    it('logs Sign In with Google errors when in debug mode', async () => {
      location.hash = '#swg.debug=1';

      self.google.accounts.id.initialize = sandbox.fake.throws(
        'Function not loaded'
      );

      const gaaUserPromise =
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          clientId: GOOGLE_API_CLIENT_ID,
        });
      clock.tick(100);
      await tick(10);

      // Reject promise.
      await gaaUserPromise;
      expect(self.console.log).to.calledWithExactly(
        '[Subscriptions]',
        'Regwall failed: Error: Function not loaded'
      );
      expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
    });

    it('logs Showcase impression events', async () => {
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });
      await tick();

      // Verify analytics events.
      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.EVENT_NO_ENTITLEMENTS,
          isFromUserAction: false,
        },
        {
          analyticsEvent: AnalyticsEvent.IMPRESSION_REGWALL,
          isFromUserAction: false,
        },
        {
          analyticsEvent: AnalyticsEvent.IMPRESSION_SHOWCASE_REGWALL,
          isFromUserAction: false,
        },
      ]);
    });
  });

  describe('createNativeRegistrationButton', () => {
    it('fails if regwall is not present', async () => {
      expect(
        GaaMeteringRegwall.createNativeRegistrationButton({
          clientId: GOOGLE_API_CLIENT_ID,
        })
      ).to.be.false;
    });

    it('renders Google Sign-In button', async () => {
      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      GaaMeteringRegwall.createNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });
      clock.tick(100);
      await tick(10);

      const argsInit = self.google.accounts.id.initialize.args;
      expect(typeof argsInit[0][0].callback).to.equal('function');
      expect(argsInit).to.deep.equal([
        [
          {
            /* eslint-disable google-camelcase/google-camelcase */
            client_id: GOOGLE_API_CLIENT_ID,
            callback: argsInit[0][0].callback,
            /* eslint-enable google-camelcase/google-camelcase */
          },
        ],
      ]);

      const argsRender = self.google.accounts.id.renderButton.args;
      expect(argsRender).to.deep.equal([
        [
          self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID),
          {
            'type': 'standard',
            'theme': 'outline',
            'text': 'continue_with',
            'logo_alignment': 'center',
          },
        ],
      ]);
    });

    it('renders supported i18n languages', async () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      GaaMeteringRegwall.createNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['pt-br']
      );
    });

    it('renders "en" for non-supported i18n languages', async () => {
      self.document.documentElement.lang = 'non-supported';

      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      GaaMeteringRegwall.createNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['en']
      );
    });

    it('resolves with GAA user', async () => {
      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      // Show button.
      const gaaUserPromise = GaaMeteringRegwall.createNativeRegistrationButton({
        clientId: GOOGLE_API_CLIENT_ID,
      });
      clock.tick(100);
      await tick(10);

      // Click button.
      self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID).click();

      const args = self.google.accounts.id.initialize.args;
      args[0][0].callback(SIGN_IN_WITH_GOOGLE_JWT);

      // Send JWT.
      expect(await gaaUserPromise).to.deep.equal(SIGN_IN_WITH_GOOGLE_JWT);
    });
  });

  describe('remove', () => {
    it('removes regwall', () => {
      function findRegwallInDocument() {
        return self.document.querySelector('.gaa-metering-regwall--dialog');
      }

      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});
      expect(findRegwallInDocument()).to.not.be.null;

      GaaMeteringRegwall.remove();
      expect(findRegwallInDocument()).to.be.null;
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

  describe('logButtonClickEvents_', () => {
    it('sends button click event', async () => {
      // Show Regwall.
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});
      await tick();
      logEvent.resetHistory();

      // Send button click post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_BUTTON_CLICK,
      });

      // Wait for logging.
      await new Promise((resolve) => {
        logEvent = sandbox.fake(resolve);
      });

      // Verify analytics event.
      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_GSI_CLICK,
          isFromUserAction: true,
        },
      ]);
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
          [${ARTICLE_LD_JSON_METADATA}]
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
    self.document.head.querySelectorAll('style').forEach((e) => {
      e.remove();
    });

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

    it('sends post message with button click event', async () => {
      // Show button.
      GaaGoogleSignInButton.show({allowedOrigins});

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);

      // Click button.
      self.document.getElementById(GOOGLE_SIGN_IN_BUTTON_ID).click();

      // Wait for button click post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      // Expect button click post message.
      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_BUTTON_CLICK,
          stamp: POST_MESSAGE_STAMP,
        },
        location.origin
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

describes.realWin('GaaSignInWithGoogleButton', {}, () => {
  const allowedOrigins = [location.origin];
  const clientId = 'client_id';

  let clock;

  beforeEach(() => {
    // Mock clock.
    clock = sandbox.useFakeTimers();

    self.google = {
      accounts: {
        id: {
          initialize: sandbox.fake(),
          renderButton: sandbox.fake(),
        },
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

    // Remove the injected style from GaaSignInWithGoogleButton.show.
    self.document.head.querySelectorAll('style').forEach((e) => {
      e.remove();
    });

    self.console.warn.restore();
  });

  describe('show', () => {
    it('renders Google Sign-In button', async () => {
      GaaSignInWithGoogleButton.show({clientId, allowedOrigins});
      clock.tick(100);
      await tick(10);

      const argsInit = self.google.accounts.id.initialize.args;
      expect(typeof argsInit[0][0].callback).to.equal('function');
      expect(argsInit).to.deep.equal([
        [
          {
            /* eslint-disable google-camelcase/google-camelcase */
            client_id: clientId,
            callback: argsInit[0][0].callback,
            allowed_parent_origin: allowedOrigins,
            /* eslint-enable google-camelcase/google-camelcase */
          },
        ],
      ]);

      const argsRender = self.google.accounts.id.renderButton.args;
      expect(argsRender).to.deep.equal([
        [
          self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID),
          {
            'type': 'standard',
            'theme': 'outline',
            'text': 'continue_with',
            'logo_alignment': 'center',
          },
        ],
      ]);
    });

    it('renders supported i18n languages', async () => {
      GaaUtils.getQueryString.returns('?lang=pt-br');

      GaaSignInWithGoogleButton.show({clientId, allowedOrigins});
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['pt-br']
      );
    });

    it('renders English by default, if "lang" URL param is missing', async () => {
      GaaUtils.getQueryString.returns('?');

      GaaSignInWithGoogleButton.show({clientId, allowedOrigins});
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['en']
      );
    });

    it('sends post message with button click event', async () => {
      // Show button.
      GaaSignInWithGoogleButton.show({clientId, allowedOrigins});

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);

      // Click button.
      self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID).click();

      // Wait for button click post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      // Expect button click post message.
      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_BUTTON_CLICK,
          stamp: POST_MESSAGE_STAMP,
        },
        location.origin
      );
    });

    it('sends post message with GAA user', async () => {
      // Mock JWT decoding function.
      sandbox.stub(JwtHelper.prototype, 'decode').callsFake((credential) => {
        return credential;
      });

      GaaSignInWithGoogleButton.show({
        clientId,
        allowedOrigins,
      });

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      const args = self.google.accounts.id.initialize.args;
      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);
      // Send JWT.
      args[0][0].callback(SIGN_IN_WITH_GOOGLE_JWT);

      // Wait for post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_USER,
          jwtPayload: SIGN_IN_WITH_GOOGLE_JWT.credential,
          stamp: POST_MESSAGE_STAMP,
        },
        location.origin
      );
    });

    it('sends errors to parent', async () => {
      self.google.accounts.id.initialize = sandbox.fake.throws(
        'Function not loaded'
      );

      GaaSignInWithGoogleButton.show({clientId, allowedOrigins});

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
        GaaSignInWithGoogleButton.show({
          clientId,
          allowedOrigins: [invalidOrigin],
        });

        // Send intro post message.
        postMessage({
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_INTRODUCTION,
        });

        // Wait for promises and intervals to resolve.
        clock.tick(100);
        await tick(10);

        expect(self.console.warn).to.have.been.calledWithExactly(
          `[swg-gaa.js:GaaSignInWithGoogleButton.show]: You specified an invalid origin: ${invalidOrigin}`
        );
      }
    });
  });
});

describes.realWin('GaaGoogle3pSignInButton', {}, () => {
  const allowedOrigins = [location.origin];

  let clock;

  beforeEach(() => {
    // Mock clock.
    clock = sandbox.useFakeTimers();

    // Mock query string.
    sandbox.stub(GaaUtils, 'getQueryString');
    GaaUtils.getQueryString.returns('?lang=en');

    // Mock console.warn method.
    sandbox.stub(self.console, 'warn');

    sandbox.stub(self, 'open');
  });

  afterEach(() => {
    if (self.postMessage.restore) {
      self.postMessage.restore();
    }

    GaaUtils.getQueryString.restore();

    // Remove the injected style from GaaGoogle3pSignInButton.show.
    self.document.head.querySelectorAll('style').forEach((e) => {
      e.remove();
    });

    self.console.warn.restore();
  });

  describe('show', () => {
    it('renders third party Google Sign-In button', async () => {
      GaaGoogle3pSignInButton.show({allowedOrigins}, GOOGLE_3P_AUTH_URL);
      clock.tick(100);
      await tick(10);

      const buttonDiv = self.document.querySelector(
        '#' + GOOGLE_3P_SIGN_IN_BUTTON_ID
      );
      assert(buttonDiv);
      expect(buttonDiv.tabIndex).to.equal(0);
      expect(typeof buttonDiv.onclick).to.equal('function');
    });

    it('renders supported i18n languages', async () => {
      GaaUtils.getQueryString.returns('?lang=pt-br');

      GaaGoogle3pSignInButton.show({allowedOrigins}, GOOGLE_3P_AUTH_URL);
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['pt-br']
      );
    });

    it('renders English by default, if "lang" URL param is missing', async () => {
      GaaUtils.getQueryString.returns('?');

      GaaGoogle3pSignInButton.show({allowedOrigins}, GOOGLE_3P_AUTH_URL);
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['en']
      );
    });

    it('sends post message with button click event', async () => {
      // Show button.
      GaaGoogle3pSignInButton.show({allowedOrigins}, GOOGLE_3P_AUTH_URL);
      clock.tick(100);
      await tick(10);

      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();
      clock.tick(100);
      await tick(10);

      expect(self.open).to.have.been.calledOnce;

      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_USER,
      });

      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);

      await new Promise((resolve) => {
        sandbox.stub(self.parent, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      expect(self.parent.postMessage).to.be.calledWithExactly(
        {
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_USER,
        },
        location.origin
      );
    });

    it('sends errors to parent', async () => {
      const invalidOrigin = [
        // Bad protocol, should be http or https.
        'ftp://localhost:8080',
        location.origin,
      ];

      GaaGoogle3pSignInButton.show(
        {allowedOrigins: invalidOrigin},
        GOOGLE_3P_AUTH_URL
      );

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

      expect(self.postMessage).to.be.calledWith(
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
        GaaGoogle3pSignInButton.show(
          {allowedOrigins: [invalidOrigin]},
          GOOGLE_3P_AUTH_URL
        );

        // Send intro post message.
        postMessage({
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_INTRODUCTION,
        });

        // Wait for promises and intervals to resolve.
        clock.tick(100);
        await tick(10);

        expect(self.console.warn).to.have.been.calledWithExactly(
          `[swg-gaa.js:GaaGoogle3pSignInButton.show]: You specified an invalid origin: ${invalidOrigin}`
        );
      }
    });
  });
});

describes.realWin('gaaNotifySignIn', {}, () => {
  it('posts message when passed a user', () => {
    self.opener = self;
    sandbox.stub(self, 'postMessage');
    const gaaUser = {
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
    };
    gaaNotifySignIn.bind(self, {gaaUser})();

    expect(self.postMessage).to.have.been.calledWithExactly({
      stamp: POST_MESSAGE_STAMP,
      command: POST_MESSAGE_COMMAND_USER,
      gaaUser,
    });
  });
});

describes.realWin('GaaMetering', {}, () => {
  let microdata;
  let script;
  let logEvent;
  let subscriptionsMock;
  let currentReferrer;

  beforeEach(() => {
    // Mock clock.
    // clock = sandbox.useFakeTimers();

    // Mock query string.
    sandbox.stub(GaaUtils, 'getQueryString');
    GaaUtils.getQueryString.returns('?lang=en');

    // Mock console.log method.
    sandbox.stub(self.console, 'log');

    // Add JSON-LD with a publisher name.
    script = self.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = ARTICLE_LD_JSON_METADATA;
    self.document.head.appendChild(script);

    // Add container for Microdata.
    microdata = self.document.createElement('div');
    self.document.head.appendChild(microdata);

    // Allow document.referrer to be overriden and save the current value
    Object.defineProperty(self.document, 'referrer', {
      writable: true,
      configurable: true,
      value: self.document.referrer,
    });

    currentReferrer = self.document.referrer;

    // Mock SwG API.
    logEvent = sandbox.fake();
    subscriptionsMock = {
      triggerLoginRequest: sandbox.fake(),
      init: sandbox.fake(),
      setOnLoginRequest: sandbox.fake(),
      setOnNativeSubscribeRequest: sandbox.fake(),
      setOnEntitlementsResponse: sandbox.fake(),
      consumeShowcaseEntitlementJwt: sandbox.fake(),
      setShowcaseEntitlement: sandbox.fake(),
      getEventManager: () => Promise.resolve({logEvent}),
    };
    self.SWG = {
      push: sandbox.fake((callback) => void callback(subscriptionsMock)),
    };
  });

  afterEach(() => {
    script.remove();
    microdata.remove();
    GaaUtils.getQueryString.restore();

    // Remove the injected style from GaaGoogleSignInButton.show.
    self.document.head.querySelectorAll('style').forEach((e) => {
      e.remove();
    });

    self.document.currentReferrer = currentReferrer;
    self.console.log.restore();
  });

  describe('validateParameters', () => {
    it('succeeds for valid params', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.true;
    });

    it('fails for invalid googleSignInClientId', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: '520465458218-e9vp957krfk2r0i4ejeh6aklqm7c25p4',
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'Missing googleSignInClientId, or it is not a string, or it is not in a correct format'
      );
    });

    it('fails for invalid allowedReferrers', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'Missing allowedReferrers or it is not an array'
      );
    });

    it('fails for missing required function unlockArticle', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'Missing unlockArticle or it is not a function'
      );
    });

    it('fails for handleSwgEntitlement not a function', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: 'test string',
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'handleSwGEntitlement is provided but it is not a function'
      );
    });

    it('fails for missing required promise registerUserPromise', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'Missing registerUserPromise or it is not a promise'
      );
    });

    it('fails for invalid userState', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: 'test userState',
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState is not an object'
      );
    });

    it('fails for missing publisherEntitlements or publisherEntitlementsPromise', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'Either granted and grantReason have to be supplied or you have to provide pubisherEntitlementPromise'
      );
    });

    it('fails for missing userState or publisherEntitlementsPromise', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateParameters({
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState or publisherEntitlementPromise needs to be provided'
      );
    });
  });

  describe('getAnchorFromUrl', () => {
    it('returns the expected anchor from url', () => {
      const url = 'https://www.google.com/1234/5678/article.html';
      const anchor = GaaMetering.getAnchorFromUrl(url);
      expect(anchor.protocol).to.equal('https:');
      expect(anchor.hostname).to.equal('www.google.com');
    });

    it('succeeds for an empty url', () => {
      const url = '';
      const anchor = GaaMetering.getAnchorFromUrl(url);
      expect(anchor.protocol).to.not.equal('https:');
      expect(anchor.hostname).to.not.equal('www.google.com');
    });

    it('succeeds for any string', () => {
      const url = 'abc12345';
      const anchor = GaaMetering.getAnchorFromUrl(url);
      expect(anchor.protocol).to.not.equal('https:');
      expect(anchor.hostname).to.not.equal('www.google.com');
    });

    it('succeeds if it is not a string', () => {
      const url = 12345;
      const anchor = GaaMetering.getAnchorFromUrl(url);
      expect(anchor.protocol).to.not.equal('https:');
      expect(anchor.hostname).to.not.equal('www.google.com');
    });
  });

  describe('getProductIDFromPageConfig_', () => {
    it('gets the publisher ID from object page config', () => {
      expect(GaaMetering.getProductIDFromPageConfig_()).to.equal(PRODUCT_ID);
    });

    it('gets the publisher ID from array page config', () => {
      self.document.head.innerHTML = `
        <script type="application/ld+json">
          [${ARTICLE_LD_JSON_METADATA}]
        </script>
      `;

      expect(GaaMetering.getProductIDFromPageConfig_()).to.equal(PRODUCT_ID);
    });

    it('gets publisher ID from microdata', () => {
      // Remove JSON-LD
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA;
      expect(GaaMetering.getProductIDFromPageConfig_()).to.equal(PRODUCT_ID);
    });

    it('throws if article metadata lacks a publisher id', () => {
      // Remove JSON-LD
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());
      // Remove microdata
      microdata.innerHTML = '';

      const meteringError = () => GaaMetering.getProductIDFromPageConfig_();
      expect(meteringError).throws(
        'Showcase articles must define a publisher ID with either JSON-LD or Microdata.'
      );
    });
  });

  describe('isArticleFreeFromPageConfig_', () => {
    it('gets isAccessibleForFree from object page config', () => {
      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.false;
    });

    it('gets isAccessibleForFree from array page config', () => {
      location.hash = `#swg.debug=1`;

      // Remove JSON-LD
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      self.document.head.innerHTML = `
        <script type="application/ld+json">
          [${ARTICLE_LD_JSON_METADATA}]
        </script>
      `;

      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.false;
    });

    it('gets isAccessibleForFree (true) from array page config', () => {
      // Remove JSON-LD
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      self.document.head.innerHTML = `
        <script type="application/ld+json">
          [${ARTICLE_LD_JSON_METADATA_FREE_ARTICLE}]
        </script>
      `;

      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.true;
    });

    it('gets isAccessibleForFree from microdata false', () => {
      // Remove JSON-LD
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA;
      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.false;
    });

    it('gets isAccessibleForFree from microdata', () => {
      // Remove JSON-LD
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA_TRUE;
      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.true;
    });

    it('if article metadata lacks a isAccessibleForFree value', () => {
      // Remove JSON-LD
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());
      // Remove microdata
      microdata.innerHTML = '';

      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.false;
    });
  });

  describe('newUserStateToUserState', () => {
    it('succeeds for valid new userState', () => {
      location.hash = `#swg.debug=1`;

      GaaMetering.newUserStateToUserState({
        userState: {
          id: 'user1235',
          registrationTimestamp: 1602763054,
          subscriptionTimestamp: 1602763094,
          granted: false,
        },
      });

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'New userState successfully converted to userState.'
      );
    });
  });

  describe('validateUserState', () => {
    it('fails for missing userState', () => {
      expect(GaaMetering.validateUserState()).to.be.false;
    });

    it('succeeds for valid userState', () => {
      location.hash = `#swg.debug=1`;

      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          registrationTimestamp: 1602763054,
          subscriptionTimestamp: 1602763094,
          granted: true,
          grantReason: 'SUBSCRIBER',
        })
      ).to.be.true;
    });

    it('fails with a warning in debug mode for missing or invalid userState.granted', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          registrationTimestamp: 1602763054,
          subscriptionTimestamp: 1602763094,
          grantReason: 'SUBSCRIBER',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState.granted is missing or invalid (must be true or false)'
      );
    });

    it('fails with a warning in debug mode for missing registrationTimestamp', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          subscriptionTimestamp: 1602763094,
          granted: true,
          grantReason: 'SUBSCRIBER',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'Missing user ID or registrationTimestamp in userState object'
      );
    });

    it('fails with a warning in debug mode for invalid params', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          registrationTimestamp: 1602763054,
          subscriptionTimestamp: 1602763094,
          granted: true,
          grantReason: 'WRONG VALUE',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'if userState.granted is true then userState.grantReason has to be either METERING, or SUBSCRIBER'
      );
    });

    it('fails with a warning in debug mode for invalid registrationTimestamp', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          registrationTimestamp: '1602763054a',
          subscriptionTimestamp: 1602763094,
          granted: true,
          grantReason: 'SUBSCRIBER',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState.registrationTimestamp invalid, userState.registrationTimestamp needs to be an integer and in seconds'
      );
    });

    it('fails with a warning in debug mode for registrationTimestamp in the future', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          registrationTimestamp: new Date().getTime() + 100000000,
          subscriptionTimestamp: 1602763094,
          granted: true,
          grantReason: 'SUBSCRIBER',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState.registrationTimestamp is in the future'
      );
    });

    it('fails with a warning in debug mode for missing subscriptionTimestamp for subscriber', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          registrationTimestamp: 1602763054,
          granted: true,
          grantReason: 'SUBSCRIBER',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'subscriptionTimestamp is required if userState.grantReason is SUBSCRIBER'
      );
    });

    it('fails with a warning in debug mode for invalid subscriptionTimestamp', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          registrationTimestamp: 1602763054,
          subscriptionTimestamp: '1602763094a',
          granted: true,
          grantReason: 'SUBSCRIBER',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState.subscriptionTimestamp invalid, userState.subscriptionTimestamp needs to be an integer and in seconds'
      );
    });

    it('fails with a warning in debug mode for subscriptionTimestamp in the future', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user1235',
          registrationTimestamp: 1602763054,
          subscriptionTimestamp: new Date().getTime() + 100000000,
          granted: true,
          grantReason: 'SUBSCRIBER',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState.subscriptionTimestamp is in the future'
      );
    });
  });

  describe('setGaaUser', () => {
    it('GaaMetering.gaaUser equal to input', () => {
      GaaMetering.setGaaUser('setting gaaUser test');

      expect(GaaMetering.gaaUser).to.equal('setting gaaUser test');
    });
  });

  describe('getGaaUser', () => {
    it('GaaMetering.getGaaUser returning GaaMetering.gaaUser', () => {
      GaaMetering.gaaUser = 'test gaaUser';

      expect(GaaMetering.getGaaUser()).to.equal('test gaaUser');
    });
  });

  describe('isGaa', () => {
    it('fails when gaa parameters are not present in URL', () => {
      expect(GaaMetering.isGaa()).to.be.false;
    });

    it('fails when the referer is not Google or the publisher', () => {
      self.document.referrer = 'https://badreferrer.com';
      expect(GaaMetering.isGaa()).to.be.false;
    });

    it('fails with a warning in debug mode for an invalid referrer', () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      location.hash = `#swg.debug=1`;
      const badReferrer = 'https://www.badreferrer.com';
      self.document.referrer = badReferrer;
      expect(GaaMetering.isGaa()).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        `This page's referrer ("${badReferrer}") can't grant Google Article Access.`
      );
    });

    it('succeeds when the gaa parameters are present and the referer is Google', () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      expect(GaaMetering.isGaa()).to.be.true;
    });

    it("succeeds when the gaa parameters are present and the referer is in partner's list", () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.examplenews.com';
      expect(GaaMetering.isGaa(['www.examplenews.com'])).to.be.true;
    });
  });

  describe('init', () => {
    it('fails with a warning in debug mode for invalid params', () => {
      location.hash = `#swg.debug=1`;
      expect(GaaMetering.init({})).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        '[gaa.js:GaaMetering.init]: Invalid params.'
      );
    });

    it('GaaMetering.init fails the isGaa', () => {
      GaaMetering.init({
        params: {
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: true,
            grantReason: 'SUBSCRIBER',
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        },
      });
      expect(self.console.log).to.have.been.calledWith(
        '[Subscriptions]',
        'Extended Access - Invalid gaa parameters or referrer.'
      );
    });

    it('succeeds for a subscriber', () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';

      expect(
        GaaMetering.init({
          params: {
            googleSignInClientId: GOOGLE_API_CLIENT_ID,
            allowedReferrers: [
              'example.com',
              'test.com',
              'localhost',
              'google.com',
            ],
            userState: {
              id: 'user1235',
              registrationTimestamp: 1602763054,
              subscriptionTimestamp: 1602763094,
              granted: true,
              grantReason: 'SUBSCRIBER',
            },
            unlockArticle: function () {},
            showPaywall: function () {},
            handleLogin: function () {},
            handleSwGEntitlement: function () {},
            registerUserPromise: new Promise(() => {}),
            handleLoginPromise: new Promise(() => {}),
            publisherEntitlementPromise: new Promise(() => {}),
          },
        })
      );

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'unlocked for subscriber'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: 'EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION',
        isUserRegistered: true,
      });
    });

    it('succeeds for metering', () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;

      GaaMetering.init({
        params: {
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            granted: true,
            grantReason: 'METERING',
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        },
      });

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'unlocked for metering'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: 'EVENT_SHOWCASE_UNLOCKED_BY_METER',
        isUserRegistered: true,
      });
    });

    it('succeeds for free', () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;

      GaaMetering.init({
        params: {
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: [
            'example.com',
            'test.com',
            'localhost',
            'google.com',
          ],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            granted: true,
            grantReason: 'FREE',
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        },
      });

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'unlocked for free'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: 'EVENT_SHOWCASE_UNLOCKED_FREE_PAGE',
        isUserRegistered: true,
      });
    });

    it('fails for invalid userState', () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;

      GaaMetering.init({
        params: {
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: [
            'example.com',
            'test.com',
            'localhost',
            'google.com',
          ],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            granted: true,
            grantReason: 'TEST REASON',
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        },
      });

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'invalid userState object'
      );
    });

    it('succeeds for free from markup', () => {
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA_FREE_ARTICLE}]
      </script>
      `;

      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      GaaMetering.init({
        params: {
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: [
            'example.com',
            'test.com',
            'localhost',
            'google.com',
          ],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        },
      });

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'Article free from markup.'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: 'EVENT_SHOWCASE_UNLOCKED_FREE_PAGE',
        isUserRegistered: true,
      });
    });

    it('has showcaseEntitlements', () => {
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA}]
      </script>
      `;

      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      GaaMetering.init({
        params: {
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: [
            'example.com',
            'test.com',
            'localhost',
            'google.com',
          ],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
          },
          showcaseEntitlement: 'test showcaseEntitlement',
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        },
      });

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'test showcaseEntitlement'
      );

      expect(subscriptionsMock.consumeShowcaseEntitlementJwt).to.calledWith(
        'test showcaseEntitlement'
      );
    });

    it('has publisherEntitlements', async () => {
      location.hash = `#swg.debug=1`;
      self.document.referrer = 'https://www.google.com';

      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );

      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA}]
      </script>
      `;

      GaaMetering.init({
        params: {
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: [
            'example.com',
            'test.com',
            'localhost',
            'google.com',
          ],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise((resolve) => {
            const publisherEntitlement = {
              granted: true,
              grantReason: 'METERING',
            };
            resolve(publisherEntitlement);
          }),
        },
      });

      await tick();

      expect(self.console.log).to.calledWith(
        '[Subscriptions]', 'resolving publisherEntitlement'
      );
    });

    it('has invalid publisherEntitlements', async () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;

      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA}]
      </script>
      `;

      GaaMetering.init({
        params: {
          googleSignInClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: [
            'example.com',
            'test.com',
            'localhost',
            'google.com',
          ],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise((resolve) => {
            const publisherEntitlement = {
              granted: true,
              grantReason: 'TEST REASON',
            };
            resolve(publisherEntitlement);
          }),
        },
      });

      await tick();

      expect(self.console.log).to.calledWith(
        '[Subscriptions]', 
        'if userState.granted is true then userState.grantReason has to be either METERING, or SUBSCRIBER'
      );

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        "Publisher entitlement isn't valid"
      );
    });
  });

  describe('isUserRegistered', () => {
    it('returns true for a registered user', () => {
      const userState = {
        id: 'user1235',
        registrationTimestamp: 1602763054,
        subscriptionTimestamp: 1602763094,
      };
      expect(GaaMetering.isUserRegistered(userState)).to.be.true;
    });

    it('returns false for an anonymous user', () => {
      expect(GaaMetering.isUserRegistered({})).to.be.false;
    });
  });

  describe('isArticleFreeFromJsonLdPageConfig_', () => {
    it('returns true for a JSON isAccessibleFree true', () => {
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA_FREE_ARTICLE}]
      </script>
      `;

      expect(GaaMetering.isArticleFreeFromJsonLdPageConfig_()).to.be.true;
    });

    it('returns false for a JSON isAccessibleFree null', () => {
      self.document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((e) => e.remove());

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA_NULL}]
      </script>
      `;

      expect(GaaMetering.isArticleFreeFromJsonLdPageConfig_()).to.be.false;
    });
  });
});
