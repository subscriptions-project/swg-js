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
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
import {tick} from '../../test/tick';

const NEWSLETTER_PARAMS = {
  action: 'TYPE_NEWSLETTER_SIGNUP',
  configurationId: 'newsletter_config_id',
};

const DEFAULT_CONFIG = `
{
  "publication": {
    "name": "PUBLICATION_NAME"
  },
  "rewardedAdParameters": {
    "adunit": "ADUNIT",
    "customMessage": "CUSTOM_MESSAGE"
  }
}`;

const NEWSLETTER_CONFIG = `
{
  "publication": {
    "name": "PUBLICATION_NAME"
  },
  "optInParameters": {
    "title": "newsletter_title",
    "body": "newsletter_body",
    "promptPreference": "PREFERENCE_PUBLISHER_PROVIDED_PROMPT",
    "rawCodeSnippet": "<form>newsletter_code_snippet<input></form>"
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
  let storageMock;
  let DEFAULT_PARAMS;

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
    eventManager = {
      logSwgEvent: sandbox.spy(),
    };
    runtime.eventManager = () => eventManager;
    entitlementsManager = {
      clear: sandbox.spy(),
      getEntitlements: sandbox.spy(),
      getArticle: () => {},
      parseArticleExperimentConfigFlags: (_) => articleExperimentFlags,
    };
    runtime.entitlementsManager = () => entitlementsManager;
    storageMock = sandbox.mock(runtime.storage());

    DEFAULT_PARAMS = {
      action: 'TYPE_REWARDED_AD',
      configurationId: 'xyz',
      autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
      monetizationFunction: sandbox.spy(),
      onCancel: sandbox.spy(),
      isClosable: true,
      onResult: sandbox.spy(),
      calledManually: false,
    };
  });

  afterEach(() => {
    storageMock.verify();
  });

  describe('start', () => {
    it('invalid action renders with error view prompt when not closable', async () => {
      const params = {
        action: 'invlid action',
        isClosable: false,
        onCancel: sandbox.spy(),
      };
      const flow = new AudienceActionLocalFlow(runtime, params);

      await flow.start();

      const wrapper = env.win.document.querySelector(
        '.audience-action-local-wrapper'
      );
      expect(wrapper).to.not.be.null;
      const prompt = wrapper.shadowRoot.querySelector('.rewarded-ad-prompt');
      expect(prompt.innerHTML).contains('Something went wrong.');
      const closePromptButton = prompt.querySelector('.closePromptButton');
      expect(closePromptButton).to.be.null;
      expect(params.onCancel).to.be.calledOnce.calledWithExactly();
    });

    it('invalid action does not renders when closable', async () => {
      const params = {
        action: 'invlid action',
        isClosable: true,
        onCancel: sandbox.spy(),
      };
      const flow = new AudienceActionLocalFlow(runtime, params);

      await flow.start();

      const wrapper = env.win.document.querySelector(
        '.audience-action-local-wrapper'
      );
      expect(wrapper).to.be.null;
      expect(params.onCancel).to.be.calledOnce.calledWithExactly();
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
          removeEventListener: sandbox.spy(),
          refresh: sandbox.spy(),
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
          apiReady: true,
          getVersion: () => 'GOOGLETAG_VERSION',
        };
        configResponse = new Response(null, {status: 200});
        completeResponse = new Response(null, {status: 200});
      });

      async function renderAndAssertRewardedAd(
        params,
        config,
        complete = DEFAULT_COMPLETE_RESPONSE
      ) {
        setUpConfig(config, complete);

        const flow = new AudienceActionLocalFlow(
          runtime,
          params,
          /* gptTimeoutMs_= */ 1,
          /* thanksTimeoutMs_= */ 1
        );

        await startRewardedAdFlow(flow);

        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.be.null;

        // Manually invoke the command for gpt.js.
        expect(env.win.googletag.cmd[0]).to.not.be.null;
        env.win.googletag.cmd[0]();

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_FLOW_INIT
        );

        return flow;
      }

      async function callReadyAndReturnWrapper() {
        expect(eventListeners['rewardedSlotReady']).to.not.be.null;
        await eventListeners['rewardedSlotReady'](readyEventArg);
        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.not.be.null;
        return wrapper;
      }

      function setUpConfig(config, complete = DEFAULT_COMPLETE_RESPONSE) {
        configResponse.text = sandbox.stub().returns(Promise.resolve(config));
        completeResponse.text = sandbox
          .stub()
          .returns(Promise.resolve(complete));
        env.win.fetch = sandbox.stub();
        env.win.fetch.onCall(0).returns(Promise.resolve(configResponse));
        env.win.fetch.onCall(1).returns(Promise.resolve(completeResponse));
      }

      async function startRewardedAdFlow(flow) {
        const interval = setInterval(() => {
          if (env.win.googletag.cmd.length > 0) {
            const cmd = env.win.googletag.cmd.pop();
            cmd();
          }
        }, 1);
        await flow.start();
        clearInterval(interval);
      }

      async function didBailout(params) {
        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.be.null;

        expect(params.onCancel).to.be.calledOnce.calledWithExactly();

        expect(
          params.monetizationFunction
        ).to.be.calledOnce.calledWithExactly();
      }

      function didCleanUpGoogletag() {
        expect(
          env.win.googletag.destroySlots
        ).to.be.calledOnce.calledWithExactly([rewardedSlot]);
        expect(pubadsobj.removeEventListener).to.have.callCount(4);
      }

      it('clicking on locked greypane closes', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        wrapper.click();
        await tick();

        expect(env.win.document.body.style.overflow).to.equal('');
        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_CLOSE
        );
      });

      it('renders subscription', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          autoPromptType: AutoPromptType.SUBSCRIPTION_LARGE,
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=xyz&origin=about%3Asrcdoc&previewEnabled=false'
        );

        const subscribeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(subscribeButton.innerHTML).contains('Subscribe');

        await subscribeButton.click();
        await tick();

        didCleanUpGoogletag();
        expect(
          params.monetizationFunction
        ).to.be.calledOnce.calledWithExactly();
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.IMPRESSION_REWARDED_AD
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_READY
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_SUPPORT
        );
        expect(pubadsobj.refresh).to.be.called;
      });

      it('renders contribution', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=xyz&origin=about%3Asrcdoc&previewEnabled=false'
        );

        const contributeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(contributeButton.innerHTML).contains('Contribute');

        await contributeButton.click();
        await tick();

        didCleanUpGoogletag();
        expect(params.onCancel).to.be.calledOnce.calledWithExactly();
        expect(
          params.monetizationFunction
        ).to.be.calledOnce.calledWithExactly();
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.IMPRESSION_REWARDED_AD
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_READY
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_SUPPORT
        );
        expect(pubadsobj.refresh).to.be.called;
      });

      it('renders premonetization', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          autoPromptType: undefined,
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=xyz&origin=about%3Asrcdoc&previewEnabled=false'
        );

        const subscribeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(subscribeButton).to.be.null;

        const signinButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-sign-in-button'
        );
        expect(signinButton).to.be.null;
      });

      it('renders subscription with preview enabled', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          autoPromptType: undefined,
          shouldRenderPreview: true,
        };

        const SUBSCRIPTION_CONFIG = `{
          "publication": {
            "name": "PUBLICATION_NAME",
            "revenueModel": {
              "subscriptions": true
            }
          },
          "rewardedAdParameters": {
            "adunit": "ADUNIT",
            "customMessage": "CUSTOM_MESSAGE"
          }
        }`;

        await renderAndAssertRewardedAd(params, SUBSCRIPTION_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=xyz&origin=about%3Asrcdoc&previewEnabled=true'
        );

        const contributeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(contributeButton.innerHTML).contains('Subscribe');

        const signinButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-sign-in-button'
        );
        expect(signinButton.innerHTML).contains('Already a subscriber?');
      });

      it('renders contribution with preview enabled', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          autoPromptType: undefined,
          shouldRenderPreview: true,
        };

        const CONTRIBUTIONS_CONFIG = `{
          "publication": {
            "name": "PUBLICATION_NAME",
            "revenueModel": {
              "contributions": true
            }
          },
          "rewardedAdParameters": {
            "adunit": "ADUNIT",
            "customMessage": "CUSTOM_MESSAGE"
          }
        }`;

        await renderAndAssertRewardedAd(params, CONTRIBUTIONS_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=xyz&origin=about%3Asrcdoc&previewEnabled=true'
        );

        const subscribeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(subscribeButton.innerHTML).contains('Contribute');

        const signinButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-sign-in-button'
        );
        expect(signinButton.innerHTML).contains('Already a contributor?');
      });

      it('renders premonetization with preview enabled', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          autoPromptType: undefined,
          shouldRenderPreview: true,
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=xyz&origin=about%3Asrcdoc&previewEnabled=true'
        );

        const subscribeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(subscribeButton).to.be.null;

        const signinButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-sign-in-button'
        );
        expect(signinButton).to.be.null;
      });

      it('renders enterprise', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          autoPromptType: undefined,
          calledManually: true,
          onAlternateAction: sandbox.spy(),
          onSignIn: sandbox.spy(),
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=xyz&origin=about%3Asrcdoc&previewEnabled=false'
        );

        const subscribeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-support-button'
        );
        expect(subscribeButton).to.not.be.null;
        expect(subscribeButton.innerHTML).contains('Subscribe');
        await subscribeButton.click();

        const signinButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-sign-in-button'
        );
        expect(signinButton).to.not.be.null;
        expect(signinButton.innerHTML).contains('Already a subscriber?');
        await signinButton.click();

        await tick();

        expect(params.onAlternateAction).to.be.calledOnce;
        expect(params.onSignIn).to.be.calledOnce;
      });
      it('escapes bad input', async () => {
        const BAD_CONFIG = `
          {
            "publication": {
              "name": "<script>PUBLICATION_NAME</script>"
            },
            "rewardedAdParameters": {
              "adunit": "ADUNIT",
              "customMessage": "<h1>CUSTOM_MESSAGE</h1>"
            }
          }`;

        await renderAndAssertRewardedAd(DEFAULT_PARAMS, BAD_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        const title = wrapper.shadowRoot.querySelector('.rewarded-ad-title');
        expect(title.innerHTML).to.equal(
          '&lt;script&gt;PUBLICATION_NAME&lt;/script&gt;'
        );

        const message = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-message'
        );
        expect(message.innerHTML).to.equal(
          '&lt;h1&gt;CUSTOM_MESSAGE&lt;/h1&gt;'
        );
      });

      it('renders isClosable == true', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          isClosable: true,
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(env.win.document.body.style.overflow).to.equal('hidden');

        const closeButton = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-close-button'
        );
        expect(closeButton).not.to.be.null;

        const backToHome = wrapper.shadowRoot.querySelector(
          '.back-to-home-container'
        );
        expect(backToHome).to.be.null;

        await closeButton.click();
        await tick();

        didCleanUpGoogletag();
        expect(env.win.document.body.style.overflow).to.equal('');
        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(params.onCancel).to.be.calledOnce.calledWithExactly();
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_CLOSE
        );
      });

      it('renders isClosable == false', async () => {
        const params = {
          ...DEFAULT_PARAMS,
          isClosable: false,
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        const prompt = wrapper.shadowRoot.querySelector(
          '.rewarded-ad-close-button'
        );
        expect(prompt).to.be.null;

        const backToHome = wrapper.shadowRoot.querySelector('.exit-container');
        expect(backToHome).not.to.be.null;
      });

      it('renders sign-in', async () => {
        const loginSpy = sandbox.spy();
        runtime.setOnLoginRequest(loginSpy);
        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        const signinButton = wrapper.shadowRoot.querySelector(
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
        const invalidConfig = '{"publication": {"name": "PUBLICATION_NAME"}}';
        configResponse.text = sandbox
          .stub()
          .returns(Promise.resolve(invalidConfig));
        env.win.fetch = sandbox.stub().returns(Promise.resolve(configResponse));
        const flow = new AudienceActionLocalFlow(
          runtime,
          DEFAULT_PARAMS,
          /* gptTimeoutMs_= */ 5,
          /* thanksTimeoutMs_= */ 5
        );

        await startRewardedAdFlow(flow);

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_CONFIG_ERROR
        );

        expect(env.win.googletag.destroySlots).to.not.be.called;
        expect(pubadsobj.removeEventListener).to.have.callCount(4);

        await didBailout(DEFAULT_PARAMS);
      });

      it('does not render on failed unclosable premon', async () => {
        env.win.googletag.defineOutOfPageSlot = () => null;

        const params = {
          ...DEFAULT_PARAMS,
          isClosable: false,
          monetizationFunction: null,
        };

        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.IMPRESSION_REWARDED_AD_ERROR
        );

        expect(env.win.googletag.destroySlots).to.not.be.called;
        expect(pubadsobj.removeEventListener).to.have.callCount(4);

        expect(params.onCancel).to.be.called;

        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper).to.be.null;
      });

      it('fails to render with bad ad slot', async () => {
        env.win.googletag.defineOutOfPageSlot = () => null;

        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_PAGE_ERROR
        );

        expect(env.win.googletag.destroySlots).to.not.be.called;
        expect(pubadsobj.removeEventListener).to.have.callCount(4);

        await didBailout(DEFAULT_PARAMS);
      });

      it('fails to render with unfilled ad slot', async () => {
        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        expect(eventListeners['slotRenderEnded']).to.not.be.null;
        await eventListeners['slotRenderEnded']({
          slot: rewardedSlot,
          isEmpty: true,
        });

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_NOT_FILLED
        );

        await didBailout(DEFAULT_PARAMS);

        didCleanUpGoogletag();
      });

      it('fails to render with gpt.js detection shortcut', async () => {
        env.win.googletag.getVersion = () => '';

        setUpConfig(DEFAULT_CONFIG);

        const flow = new AudienceActionLocalFlow(
          runtime,
          DEFAULT_PARAMS,
          /* gptTimeoutMs_= */ 5,
          /* thanksTimeoutMs_= */ 5
        );

        await flow.start();

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_GPT_MISSING_ERROR
        );

        expect(env.win.googletag.destroySlots).to.not.be.called;
        expect(pubadsobj.removeEventListener).to.have.callCount(4);

        await didBailout(DEFAULT_PARAMS);
      });

      it('fails to render with gpt.js detection timeout', async () => {
        env.win.googletag = undefined;

        setUpConfig(DEFAULT_CONFIG);

        const flow = new AudienceActionLocalFlow(
          runtime,
          DEFAULT_PARAMS,
          /* gptTimeoutMs_= */ 5,
          /* thanksTimeoutMs_= */ 5
        );

        await flow.start();

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_GPT_MISSING_ERROR
        );

        await didBailout(DEFAULT_PARAMS);
      });

      it('fails to render with gpt.js timeout', async () => {
        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_GPT_ERROR
        );

        didCleanUpGoogletag();

        await didBailout(DEFAULT_PARAMS);
      });

      it('renders thanks with rewardedSlotGranted', async () => {
        storageMock
          .expects('get')
          .withArgs(StorageKeys.USER_TOKEN)
          .resolves('abc')
          .exactly(1);
        storageMock.expects('set').withArgs(StorageKeys.USER_TOKEN).exactly(1);
        storageMock.expects('set').withArgs(StorageKeys.READ_TIME).exactly(1);

        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']({
          payload: {
            amount: 1,
            type: 'type',
          },
        });

        const prompt = wrapper.shadowRoot.querySelector('.rewarded-ad-prompt');
        expect(prompt).to.not.be.null;
        expect(prompt.innerHTML).contains('Thanks for viewing this ad');

        didCleanUpGoogletag();

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=xyz&audienceActionType=TYPE_REWARDED_AD'
        );
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_REWARDED_AD_GRANTED
        );
        expect(entitlementsManager.clear).to.be.called;
        expect(entitlementsManager.getEntitlements).to.be.called;
      });

      it('does not update entitlements when complete fails', async () => {
        storageMock
          .expects('get')
          .withArgs(StorageKeys.USER_TOKEN)
          .resolves('abc')
          .exactly(1);
        storageMock.expects('set').never();

        await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG,
          `{
            "updated": false,
            "alreadyCompleted": true,
            "swgUserToken": "xyz"
          }`
        );

        await callReadyAndReturnWrapper();
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']({
          payload: {
            amount: 1,
            type: 'type',
          },
        });

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=xyz&audienceActionType=TYPE_REWARDED_AD'
        );
        expect(entitlementsManager.clear).to.not.be.called;
        expect(entitlementsManager.getEntitlements).to.not.be.called;
      });

      it('does not update token if non returned', async () => {
        storageMock
          .expects('get')
          .withArgs(StorageKeys.USER_TOKEN)
          .resolves('abc')
          .exactly(1);
        storageMock.expects('set').withArgs(StorageKeys.USER_TOKEN).never();
        storageMock.expects('set').withArgs(StorageKeys.READ_TIME).exactly(1);

        await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG,
          `{
            "updated": true,
            "alreadyCompleted": true
          }`
        );

        await callReadyAndReturnWrapper();
        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']({
          payload: {
            amount: 1,
            type: 'type',
          },
        });

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=xyz&audienceActionType=TYPE_REWARDED_AD'
        );
        expect(entitlementsManager.clear).to.be.called;
        expect(entitlementsManager.getEntitlements).to.be.called;
      });

      it('closes on thanks', async () => {
        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']({
          payload: {
            amount: 1,
            type: 'type',
          },
        });

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

      it('calls onResult', async () => {
        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        await callReadyAndReturnWrapper();

        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']({
          payload: {
            amount: 1,
            type: 'type',
          },
        });

        expect(DEFAULT_PARAMS.onResult).to.be.calledOnce.calledWithExactly({
          configurationId: DEFAULT_PARAMS.configurationId,
          data: {
            rendered: true,
            rewardGranted: true,
            reward: 1,
            type: 'type',
          },
        });
      });

      it('closes on thanks automatically', async () => {
        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        await callReadyAndReturnWrapper();

        expect(eventListeners['rewardedSlotGranted']).to.not.be.null;
        await eventListeners['rewardedSlotGranted']({
          payload: {
            amount: 1,
            type: 'type',
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

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

        await callReadyAndReturnWrapper();

        expect(eventListeners['rewardedSlotClosed']).to.not.be.null;
        await eventListeners['rewardedSlotClosed']();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        didCleanUpGoogletag();
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

        await callReadyAndReturnWrapper();

        expect(eventListeners['rewardedSlotClosed']).to.not.be.null;
        await eventListeners['rewardedSlotClosed']();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.not.be.null;
        didCleanUpGoogletag();
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_CLOSE_AD
        );
      });

      it('shows an ad', async () => {
        await renderAndAssertRewardedAd(DEFAULT_PARAMS, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

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
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_REWARDED_AD_VIEW
        );
      });

      it('close removes prompt', async () => {
        const flow = await renderAndAssertRewardedAd(
          DEFAULT_PARAMS,
          DEFAULT_CONFIG
        );

        flow.close();

        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        didCleanUpGoogletag();
      });

      it('tab focus trap works', async () => {
        const params = {
          action: 'TYPE_REWARDED_AD',
          autoPromptType: undefined,
          monetizationFunction: sandbox.spy(),
        };
        await renderAndAssertRewardedAd(params, DEFAULT_CONFIG);

        const wrapper = await callReadyAndReturnWrapper();

        const topSentinal = wrapper.shadowRoot.querySelector(
          'audience-action-top-sentinal'
        );
        await topSentinal.focus();

        expect(env.win.document.activeElement).not.to.equal(bottomSentinal);

        const bottomSentinal = wrapper.shadowRoot.querySelector(
          'audience-action-bottom-sentinal'
        );
        await bottomSentinal.focus();

        expect(env.win.document.activeElement).not.to.equal(bottomSentinal);
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
          /* gptTimeoutMs_= */ 5,
          /* thanksTimeoutMs_= */ 5
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
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=newsletter_config_id&origin=about%3Asrcdoc&previewEnabled=false'
        );

        const shadowRoot = state.wrapper.shadowRoot;
        expect(shadowRoot).to.not.be.null;
        expect(shadowRoot.innerHTML).contains('newsletter_code_snippet');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.IMPRESSION_BYOP_NEWSLETTER_OPT_IN
        );
      });

      it('renders with preview enabled', async () => {
        const state = await renderNewsletterPrompt(
          {...NEWSLETTER_PARAMS, shouldRenderPreview: true},
          NEWSLETTER_CONFIG
        );

        expect(env.win.fetch).to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/getactionconfigurationui?publicationId=pub1&configurationId=newsletter_config_id&origin=about%3Asrcdoc&previewEnabled=true'
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

      it('clicking on locked greypane closes', async () => {
        const params = {
          action: 'TYPE_NEWSLETTER_SIGNUP',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          isClosable: true,
          configurationId: 'newsletter_config_id',
        };
        const state = await renderNewsletterPrompt(params, NEWSLETTER_CONFIG);

        state.wrapper.click();
        await tick();

        expect(env.win.document.body.style.overflow).to.equal('');
        const updatedWrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(updatedWrapper).to.be.null;
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.ACTION_BYOP_NEWSLETTER_OPT_IN_CLOSE
        );
      });

      it('tab focus trap works', async () => {
        const params = {
          action: 'TYPE_NEWSLETTER_SIGNUP',
          autoPromptType: AutoPromptType.CONTRIBUTION_LARGE,
          isClosable: false,
          configurationId: 'newsletter_config_id',
        };
        const state = await renderNewsletterPrompt(params, NEWSLETTER_CONFIG);

        const inputComponent = state.wrapper.shadowRoot.querySelector('input');
        let focused = state.wrapper.shadowRoot.querySelector(':focus');

        expect(focused).to.equal(inputComponent);

        const topSentinal = state.wrapper.shadowRoot.querySelector(
          'audience-action-top-sentinal'
        );
        await topSentinal.focus();
        focused = state.wrapper.shadowRoot.querySelector(':focus');

        expect(focused).to.equal(inputComponent);
        expect(focused).not.to.equal(topSentinal);

        const bottomSentinal = state.wrapper.shadowRoot.querySelector(
          'audience-action-bottom-sentinal'
        );
        await bottomSentinal.focus();
        focused = state.wrapper.shadowRoot.querySelector(':focus');

        expect(focused).to.equal(inputComponent);
        expect(focused).not.to.equal(bottomSentinal);
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
            "name": "PUBLICATION_NAME"
          },
          "optInParameters": {
            "title": "newsletter_title",
            "body": "newsletter_body",
            "promptPreference": "PREFERENCE_GOOGLE_PROVIDED_PROMPT",
            "rawCodeSnippet": "<form>newsletter_code_snippet</form>"
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
            "name": "PUBLICATION_NAME"
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
        const prompt = shadowRoot.querySelector('.rewarded-ad-prompt');
        expect(prompt.innerHTML).contains('Something went wrong.');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CONFIG_ERROR
        );
      });

      it('will not render with code snippet not containing form element', async () => {
        const NEWSLETTER_NO_SNIPPET_CONFIG = `
        {
          "publication": {
            "name": "PUBLICATION_NAME"
          },
          "optInParameters": {
            "title": "newsletter_title",
            "body": "newsletter_body",
            "promptPreference": "PREFERENCE_PUBLISHER_PROVIDED_PROMPT",
            "rawCodeSnippet": "<input>newsletter_code_snippet_fake_form</input>"
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
        const prompt = state.wrapper.shadowRoot.querySelector(
          '.rewarded-ad-prompt'
        );
        expect(prompt.innerHTML).contains('Something went wrong.');
        expect(eventManager.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_BYOP_NEWSLETTER_OPT_IN_CODE_SNIPPET_ERROR
        );
      });

      it('submit event triggers completion event', async () => {
        storageMock
          .expects('get')
          .withArgs(StorageKeys.USER_TOKEN)
          .resolves('abc')
          .atLeast(0);
        storageMock.expects('set').withArgs(StorageKeys.USER_TOKEN).exactly(1);
        storageMock.expects('set').withArgs(StorageKeys.READ_TIME).exactly(1);

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

      it('submit event doesn not trigger completion event when preview enabled', async () => {
        const state = await renderNewsletterPrompt(
          {...NEWSLETTER_PARAMS, shouldRenderPreview: true},
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
        // Only fetch event was getActionConfigurationUI to retrieve config.
        expect(env.win.fetch).to.be.calledOnce;
        expect(env.win.fetch).not.to.be.calledWith(
          'https://news.google.com/swg/_/api/v1/publication/pub1/completeaudienceaction?sut=abc&configurationId=newsletter_config_id&audienceActionType=TYPE_NEWSLETTER_SIGNUP'
        );
        await tick();
        // entitlementsManager will not be called either.
        expect(entitlementsManager.clear).not.to.be.called;
        await tick();
        expect(entitlementsManager.getEntitlements).not.to.be.called;
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
        const wrapper = env.win.document.querySelector(
          '.audience-action-local-wrapper'
        );
        expect(wrapper.style.opacity).to.equal('0');

        await new Promise((resolve) => setTimeout(resolve, 1005));
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
