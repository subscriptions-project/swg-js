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

import {AnalyticsEvent} from '../proto/api_messages';
import {AudienceActionLocalFlow} from './audience-action-local-flow';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {Toast} from '../ui/toast';
import {tick} from '../../test/tick';

const DEFAULT_PARAMS = {
  action: 'TYPE_REWARDED_AD',
  configurationId: 'xyz',
  autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
};

const NEWSLETTER_PARAMS = {
  action: 'TYPE_NEWSLETTER_SIGNUP',
  configurationId: 'newsletter_config_id',
};

const DEFAULT_CONFIG = `
{
  "publication": {
    "name": "PUBLICATOIN_NAME"
  },
  "rewardedAdParameters": {
    "adunit": "ADUNIT",
    "customMessage": "CUSTOM_MESSAGE"
  }
}`;

const NEWSLETTER_CONFIG = `
{
  "publication": {
    "name": "PUBLICATOIN_NAME"
  },
  "optInParameters": {
    "title": "newsletter_title",
    "body": "newsletter_body",
    "promptPreference": "PREFERENCE_PUBLISHER_PROVIDED_PROMPT",
    "codeSnippet": "<form>newsletter_code_snippet</form>"
  }
}`;

const DEFAULT_COMPLETE_RESPONSE = `
{
  "updated": true,
  "alreadyCompleted": true,
  "swgUserToken": "xyz"
}`;

