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

describes.realWin('GaaMeteringRegwall', {}, () => {
  let signOutFake;

  beforeEach(() => {
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

    GaaMeteringRegwall.location_ = {
      href: 'INITIAL',
    };
  });

  describe('show', () => {
    it('is a function', () => {
      expect(typeof GaaMeteringRegwall.show).to.equal('function');
    });

    // TODO: Add tests after prototyping phase.
  });

  describe('redirectToArticle', () => {
    it('redirects', () => {
      const url = 'URL';
      sessionStorage.gaaRegwallArticleUrl = url;
      GaaMeteringRegwall.redirectToArticle();
      expect(GaaMeteringRegwall.location_.href).to.equal(url);
    });
  });

  describe('configureGoogleSignIn', () => {
    it('configures Google Sign-In properly', async () => {
      const redirectUri = 'nirvana';
      await GaaMeteringRegwall.configureGoogleSignIn({redirectUri});

      expect(self.gapi.load).to.be.calledWith('auth2');
      expect(self.gapi.auth2.getAuthInstance).to.be.called;
      expect(self.gapi.auth2.init).to.be.calledWith({
        'ux_mode': 'redirect',
        'redirect_uri': redirectUri,
      });
    });
  });

  describe('signOut', () => {
    it('signs user out of Google Sign-In', async () => {
      // Start signOut process.
      const signOutPromise = GaaMeteringRegwall.signOut();

      // Check Google Sign-In API calls.
      expect(await signOutPromise).to.be.undefined;
      expect(self.gapi.load).to.be.calledWith('auth2');
      expect(self.gapi.auth2.getAuthInstance).to.be.called;
      expect(self.gapi.auth2.init).to.be.called;
      expect(signOutFake).to.be.called;
    });
  });
});
