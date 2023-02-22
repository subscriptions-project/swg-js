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

import {GOOGLE_3P_SIGN_IN_BUTTON_ID} from './html-templates';
import {GaaGoogle3pSignInButton} from './';
import {I18N_STRINGS} from '../../i18n/strings';
import {
  POST_MESSAGE_COMMAND_3P_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
} from './constants';
import {QueryStringUtils} from './utils';
import {tick} from '../../../test/tick';

const GOOGLE_3P_AUTH_URL = 'https://fabulous-3p-authserver.glitch.me/auth';

describes.realWin('GaaGoogle3pSignInButton', () => {
  const allowedOrigins = [location.origin];

  let clock;

  beforeEach(() => {
    // Mock clock.
    clock = sandbox.useFakeTimers();

    // Mock query string.
    sandbox.stub(QueryStringUtils, 'getQueryString');
    QueryStringUtils.getQueryString.returns('?lang=en');

    // Mock console.warn method.
    sandbox.stub(self.console, 'warn');

    sandbox.stub(self, 'open');
    // Makes sure no div elements on the test dom exist.
    const elements = self.document.getElementsByTagName('div');
    while (elements[0]) {
      elements[0].parentNode.removeChild(elements[0]);
    }
  });

  afterEach(() => {
    if (self.postMessage.restore) {
      self.postMessage.restore();
    }

    QueryStringUtils.getQueryString.restore();

    // Remove the injected style from GaaGoogle3pSignInButton.show.
    for (const style of [...self.document.head.querySelectorAll('style')]) {
      style.remove();
    }

    self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID)?.remove();
    self.console.warn.restore();
  });

  describe('show', () => {
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
      QueryStringUtils.getQueryString.returns('?lang=pt-br');

      GaaGoogle3pSignInButton.show({allowedOrigins}, GOOGLE_3P_AUTH_URL);
      clock.tick(100);
      await tick(10);

      const styleEl = self.document.querySelector('style');
      expect(styleEl.textContent).to.contain(
        I18N_STRINGS.SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON['pt-br']
      );
    });

    it('renders English by default, if "lang" URL param is missing', async () => {
      QueryStringUtils.getQueryString.returns('?');

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

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();
      clock.tick(100);
      await tick(10);

      // Send user post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_USER,
      });

      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);

      // Wait for `postMessage` to be relayed to parent.
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

    it('sends post message with 3p button click event', async () => {
      // Show button.
      GaaGoogle3pSignInButton.show({
        allowedOrigins,
        authorizationUrl: GOOGLE_3P_AUTH_URL,
      });
      clock.tick(100);
      await tick(10);

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);

      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();

      // Wait for button click post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      // Expect button click post message.
      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_3P_BUTTON_CLICK,
          stamp: POST_MESSAGE_STAMP,
        },
        location.origin
      );
    });

    it('sends post message with 3p button click event when redirectMode is true', async () => {
      // Show button.
      GaaGoogle3pSignInButton.show({
        allowedOrigins,
        authorizationUrl: GOOGLE_3P_AUTH_URL,
        redirectMode: true,
      });
      clock.tick(100);
      await tick(10);

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Wait for promises and intervals to resolve.
      clock.tick(100);
      await tick(10);

      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();

      // Wait for button click post message.
      await new Promise((resolve) => {
        sandbox.stub(self, 'postMessage').callsFake(() => {
          resolve();
        });
      });

      // Expect button click post message.
      expect(self.postMessage).to.be.calledWithExactly(
        {
          command: POST_MESSAGE_COMMAND_3P_BUTTON_CLICK,
          stamp: POST_MESSAGE_STAMP,
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

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();
      clock.tick(100);
      await tick(10);

      // Wait for `open` to be called.
      await new Promise((resolve) => void self.open.callsFake(resolve));

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

      // Send intro post message.
      postMessage({
        stamp: POST_MESSAGE_STAMP,
        command: POST_MESSAGE_COMMAND_INTRODUCTION,
      });

      // Click button.
      self.document.getElementById(GOOGLE_3P_SIGN_IN_BUTTON_ID).click();

      // Wait for timeout to complete.
      clock.tickAsync(100);

      // Wait for `open` to be called.
      await new Promise((resolve) => void self.open.callsFake(resolve));

      expect(self.open).to.have.been.calledWithExactly(
        GOOGLE_3P_AUTH_URL,
        '_parent'
      );
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
