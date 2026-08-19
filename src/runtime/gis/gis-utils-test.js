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
import {
  GisMode,
  getGisMode,
  mixRrmGisTokens,
  processGisCredentialInternal,
} from './gis-utils';
import {InterventionType} from '../../api/intervention-type';
import {XhrFetcher} from '../fetcher';

describes.sandboxed('gis-utils', () => {
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
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerNotReady
        )
      ).to.equal(GisMode.GisModeDisabled);
    });

    it('returns GisModeDisabled when action is not TYPE_REGISTRATION_WALL', () => {
      expect(
        getGisMode(
          InterventionType.TYPE_NEWSLETTER_SIGNUP,
          gisInteropManagerReady
        )
      ).to.equal(GisMode.GisModeDisabled);
    });

    it('returns GisModeOverlay when action is TYPE_REGISTRATION_WALL and gisInteropManager is ready', () => {
      expect(
        getGisMode(
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerReady
        )
      ).to.equal(GisMode.GisModeOverlay);
    });

    it('returns GisModeOverlay when gisInterop parameter is true, even if gisInteropManager is not ready', () => {
      expect(
        getGisMode(
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerNotReady,
          true
        )
      ).to.equal(GisMode.GisModeOverlay);
    });

    it('returns GisModeOverlay when gisInteropManager.isConnectionExpected() is true', () => {
      const managerWithExpectedConnection = {
        getState: () => GisInteropManagerStates.WAITING_FOR_PING,
        isConnectionExpected: () => true,
      };
      expect(
        getGisMode(
          InterventionType.TYPE_REGISTRATION_WALL,
          managerWithExpectedConnection
        )
      ).to.equal(GisMode.GisModeOverlay);
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
        win: () => globalThis,
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

  describe('processGisCredentialInternal', () => {
    let deps;
    let managerMock;
    let dialogMock;
    let loadingViewMock;
    let containerMock;
    let sendPostStub;

    beforeEach(() => {
      managerMock = {
        isRegwallClickPending: sandbox.stub().returns(false),
        setRegwallClickPending: sandbox.stub(),
        triggerCompleteLogin: sandbox.stub().resolves(false),
      };

      loadingViewMock = {
        show: sandbox.stub(),
        hide: sandbox.stub(),
      };

      containerMock = {
        style: {
          setProperty: sandbox.stub(),
        },
      };

      dialogMock = {
        getLoadingView: sandbox.stub().returns(loadingViewMock),
        getContainer: sandbox.stub().returns(containerMock),
      };

      deps = {
        win: () => globalThis,
        pageConfig: () => ({
          getPublicationId: () => 'pub1',
        }),
        storage: () => ({
          get: sandbox.stub().resolves('fakeSwgUserToken'),
          set: sandbox.stub().resolves(),
        }),
        entitlementsManager: () => ({
          updateEntitlements: sandbox.stub().resolves(),
        }),
        gisInteropManager: sandbox.stub().returns(managerMock),
        dialogManager: sandbox.stub().returns({
          getDialog: sandbox.stub().returns(dialogMock),
        }),
      };

      sendPostStub = sandbox.stub(XhrFetcher.prototype, 'sendPost').resolves({
        swgUserToken: 'newSwgUserToken',
      });
    });

    it('handles Regwall flow successfully', async () => {
      managerMock.isRegwallClickPending.returns(true);
      managerMock.triggerCompleteLogin.resolves(true);

      const response = {credential: 'fakeIdToken'};
      const params = {gisClientId: 'fakeClientId'};

      const result = await processGisCredentialInternal(deps, response, params);

      expect(result).to.be.true;
      expect(loadingViewMock.show).to.have.been.calledOnce;
      expect(containerMock.style.setProperty).to.have.been.calledWith(
        'display',
        'none',
        'important'
      );
      expect(managerMock.setRegwallClickPending).to.have.been.calledWith(false);
      expect(managerMock.triggerCompleteLogin).to.have.been.calledWith(
        'newSwgUserToken'
      );
      // Should NOT hide loading view because keepLoading should be true
      expect(loadingViewMock.hide).to.not.have.been.called;
    });

    it('handles Regwall flow failure in triggerCompleteLogin', async () => {
      managerMock.isRegwallClickPending.returns(true);
      managerMock.triggerCompleteLogin.resolves(false); // Failed to handle

      const response = {credential: 'fakeIdToken'};
      const params = {gisClientId: 'fakeClientId'};

      const result = await processGisCredentialInternal(deps, response, params);

      expect(result).to.be.false;
      expect(loadingViewMock.show).to.have.been.calledOnce;
      expect(managerMock.setRegwallClickPending).to.have.been.calledWith(false);
      // Should hide loading view because keepLoading should be false
      expect(loadingViewMock.hide).to.have.been.calledOnce;
      expect(containerMock.style.setProperty).to.have.been.calledWith(
        'display',
        'block',
        'important'
      );
    });

    it('handles Regwall flow when no swgUserToken is returned', async () => {
      managerMock.isRegwallClickPending.returns(true);
      sendPostStub.resolves({});

      const response = {credential: 'fakeIdToken'};
      const params = {gisClientId: 'fakeClientId'};

      const result = await processGisCredentialInternal(deps, response, params);

      expect(result).to.be.false;
      expect(loadingViewMock.show).to.have.been.calledOnce;
      expect(managerMock.setRegwallClickPending).to.have.been.calledWith(false);
      expect(managerMock.triggerCompleteLogin).to.not.have.been.called;
      expect(loadingViewMock.hide).to.have.been.calledOnce;
    });

    it('handles Non-Regwall flow', async () => {
      managerMock.isRegwallClickPending.returns(false);

      const response = {credential: 'fakeIdToken'};
      const params = {gisClientId: 'fakeClientId'};

      const result = await processGisCredentialInternal(deps, response, params);

      expect(result).to.be.false;
      expect(loadingViewMock.show).to.not.have.been.called;
      expect(containerMock.style.setProperty).to.not.have.been.called;
      expect(managerMock.setRegwallClickPending).to.not.have.been.called;
      expect(managerMock.triggerCompleteLogin).to.not.have.been.called;
      // Should NOT manipulate loading view
      expect(loadingViewMock.hide).to.not.have.been.called;
    });

    it('cleans up UI on error', async () => {
      managerMock.isRegwallClickPending.returns(true);
      sendPostStub.rejects(new Error('Network error'));

      const response = {credential: 'fakeIdToken'};
      const params = {gisClientId: 'fakeClientId'};

      await expect(
        processGisCredentialInternal(deps, response, params)
      ).to.eventually.be.rejectedWith('Network error');

      // Should hide loading view and restore container
      expect(loadingViewMock.hide).to.have.been.calledOnce;
      expect(containerMock.style.setProperty).to.have.been.calledWith(
        'display',
        'block',
        'important'
      );
    });
  });
});
