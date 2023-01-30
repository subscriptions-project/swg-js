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

import {AnalyticsEvent} from '../../proto/api_messages';
import {
  GOOGLE_3P_SIGN_IN_BUTTON_ID,
  GOOGLE_SIGN_IN_IFRAME_ID,
  REGWALL_CONTAINER_ID,
  REGWALL_DIALOG_ID,
  REGWALL_TITLE_ID,
  SIGN_IN_WITH_GOOGLE_BUTTON_ID,
} from './html-templates';
import {GaaMeteringRegwall} from './';
import {I18N_STRINGS} from '../../i18n/strings';
import {JwtHelper} from '../../utils/jwt';
import {
  POST_MESSAGE_COMMAND_3P_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_GSI_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
} from './constants';
import {QueryStringUtils} from './utils';
import {ShowcaseEvent as ShowcaseEventDef} from '../../api/subscriptions';
import {tick} from '../../../test/tick';

const PUBLISHER_NAME = 'The Scenic';
const PRODUCT_ID = 'scenic-2017.appspot.com:news';
const GSI_IFRAME_URL = 'https://localhost/gsi-iframe';
const SIWG_IFRAME_URL = 'https://localhost/gis-iframe';
const GOOGLE_3P_AUTH_URL = 'https://fabulous-3p-authserver.glitch.me/auth';
const CASL_URL = 'https://example-casl.com';
const GOOGLE_API_CLIENT_ID = 'test123.apps.googleusercontent.com';

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

