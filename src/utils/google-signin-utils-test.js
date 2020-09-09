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
  ENTITLEMENTS_READY_COMMAND,
  PARENT_READY_COMMAND,
  SENTINEL,
  SwgGoogleSigninCreator,
  createGoogleSignInCallback,
} from './google-signin-utils';

describes.realWin('SwgGoogleSigninCreator', {}, (env) => {
  let win;
  let allowedOrigins;
  let signinCallback;
  let parentMock;
  let clientId;

  const testMeteringObject = {
    metering: {
      state: {
        id: 'user5901e3f7a7fc5767b6acbbbaa927d36f5901e3f7a7fc5767b6acbbbaa927',
        standardAttributes: {
          registeredUser: {
            timestamp: 10000000,
          },
        },
        customAttributes: {
          newsletterSubscriber: {
            timestamp: 10000000,
          },
        },
      },
    },
  };

  function testCallback() {
    return JSON.stringify(testMeteringObject);
  }

  beforeEach(() => {
    win = env.win;
    win.google = sandbox.spy();
    allowedOrigins = ['localhost'];
    signinCallback = sandbox.spy();
    parentMock = sandbox.mock(win.parent);
    clientId = 'fakegoogleclientid';
  });

  afterEach(() => {
    parentMock.verify();
  });

  describe('start', () => {
    it('should start correctly and accept events', () => {
      const creator = new SwgGoogleSigninCreator(
        allowedOrigins,
        clientId,
        signinCallback,
        win
      );
      parentMock.expects('postMessage').once();
      creator.start();
      win.postMessage(
        {
          sentinel: SENTINEL,
          command: PARENT_READY_COMMAND,
          nonce: creator.pendingNonce_,
        },
        '*'
      );
    });
  });
});
