/**
 * Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.
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

import * as log from '../utils/log';
import {GisInteropManager} from './gis-interop-manager';
import {GlobalDoc} from '../model/doc';

describes.realWin('GisInteropManager', (env) => {
  let win;
  let doc;
  let manager;

  beforeEach(() => {
    win = env.win;
    doc = new GlobalDoc(win);
    manager = new GisInteropManager(doc);
  });

  it('should be created in listening state', () => {
    expect(manager).to.be.ok;
  });

  it('should ignore non-RRM messages', () => {
    const warnStub = sandbox.stub(log, 'warn');

    const event = new MessageEvent('message', {
      data: {type: 'RANDOM_MESSAGE'},
      source: win,
    });

    win.dispatchEvent(event);

    expect(warnStub).to.not.have.been.called;
  });

  it('should handle invalid RRM_GIS_PING (missing sessionId) by transitioning to ERROR', () => {
    const warnStub = sandbox.stub(log, 'warn');

    // This is an RRM message, but missing sessionId, so handleListeningState should catch it.
    const event = new MessageEvent('message', {
      data: {
        type: 'RRM_GIS_PING',
        // Missing sessionId
      },
      source: win,
    });

    win.dispatchEvent(event);

    expect(warnStub).to.have.been.calledWithMatch(
      /Unexpected message in LISTENING state/
    );
  });

  it('should handle valid RRM_GIS_PING', () => {
    const warnStub = sandbox.stub(log, 'warn');

    // Valid ping
    const event = new MessageEvent('message', {
      data: {
        type: 'RRM_GIS_PING',
        sessionId: 'test-session-id',
      },
      source: win,
      origin: 'https://example.com',
    });

    win.dispatchEvent(event);

    expect(warnStub).to.not.have.been.called;
  });
});