describes.realWin('GaaMeteringRegwall', () => {
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
    sandbox.stub(QueryStringUtils, 'getQueryString');
    QueryStringUtils.getQueryString.returns(
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
    // Remove JSON-LD and Microdata elements.
    const elements = [
      ...self.document.head.querySelectorAll(
        'div[itemscope], script[type="application/ld+json"]'
      ),
    ];
    for (const element of elements) {
      element.remove();
    }

    // Remove SIWG button, if it exists.
    const buttonEl = self.document.getElementById(
      SIGN_IN_WITH_GOOGLE_BUTTON_ID
    );
    if (buttonEl) {
      buttonEl.remove();
    }

    // Remove regwall.
    GaaMeteringRegwall.remove();

    // Reset language.
    self.document.documentElement.lang = '';

    // Remove the injected style from GaaMeteringRegwall.createNativeRegistrationButton.
    const styles = [...self.document.head.querySelectorAll('style')];
    for (const style of styles) {
      style.remove();
    }

    self.console.warn.restore();
    self.console.log.restore();
  });

  /**
   * Expects a list of Analytics events.
   * @param {!Array<{
   *   analyticsEvent: !ShowcaseEventDef,
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
      GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('does not render CASL blurb by default', () => {
      GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});

      const caslEl = self.document.querySelector('.gaa-metering-regwall--casl');
      expect(caslEl).to.be.null;
    });

    it('optionally renders CASL blurb', () => {
      GaaMeteringRegwall.render_({
        iframeUrl: GSI_IFRAME_URL,
        caslUrl: CASL_URL,
      });

      const caslEl = self.document.querySelector('.gaa-metering-regwall--casl');
      expect(caslEl.textContent).contains("Review The Scenic's CASL terms");

      const caslLinkEl = caslEl.querySelector('a');
      expect(caslLinkEl.href).contains(CASL_URL);
    });

    it('focuses on modal title after the animation completes', () => {
      GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});

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

      GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});

      const descriptionEl = self.document.querySelector(
        '.gaa-metering-regwall--description'
      );
      expect(descriptionEl.textContent).contains(PUBLISHER_NAME);
    });

    it('throws if article metadata lacks a publisher name', () => {
      // Remove JSON-LD.
      script.text = '{}';

      const showingRegwall = () =>
        GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});

      expect(showingRegwall).to.throw(
        'Showcase articles must define a publisher name with either JSON-LD or Microdata.'
      );
    });

    it('renders supported i18n languages', () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});

      const titleEl = self.document.querySelector(
        '.gaa-metering-regwall--title'
      );
      expect(titleEl.textContent.trim()).to.equal(
        I18N_STRINGS.SHOWCASE_REGWALL_TITLE['pt-br']
      );
    });

    it('renders "en" for non-supported i18n languages', () => {
      self.document.documentElement.lang = 'non-supported';

      GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});

      const titleEl = self.document.querySelector(
        '.gaa-metering-regwall--title'
      );
      expect(titleEl.textContent.trim()).to.equal(
        I18N_STRINGS.SHOWCASE_REGWALL_TITLE['en']
      );
    });

    it('adds "lang" URL param to iframe URL', () => {
      self.document.documentElement.lang = 'pt-br';

      GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});

      const iframeEl = self.document.getElementById(GOOGLE_SIGN_IN_IFRAME_ID);
      expect(iframeEl.src).to.contain('?lang=pt-br');
    });

    it('handles clicks on publisher sign in link', async () => {
      // Show Regwall.
      GaaMeteringRegwall.render_({iframeUrl: GSI_IFRAME_URL});
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
      GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL});
      expect(renderSpy).to.have.been.calledWithExactly({
        iframeUrl: GSI_IFRAME_URL,
        caslUrl: undefined,
      });
    });

    it('optionally passes caslUrl to GaaMeteringRegwall.render_', () => {
      GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL, caslUrl: CASL_URL});

      expect(renderSpy).to.have.been.calledWithExactly({
        iframeUrl: GSI_IFRAME_URL,
        caslUrl: CASL_URL,
      });
    });

    it('returns GAA User', async () => {
      const gaaUser = {name: 'Hello'};
      const gaaUserPromise = GaaMeteringRegwall.show({
        iframeUrl: GSI_IFRAME_URL,
      });

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

      await GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL});

      expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
    });

    it('fails if GAA URL params are missing', () => {
      // Remove GAA URL params.
      QueryStringUtils.getQueryString.restore();

      GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL});

      expect(self.console.warn).to.have.been.calledWithExactly(
        '[swg-gaa.js:GaaMeteringRegwall.show]: URL needs fresh GAA params.'
      );
    });

    it('fails if GAA URL params are expired', () => {
      // Add GAA URL params with expiration of 7 seconds.
      QueryStringUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=7'
      );

      // Move clock a little past 7 seconds.
      clock.tick(7001);

      GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL});

      expect(self.console.warn).to.have.been.calledWithExactly(
        '[swg-gaa.js:GaaMeteringRegwall.show]: URL needs fresh GAA params.'
      );
    });

    it('handles GSI error', async () => {
      const gaaUserPromise = GaaMeteringRegwall.show({
        iframeUrl: GSI_IFRAME_URL,
      });

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
      GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL});
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

    it('resolves with a gaaUser removes Regwall from DOM on click', async () => {
      const gaaUserPromise =
        GaaMeteringRegwall.showWithNativeRegistrationButton({
          googleApiClientId: GOOGLE_API_CLIENT_ID,
        });
      clock.tick(100);

      // Click button.
      self.document.getElementById(SIGN_IN_WITH_GOOGLE_BUTTON_ID).click();

      // Simulate the click resolving.
      const args = self.google.accounts.id.initialize.args;
      args[0][0].callback(SIGN_IN_WITH_GOOGLE_JWT);

      const gaaUser = await gaaUserPromise;
      expect(gaaUser).to.deep.equal(SIGN_IN_WITH_GOOGLE_JWT);
      expect(self.document.getElementById(REGWALL_CONTAINER_ID)).to.be.null;
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

      // Simulate a click event from SIWG.
      self.google.accounts.id.renderButton.args[0][1].click_listener();

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
          analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_SIWG_CLICK,
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

    it('logs 3P button click event', async () => {
      // Show button.
      GaaMeteringRegwall.render_({useNativeMode: true});

      GaaMeteringRegwall.createNative3PRegistrationButton({
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });

      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();
      clock.tick(100);
      await tick(10);

      // Verify analytics event.
      expectAnalyticsEvents([
        {
          analyticsEvent:
            AnalyticsEvent.ACTION_SHOWCASE_REGWALL_3P_BUTTON_CLICK,
          isFromUserAction: true,
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
            'click_listener': argsRender[0][1].click_listener,
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

      // Simulate the click resolving.
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

      GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL});
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
      GaaMeteringRegwall.sendIntroMessageToGsiIframe_({
        iframeUrl: GSI_IFRAME_URL,
      });
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
    it('sends GSI button click event', async () => {
      // Show Regwall.
      GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL});
      await tick();
      logEvent.resetHistory();

      // Send button click post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_GSI_BUTTON_CLICK,
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

    it('sends SIWG button click event', async () => {
      // Show Regwall.
      GaaMeteringRegwall.show({iframeUrl: SIWG_IFRAME_URL});
      await tick();
      logEvent.resetHistory();

      // Send button click post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK,
      });

      // Wait for logging.
      await new Promise((resolve) => {
        logEvent = sandbox.fake(resolve);
      });

      // Verify analytics event.
      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_SIWG_CLICK,
          isFromUserAction: true,
        },
      ]);
    });

    it('sends 3P button click event', async () => {
      // Show Regwall.
      GaaMeteringRegwall.show({iframeUrl: GSI_IFRAME_URL});
      await tick();
      logEvent.resetHistory();

      // Send button click post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_3P_BUTTON_CLICK,
      });

      // Wait for logging.
      await new Promise((resolve) => {
        logEvent = sandbox.fake(resolve);
      });

      // Verify analytics event.
      expectAnalyticsEvents([
        {
          analyticsEvent:
            AnalyticsEvent.ACTION_SHOWCASE_REGWALL_3P_BUTTON_CLICK,
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
