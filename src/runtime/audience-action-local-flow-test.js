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
import {InterventionType} from '../api/intervention-type';
import {PageConfig} from '../model/page-config';
import {StorageKeys} from '../utils/constants';
import {Toast} from '../ui/toast';
import {tick} from '../../test/tick';

const NEWSLETTER_PARAMS = {
  action: 'TYPE_NEWSLETTER_SIGNUP',
  configurationId: 'newsletter_config_id',
};

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
      action: InterventionType.TYPE_NEWSLETTER_SIGNUP,
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
      const prompt = wrapper.shadowRoot.querySelector('.local-cta');
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
        const prompt = shadowRoot.querySelector('.local-cta');
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
        const prompt = state.wrapper.shadowRoot.querySelector('.local-cta');
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
