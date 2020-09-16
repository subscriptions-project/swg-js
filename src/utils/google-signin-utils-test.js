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
  PARENT_READY_COMMAND,
  SENTINEL,
  SwgGoogleSigninCreator,
} from './google-signin-utils';

describes.realWin('SwgGoogleSigninCreator', {}, (env) => {
  let win;
  let allowedOrigins;
  let signinCallback;
  let parentMock;
  let clientId;

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
    });
  });

  describe('handleMessageEvent_', () => {
    it('should handle correct message event', () => {
      const creator = new SwgGoogleSigninCreator(
        allowedOrigins,
        clientId,
        signinCallback,
        win
      );
      creator.start();
      creator.signinCallback_ = signinCallback;
      const event = new MessageEvent('worker', {
        data: {
          sentinel: SENTINEL,
          command: PARENT_READY_COMMAND,
          nonce: creator.pendingNonce_,
        },
        origin: 'localhost',
        source: win.parent,
      });
      creator.handleMessageEvent_(event);
      assert(signinCallback.calledOnce);
    });

    it('should not call callback on unallowed origin', () => {
      const creator = new SwgGoogleSigninCreator(
        allowedOrigins,
        clientId,
        signinCallback,
        win
      );
      creator.start();
      creator.signinCallback_ = signinCallback;
      const event = new MessageEvent('worker', {
        data: {
          sentinel: SENTINEL,
          command: PARENT_READY_COMMAND,
          nonce: creator.pendingNonce_,
        },
        origin: 'somescaryorigin',
        source: win.parent,
      });
      creator.handleMessageEvent_(event);
      assert(signinCallback.notCalled);
    });

    it('should not call callback on missing data', () => {
      const creator = new SwgGoogleSigninCreator(
        allowedOrigins,
        clientId,
        signinCallback,
        win
      );
      creator.start();
      creator.signinCallback_ = signinCallback;
      const event = new MessageEvent('worker', {
        origin: 'localhost',
        source: win.parent,
      });
      creator.handleMessageEvent_(event);
      assert(signinCallback.notCalled);
    });

    it('should not call callback on mismatched nonce', () => {
      const creator = new SwgGoogleSigninCreator(
        allowedOrigins,
        clientId,
        signinCallback,
        win
      );
      creator.start();
      creator.signinCallback_ = signinCallback;
      const event = new MessageEvent('worker', {
        data: {
          sentinel: SENTINEL,
          command: PARENT_READY_COMMAND,
          nonce: btoa('XXXXX-nonce'),
        },
        origin: 'localhost',
        source: win.parent,
      });
      creator.handleMessageEvent_(event);
      assert(signinCallback.notCalled);
    });

    it('should not call callback on incorrect command', () => {
      const creator = new SwgGoogleSigninCreator(
        allowedOrigins,
        clientId,
        signinCallback,
        win
      );
      creator.start();
      creator.signinCallback_ = signinCallback;
      const event = new MessageEvent('worker', {
        data: {
          sentinel: SENTINEL,
          command: 'someBadCommand',
          nonce: creator.pendingNonce_,
        },
        origin: 'localhost',
        source: win.parent,
      });
      creator.handleMessageEvent_(event);
      assert(signinCallback.notCalled);
    });
  });
});