describes.realWin('AudienceActionLocalFlow', (env) => {
  let runtime;
  let eventManager;
  let entitlementsManager;

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
    env.win.localStorage.getItem = () => 'abc';
    env.win.localStorage.setItem = sandbox.spy();
    env.win.sessionStorage.setItem = sandbox.spy();
    eventManager = {
      logSwgEvent: sandbox.spy(),
    };
    runtime.eventManager = () => eventManager;
    entitlementsManager = {
      clear: sandbox.spy(),
      getEntitlements: sandbox.spy(),
    };
    runtime.entitlementsManager = () => entitlementsManager;
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
      let configResponse;
      let completeResponse;

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
        configResponse = new Response(null, {status: 200});
        completeResponse = new Response(null, {status: 200});
      });

      async function renderAndAssertRewardedAd(
        params,
        config,
        complete = DEFAULT_COMPLETE_RESPONSE
      ) {
        configResponse.text = sandbox.stub().returns(Promise.resolve(config));
        completeResponse.text = sandbox
          .stub()
          .returns(Promise.resolve(complete));
        env.win.fetch = sandbox.stub();
        env.win.fetch.onCall(0).returns(Promise.resolve(configResponse));
        env.win.fetch.onCall(1).returns(Promise.resolve(completeResponse));

        const flow = new AudienceActionLocalFlow(
          runtime,
          params,
          /* gptTimeoutMs_= */ 1
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
        env.win.googletag.cmd[0]();

        return {flow, wrapper};
      }

      it('renders subscription', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
          monetizationFunction: sandbox.spy(),
        };
        const state = await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=undefined&origin=about%3Asrcdoc'
        );

        const subscribeButton = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(subscribeButton.innerHTML).contains('Subscribe');

        await subscribeButton.click();
        await tick();

        expect(
          params.monetizationFunction
        ).to.be.calledOnce.calledWithExactly();
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.IMPRESSION_REWARDED_AD
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_READY
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_SUPPORT
        );
      });

      it('renders contribution', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          monetizationFunction: sandbox.spy(),
        };
        const state = await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=undefined&origin=about%3Asrcdoc'
        );

        const contributeButton = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(contributeButton.innerHTML).contains('Contribute');

        await contributeButton.click();
        await tick();

        expect(
          params.monetizationFunction
        ).to.be.calledOnce.calledWithExactly();
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.IMPRESSION_REWARDED_AD
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_READY
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_SUPPORT
        );
      });

      it('renders premonetization', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: undefined,
          monetizationFunction: sandbox.spy(),
        };
        const state = await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=undefined&origin=about%3Asrcdoc'
        );

        const subscribeButton = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(subscribeButton).to.be.null;

        const signinButton = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-sign-in-button'
        );
        expect(signinButton).to.be.null;
      });

      it('renders isClosable == true', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          isClosable: true,
          onCancel: sandbox.spy(),
        };
        const state = await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        expect(env.win.document.body.style.overflow).to.equal('hidden');

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        const closeButton = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-close-button'
        );
        expect(closeButton).not.to.be.null;

        await closeButton.click();
        await tick();

        expect(env.win.document.body.style.overflow).to.equal('');
        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(params.onCancel).to.be.calledOnce.calledWithExactly();
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_CLOSE
        );
      });

      it('renders isClosable == false', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          isClosable: false,
        };
        const state = await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        const prompt = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-close-button'
        );
        expect(prompt).to.be.null;
      });

      it('renders sign-in', async () => {
        const loginSpy = sandbox.spy();
        runtime.setOnLoginRequest(loginSpy);
        const state = await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG
        );

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        const signinButton = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-sign-in-button'
        );
        expect(signinButton).to.not.be.null;

        await signinButton.click();
        await tick();

        expect(loginSpy).to.be.calledOnce.calledWithExactly({
          linkRequested: false,
        });
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_SIGN_IN
        );
      });

      it('fails to render with bad config', async () => {
        const invalidConfig = `
        {
          "publication": {
            "name": "PUBLICATOIN_NAME"
          }
        }`;
        configResponse.text = sandbox
          .stub()
          .returns(Promise.resolve(invalidConfig));
        env.win.fetch = sandbox.stub().returns(Promise.resolve(configResponse));
        const flow = new AudienceActionLocalFlow(
          runtime,
          DEFAULT_PARAMS,
          /* gptTimeoutMs_= */ 1
        );

        await flow.start();

        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;

        const errorPrompt = wrapper.shadowRoot.querySelector('.prompt');
        expect(errorPrompt.innerHTML).contains('Something went wrong.');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_CONFIG_ERROR
        );
      });

      it('fails to render with bad ad slot', async () => {
        env.win.googletag.defineOutOfPageSlot = () => null;

        const state = await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG
        );

        const errorPrompt = state.wrapper.shadowRoot.querySelector('.prompt');
        expect(errorPrompt.innerHTML).contains('Something went wrong.');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_PAGE_ERROR
        );
      });

      it('fails to render with gpt.js timeout', async () => {
        const state = await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG
        );

        await state.flow.rewardedTimout_;

        const errorPrompt = state.wrapper.shadowRoot.querySelector('.prompt');
        expect(errorPrompt.innerHTML).contains('Something went wrong.');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_GPT_ERROR
        );
      });

      it('renders thanks with rewardedSlotGranted', async () => {
        const state = await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG
        );

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']();

        const prompt = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-prompt'
        );
        expect(prompt).to.not.be.null;
        expect(prompt.innerHTML).contains('Thanks for viewing this ad');

        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=xyz&audienceActionType=TYPE_REWARDED_AD'
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_GRANTED
        );
        expect(entitlementsManager.clear).to.be.called;
        expect(entitlementsManager.getEntitlements).to.be.called;
        expect(env.win.localStorage.setItem).to.be.calledWith(
          'subscribe.google.com:USER_TOKEN',
          'xyz'
        );
        expect(env.win.sessionStorage.setItem).to.be.calledWith(
          'subscribe.google.com:READ_TIME'
        );
      });

      it('does not update entitlements when complete fails', async () => {
        await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG,
          `{
            "updated": false,
            "alreadyCompleted": true,
            "swgUserToken": "xyz"
          }`
        );

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=xyz&audienceActionType=TYPE_REWARDED_AD'
        );
        expect(entitlementsManager.clear).to.not.be.called;
        expect(entitlementsManager.getEntitlements).to.not.be.called;
        expect(env.win.localStorage.setItem).to.not.be.calledWith(
          'subscribe.google.com:USER_TOKEN',
          'xyz'
        );
        expect(env.win.sessionStorage.setItem).to.not.be.calledWith(
          'subscribe.google.com:READ_TIME'
        );
      });

      it('does not update token if non returned', async () => {
        await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG,
          `{
            "updated": true,
            "alreadyCompleted": true
          }`
        );

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=xyz&audienceActionType=TYPE_REWARDED_AD'
        );
        expect(entitlementsManager.clear).to.be.called;
        expect(entitlementsManager.getEntitlements).to.be.called;
        expect(env.win.localStorage.setItem).to.not.be.calledWith(
          'subscribe.google.com:USER_TOKEN',
          'xyz'
        );
        expect(env.win.sessionStorage.setItem).to.be.calledWith(
          'subscribe.google.com:READ_TIME'
        );
      });

      it('closes on thanks', async () => {
        const state = await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG
        );

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']();

        const closeButton = state.wrapper.shadowRoot.querySelector(
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
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotClosed']).to.not.be.null;
        await eventListeners['rewardedSlotClosed']();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(params.onCancel).to.be.calledOnce.calledWithExactly();
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD
        );
      });

      it('renders with rewardedSlotClosed for locked content', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          isClosable: false,
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        expect(eventListeners['rewardedSlotClosed']).to.not.be.null;
        await eventListeners['rewardedSlotClosed']();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.not.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD
        );
      });

      it('shows an ad', async () => {
        const state = await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG
        );

        // Manually invoke the rewardedSlotReady callback.
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);

        const viewButton = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-view-ad-button'
        );
        expect(viewButton).to.not.be.null;

        await viewButton.click();
        await tick();

        expect(viewButton.getAttribute('disabled')).to.equal('true');

        expect(
          readyEventArg.makeRewardedVisible
        ).to.be.calledOnce.calledWithExactly();
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_VIEW
        );
      });

      it('close removes prompt', async () => {
        const state = await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG
        );

        state.flow.close();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
      });
    });

    describe('newsletter publisher prompt', () => {
      let configResponse;
      let completeResponse;

      beforeEach(() => {
        configResponse = new Response(null, {status: 200});
        completeResponse = new Response(null, {status: 200});
      });

      async function renderNewsletterPrompt(
        params,
        config,
        complete = DEFAULT_COMPLETE_RESPONSE
      ) {
        configResponse.text = sandbox.stub().returns(Promise.resolve(config));
        completeResponse.text = sandbox
          .stub()
          .returns(Promise.resolve(complete));
        env.win.fetch = sandbox.stub();
        env.win.fetch.onCall(0).returns(Promise.resolve(configResponse));
        env.win.fetch.onCall(1).returns(Promise.resolve(completeResponse));

        const flow = new AudienceActionLocalFlow(
          runtime,
          params,
          /* gptTimeoutMs_= */ 1
        );

        await flow.start();

        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;

        return {flow, wrapper};
      }

      it('renders', async () => {
        const state = await renderNewsletterPrompt(
          NEWSLETTER_PARAMS,
          NEWSLETTER_CONFIG
        );

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=newsletter_config_id&origin=about%3Asrcdoc'
        );

        const shadowRoot = state.wrapper.shadowRoot;
        expect(shadowRoot).to.not.be.null;
        expect(shadowRoot.innerHTML).contains('newsletter_code_snippet');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN
        );
      });

      it('renders prompt with close button', async () => {
        const params = {
          action: 'TYPE_NEWSLETTER_SIGNUP',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          isClosable: true,
          configurationId: 'newsletter_config_id',
        };
        const state = await renderNewsletterPrompt(params, NEWSLETTER_CONFIG);

        const closeButton = state.wrapper.shadowRoot.querySelector(
          '.opt-in-close-button'
        );
        expect(closeButton).not.to.be.null;
      });

      it('close button click', async () => {
        const params = {
          action: 'TYPE_NEWSLETTER_SIGNUP',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          isClosable: true,
          configurationId: 'newsletter_config_id',
          onCancel: sandbox.spy(),
        };
        const state = await renderNewsletterPrompt(params, NEWSLETTER_CONFIG);
        const closeButton = state.wrapper.shadowRoot.querySelector(
          '.opt-in-close-button'
        );

        await closeButton.click();
        await tick();

        expect(env.win.document.body.style.overflow).to.equal('');
        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(params.onCancel).to.be.calledOnce.calledWithExactly();
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE
        );
      });

      it('renders prompt without close button', async () => {
        const state = await renderNewsletterPrompt(
          NEWSLETTER_PARAMS,
          NEWSLETTER_CONFIG
        );

        const closeButton = state.wrapper.shadowRoot.querySelector(
          '.opt-in-close-button'
        );
        expect(closeButton).to.be.null;
      });

      it('will not render with Google prompt preference', async () => {
        const NEWSLETTER_GOOGLE_PROMPT_CONFIG = `
        {
          "publication": {
            "name": "PUBLICATOIN_NAME"
          },
          "optInParameters": {
            "title": "newsletter_title",
            "body": "newsletter_body",
            "promptPreference": "PREFERENCE_GOOGLE_PROVIDED_PROMPT",
            "codeSnippet": "<form>newsletter_code_snippet</form>"
          }
        }`;
        const state = await renderNewsletterPrompt(
          NEWSLETTER_PARAMS,
          NEWSLETTER_GOOGLE_PROMPT_CONFIG
        );

        const shadowRoot = state.wrapper.shadowRoot;
        expect(shadowRoot.innerHTML).to.not.contain('newsletter_code_snippet');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CONFIG_ERROR
        );
      });

      it('will not render with no code snippet', async () => {
        const NEWSLETTER_NO_SNIPPET_CONFIG = `
        {
          "publication": {
            "name": "PUBLICATOIN_NAME"
          },
          "optInParameters": {
            "title": "newsletter_title",
            "body": "newsletter_body",
            "promptPreference": "PREFERENCE_PUBLISHER_PROVIDED_PROMPT"
          }
        }`;
        const state = await renderNewsletterPrompt(
          NEWSLETTER_PARAMS,
          NEWSLETTER_NO_SNIPPET_CONFIG
        );

        const shadowRoot = state.wrapper.shadowRoot;
        expect(shadowRoot.innerHTML).to.not.contain('newsletter_code_snippet');
        const prompt = shadowRoot.querySelector('.prompt');
        expect(prompt.innerHTML).contains('Something went wrong.');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CONFIG_ERROR
        );
      });

      it('will not render with code snippet not containing form element', async () => {
        const NEWSLETTER_NO_SNIPPET_CONFIG = `
        {
          "publication": {
            "name": "PUBLICATOIN_NAME"
          },
          "optInParameters": {
            "title": "newsletter_title",
            "body": "newsletter_body",
            "promptPreference": "PREFERENCE_PUBLISHER_PROVIDED_PROMPT",
            "codeSnippet": "<input>newsletter_code_snippet_fake_form</input>"
          }
        }`;
        const state = await renderNewsletterPrompt(
          NEWSLETTER_PARAMS,
          NEWSLETTER_NO_SNIPPET_CONFIG
        );

        const shadowRoot = state.wrapper.shadowRoot;
        expect(shadowRoot.innerHTML).to.not.contain('newsletter_code_snippet');
        const form = state.wrapper.shadowRoot.querySelector('form');
        expect(form).to.be.null;
        const prompt = state.wrapper.shadowRoot.querySelector('.prompt');
        expect(prompt.innerHTML).contains('Something went wrong.');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CODE_SNIPPET_ERROR
        );
      });

      it('submit event triggers completion event', async () => {
        const state = await renderNewsletterPrompt(
          NEWSLETTER_PARAMS,
          NEWSLETTER_CONFIG
        );

        const form = state.wrapper.shadowRoot.querySelector('form');
        expect(form).to.not.be.null;
        expect(form.innerHTML).contains('newsletter_code_snippet');
        form.dispatchEvent(new SubmitEvent('submit'));
        await tick(3);

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_SUBMIT
        );
        // First fetch event was getActionConfigurationUI to retrieve config.
        // Second fetch event was to completeAudienceAction.
        expect(env.win.fetch).to.be.calledTwice;
        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=newsletter_config_id&audienceActionType=TYPE_NEWSLETTER_SIGNUP'
        );
        await tick();
        expect(entitlementsManager.clear).to.be.called;
        await tick();
        expect(entitlementsManager.getEntitlements).to.be.called;
      });

      it('submit event removes prompt', async () => {
        const state = await renderNewsletterPrompt(
          NEWSLETTER_PARAMS,
          NEWSLETTER_CONFIG
        );

        const form = state.wrapper.shadowRoot.querySelector('form');
        expect(form).to.not.be.null;
        expect(form.innerHTML).contains('newsletter_code_snippet');
        form.dispatchEvent(new SubmitEvent('submit'));
        await tick();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        // The prompt is expected to be removed.
        expect(updatedWrapper).to.be.null;
      });
    });
  });

  describe('showNoEntitlementFoundToast', () => {
    it('opens toast', () => {
      const flow = new AudienceActionLocalFlow(runtime, DEFAULT_PARAMS);

      const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

      flow.showNoEntitlementFoundToast();

      expect(toastOpenStub).to.be.called.calledWithExactly();
    });
  });
});
