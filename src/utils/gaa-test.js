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
  queryStringHasFreshGaaParams,
} from './gaa';
import {I18N_STRINGS} from '../i18n/strings';
import {JwtHelper} from './jwt';
import {tick} from '../../test/tick';

const PUBLISHER_NAME = 'The Scenic';
const PRODUCT_ID = 'scenic-2017.appspot.com:news';
const IFRAME_URL = 'https://localhost/gsi-iframe';
const GOOGLE_3P_AUTH_URL = 'https://fabulous-3p-authserver.glitch.me/auth';
const CASL_URL = 'https://example-casl.com';
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

const SIGN_IN_WITH_GOOGLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJuYmYiOjE2MTgwMzM5ODg3NCwiYXVkIjoiMzE0MTU5MjY1LXBpLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMzE0MTU5MjY1MzU4OTc5MzIzOCIsImhkIjoiZ21haWwuY29tIiwiZW1haWwiOiJlbGlzYS5nLmJlY2tldHRAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImF6cCI6IjMxNDE1OTI2NS1waS5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsIm5hbWUiOiJFbGlzYSBCZWNrZXR0IiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hLS9lMjcxODI4MTgyODQ1OTA0NTIzNTM2MHVsZXIiLCJnaXZlbl9uYW1lIjoiRWxpc2EiLCJmYW1pbHlfbmFtZSI6IkJlY2tldHQiLCJpYXQiOjE1OTY0NzQwMDAsImV4cCI6MTU5NjQ3NzYwMCwianRpIjoiYWJjMTYxODAzMzk4ODc0ZGVmIn0.B2WPwt9X22Ql6EOLSolL3lkNkxPm-YLgzGyutnW7FRs';

