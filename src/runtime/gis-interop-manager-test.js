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

import {
  GisInteropManager,
  GisInteropManagerStates,
} from './gis-interop-manager';
import {GlobalDoc} from '../model/doc';
import {StorageKeys} from '../utils/constants';

describes.realWin('GisInteropManager', (env) => {
  let win;
  let doc;
  let manager;
  let mockGisFrame;
  let storageMock;
  let entitlementsManagerMock;

  beforeEach(() => {
    win = env.win;
    doc = new GlobalDoc(win);
    storageMock = {
      get: sandbox.stub(),
    };
    entitlementsManagerMock = {
      updateEntitlements: sandbox.stub(),
    };
    manager = new GisInteropManager(doc, storageMock, entitlementsManagerMock);
    mockGisFrame = doc.getRootNode().createElement('iframe');
    doc.getBody().appendChild(mockGisFrame);
  });

  afterEach(() => {
    if (mockGisFrame && mockGisFrame.parentNode) {
      mockGisFrame.parentNode.removeChild(mockGisFrame);
    }
  });

  describe('in WAITING_FOR_PING state', () => {
    it('should be in WAITING_FOR_PING state initially', () => {
      expect(manager.getState()).to.equal(
        GisInteropManagerStates.WAITING_FOR_PING
      );
    });

    it('should ignore non-PING messages', () => {
      win.dispatchEvent(
        new MessageEvent('message', {
          data: {type: 'RANDOM_MESSAGE'},
          source: win,
          origin: 'https://example.com',
        })
      );
      expect(manager.getState()).to.equal(
        GisInteropManagerStates.WAITING_FOR_PING
      );
    });

    it('should ignore PING without sessionId', () => {
      win.dispatchEvent(
        new MessageEvent('message', {
          data: {type: 'RRM_GIS_PING'},
          source: win,
          origin: 'https://example.com',
        })
      );

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.WAITING_FOR_PING
      );
    });

    it('should transition to LOADING_COMMUNICATION_IFRAME on valid PING', () => {
      const gisSource = mockGisFrame.contentWindow;
      const postMessageSpy = sandbox.spy(gisSource, 'postMessage');

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_PING',
            sessionId: 'test-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );

      expect(postMessageSpy).to.have.been.calledWith({
        type: 'RRM_GIS_ACK',
        sessionId: 'test-session-id',
      });

      const iframes = doc.getBody().querySelectorAll('iframe');
      const communicationIframe = Array.from(iframes).find(
        (f) => f !== mockGisFrame
      );
      expect(communicationIframe).to.exist;
      expect(communicationIframe.getAttribute('src')).to.contain(
        '/rrmgisinterop'
      );
      expect(communicationIframe.getAttribute('src')).to.contain(
        'sessionId=test-session-id'
      );
    });
  });

  describe('in LOADING_COMMUNICATION_IFRAME state', () => {
    let communicationIframe;
    let gisSource;
    let postMessageSpy;

    beforeEach(() => {
      gisSource = mockGisFrame.contentWindow;
      postMessageSpy = sandbox.spy(gisSource, 'postMessage');

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_PING',
            sessionId: 'test-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );

      const iframes = doc.getBody().querySelectorAll('iframe');
      communicationIframe = Array.from(iframes).find((f) => f !== mockGisFrame);

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );
    });

    it('should ignore messages with wrong sessionId', () => {
      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_READY',
            sessionId: 'wrong-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );
    });

    it('should ignore IFRAME_LOADED from wrong source', () => {
      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_IFRAME_LOADED_RRM',
            sessionId: 'test-session-id',
          },
          source: win,
          origin: 'https://example.com',
        })
      );

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );

      expect(postMessageSpy).to.not.have.been.calledWithMatch({
        type: 'RRM_GIS_READY',
      });
    });

    it('should transition to COMMUNICATION_IFRAME_ESTABLISHED (Scenario 1: IFRAME_LOADED then READY)', () => {
      const iframeSpy = sandbox.spy(
        communicationIframe.contentWindow,
        'postMessage'
      );

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_IFRAME_LOADED_RRM',
            sessionId: 'test-session-id',
          },
          source: communicationIframe.contentWindow,
          origin: 'https://example.com',
        })
      );

      expect(postMessageSpy).to.have.callCount(1);
      expect(iframeSpy).to.have.been.calledWith(
        {
          type: 'RRM_GIS_READY_RRM',
          sessionId: 'test-session-id',
        },
        {
          targetOrigin: 'https://example.com',
        }
      );

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_READY_GIS',
            sessionId: 'test-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED
      );
    });

    it('should transition to COMMUNICATION_IFRAME_ESTABLISHED (Scenario 2: READY then IFRAME_LOADED)', () => {
      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_READY_GIS',
            sessionId: 'test-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );

      const iframeSpy = sandbox.spy(
        communicationIframe.contentWindow,
        'postMessage'
      );

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_IFRAME_LOADED_RRM',
            sessionId: 'test-session-id',
          },
          source: communicationIframe.contentWindow,
          origin: 'https://example.com',
        })
      );

      expect(postMessageSpy).to.have.callCount(1);
      expect(iframeSpy).to.have.been.calledWith(
        {
          type: 'RRM_GIS_READY_RRM',
          sessionId: 'test-session-id',
        },
        {
          targetOrigin: 'https://example.com',
        }
      );

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED
      );
    });
  });

  describe('in COMMUNICATION_IFRAME_ESTABLISHED state', () => {
    let communicationIframe;

    beforeEach(() => {
      const gisSource = mockGisFrame.contentWindow;
      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_PING',
            sessionId: 'test-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );

      const iframes = doc.getBody().querySelectorAll('iframe');
      communicationIframe = Array.from(iframes).find((f) => f !== mockGisFrame);

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_IFRAME_LOADED_RRM',
            sessionId: 'test-session-id',
          },
          source: communicationIframe.contentWindow,
          origin: 'https://example.com',
        })
      );

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_READY_GIS',
            sessionId: 'test-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );
    });

    it('should remove iframe and transition to YIELDED on yield()', () => {
      const clock = sandbox.useFakeTimers();

      manager.yield();

      expect(manager.getState()).to.equal(GisInteropManagerStates.YIELDED);

      clock.tick(1001);

      const iframes = doc.getBody().querySelectorAll('iframe');
      const foundcommunicationIframe = Array.from(iframes).find(
        (f) => f === communicationIframe
      );
      expect(foundcommunicationIframe).to.be.undefined;
    });
  });

  describe('Sync Flow', () => {
    let communicationIframe;

    beforeEach(() => {
      const gisSource = mockGisFrame.contentWindow;
      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_PING',
            sessionId: 'test-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );

      const iframes = doc.getBody().querySelectorAll('iframe');
      communicationIframe = Array.from(iframes).find((f) => f !== mockGisFrame);

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_IFRAME_LOADED_RRM',
            sessionId: 'test-session-id',
          },
          source: communicationIframe.contentWindow,
          origin: 'https://example.com',
        })
      );

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_READY_GIS',
            sessionId: 'test-session-id',
          },
          source: gisSource,
          origin: 'https://example.com',
        })
      );
    });

    it('should handle RRM_GIS_TOKEN_UPDATE_START', async () => {
      storageMock.get
        .withArgs(StorageKeys.USER_TOKEN, true)
        .resolves('test-user-token');

      const iframeSpy = sandbox.spy(
        communicationIframe.contentWindow,
        'postMessage'
      );

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_TOKEN_UPDATE_START',
            sessionId: 'test-session-id',
          },
          source: communicationIframe.contentWindow,
          origin: 'https://example.com',
        })
      );

      await Promise.resolve();

      expect(iframeSpy).to.have.been.calledWith(
        {
          type: 'RRM_GIS_SWG_USER_TOKEN',
          swgUserToken: 'test-user-token',
          sessionId: 'test-session-id',
        },
        {
          targetOrigin: 'https://example.com',
        }
      );
    });

    it('should handle RRM_GIS_TOKEN_UPDATED', async () => {
      entitlementsManagerMock.updateEntitlements.resolves();

      const iframeSpy = sandbox.spy(
        communicationIframe.contentWindow,
        'postMessage'
      );

      win.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'RRM_GIS_TOKEN_UPDATED',
            swgUserToken: 'new-user-token',
            sessionId: 'test-session-id',
          },
          source: communicationIframe.contentWindow,
          origin: 'https://example.com',
        })
      );

      await Promise.resolve();

      expect(
        entitlementsManagerMock.updateEntitlements
      ).to.have.been.calledWith('new-user-token');

      expect(iframeSpy).to.have.been.calledWith(
        {
          type: 'RRM_GIS_REDIRECT_OK',
          sessionId: 'test-session-id',
        },
        {
          targetOrigin: 'https://example.com',
        }
      );
    });
  });
});
