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

import {GaaSignInWithGoogleButton} from './';
import {I18N_STRINGS} from '../../i18n/strings';
import {JwtHelper} from '../../utils/jwt';
import {
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
} from './constants';
import {QueryStringUtils} from './utils';
import {SIGN_IN_WITH_GOOGLE_BUTTON_ID} from './html-templates';
import {tick} from '../../../test/tick';

describes.realWin('GaaSignInWithGoogleButton', () => {
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
    sandbox.stub(QueryStringUtils, 'getQueryString');
    QueryStringUtils.getQueryString.returns('?lang=en');

    // Mock console.warn method.
    sandbox.stub(self.console, 'warn');
  });

  afterEach(() => {
    if (self.postMessage.restore) {
      self.postMessage.restore();
    }
    QueryStringUtils.getQueryString.restore();

    // Remove the injected style from GaaSignInWithGoogleButton.show.
    for (const style of [...self.document.head.querySelectorAll('style')]) {
      style.remove();
    }

    self.console.warn.restore();
  });

  describe('show', () => {
    it('renders Sign-In with Google button', async () => {
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
            use_fedcm_for_button: true,
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
            'click_listener': argsRender[0][1].click_listener,
          },
        ],
      ]);
    });

    it('renders supported i18n languages', async () => {
      QueryStringUtils.getQueryString.returns('?lang=pt-br');

      GaaSignInWithGoogleButton.show({clientId, allowedOrigins});
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['pt-br']
      );
    });

    it('renders English by default, if "lang" URL param is missing', async () => {
      QueryStringUtils.getQueryString.returns('?');

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

      // Simulate a click event from SIWG.
      self.google.accounts.id.renderButton.args[0][1].click_listener();

      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      // Expect button click post message.
      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK,
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
