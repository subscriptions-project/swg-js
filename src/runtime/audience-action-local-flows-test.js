/**
 * Copyright 2023 The Subscribe with Google Authors. All Rights Reserved.
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

import {AudienceActionLocalFlow} from './audience-action-local-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {Toast} from '../ui/toast';
import {tick} from '../../test/tick';

describes.realWin('AudienceActionLocalFlow', (env) => {
  let runtime;

  beforeEach(() => {
    runtime = new ConfiguredRuntime(
      env.win,
      new PageConfig(
        /* productOrPublicationId= */ 'pub1:label1',
        /* locked= */ true
      ),
      /* integr= */ undefined,
      /* config= */ undefined,
      /* clientOptions= */ {}
    );
  });

  describe('start', () => {
    it('renders with error view prompt', async () => {
      const params = {
        action: 'invlid action',
      };
      const flow = new AudienceActionLocalFlow(runtime, params);

      await flow.start();

      const wrapper = env.win.document.querySelector(
        '.audience-action-local-wrapper'
      );
      expect(wrapper).to.not.be.null;
      const prompt = wrapper.shadowRoot.querySelector('.prompt');
      expect(prompt.innerHTML).contains('Something went wrong.');
      const closePromptButton = prompt.querySelector('.closePromptButton');
      expect(closePromptButton).to.be.null;
    });

    describe('rewarded ad', () => {
      let rewardedSlot;
      let pubadsobj;
      let eventListeners;
      let readyEventArg;

      beforeEach(() => {
        rewardedSlot = {
          addService: () => {},
        };
        eventListeners = {};
        pubadsobj = {
          addEventListener: (event, handler) => {
            eventListeners[event] = handler;
          },
        };
        readyEventArg = {
          makeRewardedVisible: sandbox.spy(),
        };
        env.win.googletag = {
          cmd: [],
          defineOutOfPageSlot: () => rewardedSlot,
          enums: {OutOfPageFormat: {REWARDED: 'REWARDED'}},
          pubads: () => pubadsobj,
          enableServices: () => {},
          display: () => {},
          destroySlots: sandbox.spy(),
        };
      });

      async function renderAndAssertRewardedAd(params) {
        const flow = new AudienceActionLocalFlow(
          runtime,
          params,
          /* gptTimeout_= */ 1000
        );

        await flow.start();

        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;

        const loadingPrompt = wrapper.shadowRoot.querySelector(
          'swg-loading-container'
        );
        expect(loadingPrompt).to.not.be.null;

        // Manually invoke the command for gpt.js.
        expect(env.win.googletag.cmd[0]).to.not.be.null;
        const initPromise = env.win.googletag.cmd[0]();

        return {wrapper, initPromise};
      }

      it('renders subscription', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
          monetizationFunction: sandbox.spy(),
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        await initPromise;

        const contributeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-contribute-button'
        );
        expect(contributeButton).to.be.null;
        const subscribeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-subscribe-button'
        );
        expect(subscribeButton).not.to.be.null;

        await subscribeButton.click();
        await tick();

        expect(
          params.monetizationFunction
        ).to.be.calledOnce.calledWithExactly();
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
      });

      it('renders contribution', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          monetizationFunction: sandbox.spy(),
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        await initPromise;

        const contributeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-contribute-button'
        );
        expect(contributeButton).not.to.be.null;
        const subscribeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-subscribe-button'
        );
        expect(subscribeButton).to.be.null;

        await contributeButton.click();
        await tick();

        // expect(params.monetizationFunction).to.be.calledOnce.calledWithExactly();
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
      });

      it('renders isClosable == true', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          isClosable: true,
          onCancel: sandbox.spy(),
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        await initPromise;

        const closeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-close-button'
        );
        expect(closeButton).not.to.be.null;

        await closeButton.click();
        await tick();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(params.onCancel).to.be.calledOnce.calledWithExactly();
      });

      it('renders isClosable == false', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          isClosable: false,
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        await initPromise;

        const prompt = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-close-button'
        );
        expect(prompt).to.be.null;
      });

      it('renders sign-in', async () => {
        const loginSpy = sandbox.spy();
        runtime.setOnLoginRequest(loginSpy);
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        await initPromise;

        const signinButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-sign-in-button'
        );
        expect(signinButton).to.not.be.null;

        await signinButton.click();
        await tick();

        expect(loginSpy).to.be.calledOnce.calledWithExactly({
          linkRequested: false,
        });
      });

      it('fails to render with bad ad slot', async () => {
        env.win.googletag.defineOutOfPageSlot = () => null;
        const params = {
          action: 'TYPE_REWARDED_AD',
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        await initPromise;

        const errorPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(errorPrompt.innerHTML).contains('Something went wrong.');
      });

      it('fails to render with gpt.js timeout', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        await initPromise;

        const errorPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(errorPrompt.innerHTML).contains('Something went wrong.');
      });

      it('renders thanks with rewardedSlotGranted', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']();

        await initPromise;

        const prompt = wrapper.shadowRoot.querySelector('.rewarded-ad-prompt');
        expect(prompt).to.not.be.null;
        expect(prompt.innerHTML).contains('Thanks for viewing this ad');

        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
      });

      it('closes on thanks', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']();

        await initPromise;

        const closeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-close-button'
        );
        await closeButton.click();
        await tick();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
      });

      it('renders with rewardedSlotClosed for free content', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          isClosable: true,
          onCancel: sandbox.spy(),
        };
        const render = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotClosed']).to.not.be.null;
        await eventListeners['rewardedSlotClosed']();

        await render.initPromise;

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(params.onCancel).to.be.calledOnce.calledWithExactly();
      });

      it('renders with rewardedSlotClosed for locked content', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          isClosable: false,
        };
        const render = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotClosed']).to.not.be.null;
        await eventListeners['rewardedSlotClosed']();

        await render.initPromise;

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.not.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
      });

      it('shows an ad', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        };
        const {wrapper, initPromise} = await renderAndAssertRewardedAd(params);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        await initPromise;

        const viewButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-view-ad-button'
        );
        expect(viewButton).to.not.be.null;

        await viewButton.click();
        await tick();

        expect(viewButton.getAttribute('disabled')).to.equal('true');

        expect(
          readyEventArg.makeRewardedVisible
        ).to.be.calledOnce.calledWithExactly();
      });
    });
  });

  describe('showNoEntitlementFoundToast', () => {
    it('opens toast', async () => {
      const params = {
        action: 'action',
      };
      const flow = new AudienceActionLocalFlow(runtime, params);

      const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

      await flow.showNoEntitlementFoundToast();

      expect(toastOpenStub).to.be.called.calledWithExactly();
    });
  });
});
