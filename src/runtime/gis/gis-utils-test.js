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
import {GisInteropManagerStates} from './gis-interop-manager';
import {GisMode, getGisMode, mixRrmGisTokens} from './gis-utils';
import {InterventionType} from '../../api/intervention-type';
import {XhrFetcher} from '../fetcher';

describes.realWin('gis-utils', (env) => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  describe('getGisMode', () => {
    let gisInteropManagerReady;
    let gisInteropManagerNotReady;

    beforeEach(() => {
      gisInteropManagerReady = {
        getState: () =>
          GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED,
        isConnectionExpected: () => true,
      };
      gisInteropManagerNotReady = {
        getState: () => GisInteropManagerStates.WAITING_FOR_PING,
        isConnectionExpected: () => false,
      };
    });

    it('returns GisModeDisabled when gisInteropManager is not ready', () => {
      expect(
        getGisMode(
          win,
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerNotReady
        )
      ).to.equal(GisMode.GisModeDisabled);
    });

    it('returns GisModeDisabled when action is not TYPE_REGISTRATION_WALL', () => {
      expect(
        getGisMode(
          win,
          InterventionType.TYPE_NEWSLETTER_SIGNUP,
          gisInteropManagerReady
        )
      ).to.equal(GisMode.GisModeDisabled);
    });

    it('returns GisModeOverlay for Safari browser', () => {
      const fakeWin = {
        navigator: {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        },
      };
      expect(
        getGisMode(
          fakeWin,
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerReady
        )
      ).to.equal(GisMode.GisModeOverlay);
    });

    it('returns GisModeNormal for non-Safari browser (Chrome)', () => {
      const fakeWin = {
        navigator: {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        },
      };
      expect(
        getGisMode(
          fakeWin,
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerReady
        )
      ).to.equal(GisMode.GisModeNormal);
    });

    it('returns GisModeNormal when gisInterop parameter is true, even if gisInteropManager is not ready', () => {
      const fakeWin = {
        navigator: {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        },
      };
      expect(
        getGisMode(
          fakeWin,
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerNotReady,
          true
        )
      ).to.equal(GisMode.GisModeNormal);
    });

    it('returns GisModeNormal when gisInteropManager.isConnectionExpected() is true', () => {
      const fakeWin = {
        navigator: {
          userAgent: 'Chrome',
        },
      };
      const managerWithExpectedConnection = {
        getState: () => GisInteropManagerStates.WAITING_FOR_PING,
        isConnectionExpected: () => true,
      };
      expect(
        getGisMode(
          fakeWin,
          InterventionType.TYPE_REGISTRATION_WALL,
          managerWithExpectedConnection
        )
      ).to.equal(GisMode.GisModeNormal);
    });
  });

  describe('mixRrmGisTokens', () => {
    let deps;
    let storageMock;
    let entitlementsManagerMock;
    let sendPostStub;

    beforeEach(() => {
      storageMock = {
        get: sandbox.stub().resolves('fakeSwgUserToken'),
        set: sandbox.stub().resolves(),
      };
      entitlementsManagerMock = {
        updateEntitlements: sandbox.stub().resolves(),
      };
      deps = {
        win: () => win,
        pageConfig: () => ({
          getPublicationId: () => 'pub1',
        }),
        storage: () => storageMock,
        entitlementsManager: () => entitlementsManagerMock,
      };

      sendPostStub = sandbox.stub(XhrFetcher.prototype, 'sendPost').resolves({
        swgUserToken: 'newSwgUserToken',
      });
    });

    it('constructs URL correctly and calls sendPost', async () => {
      const params = {
        idToken: 'fakeIdToken',
        gisClientId: 'fakeClientId',
        gisOrigin: 'fakeGisOrigin',
      };

      await mixRrmGisTokens(deps, params);

      expect(sendPostStub).to.have.been.calledOnce;
      const [url, message] = sendPostStub.firstCall.args;

      expect(url).to.contain('/publication/pub1/mixrrmgistokens');
      expect(url).to.contain('sut=fakeSwgUserToken');
      expect(url).to.contain('id_token=fakeIdToken');
      expect(url).to.contain('gis_client_id=fakeClientId');
      expect(url).to.contain('gis_origin=fakeGisOrigin');
      expect(url).to.contain('rrm_origin=');

      expect(message.toArray()).to.deep.equal([]);
      expect(message.label()).to.equal('MixRrmGisTokens');
    });

    it('updates entitlements if new token is returned', async () => {
      const params = {
        idToken: 'fakeIdToken',
        gisClientId: 'fakeClientId',
      };

      const response = await mixRrmGisTokens(deps, params);

      expect(response.swgUserToken).to.equal('newSwgUserToken');
      expect(
        entitlementsManagerMock.updateEntitlements
      ).to.have.been.calledWith('newSwgUserToken');
    });

    it('does not update entitlements if no new token is returned', async () => {
      sendPostStub.resolves({});
      const params = {
        idToken: 'fakeIdToken',
        gisClientId: 'fakeClientId',
      };

      await mixRrmGisTokens(deps, params);

      expect(entitlementsManagerMock.updateEntitlements).to.not.have.been
        .called;
    });
  });
});
