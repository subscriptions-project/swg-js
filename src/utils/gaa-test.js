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
  let headEls = [];
  let bodyEls = [];
  let signOutFake;

  beforeEach(() => {
    headEls = [];
    sandbox.stub(self.document.head, 'appendChild').callsFake((el) => {
      headEls.push(el);
    });

    bodyEls = [];
    sandbox.stub(self.document.body, 'appendChild').callsFake((el) => {
      bodyEls.push(el);
    });

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
  });

  describe('show', () => {
    it('is a function', () => {
      expect(typeof GaaMeteringRegwall.show).to.equal('function');
    });

    // TODO: Add tests after prototyping phase.
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
