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

import {AnalyticsEvent} from '../../proto/api_messages';
import {
  GisInteropManager,
  GisInteropManagerStates,
} from './gis-interop-manager';
import {GlobalDoc} from '../../model/doc';
import {StorageKeys} from '../../utils/constants';

describes.realWin('GisInteropManager', (env) => {
  let win;
  let doc;
  let manager;
  let mockGisFrame;
  let storageMock;
  let entitlementsManagerMock;
  let pageConfigMock;
  let eventManagerMock;
  let postMessageSpy;

  beforeEach(() => {
    win = env.win;
    doc = new GlobalDoc(win);
    storageMock = {
      get: sandbox.stub(),
      remove: sandbox.stub(),
    };
    entitlementsManagerMock = {
      updateEntitlements: sandbox.stub(),
    };
    pageConfigMock = {
      getPublicationId: sandbox.stub().returns('test-pub-id'),
    };
    eventManagerMock = {
      logEvent: sandbox.stub(),
      logSwgEvent: sandbox.stub(),
    };
    manager = new GisInteropManager(
      doc,
      storageMock,
      entitlementsManagerMock,
      pageConfigMock,
      eventManagerMock
    );
    mockGisFrame = doc.getRootNode().createElement('iframe');
    doc.getBody().appendChild(mockGisFrame);
    postMessageSpy = sandbox.spy(mockGisFrame.contentWindow, 'postMessage');
  });

  afterEach(() => {
    if (mockGisFrame && mockGisFrame.parentNode) {
      mockGisFrame.parentNode.removeChild(mockGisFrame);
    }
  });

  function dispatchMessage({source, data = {}}) {
    win.dispatchEvent(
      new MessageEvent('message', {
        data: {sessionId: 'test-session-id', ...data},
        source,
        origin: 'https://example.com',
      })
    );
  }

  async function dispatchFromGisIframe(data) {
    dispatchMessage({
      source: mockGisFrame.contentWindow,
      data,
    });
    await Promise.resolve();
  }

  function getCommunicationIframe() {
    const iframes = doc.getBody().querySelectorAll('iframe');
    return Array.from(iframes).find((f) => f !== mockGisFrame);
  }

  async function dispatchFromCommunicationIframe(data) {
    dispatchMessage({
      source: getCommunicationIframe().contentWindow,
      data,
    });
    await Promise.resolve();
  }

  describe('in WAITING_FOR_PING state', () => {
    it('should be in WAITING_FOR_PING state initially', () => {
      expect(manager.getState()).to.equal(
        GisInteropManagerStates.WAITING_FOR_PING
      );
    });

    it('should ignore yield() call', () => {
      manager.yield();

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.WAITING_FOR_PING
      );
    });

    it('should ignore non-PING messages', async () => {
      await dispatchFromGisIframe({type: 'RANDOM_MESSAGE'});
      expect(manager.getState()).to.equal(
        GisInteropManagerStates.WAITING_FOR_PING
      );
    });

    it('should ignore PING without sessionId', async () => {
      await dispatchFromGisIframe({type: 'RRM_GIS_PING', sessionId: null});

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.WAITING_FOR_PING
      );
    });

    it('should log error when RRM_GIS_ERROR received in WAITING_FOR_PING', async () => {
      await dispatchFromGisIframe({type: 'RRM_GIS_ERROR'});

      expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
        AnalyticsEvent.EVENT_GIS_INTEROP_WAITING_FOR_PING_ERROR
      );
    });

    it('should transition to LOADING_COMMUNICATION_IFRAME on valid PING', async () => {
      await dispatchFromGisIframe({
        type: 'RRM_GIS_PING',
        clientId: 'test-client-id',
      });

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );

      expect(postMessageSpy).to.have.been.calledWith({
        type: 'RRM_GIS_ACK',
        sessionId: 'test-session-id',
      });

      expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
        AnalyticsEvent.EVENT_GIS_INTEROP_PING_RECEIVED
      );

      const communicationIframe = getCommunicationIframe();
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
    beforeEach(async () => {
      await dispatchFromGisIframe({
        type: 'RRM_GIS_PING',
        clientId: 'test-client-id',
      });

      const communicationIframe = getCommunicationIframe();
      expect(communicationIframe).to.exist;

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );
    });

    it('should log error when RRM_GIS_ERROR received', async () => {
      await dispatchFromCommunicationIframe({type: 'RRM_GIS_ERROR'});

      expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
        AnalyticsEvent.EVENT_GIS_INTEROP_LOADING_IFRAME_ERROR
      );
    });

    it('should ignore messages with wrong sessionId', async () => {
      await dispatchFromCommunicationIframe({
        type: 'RRM_GIS_READY',
        sessionId: 'wrong-session-id',
      });

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );
    });

    it('should ignore IFRAME_LOADED from wrong source', async () => {
      await dispatchFromGisIframe({
        type: 'RRM_GIS_IFRAME_LOADED_RRM',
      });

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );

      expect(postMessageSpy).to.not.have.been.calledWithMatch({
        type: 'RRM_GIS_READY',
      });
    });

    it('should transition to COMMUNICATION_IFRAME_ESTABLISHED (Scenario 1: IFRAME_LOADED then READY)', async () => {
      await dispatchFromGisIframe({
        type: 'RRM_GIS_IFRAME_LOADED_RRM',
      });

      expect(postMessageSpy).to.have.callCount(2);
      expect(postMessageSpy).to.have.been.calledWith(
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

      await dispatchFromGisIframe({
        type: 'RRM_GIS_READY_GIS',
      });

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED
      );
    });

    it('should transition to COMMUNICATION_IFRAME_ESTABLISHED (Scenario 2: READY then IFRAME_LOADED)', async () => {
      await dispatchFromGisIframe({
        type: 'RRM_GIS_READY_GIS',
      });

      expect(manager.getState()).to.equal(
        GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
      );

      await dispatchFromCommunicationIframe({
        type: 'RRM_GIS_IFRAME_LOADED_RRM',
      });

      expect(postMessageSpy).to.have.callCount(2);
      expect(postMessageSpy).to.have.been.calledWith(
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

  describe('in COMMUNICATION_IFRAME_ESTABLISHED state', async () => {
    let communicationIframe;
    let communicationIframePostMessageSpy;

    beforeEach(async () => {
      await dispatchFromGisIframe({
        type: 'RRM_GIS_PING',
        clientId: 'test-client-id',
      });

      await dispatchFromCommunicationIframe({
        type: 'RRM_GIS_IFRAME_LOADED_RRM',
      });

      await dispatchFromGisIframe({
        type: 'RRM_GIS_READY_GIS',
      });

      communicationIframe = getCommunicationIframe();

      expect(communicationIframe).to.exist;

      communicationIframePostMessageSpy = sandbox.spy(
        communicationIframe.contentWindow,
        'postMessage'
      );
    });

    it('should log error when RRM_GIS_ERROR received', async () => {
      await dispatchFromCommunicationIframe({
        type: 'RRM_GIS_ERROR',
      });

      expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
        AnalyticsEvent.EVENT_GIS_INTEROP_OPERATION_ERROR
      );
    });

    it('should ignore messages with wrong sessionId', async () => {
      await dispatchFromCommunicationIframe({
        type: 'RRM_GIS_TOKEN_UPDATE_START',
        sessionId: 'wrong-session-id',
      });

      expect(communicationIframePostMessageSpy).to.not.have.been.called;
    });

    it('should ignore messages from wrong source', async () => {
      await dispatchFromGisIframe({
        type: 'RRM_GIS_TOKEN_UPDATE_START',
      });

      expect(communicationIframePostMessageSpy).to.not.have.been.called;
    });

    describe('in YIELDED state', () => {
      beforeEach(async () => {
        await manager.yield();

        expect(manager.getState()).to.equal(GisInteropManagerStates.YIELDED);
      });

      it('should notify iframe', () => {
        expect(communicationIframePostMessageSpy).to.have.been.calledWith(
          {
            type: 'RRM_GIS_YIELD',
            sessionId: 'test-session-id',
          },
          {
            targetOrigin: 'https://news.google.com',
          }
        );
      });

      it('should ignore further calls to yield()', async () => {
        expect(communicationIframePostMessageSpy).to.have.been.calledOnce;
        await manager.yield();
        expect(communicationIframePostMessageSpy).to.have.been.calledOnce;
      });

      it('should handle messages', async () => {
        entitlementsManagerMock.updateEntitlements.resolves();

        await dispatchFromCommunicationIframe({
          type: 'RRM_GIS_TOKEN_UPDATE_START',
        });

        await dispatchFromCommunicationIframe({
          type: 'RRM_GIS_TOKEN_UPDATED',
          swgUserToken: 'new-user-token',
        });
        expect(
          entitlementsManagerMock.updateEntitlements
        ).to.have.been.calledWith('new-user-token');
        expect(communicationIframePostMessageSpy).to.have.been.calledWith(
          {
            type: 'RRM_GIS_REDIRECT_OK',
            sessionId: 'test-session-id',
          },
          {
            targetOrigin: 'https://news.google.com',
          }
        );
      });
    });

    describe('in TOKEN_UPDATE_IN_PROGRESS state', () => {
      beforeEach(async () => {
        storageMock.get
          .withArgs(StorageKeys.USER_TOKEN, true)
          .resolves('test-user-token');
        await dispatchFromCommunicationIframe({
          type: 'RRM_GIS_TOKEN_UPDATE_START',
        });
      });

      it('should handle RRM_GIS_TOKEN_UPDATE_START', async () => {
        expect(manager.getState()).to.equal(
          GisInteropManagerStates.TOKEN_UPDATE_IN_PROGRESS
        );
        expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
          AnalyticsEvent.EVENT_GIS_INTEROP_TOKEN_UPDATE_START
        );
        expect(communicationIframePostMessageSpy).to.have.been.calledWith(
          {
            type: 'RRM_GIS_SWG_USER_TOKEN',
            swgUserToken: 'test-user-token',
            sessionId: 'test-session-id',
            clientId: 'test-client-id',
            publicationId: 'test-pub-id',
          },
          {
            targetOrigin: 'https://news.google.com',
          }
        );
      });

      it('should handle RRM_GIS_TOKEN_UPDATED', async () => {
        entitlementsManagerMock.updateEntitlements.resolves();

        await dispatchFromCommunicationIframe({
          type: 'RRM_GIS_TOKEN_UPDATED',
          swgUserToken: 'new-user-token',
        });

        expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
          AnalyticsEvent.EVENT_GIS_INTEROP_TOKEN_UPDATED
        );
        expect(
          entitlementsManagerMock.updateEntitlements
        ).to.have.been.calledWith('new-user-token');
        expect(communicationIframePostMessageSpy).to.have.been.calledWith(
          {
            type: 'RRM_GIS_REDIRECT_OK',
            sessionId: 'test-session-id',
          },
          {
            targetOrigin: 'https://news.google.com',
          }
        );
      });

      it('should log error when RRM_GIS_ERROR received during token update', async () => {
        await dispatchFromCommunicationIframe({type: 'RRM_GIS_ERROR'});

        expect(eventManagerMock.logSwgEvent).to.have.been.calledWith(
          AnalyticsEvent.EVENT_GIS_INTEROP_TOKEN_UPDATE_ERROR
        );
      });

      it('should ignore RRM_GIS_TOKEN_UPDATED with wrong sessionId', async () => {
        await dispatchFromCommunicationIframe({
          type: 'RRM_GIS_TOKEN_UPDATED',
          sessionId: 'wrong-session-id',
          swgUserToken: 'new-user-token',
        });

        expect(eventManagerMock.logSwgEvent).to.not.have.been.calledWith(
          AnalyticsEvent.EVENT_GIS_INTEROP_TOKEN_UPDATED
        );
        expect(entitlementsManagerMock.updateEntitlements).to.not.have.been
          .called;
        expect(manager.getState()).to.equal(
          GisInteropManagerStates.TOKEN_UPDATE_IN_PROGRESS
        );
      });
    });
  });
});
