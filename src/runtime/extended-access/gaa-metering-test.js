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
import {GaaMetering, GaaMeteringRegwall} from '.';
import {PaywallType} from './constants';
import {QueryStringUtils} from './utils';
import {ShowcaseEvent} from '../../api/subscriptions';
import {tick} from '../../../test/tick';

const PUBLISHER_NAME = 'The Scenic';
const PRODUCT_ID = 'scenic-2017.appspot.com:news';
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

const ARTICLE_LD_JSON_METADATA_THAT_SAYS_ARTICLE_IS_FREE = `
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

const ARTICLE_LD_JSON_METADATA_THAT_DOES_NOT_SAY_WHETHER_ARTICLE_IS_FREE =
  ARTICLE_LD_JSON_METADATA_THAT_SAYS_ARTICLE_IS_FREE.replace(
    '"isAccessibleForFree": true,',
    ''
  );

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

function removeJsonLdScripts() {
  const scripts = [
    ...self.document.querySelectorAll('script[type="application/ld+json"]'),
  ];
  for (const script of scripts) {
    script.remove();
  }
}

describes.realWin('GaaMetering', () => {
  let microdata;
  let script;
  let logEvent;
  let subscriptionsMock;
  let currentReferrer;

  beforeEach(() => {
    // Mock clock.
    // clock = sandbox.useFakeTimers();

    // Mock query string.
    sandbox.stub(QueryStringUtils, 'getQueryString');
    QueryStringUtils.getQueryString.returns('?lang=en');

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
      consumeShowcaseEntitlementJwt: sandbox.fake((entJwt, callback) => {
        callback();
      }),
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
    QueryStringUtils.getQueryString.restore();
    GaaMeteringRegwall.remove();

    const styles = [...self.document.head.querySelectorAll('style')];
    for (const style of styles) {
      style.remove();
    }

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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.true;
    });

    it('succeeds for valid params with showcaseEntitlement', () => {
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
          /* Ommiting unlockArticle */
          showcaseEntitlement: 'test showcaseEntitlement',
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.true;
    });

    it('succeeds for valid params with paywallType', () => {
      expect(
        GaaMetering.validateParameters({
          paywallType: 'SERVER_SIDE',
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: () => {},
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'publisherEntitlementPromise is provided but it is not a promise'
      );
    });

    it('fails for a non-boolean shouldInitializeSwG', () => {
      expect(
        GaaMetering.validateParameters({
          shouldInitializeSwG: 'invalid_value',
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'shouldInitializeSwG is provided but the value is not a boolean'
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
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
        })
      ).to.be.true;
    });

    it('fails for invalid paywallType', () => {
      expect(
        GaaMetering.validateParameters({
          paywallType: 'invalid_value',
          googleApiClientId: GOOGLE_API_CLIENT_ID,
          allowedReferrers: ['example.com', 'test.com', 'localhost'],
          userState: {
            id: 'user1235',
            registrationTimestamp: 1602763054,
            subscriptionTimestamp: 1602763094,
            granted: false,
          },
          unlockArticle: () => {},
          showPaywall: () => {},
          handleLogin: () => {},
          handleSwGEntitlement: () => {},
          registerUserPromise: new Promise(() => {}),
          handleLoginPromise: new Promise(() => {}),
          publisherEntitlementPromise: new Promise(() => {}),
        })
      ).to.be.false;

      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'invalid_value is not a valid paywallType'
      );
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
      removeJsonLdScripts();

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA;
      expect(GaaMetering.getProductIDFromPageConfig_()).to.equal(PRODUCT_ID);
    });

    it('throws if article metadata lacks a publisher id', () => {
      removeJsonLdScripts();
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

      removeJsonLdScripts();

      self.document.head.innerHTML = `
        <script type="application/ld+json">
          [${ARTICLE_LD_JSON_METADATA}]
        </script>
      `;

      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.false;
    });

    it('gets isAccessibleForFree (true) from array page config', () => {
      removeJsonLdScripts();

      self.document.head.innerHTML = `
        <script type="application/ld+json">
          [${ARTICLE_LD_JSON_METADATA_THAT_SAYS_ARTICLE_IS_FREE}]
        </script>
      `;

      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.true;
    });

    it('gets isAccessibleForFree from microdata false', () => {
      removeJsonLdScripts();

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA;
      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.false;
    });

    it('gets isAccessibleForFree from microdata', () => {
      removeJsonLdScripts();

      // Add Microdata.
      microdata.innerHTML = ARTICLE_MICRODATA_METADATA_TRUE;
      expect(GaaMetering.isArticleFreeFromPageConfig_()).to.be.true;
    });

    it('if article metadata lacks a isAccessibleForFree value', () => {
      removeJsonLdScripts();
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

    it('fails with a warning in debug mode if paywallReason is provided but granted is true', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          granted: true,
          paywallReason: 'RESERVED_USER',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState.granted must be false when paywallReason is supplied.'
      );
    });

    it('fails with a warning in debug mode for and invalid paywallReason', () => {
      location.hash = `#swg.debug=1`;
      expect(
        GaaMetering.validateUserState({
          granted: false,
          paywallReason: 'INVALID',
        })
      ).to.be.false;
      expect(self.console.log).to.have.been.calledWithExactly(
        '[Subscriptions]',
        'userState.paywallReason has to be empty or set to RESERVED_USER.'
      );
    });
  });

  describe('getGaaUserPromise', () => {
    beforeEach(() => {
      GaaMetering.gaaUserPromiseResolve_ = undefined;
    });

    it('sets up the promise to return the gaaUser', async () => {
      const gaaUser = 'test gaaUser';
      const gaaUserPromise = GaaMetering.getGaaUserPromise();
      GaaMetering.setGaaUser(gaaUser);
      expect(await gaaUserPromise).to.equal(gaaUser);
    });
  });

  describe('getLoginPromise', () => {
    it('sets up the promise', async () => {
      const promise = GaaMetering.getLoginPromise();
      GaaMetering.resolveLogin();
      await expect(promise).to.be.fulfilled;
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
      QueryStringUtils.getQueryString.returns(
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
      QueryStringUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      expect(GaaMetering.isGaa()).to.be.true;
    });

    it("succeeds when the gaa parameters are present and the referer is in partner's list", () => {
      QueryStringUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.examplenews.com';
      expect(GaaMetering.isGaa(['www.examplenews.com'])).to.be.true;
    });
  });

  describe('init', () => {
    beforeEach(() => {
      location.hash = `#swg.debug=1`;
    });

    it('fails with a warning in debug mode for invalid params', () => {
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
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

    it('initializes SwG by default', async () => {
      QueryStringUtils.getQueryString.returns(
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
        userState: {},
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise(() => {}),
      });

      expect(subscriptionsMock.init).to.be.called;
    });

    it('does not initialize SwG when shouldInitializeSwG is false', async () => {
      QueryStringUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      GaaMetering.init({
        shouldInitializeSwG: false,
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        allowedReferrers: [
          'example.com',
          'test.com',
          'localhost',
          'google.com',
        ],
        userState: {},
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise(() => {}),
      });

      expect(subscriptionsMock.init).to.not.be.called;
    });

    it('succeeds for a subscriber', async () => {
      QueryStringUtils.getQueryString.returns(
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
          subscriptionTimestamp: 1602763094,
          granted: true,
          grantReason: 'SUBSCRIBER',
        },
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise(() => {}),
      });

      await tick();

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'unlocked for SUBSCRIBER'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION,
        isUserRegistered: true,
        subscriptionTimestamp: 1602763094,
      });

      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.EVENT_SHOWCASE_METERING_INIT,
          isFromUserAction: false,
        },
      ]);
    });

    it('succeeds for metering', async () => {
      QueryStringUtils.getQueryString.returns(
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
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
        entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_METER,
        isUserRegistered: true,
        subscriptionTimestamp: null,
      });

      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.EVENT_SHOWCASE_METERING_INIT,
          isFromUserAction: false,
        },
      ]);
    });

    it('succeeds for free', async () => {
      QueryStringUtils.getQueryString.returns(
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleSwGEntitlement: () => {},
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
        entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_FREE_PAGE,
        isUserRegistered: true,
        subscriptionTimestamp: null,
      });

      expectAnalyticsEvents([
        {
          analyticsEvent: AnalyticsEvent.EVENT_SHOWCASE_METERING_INIT,
          isFromUserAction: false,
        },
      ]);
    });

    it('fails for invalid userState', () => {
      QueryStringUtils.getQueryString.returns(
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
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
      removeJsonLdScripts();

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA_THAT_SAYS_ARTICLE_IS_FREE}]
      </script>
      `;

      QueryStringUtils.getQueryString.returns(
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise(() => {}),
      });

      expect(self.console.log).to.calledWith(
        '[Subscriptions]',
        'Article free from markup.'
      );

      expect(subscriptionsMock.setShowcaseEntitlement).to.calledWith({
        entitlement: ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_FREE_PAGE,
        isUserRegistered: true,
        subscriptionTimestamp: null,
      });
    });

    it('has showcaseEntitlements', () => {
      removeJsonLdScripts();

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA}]
      </script>
      `;

      QueryStringUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      const unlockArticle = sandbox.fake(() => {});

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
        unlockArticle,
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
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

      // No client-side entitlement checks: Google
      expect(subscriptionsMock.getEntitlements).to.not.be.called;

      // No client-side entitlement checks: publisher
      expect(self.console.log).to.not.be.calledWith(
        '[Subscriptions]',
        'resolving publisherEntitlement'
      );

      expect(unlockArticle).to.be.called;
    });

    it('makes unlockArticle optional when showcaseEntitlements is provided', () => {
      const unlockArticle = undefined;

      removeJsonLdScripts();

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA}]
      </script>
      `;

      QueryStringUtils.getQueryString.returns(
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
        unlockArticle,
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
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

    it('should not check for entitlements on client-side for server-side paywall', () => {
      removeJsonLdScripts();

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA}]
      </script>
      `;

      QueryStringUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      const unlockArticle = sandbox.fake(() => {});

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
          granted: false,
        },
        paywallType: 'SERVER_SIDE',
        unlockArticle,
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise(() => {}),
      });

      expect(subscriptionsMock.getEntitlements).to.not.be.called;

      expect(self.console.log).to.not.be.calledWith(
        '[Subscriptions]',
        'resolving publisherEntitlement'
      );

      expect(unlockArticle).to.not.be.called;
    });

    it('has publisherEntitlements', async () => {
      location.hash = `#swg.debug=1`;
      self.document.referrer = 'https://www.google.com';

      QueryStringUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );

      removeJsonLdScripts();

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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
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
      QueryStringUtils.getQueryString.returns(
        '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999999'
      );
      self.document.referrer = 'https://www.google.com';
      location.hash = `#swg.debug=1`;

      removeJsonLdScripts();

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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
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

    it('sets onLoginRequest callback', async () => {
      sandbox.stub(GaaMetering, 'handleLoginRequest');

      // Successfully init, setting a callback in the process.
      QueryStringUtils.getQueryString.returns(
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
        userState: {},
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise(() => {}),
      });

      expect(subscriptionsMock.setOnLoginRequest).to.be.called;
      expect(GaaMetering.handleLoginRequest).to.not.be.called;
      const callback = subscriptionsMock.setOnLoginRequest.lastCall.firstArg;
      callback();
      expect(GaaMetering.handleLoginRequest).to.be.called;
    });
  });

  describe('determinePaywallType', () => {
    it('returns CLIENT_SIDE by default when there is no showcaseEntitlement', () => {
      expect(GaaMetering.determinePaywallType({})).to.be.equal('CLIENT_SIDE');
    });

    it('returns SERVER_SIDE when there is showcaseEntitlement', () => {
      expect(
        GaaMetering.determinePaywallType({
          showcaseEntitlement: 'showcase_entitlement',
        })
      ).to.equal(PaywallType.SERVER_SIDE);
      // showcaseEntitlement should take precedence over paywallType
      expect(
        GaaMetering.determinePaywallType({
          showcaseEntitlement: 'showcase_entitlement',
          paywallType: 'CLIENT_SIDE',
        })
      ).to.equal(PaywallType.SERVER_SIDE);
    });

    it('returns paywallType set by publisher when there is no showcaseEntitlement', () => {
      expect(
        GaaMetering.determinePaywallType({
          paywallType: 'SERVER_SIDE',
        })
      ).to.equal(PaywallType.SERVER_SIDE);
      expect(
        GaaMetering.determinePaywallType({
          paywallType: 'CLIENT_SIDE',
        })
      ).to.equal(PaywallType.CLIENT_SIDE);
    });
  });

  describe('checkShowcaseEntitlement', () => {
    beforeEach(() => {
      sandbox
        .stub(GaaMetering, 'getOnReadyPromise')
        .returns(new Promise((resolve) => resolve()));
      QueryStringUtils.getQueryString.returns(
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleSwGEntitlement: () => {},
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();

      await GaaMetering.getOnReadyPromise();
      expect(showWithNativeRegistrationButtonSpy).to.be.calledWith({
        caslUrl: undefined,
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        rawJwt: undefined,
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();

      await GaaMetering.getOnReadyPromise();
      expect(showWithNativeRegistrationButtonSpy).to.be.calledWith({
        caslUrl: CASL_URL,
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        rawJwt: undefined,
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();

      await GaaMetering.getOnReadyPromise();
      expect(showWithNativeRegistrationButtonSpy).to.be.calledWith({
        caslUrl: undefined,
        googleApiClientId: GOOGLE_API_CLIENT_ID,
        rawJwt: false,
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
      const registerUserPromise = new Promise(async (resolve) => {
        await GaaMetering.getGaaUserPromise();
        resolve(returnedUserState);
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleSwGEntitlement: () => {},
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick();

      await GaaMetering.getOnReadyPromise();
      expect(showWithNative3PRegistrationButtonSpy).to.calledWith({
        caslUrl: undefined,
        authorizationUrl: GOOGLE_3P_AUTH_URL,
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
        unlockArticle: () => {},
        showPaywall: () => {},
        handleLogin: () => {},
        handleSwGEntitlement: () => {},
        registerUserPromise: new Promise(() => {}),
        handleLoginPromise: new Promise(() => {}),
        publisherEntitlementPromise: new Promise((resolve) => {
          resolve({granted: false});
        }),
      });

      await tick(10);

      await GaaMetering.getOnReadyPromise();
      expect(showWithNative3PRegistrationButtonSpy).to.calledWith({
        caslUrl: CASL_URL,
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });
    });
  });

  describe('isCurrentUserRegistered', () => {
    it('returns true for a registered user', () => {
      GaaMetering.userState = {
        id: 'user1235',
        registrationTimestamp: 1602763054,
        subscriptionTimestamp: 1602763094,
      };
      expect(GaaMetering.isCurrentUserRegistered()).to.be.true;
    });

    it('returns false for an anonymous user', () => {
      GaaMetering.userState = {};
      expect(GaaMetering.isCurrentUserRegistered()).to.be.false;
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
      const userState = {};
      expect(GaaMetering.isUserRegistered(userState)).to.be.false;
    });
  });

  describe('isArticleFreeFromJsonLdPageConfig_', () => {
    it('returns true if ld+json says the article is free', () => {
      removeJsonLdScripts();

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA_THAT_SAYS_ARTICLE_IS_FREE}]
      </script>
      `;

      expect(GaaMetering.isArticleFreeFromJsonLdPageConfig_()).to.be.true;
    });

    it('returns true if ld+json says the article is free, following ld+json that does not say whether the article is free', () => {
      removeJsonLdScripts();

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA_THAT_DOES_NOT_SAY_WHETHER_ARTICLE_IS_FREE}]
      </script>
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA_THAT_SAYS_ARTICLE_IS_FREE}]
      </script>
      `;

      expect(GaaMetering.isArticleFreeFromJsonLdPageConfig_()).to.be.true;
    });

    it('returns false if ld+json does not say whether article is free', () => {
      removeJsonLdScripts();

      self.document.head.innerHTML = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA_THAT_DOES_NOT_SAY_WHETHER_ARTICLE_IS_FREE}]
      </script>
      `;

      expect(GaaMetering.isArticleFreeFromJsonLdPageConfig_()).to.be.false;
    });

    it('returns false if ld+json says the article is not free', () => {
      const ldJsonScript = `
      <script type="application/ld+json">
        [${ARTICLE_LD_JSON_METADATA}]
      </script>`;
      removeJsonLdScripts();

      self.document.head.innerHTML = ldJsonScript;

      expect(GaaMetering.isArticleFreeFromJsonLdPageConfig_()).to.be.false;
    });
  });

  describe('handleLoginRequest', () => {
    beforeEach(() => {
      GaaMetering.loginPromiseResolve_ = undefined;
      location.hash = `#swg.debug=1`;
      sandbox.spy(GaaMetering, 'resolveLogin');
    });

    it('resolves the loginPromise', async () => {
      const unlockArticleIfGranted = () => {};
      const handleLoginPromise = GaaMetering.getLoginPromise();
      GaaMetering.handleLoginRequest(
        handleLoginPromise,
        unlockArticleIfGranted
      );
      await handleLoginPromise;
      expect(GaaMetering.resolveLogin).to.have.been.called;
    });

    it('calls unlockArticleIfGranted if handleLoginUserState is valid', async () => {
      const unlockArticleIfGranted = sandbox.fake();
      const handleLoginPromise = new Promise(async (resolve) => {
        await GaaMetering.getLoginPromise();
        const handleLoginUserState = {
          id: 12345,
          registrationTimestamp: Date.now() / 1000,
          granted: false,
        };
        resolve(handleLoginUserState);
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
      const handleLoginPromise = new Promise(async (resolve) => {
        await GaaMetering.getLoginPromise();
        const userStateInvalid = {
          id: 12345,
        };
        resolve(userStateInvalid);
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
    let unlockArticle = () => {};
    let handleSwGEntitlement = () => {};
    let showGoogleRegwall = () => {};
    let showPaywall = () => {};

    it('consumes google entitlement and unlock article', async () => {
      unlockArticle = sandbox.fake();

      sandbox.stub(GaaMetering, 'isCurrentUserRegistered').returns(true);

      const googleEntitlementsPromise = Promise.resolve({
        enablesThisWithGoogleMetering: sandbox.fake.returns(true),
        enablesThis: sandbox.fake.returns(false),
        consume: sandbox.fake((callback) => {
          return callback();
        }),
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

      sandbox.stub(GaaMetering, 'isCurrentUserRegistered').returns(true);
      const googleEntitlement = {
        enablesThisWithGoogleMetering: sandbox.fake.returns(false),
        enablesThis: sandbox.fake.returns(true),
        consume: sandbox.fake(),
      };
      const googleEntitlementsPromise = Promise.resolve(googleEntitlement);

      GaaMetering.setEntitlements(
        googleEntitlementsPromise,
        allowedReferrers,
        unlockArticle,
        handleSwGEntitlement,
        showGoogleRegwall,
        showPaywall
      );

      await tick(10);
      expect(handleSwGEntitlement).to.be.calledWithExactly(googleEntitlement);
    });

    it("shows regWall if user isn't registered", async () => {
      showGoogleRegwall = sandbox.fake();

      GaaMetering.userState = {};

      sandbox.stub(GaaMetering, 'isCurrentUserRegistered').returns(false);
      sandbox.stub(GaaMetering, 'isGaa').returns(true);

      const googleEntitlementsPromise = Promise.resolve({
        enablesThisWithGoogleMetering: sandbox.fake.returns(false),
        enablesThis: sandbox.fake.returns(false),
        consume: sandbox.fake(),
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

      sandbox.stub(GaaMetering, 'isCurrentUserRegistered').returns(true);

      const googleEntitlementsPromise = Promise.resolve({
        enablesThisWithGoogleMetering: sandbox.fake.returns(false),
        enablesThis: sandbox.fake.returns(false),
        consume: sandbox.fake(),
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
        entitlement: ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_PAYWALL,
        isUserRegistered: true,
        subscriptionTimestamp: null,
      });

      expect(showPaywall).to.be.called;
    });

    it('shows the paywall and call setShowcaseEntitlement', async () => {
      showPaywall = sandbox.fake();

      GaaMetering.userState = {
        paywallReason: 'RESERVED_USER',
      };

      sandbox.stub(GaaMetering, 'isCurrentUserRegistered').returns(true);

      const googleEntitlementsPromise = Promise.resolve({
        enablesThisWithGoogleMetering: sandbox.fake.returns(false),
        enablesThis: sandbox.fake.returns(false),
        consume: sandbox.fake(),
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
        entitlement: ShowcaseEvent.EVENT_SHOWCASE_INELIGIBLE_PAYWALL,
        isUserRegistered: true,
        subscriptionTimestamp: null,
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