const SIGN_IN_WITH_GOOGLE_DECODED_JWT = {
  credential: {
    /* eslint-disable google-camelcase/google-camelcase */
    payload: {
      iss: 'https://accounts.google.com', // The JWT's issuer
      nbf: 161803398874,
      aud: GOOGLE_API_CLIENT_ID, // Your server's client ID
      sub: '3141592653589793238', // The unique ID of the user's Google Account
      hd: 'gmail.com', // If present, the host domain of the user's GSuite email address
      email: 'elisa.g.beckett@gmail.com', // The user's email address
      email_verified: true, // true, if Google has verified the email address
      azp: GOOGLE_API_CLIENT_ID,
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
  let renderSpy;

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

    // Mock window opener
    sandbox.stub(self, 'open');

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

  describe('render_', () => {
    it('shows regwall with publisher name', () => {
      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('does not render CASL blurb by default', () => {
      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});

      const caslEl = self.document.querySelector('.gaa-metering-regwall--casl');
      expect(caslEl).to.be.null;
    });

    it('optionally renders CASL blurb', () => {
      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL, caslUrl: CASL_URL});

      const caslEl = self.document.querySelector('.gaa-metering-regwall--casl');
      expect(caslEl.textContent).contains("Review The Scenic's CASL terms");

      const caslLinkEl = caslEl.querySelector('a');
      expect(caslLinkEl.href).contains(CASL_URL);
    });

    it('focuses on modal title after the animation completes', () => {
      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});

      // Mock animation ending.
      const dialogEl = self.document.getElementById(REGWALL_DIALOG_ID);
      dialogEl.dispatchEvent(new Event('animationend'));

      const titleEl = self.document.getElementById(REGWALL_TITLE_ID);
      expect(self.document.activeElement).to.equal(titleEl);
    });

    it('parses publisher name from microdata', () => {
      // Remove JSON-LD.
      script.text = '{}';

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA;

      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('throws if article metadata lacks a publisher name', () => {
      // Remove JSON-LD.
      script.text = '{}';

      const showingRegwall = () =>
        GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});

      expect(showingRegwall).throws(
        'Showcase articles must define a publisher name with either JSON-LD or Microdata.'
      );
    });

    it('renders supported i18n languages', () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});

      const titleEl = self.document.querySelector(
        '.gaa-metering-regwall--title'
      );
      expect(titleEl.textContent).to.equal(
        I18N_STRINGS.SHOWCASE_REGWALL_TITLE['pt-br']
      );
    });

    it('renders "en" for non-supported i18n languages', () => {
      self.document.documentElement.lang = 'non-supported';

      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});

      const titleEl = self.document.querySelector(
        '.gaa-metering-regwall--title'
      );
      expect(titleEl.textContent).to.equal(
        I18N_STRINGS.SHOWCASE_REGWALL_TITLE['en']
      );
    });

    it('adds "lang" URL param to iframe URL', () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});

      const iframeEl = self.document.getElementById(GOOGLE_SIGN_IN_IFRAME_ID);
      expect(iframeEl.src).to.contain('?lang=pt-br');
    });

    it('handles clicks on publisher sign in link', async () => {
      // Show Regwall.
      GaaMeteringRegwall.render_({iframeUrl: IFRAME_URL});
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
  });

  describe('show', () => {
    beforeEach(() => {
      renderSpy = sandbox.spy(GaaMeteringRegwall, 'render_');
    });

    it('passes iframeUrl to GaaMeteringRegwall.render_', () => {
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL});
      expect(renderSpy).to.have.been.calledWithExactly({
        iframeUrl: IFRAME_URL,
        caslUrl: undefined,
      });
    });

    it('optionally passes caslUrl to GaaMeteringRegwall.render_', () => {
      GaaMeteringRegwall.show({iframeUrl: IFRAME_URL, caslUrl: CASL_URL});

      expect(renderSpy).to.have.been.calledWithExactly({
        iframeUrl: IFRAME_URL,
        caslUrl: CASL_URL,
      });
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
    beforeEach(() => {
      renderSpy = sandbox.spy(GaaMeteringRegwall, 'render_');
    });

    it('calls GaaMeteringRegwall.render_ with useNativeMode: true', () => {
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
      });
      expect(renderSpy).to.have.been.calledWithExactly({
        iframeUrl: '',
        caslUrl: undefined,
        useNativeMode: true,
      });
    });

    it('optionally passes caslUrl to GaaMeteringRegwall.render_', () => {
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        caslUrl: CASL_URL,
      });
      expect(renderSpy).to.have.been.calledWithExactly({
        iframeUrl: '',
        caslUrl: CASL_URL,
        useNativeMode: true,
      });
    });

    it('resolves with a gaaUser removes Regwall from DOM on click', () => {
      const gaaUserPromise =
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
        });
      clock.tick(100);

      // Click button.
      self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID).click();

      // Simulate the click resolving
      const args = self.google.accounts.id.initialize.args;
      args[0][0].callback(SIGN_IN_WITH_GOOGLE_JWT);

      gaaUserPromise.then((gaaUser) => {
        expect(gaaUser).to.deep.equal(SIGN_IN_WITH_GOOGLE_JWT);
        expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
      });
    });

    it('resolves with a decoded jwt if rawJwt is false', async () => {
      const gaaUserPromise =
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          rawJwt: false,
        });

      // Mock JWT decoding function.
      sandbox
        .stub(JwtHelper.prototype, 'decode')
        .returns(SIGN_IN_WITH_GOOGLE_DECODED_JWT);

      // Click button.
      self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID).click();

      // Simulate the click resolving
      const args = self.google.accounts.id.initialize.args;
      args[0][0].callback(SIGN_IN_WITH_GOOGLE_JWT);

      await tick();

      expect(await gaaUserPromise).to.equal(SIGN_IN_WITH_GOOGLE_DECODED_JWT);
      expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
    });

    it('handles Sign In with Google errors', async () => {
      self.google.accounts.id.initialize = sandbox.fake.throws(
        'Function not loaded'
      );

      const gaaUserPromise =
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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

    it('logs analytics events on button click', async () => {
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
      });

      // Click button.
      self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID).click();

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
        {
          analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_SWIG_CLICK,
          isFromUserAction: true,
        },
      ]);
    });
  });

  describe('showWithNative3PRegistrationButton', () => {
    let createNative3PRegistrationButtonSpy;
    beforeEach(() => {
      renderSpy = sandbox.spy(GaaMeteringRegwall, 'render_');
      createNative3PRegistrationButtonSpy = sandbox.spy(
        GaaMeteringRegwall,
        'createNative3PRegistrationButton'
      );
    });

    it('creates a 3P button when authorizationUrl is provided', () => {
      GaaMeteringRegwall.showWithNative3PRegistrationButton({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });

      expect(
        createNative3PRegistrationButtonSpy
      ).to.have.been.calledWithExactly({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });
    });

    it('calls GaaMeteringRegwall.render_ with useNativeMode: true', () => {
      GaaMeteringRegwall.showWithNative3PRegistrationButton({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });
      expect(renderSpy).to.have.been.calledWithExactly({
        iframeUrl: '',
        caslUrl: undefined,
        useNativeMode: true,
      });
    });

    it('optionally passes caslUrl to GaaMeteringRegwall.render_', () => {
      GaaMeteringRegwall.showWithNative3PRegistrationButton({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
        caslUrl: CASL_URL,
      });
      expect(renderSpy).to.have.been.calledWithExactly({
        iframeUrl: '',
        caslUrl: CASL_URL,
        useNativeMode: true,
      });
    });

    it('logs Showcase impression events', async () => {
      GaaMeteringRegwall.showWithNativeRegistrationButton({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
          googleApiClientId: GOOGLE_API_CLIENT_ID,
        })
      ).to.be.false;
    });

    it('renders Google Sign-In button', async () => {
      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      GaaMeteringRegwall.createNativeRegistrationButton({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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

  describe('createNative3PRegistrationButton', () => {
    it('fails if regwall is not present', async () => {
      expect(
        GaaMeteringRegwall.createNative3PRegistrationButton({
          authorizationUrl: GOOGLE_3P_AUTH_URL,
        })
      ).to.be.false;
    });

    it('renders third party Google Sign-In button', async () => {
      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      GaaMeteringRegwall.createNative3PRegistrationButton({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });

      const buttonDiv = self.document.querySelector(
        '#' + GOOGLE_3P_SIGN_IN_BUTTON_ID
      );
      assert(buttonDiv);
      expect(buttonDiv.tabIndex).to.equal(0);
    });

    it('renders supported i18n languages', async () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      GaaMeteringRegwall.createNative3PRegistrationButton({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['pt-br']
      );
    });

    it('renders English by default, if "lang" URL param is missing', async () => {
      self.document.documentElement.lang = 'non-supported';

      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      GaaMeteringRegwall.createNative3PRegistrationButton({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['en']
      );
    });

    it('should open an authorizationUrl in the same window on click', async () => {
      // Show button.
      GaaMeteringRegwall.render_({useNativeMode: true});
      clock.tick(100);
      await tick(10);

      GaaMeteringRegwall.createNative3PRegistrationButton({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });

      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();
      clock.tick(100);
      await tick(10);

      expect(self.open).to.have.been.calledWithExactly(
        GOOGLE_3P_AUTH_URL,
        '_parent'
      );
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

    it('gets the publisher name from graph construct', () => {
      self.document.head.innerHTML = `
        <script type="application/ld+json">
          [{
            "@context": "http://schema.org",
            "@graph": [${ARTICLE_LD_JSON_METADATA}]
          }]
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
    for (const style of [...self.document.head.querySelectorAll('style')]) {
      style.remove();
    }

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
    for (const style of [...self.document.head.querySelectorAll('style')]) {
      style.remove();
    }

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
      const buttonEl = self.document.getElementById(
        SIGN_IN_WITH_GOOGLE_BUTTON_ID
      );

      expect(argsRender).to.deep.equal([
        [
          buttonEl,
          {
            'type': 'standard',
            'theme': 'outline',
            'text': 'continue_with',
            'logo_alignment': 'center',
            'width': buttonEl.offsetWidth,
            'height': buttonEl.offsetHeight,
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
      // Mock encrypted GIS response with JWT object.
      const jwtRaw = {
        credential: {
          payload:
            'eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJuYmYiOjE2NDE5OTU5MzgsImF1ZCI6IjQ3MzExNjQ0Mzk1OC12ajkwaDJrbW92cm9zZXUydWhrdnVxNGNjZ3ZldW43My5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInN1YiI6IjExNzE5ODI3Njk2NjYyOTcxNjg0MSIsImhkIjoiZ29vZ2xlLmNvbSIsImVtYWlsIjoiZWRiaXJkQGdvb2dsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiYXpwIjoiNDczMTE2NDQzOTU4LXZqOTBoMmttb3Zyb3NldTJ1aGt2dXE0Y2NndmV1bjczLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiaWF0IjoxNjQxOTk2MjM4LCJleHAiOjE2NDE5OTk4MzgsImp0aSI6IjA4MGQ3Y2FiNzAyZDEyYWU1MzJjYzc3YTExNDk3NGI4OThjNmFjNTYifQ',
        },
      };

      // Mock decrypted GIS response with JWT object.
      const jwtDecoded = {
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

      // Mock JWT decoding function.
      sandbox.stub(JwtHelper.prototype, 'decode').callsFake((unused) => {
        return jwtDecoded.credential;
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
      args[0][0].callback(jwtRaw);

      // Wait for post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_USER,
          jwtPayload: jwtDecoded.credential,
          returnedJwt: jwtDecoded.credential,
          stamp: POST_MESSAGE_STAMP,
        },
        location.origin
      );
    });

    it('sends post message with GAA user while requesting raw JWT', async () => {
      // Mock encrypted GIS response with JWT object.
      const jwtRaw = {
        credential: {
          payload:
            'eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJuYmYiOjE2NDE5OTU5MzgsImF1ZCI6IjQ3MzExNjQ0Mzk1OC12ajkwaDJrbW92cm9zZXUydWhrdnVxNGNjZ3ZldW43My5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInN1YiI6IjExNzE5ODI3Njk2NjYyOTcxNjg0MSIsImhkIjoiZ29vZ2xlLmNvbSIsImVtYWlsIjoiZWRiaXJkQGdvb2dsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiYXpwIjoiNDczMTE2NDQzOTU4LXZqOTBoMmttb3Zyb3NldTJ1aGt2dXE0Y2NndmV1bjczLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiaWF0IjoxNjQxOTk2MjM4LCJleHAiOjE2NDE5OTk4MzgsImp0aSI6IjA4MGQ3Y2FiNzAyZDEyYWU1MzJjYzc3YTExNDk3NGI4OThjNmFjNTYifQ',
        },
      };

      // Mock decrypted GIS response with JWT object.
      const jwtDecoded = {
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

      // Mock JWT decoding function.
      sandbox.stub(JwtHelper.prototype, 'decode').callsFake((unused) => {
        return jwtDecoded.credential;
      });

      GaaSignInWithGoogleButton.show({
        clientId,
        allowedOrigins,
        rawJwt: true,
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
      args[0][0].callback(jwtRaw);

      // Wait for post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_USER,
          jwtPayload: jwtDecoded.credential,
          returnedJwt: jwtRaw,
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
    for (const style of [...self.document.head.querySelectorAll('style')]) {
      style.remove();
    }

    self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).remove();
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
      GaaGoogle3pSignInButton.show({
        allowedOrigins,
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });
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

    it('should open an authorizationUrl in a new window by default', async () => {
      // Show button.
      GaaGoogle3pSignInButton.show({
        allowedOrigins,
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });
      clock.tick(100);
      await tick(10);
      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();
      clock.tick(100);
      await tick(10);
      expect(self.open).to.have.been.calledWithExactly(GOOGLE_3P_AUTH_URL);
    });

    it('should open an authorizationUrl in the same window when redirectMode is true', async () => {
      // Show button.
      GaaGoogle3pSignInButton.show({
        allowedOrigins,
        authorizationUrl: GOOGLE_3P_AUTH_URL,
        redirectMode: true,
      });
      clock.tick(100);
      await tick(10);
      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();
      clock.tick(100);
      await tick(10);

      expect(self.open).to.have.been.calledWithExactly(
        GOOGLE_3P_AUTH_URL,
        '_parent'
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

  describe('gaaNotifySignIn', () => {
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
      GaaGoogle3pSignInButton.gaaNotifySignIn({gaaUser});

      expect(self.postMessage).to.have.been.calledWithExactly({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_USER,
        gaaUser,
      });
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
      getEntitlements: sandbox.fake(),
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
    GaaMeteringRegwall.remove();
    self.document.head.querySelectorAll('style').forEach((e) => {
      e.remove();
    });

    self.document.referrer = currentReferrer;
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

  describe('constructor', () => {
    it('sets class variable', () => {
      const gaaMeteringInstance = new GaaMetering();

      expect(typeof gaaMeteringInstance.userState).to.equal('object');

      expect(typeof gaaMeteringInstance.gaaUserPromiseResolve_).to.equal(
        'function'
      );
    });
  });

  describe('validateParameters', () => {
    beforeEach(() => {
      location.hash = `#swg.debug=1`;
    });

    it('succeeds for valid params', () => {
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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

    it('succeeds for valid params with authorizationUrl', () => {
      expect(
        GaaMetering.validateParameters({
          authorizationUrl: GOOGLE_3P_AUTH_URL,
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
      ).to.be.true;
    });

    it('fails for invalid googleApiClientId', () => {
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: '520465458218-e9vp957krfk2r0i4ejeh6aklqm7c25p4',
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
        'Missing googleApiClientId, or it is not a string, or it is not in a correct format'
      );
    });

    it('fails for invalid authorizationUrl', () => {
      expect(
        GaaMetering.validateParameters({
          authorizationUrl: 'login.html',
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
        'authorizationUrl is not a valid URL'
      );
    });

    it('fails if googleApiClientId and authorizationUrl are provided', () => {
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          authorizationUrl: GOOGLE_3P_AUTH_URL,
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
        'Either googleApiClientId or authorizationUrl should be supplied but not both.'
      );
    });

    it('fails if neither googleApiClientId and authorizationUrl are provided', () => {
      expect(
        GaaMetering.validateParameters({
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
        'Either googleApiClientId or authorizationUrl should be supplied but not both.'
      );
    });

    it('fails for invalid allowedReferrers', () => {
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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

    it('fails for missing userState or publisherEntitlementsPromise', () => {
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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

    it('fails for an invalid publisherEntitlementsPromise', () => {
      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
          publisherEntitlementPromise: function () {},
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'publisherEntitlementPromise is provided but it is not a promise'
      );
    });

    it('succeeds for free articles where granted is true but grantedReason is not required', () => {
      sandbox.stub(GaaMetering, 'isArticleFreeFromPageConfig_');
      GaaMetering.isArticleFreeFromPageConfig_.returns(true);

      expect(
        GaaMetering.validateParameters({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            granted: true,
          },
          unlockArticle: function () {},
          showPaywall: function () {},
          handleLogin: function () {},
          handleSwGEntitlement: function () {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
        })
      ).to.be.true;
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

      const newUserState = GaaMetering.newUserStateToUserState({
        id: 'user1235',
        registrationTimestamp: 1602763054,
        subscriptionTimestamp: 1602763094,
        granted: false,
      });

      expect(newUserState.metering.state.id).to.equal('user1235');
      expect(
        newUserState.metering.state.standardAttributes.registered_user.timestamp
      ).to.equal(1602763054);
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

    it('fails if userstate does not have id but has registrationTimestamp', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          registrationTimestamp: 1602763054,
          granted: false,
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'Missing user ID in userState object'
      );
    });

    it('fails if userstate does not have registrationTimestamp but has id', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          id: 'user12345',
          granted: false,
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'Missing registrationTimestamp in userState object'
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

  describe('getGaaUserPromise', () => {
    beforeEach(() => {
      GaaMetering.gaaUserPromiseResolve_ = undefined;
    });
    it('sets up the promise to return the gaaUser', () => {
      GaaMetering.getGaaUserPromise().then((gaaUser) => {
        expect(gaaUser).to.equal('test gaaUser');
      });
      GaaMetering.setGaaUser('test gaaUser');
    });
  });

  describe('getLoginPromise', () => {
    beforeEach(() => {
      GaaMetering.loginPromiseResolve_ = undefined;
    });
    it('sets up the promise', () => {
      GaaMetering.getLoginPromise().then(() => {
        expect(GaaMetering.loginPromiseResolve_).to.have.been.called();
      });
      GaaMetering.resolveLogin();
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
      expect(logEvent).not.to.have.been.called;
    });

    it('GaaMetering.init fails the isGaa', () => {
      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      });
      expect(self.console.log).to.have.been.calledWith(
        '[Subscriptions]',
        'Extended Access - Invalid gaa parameters or referrer.'
      );
      expect(logEvent).not.to.have.been.called;
    });

    it('succeeds for a subscriber', async () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';

      expect(
        GaaMetering.init({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
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
        })
      );

      await tick();

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'unlocked for SUBSCRIBER'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: 'EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION',
        isUserRegistered: true,
      });

      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.EVENT_SHOWCASE_METERING_INIT,
          isFromUserAction: false,
        },
      ]);
    });

    it('succeeds for metering', async () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;

      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      });

      await tick();

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'unlocked for METERING'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: 'EVENT_SHOWCASE_UNLOCKED_BY_METER',
        isUserRegistered: true,
      });

      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.EVENT_SHOWCASE_METERING_INIT,
          isFromUserAction: false,
        },
      ]);
    });

    it('succeeds for free', async () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;

      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
        handleSwGEntitlement: function () {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise(() => {}),
      });

      await tick();

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'unlocked for FREE'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: 'EVENT_SHOWCASE_UNLOCKED_FREE_PAGE',
        isUserRegistered: true,
      });

      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.EVENT_SHOWCASE_METERING_INIT,
          isFromUserAction: false,
        },
      ]);
    });

    it('fails for invalid userState', () => {
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;

      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      });

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'Invalid userState object'
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
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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
      });

      await tick();

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'resolving publisherEntitlement'
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
        googleApiClientId: GOOGLE_API_CLIENT_ID,
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

  describe('checkShowcaseEntitlement', () => {
    beforeEach(() => {
      sandbox
        .stub(GaaMetering, 'getOnReadyPromise')
        .returns(new Promise((resolve) => resolve()));
      GaaUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;
    });

    afterEach(() => {
      GaaMetering.getOnReadyPromise.reset();
    });

    it('checkShowcaseEntitlement for registered users', async () => {
      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        allowedReferrers: ['example.com', 'test.com', 'localhost'],
        userState: {
          id: 'user1235',
          registrationTimestamp: 1602763054,
          granted: false,
        },
        unlockArticle: function () {},
        showPaywall: function () {},
        handleSwGEntitlement: function () {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          const publisherEntitlement = {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            granted: false,
          };
          resolve(publisherEntitlement);
        }),
      });

      await tick();

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'getting entitlements from Google'
      );

      expect(subscriptionsMock.getEntitlements).to.calledOnce;
    });

    it('shows GoogleRegwall', async () => {
      const showWithNativeRegistrationButtonSpy = sandbox.spy(
        GaaMeteringRegwall,
        'showWithNativeRegistrationButton'
      );

      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        allowedReferrers: [
          'example.com',
          'test.com',
          'localhost',
          'google.com',
        ],
        userState: {
          granted: false,
        },
        unlockArticle: function () {},
        showPaywall: function () {},
        handleLogin: function () {},
        handleSwGEntitlement: function () {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();

      GaaMetering.getOnReadyPromise().then(() => {
        expect(showWithNativeRegistrationButtonSpy).to.be.calledWith({
          caslUrl: undefined,
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          rawJwt: undefined,
        });
      });
    });

    it('shows GoogleRegwall with optional caslUrl', async () => {
      const showWithNativeRegistrationButtonSpy = sandbox.spy(
        GaaMeteringRegwall,
        'showWithNativeRegistrationButton'
      );

      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        caslUrl: CASL_URL,
        allowedReferrers: [
          'example.com',
          'test.com',
          'localhost',
          'google.com',
        ],
        userState: {
          granted: false,
        },
        unlockArticle: function () {},
        showPaywall: function () {},
        handleLogin: function () {},
        handleSwGEntitlement: function () {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();

      GaaMetering.getOnReadyPromise().then(() => {
        expect(showWithNativeRegistrationButtonSpy).to.be.calledWith({
          caslUrl: CASL_URL,
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          rawJwt: undefined,
        });
      });
    });

    it('shows GoogleRegwall with optional rawJwt', async () => {
      const showWithNativeRegistrationButtonSpy = sandbox.spy(
        GaaMeteringRegwall,
        'showWithNativeRegistrationButton'
      );

      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        rawJwt: false,
        allowedReferrers: [
          'example.com',
          'test.com',
          'localhost',
          'google.com',
        ],
        userState: {
          granted: false,
        },
        unlockArticle: function () {},
        showPaywall: function () {},
        handleLogin: function () {},
        handleSwGEntitlement: function () {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();

      GaaMetering.getOnReadyPromise().then(() => {
        expect(showWithNativeRegistrationButtonSpy).to.be.calledWith({
          caslUrl: undefined,
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          rawJwt: false,
        });
      });
    });

    it('showGoogleRegwall - registerUserPromise', async () => {
      const setGaaUserSpy = sandbox.spy(GaaMetering, 'setGaaUser');
      const returnedUserState = {
        id: SIGN_IN_WITH_GOOGLE_DECODED_JWT.credential.payload.email,
        registrationTimestamp: Date.now() / 1000,
        granted: false,
      };
      const validateUserStateSpy = sandbox.spy(
        GaaMetering,
        'validateUserState'
      );
      const registerUserPromise = new Promise((resolve) => {
        GaaMetering.getGaaUserPromise().then(() => {
          resolve(returnedUserState);
        });
      });

      // Mock showWithNativeRegistrationButton to return jwt
      const showWithNativeRegistrationButtonPromise = new Promise((resolve) => {
        resolve(SIGN_IN_WITH_GOOGLE_JWT);
      });
      sandbox
        .stub(GaaMeteringRegwall, 'showWithNativeRegistrationButton')
        .returns(showWithNativeRegistrationButtonPromise);

      GaaMetering.init({
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        allowedReferrers: ['example.com', 'test.com', 'localhost'],
        userState: {
          granted: false,
        },
        unlockArticle: function () {},
        showPaywall: function () {},
        handleSwGEntitlement: function () {},
        registerUserPromise,
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();
      await GaaMetering.getOnReadyPromise();
      await showWithNativeRegistrationButtonPromise;
      expect(setGaaUserSpy).to.have.been.calledWith(SIGN_IN_WITH_GOOGLE_JWT);

      await registerUserPromise;
      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'registerUserPromise resolved'
      );
      expect(validateUserStateSpy).to.be.calledWithExactly(returnedUserState);
    });

    it('shows GoogleRegwall with 3P button when authorizationUrl is supplied', async () => {
      const showWithNative3PRegistrationButtonSpy = sandbox.spy(
        GaaMeteringRegwall,
        'showWithNative3PRegistrationButton'
      );

      GaaMetering.init({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
        allowedReferrers: [
          'example.com',
          'test.com',
          'localhost',
          'google.com',
        ],
        userState: {
          granted: false,
        },
        unlockArticle: function () {},
        showPaywall: function () {},
        handleLogin: function () {},
        handleSwGEntitlement: function () {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();

      GaaMetering.getOnReadyPromise().then(() => {
        expect(showWithNative3PRegistrationButtonSpy).to.calledWith({
          caslUrl: undefined,
          authorizationUrl: GOOGLE_3P_AUTH_URL,
        });
      });
    });

    it('shows GoogleRegwall with 3P button with optional caslUrl', async () => {
      const showWithNative3PRegistrationButtonSpy = sandbox.spy(
        GaaMeteringRegwall,
        'showWithNative3PRegistrationButton'
      );

      GaaMetering.init({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
        caslUrl: CASL_URL,
        allowedReferrers: [
          'example.com',
          'test.com',
          'localhost',
          'google.com',
        ],
        userState: {
          granted: false,
        },
        unlockArticle: function () {},
        showPaywall: function () {},
        handleLogin: function () {},
        handleSwGEntitlement: function () {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick(10);

      GaaMetering.getOnReadyPromise().then(() => {
        expect(showWithNative3PRegistrationButtonSpy).to.calledWith({
          caslUrl: CASL_URL,
          authorizationUrl: GOOGLE_3P_AUTH_URL,
        });
      });
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

  describe('handleLoginRequest', () => {
    beforeEach(() => {
      GaaMetering.loginPromiseResolve_ = undefined;
    });

    it('resolves the loginPromise', () => {
      const unlockArticleIfGranted = function () {};
      const handleLoginPromise = new Promise(() => {
        GaaMetering.getLoginPromise().then(() => {
          expect(GaaMetering.resolveLogin).to.have.been.called;
        });
      });
      GaaMetering.handleLoginRequest(
        handleLoginPromise,
        unlockArticleIfGranted
      );
    });

    it('calls unlockArticleIfGranted if handleLoginUserState is valid', async () => {
      const unlockArticleIfGranted = sandbox.fake();
      const handleLoginPromise = new Promise((resolve) => {
        GaaMetering.getLoginPromise().then(() => {
          const handleLoginUserState = {
            id: 12345,
            registrationTimestamp: Date.now() / 1000,
            granted: false,
          };
          resolve(handleLoginUserState);
        });
      });
      GaaMetering.handleLoginRequest(
        handleLoginPromise,
        unlockArticleIfGranted
      );
      await tick();
      await handleLoginPromise;
      expect(unlockArticleIfGranted).to.have.been.called;
      expect(self.console.log).to.have.been.calledWith(
        '[Subscriptions]',
        'GaaMeteringRegwall removed'
      );
    });

    it("doens't unlock article if handleLoginUserState is invalid", async () => {
      const unlockArticleIfGranted = sandbox.fake();
      const handleLoginPromise = new Promise((resolve) => {
        GaaMetering.getLoginPromise().then(() => {
          const userStateInvalid = {
            id: 12345,
          };
          resolve(userStateInvalid);
        });
      });

      GaaMetering.handleLoginRequest(
        handleLoginPromise,
        unlockArticleIfGranted
      );
      await tick();
      await handleLoginPromise;
      expect(unlockArticleIfGranted).not.to.have.been.called;
      expect(self.console.log).to.have.been.calledWith(
        '[Subscriptions]',
        'invalid handleLoginUserState'
      );
    });
  });

  describe('setEntitlements', () => {
    const allowedReferrers = ['example.com'];
    let unlockArticle = function () {};
    let handleSwGEntitlement = function () {};
    let showGoogleRegwall = function () {};
    let showPaywall = function () {};

    it('consumes google entitlement and unlock article', async () => {
      unlockArticle = sandbox.fake();

      sandbox.stub(GaaMetering, 'isUserRegistered');
      GaaMetering.isUserRegistered.returns(true);

      const googleEntitlementsPromise = new Promise((resolve) => {
        function GoogleEntitlement() {
          this.enablesThisWithGoogleMetering = sandbox.fake.returns(true);
          this.enablesThis = sandbox.fake.returns(false);
          this.consume = sandbox.fake(() => {
            unlockArticle();
          });
        }
        resolve(new GoogleEntitlement());
      });

      GaaMetering.setEntitlements(
        googleEntitlementsPromise,
        allowedReferrers,
        unlockArticle,
        handleSwGEntitlement,
        showGoogleRegwall,
        showPaywall
      );

      await tick(10);
      expect(unlockArticle).to.be.called;
    });

    it('user is a SwG subscriber', async () => {
      handleSwGEntitlement = sandbox.fake();

      sandbox.stub(GaaMetering, 'isUserRegistered');
      GaaMetering.isUserRegistered.returns(true);

      const googleEntitlementsPromise = new Promise((resolve) => {
        function GoogleEntitlement() {
          this.enablesThisWithGoogleMetering = sandbox.fake.returns(false);
          this.enablesThis = sandbox.fake.returns(true);
          this.consume = sandbox.fake();
        }
        resolve(new GoogleEntitlement());
      });

      GaaMetering.setEntitlements(
        googleEntitlementsPromise,
        allowedReferrers,
        unlockArticle,
        handleSwGEntitlement,
        showGoogleRegwall,
        showPaywall
      );

      await tick(10);
      expect(handleSwGEntitlement).to.be.called;
    });

    it("shows regWall if user isn't registered", async () => {
      showGoogleRegwall = sandbox.fake();

      GaaMetering.userState = {};
      sandbox.stub(GaaMetering, 'isUserRegistered');
      GaaMetering.isUserRegistered.returns(false);

      sandbox.stub(GaaMetering, 'isGaa');
      GaaMetering.isGaa.returns(true);

      const googleEntitlementsPromise = new Promise((resolve) => {
        function GoogleEntitlement() {
          this.enablesThisWithGoogleMetering = sandbox.fake.returns(false);
          this.enablesThis = sandbox.fake.returns(false);
          this.consume = sandbox.fake();
        }
        resolve(new GoogleEntitlement());
      });

      GaaMetering.setEntitlements(
        googleEntitlementsPromise,
        allowedReferrers,
        unlockArticle,
        handleSwGEntitlement,
        showGoogleRegwall,
        showPaywall
      );

      await tick(10);
      expect(showGoogleRegwall).to.be.called;
    });

    it('shows the paywall and call setShowcaseEntitlement', async () => {
      showPaywall = sandbox.fake();
      GaaMetering.userState = {};

      sandbox.stub(GaaMetering, 'isUserRegistered');
      GaaMetering.isUserRegistered.returns(true);

      const googleEntitlementsPromise = new Promise((resolve) => {
        function GoogleEntitlement() {
          this.enablesThisWithGoogleMetering = sandbox.fake.returns(false);
          this.enablesThis = sandbox.fake.returns(false);
          this.consume = sandbox.fake();
        }
        resolve(new GoogleEntitlement());
      });

      GaaMetering.setEntitlements(
        googleEntitlementsPromise,
        allowedReferrers,
        unlockArticle,
        handleSwGEntitlement,
        showGoogleRegwall,
        showPaywall
      );

      await tick(10);

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: 'EVENT_SHOWCASE_NO_ENTITLEMENTS_PAYWALL',
        isUserRegistered: true,
      });

      expect(showPaywall).to.be.called;
    });
  });
  describe('getOnReadyPromise', () => {
    it('resolves when the page has aleady loaded', async () => {
      expect(self.document.readyState).to.equal('complete');
      const onReadyPromise = GaaMetering.getOnReadyPromise();
      await expect(onReadyPromise).to.be.fulfilled;
    });
    it('resolves when the load event is triggered', async () => {
      // Simulate a page that is in a loading state and then finishes loading
      // with a load event fired.
      Object.defineProperty(self.document, 'readyState', {
        get() {
          return 'loading';
        },
      });
      const onReadyPromise = GaaMetering.getOnReadyPromise();
      setTimeout(() => {
        self.window.dispatchEvent(new Event('load'));
      }, 500);
      await expect(onReadyPromise).to.be.fulfilled;
    });
  });
});
