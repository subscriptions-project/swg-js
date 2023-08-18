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
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {Toast} from '../ui/toast';

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
        env.win.googletag = {
          cmd: [],
          defineOutOfPageSlot: () => rewardedSlot,
          enums: {OutOfPageFormat: {REWARDED: 'REWARDED'}},
          pubads: () => pubadsobj,
          enableServices: () => {},
          display: (rewardedSlot) => {},
          destroySlots: sandbox.spy(),
        };
      });

      it('renders', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
        };
        const flow = new AudienceActionLocalFlow(runtime, params);

        await flow.start();

        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;
        const loadingPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(loadingPrompt.innerHTML).contains('Loading...');

        // Manually invoke the command for gpt.js.
        expect(env.win.googletag.cmd[0]).to.not.be.null;
        const initPromise = env.win.googletag.cmd[0]();

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady']();

        await initPromise;

        const prompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(prompt.innerHTML).contains('Support us by watching this ad');
      });

      it('fails to render with bad ad slot', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
        };
        const flow = new AudienceActionLocalFlow(runtime, params);
        env.win.googletag.defineOutOfPageSlot = () => null;

        await flow.start();

        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;
        const loadingPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(loadingPrompt.innerHTML).contains('Loading...');

        // Manually invoke the command for gpt.js.
        expect(env.win.googletag.cmd[0]).to.not.be.null;
        await env.win.googletag.cmd[0]();

        const errorPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(errorPrompt.innerHTML).contains('Something went wrong.');
      });

      it('renders with rewardedSlotGranted', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
        };
        const flow = new AudienceActionLocalFlow(runtime, params);

        await flow.start();

        let wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;
        const loadingPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(loadingPrompt.innerHTML).contains('Loading...');

        // Manually invoke the command for gpt.js.
        expect(env.win.googletag.cmd[0]).to.not.be.null;
        const initPromise = env.win.googletag.cmd[0]();

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady']();
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']();

        await initPromise;

        wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
      });

      it('renders with rewardedSlotClosed for free content', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          isClosable: true,
          onCancel: sandbox.spy(),
        };
        const flow = new AudienceActionLocalFlow(runtime, params);

        await flow.start();

        let wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;
        const loadingPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(loadingPrompt.innerHTML).contains('Loading...');

        // Manually invoke the command for gpt.js.
        expect(env.win.googletag.cmd[0]).to.not.be.null;
        const initPromise = env.win.googletag.cmd[0]();

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady']();
        expect(eventListeners['rewardedSlotClosed']).to.not.be.null;
        await eventListeners['rewardedSlotClosed']();

        await initPromise;

        wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(params.onCancel).to.be.calledOnce.calledWithExactly();
      });

      it('renders with rewardedSlotClosed for locked content', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          isClosable: false,
          onCancel: sandbox.spy(),
        };
        const flow = new AudienceActionLocalFlow(runtime, params);

        await flow.start();

        let wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;
        const loadingPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(loadingPrompt.innerHTML).contains('Loading...');

        wrapper.style.display = 'none';

        // Manually invoke the command for gpt.js.
        expect(env.win.googletag.cmd[0]).to.not.be.null;
        const initPromise = env.win.googletag.cmd[0]();

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady']();
        expect(eventListeners['rewardedSlotClosed']).to.not.be.null;
        await eventListeners['rewardedSlotClosed']();

        await initPromise;

        wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper.style.display).equal('block');
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(params.onCancel).to.not.be.called;
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
