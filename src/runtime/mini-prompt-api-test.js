/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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
import {AutoPromptType, ClientTheme} from '../api/basic-subscriptions';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {DepsDef} from './deps';
import {Fetcher} from './fetcher';
import {GlobalDoc} from '../model/doc';
import {MiniPromptApi} from './mini-prompt-api';

describes.realWin('MiniPromptApi', {}, (env) => {
  let miniPromptApi;
  let deps;
  let doc;
  let gd;
  let clientConfigManager;
  let clientConfigManagerMock;
  let events;
  let callbackSpy;

  beforeEach(() => {
    deps = new DepsDef();

    doc = env.win.document;
    gd = new GlobalDoc(env.win);
    sandbox.stub(deps, 'doc').returns(gd);

    clientConfigManager = new ClientConfigManager(
      'pubId',
      new Fetcher(env.win)
    );
    clientConfigManagerMock = sandbox.mock(clientConfigManager);
    sandbox.stub(deps, 'clientConfigManager').returns(clientConfigManager);

    const clientEventManager = new ClientEventManager(Promise.resolve());
    sandbox.stub(deps, 'eventManager').returns(clientEventManager);
    sandbox
      .stub(ClientEventManager.prototype, 'logSwgEvent')
      .callsFake((eventType, isFromUserAction) => {
        events.push({eventType, isFromUserAction});
      });
    events = [];

    callbackSpy = sandbox.spy();
    miniPromptApi = new MiniPromptApi(deps);
  });

  afterEach(() => {
    clientConfigManagerMock.verify();
  });

  it('should insert the mini prompt css on init', () => {
    miniPromptApi.init();
    const links = doc.querySelectorAll(
      'link[href="$assets$/swg-mini-prompt.css"]'
    );
    expect(links).to.have.length(1);
    const link = links[0];
    expect(link.getAttribute('rel')).to.equal('stylesheet');
    expect(link.getAttribute('type')).to.equal('text/css');
    expect(link.getAttribute('href')).to.equal('$assets$/swg-mini-prompt.css');
  });

  it('should not insert the mini prompt css twice', () => {
    miniPromptApi.init();
    let links = doc.querySelectorAll(
      'link[href="$assets$/swg-mini-prompt.css"]'
    );
    expect(links).to.have.length(1);
    let link = links[0];
    expect(link.getAttribute('rel')).to.equal('stylesheet');
    expect(link.getAttribute('type')).to.equal('text/css');
    expect(link.getAttribute('href')).to.equal('$assets$/swg-mini-prompt.css');

    // Try to init a second time.
    miniPromptApi.init();
    links = doc.querySelectorAll('link[href="$assets$/swg-mini-prompt.css"]');
    expect(links).to.have.length(1);
    link = links[0];
    expect(link.getAttribute('rel')).to.equal('stylesheet');
    expect(link.getAttribute('type')).to.equal('text/css');
    expect(link.getAttribute('href')).to.equal('$assets$/swg-mini-prompt.css');
  });

  describe('Create', () => {
    let isDarkMode;
    let autoPromptType;
    let expectedTitle;

    beforeEach(() => {
      isDarkMode = false;
      expectedTitle = undefined;
      autoPromptType = AutoPromptType.NONE;
    });

    function setTheme() {
      clientConfigManagerMock
        .expects('getTheme')
        .returns(isDarkMode ? ClientTheme.DARK : ClientTheme.LIGHT);
    }

    async function expectMiniPromptCreated() {
      const theme = isDarkMode ? 'dark' : 'light';
      if (!expectedTitle) {
        if (autoPromptType === AutoPromptType.CONTRIBUTION) {
          expectedTitle = 'Contribute with Google';
        } else if (autoPromptType === AutoPromptType.SUBSCRIPTION) {
          expectedTitle = 'Subscribe with Google';
        }
      }

      // Check the mini prompt's structure and that it was inserted in the
      // document body.
      expect(gd.getBody().childNodes).to.have.length(1);
      const miniPrompt = gd.getBody().firstChild;
      expect(miniPrompt).to.have.class(`swg-mini-prompt-${theme}`);
      expect(miniPrompt.getAttribute('role')).to.equal('dialog');
      expect(miniPrompt.childNodes).to.have.length(2);
      const titleContainer = miniPrompt.firstChild;
      expect(titleContainer).to.have.class('swg-mini-prompt-title-container');
      expect(titleContainer.getAttribute('role')).to.equal('button');
      expect(titleContainer.childNodes).to.have.length(2);
      const icon = titleContainer.childNodes[0];
      const text = titleContainer.childNodes[1];
      expect(icon).to.have.class(`swg-mini-prompt-icon-${theme}`);
      expect(text).to.have.class(`swg-mini-prompt-title-text-${theme}`);
      expect(text.textContent).to.equal(expectedTitle);
      const closeButton = miniPrompt.childNodes[1];
      expect(closeButton).to.have.class(
        'swg-mini-prompt-close-button-container'
      );
      expect(closeButton.childNodes).to.have.length(1);
      const closeIcon = closeButton.firstChild;
      expect(closeIcon).to.have.class(`swg-mini-prompt-close-icon-${theme}`);

      // Check that the impression was logged.
      expect(events.length).to.equal(1);
      const expectedImpressionEvent =
        autoPromptType === AutoPromptType.CONTRIBUTION
          ? AnalyticsEvent.IMPRESSION_SWG_CONTRIBUTION_MINI_PROMPT
          : AnalyticsEvent.IMPRESSION_SWG_SUBSCRIPTION_MINI_PROMPT;
      expect(events[0]).to.deep.equal({
        eventType: expectedImpressionEvent,
        isFromUserAction: false,
      });

      // Check the title portion of the mini prompt, check click was logged,
      // that the callback was executed, and that the prompt is hidden
      // afterwards.
      await titleContainer.click();
      expect(events.length).to.equal(2);
      const expectedClickEvent =
        autoPromptType === AutoPromptType.CONTRIBUTION
          ? AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLICK
          : AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK;
      expect(events[1]).to.deep.equal({
        eventType: expectedClickEvent,
        isFromUserAction: true,
      });
      expect(miniPrompt.style.visibility).to.equal('hidden');
      expect(callbackSpy).to.be.calledOnce;
    }

    function expectMiniPromptNotCreated() {
      expect(gd.getBody().childNodes).to.have.length(0);
    }

    it('should not create a prompt if autoPromptType is not specified', () => {
      miniPromptApi.create({});
      expectMiniPromptNotCreated();
    });

    it('should not create a prompt if the autoPromptType is not supported', () => {
      miniPromptApi.create({autoPromptType: AutoPromptType.NONE});
      expectMiniPromptNotCreated();
    });

    it('should create a contribution prompt', async () => {
      setTheme();
      autoPromptType = AutoPromptType.CONTRIBUTION;
      miniPromptApi.create({autoPromptType});
      expectMiniPromptCreated();
    });

    it('should create a subscription prompt', async () => {
      setTheme();
      autoPromptType = AutoPromptType.SUBSCRIPTION;
      miniPromptApi.create({autoPromptType});
      expectMiniPromptCreated();
    });

    it('should create a dark themed contribution prompt as specified in the ClientConfigManager', async () => {
      isDarkMode = true;
      setTheme();
      autoPromptType = AutoPromptType.CONTRIBUTION;
      miniPromptApi.create({autoPromptType});
      expectMiniPromptCreated();
    });

    it('should create a dark themed subscription prompt as specified in the ClientConfigManager', async () => {
      isDarkMode = true;
      setTheme();
      autoPromptType = AutoPromptType.SUBSCRIPTION;
      miniPromptApi.create({autoPromptType});
      expectMiniPromptCreated();
    });

    it('should create a prompt in a non-default language if specified', async () => {
      setTheme();
      clientConfigManagerMock.expects('getLanguage').returns('fr');
      autoPromptType = AutoPromptType.SUBSCRIPTION;
      miniPromptApi.create({autoPromptType});
      expectedTitle = "S'abonner avec Google";
      expectMiniPromptCreated();
    });

    it('should close a contribution prompt when the close button is clicked', async () => {
      autoPromptType = AutoPromptType.CONTRIBUTION;
      miniPromptApi.create({autoPromptType});

      expect(gd.getBody().childNodes).to.have.length(1);
      const miniPrompt = gd.getBody().firstChild;
      const closeButton = miniPrompt.childNodes[1];
      await closeButton.click();
      expect(callbackSpy).to.not.be.called;
      expect(events.length).to.equal(2); // First event is the impression.
      expect(events[1]).to.deep.equal({
        eventType: AnalyticsEvent.ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE,
        isFromUserAction: true,
      });
      expect(miniPrompt.style.visibility).to.equal('hidden');
    });

    it('should close a subscription prompt when the close button is clicked', async () => {
      autoPromptType = AutoPromptType.SUBSCRIPTION;
      miniPromptApi.create({autoPromptType});

      expect(gd.getBody().childNodes).to.have.length(1);
      const miniPrompt = gd.getBody().firstChild;
      const closeButton = miniPrompt.childNodes[1];
      await closeButton.click();
      expect(callbackSpy).to.not.be.called;
      expect(events.length).to.equal(2); // First event is the impression.
      expect(events[1]).to.deep.equal({
        eventType: AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLOSE,
        isFromUserAction: true,
      });
      expect(miniPrompt.style.visibility).to.equal('hidden');
    });
  });
});
