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
  PUBLISHER_IFRAME_READY_COMMAND,
  SENTINEL,
  SWG_SERVER_ORIGIN,
  SwgGoogleSignInButtonCreator,
} from './google-signin-utils';

describes.realWin('SwgGoogleSignInButtonCreator', {}, (env) => {
  let clientId;
  let postMessages;
  let signinCallback;
  let win;

  beforeEach(() => {
    win = env.win;
    win.google = sandbox.spy();
    signinCallback = sandbox.spy();
    postMessages = [];
    sandbox.stub(win.parent, 'postMessage').callsFake((message, origin) => {
      postMessages.push({
        message,
        origin,
      });
    });
    clientId = 'fakegoogleclientid';
  });

  describe('start', () => {
    it('should start correctly and accept events', () => {
      const creator = new SwgGoogleSignInButtonCreator(
        clientId,
        signinCallback,
        win
      );
      creator.start();
      expect(postMessages).to.deep.equal([
        {
          message: {
            command: PUBLISHER_IFRAME_READY_COMMAND,
            nonce: creator.requestNonce_,
            sentinel: SENTINEL,
          },
          origin: SWG_SERVER_ORIGIN,
        },
      ]);
    });
  });
});
