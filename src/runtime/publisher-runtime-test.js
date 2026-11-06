/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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
import {ActivityPorts} from '../components/activities';
import {AddPreferredSourceButton} from '../ui/add-preferred-source-button';
import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {
  AddPreferredSourceResponse,
  AddPreferredSourceStatus,
  AnalyticsEvent,
  PreferredSourcesAddSourceTrigger,
} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {ClientEventManager} from './client-event-manager';
import {PublisherRuntime, installPublisherRuntime} from './publisher-runtime';
import {Toast} from '../ui/toast';

describes.realWin('installPublisherRuntime', (env) => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  function dep(callback) {
    (win.PREFERRED_SOURCE = win.PREFERRED_SOURCE || []).push(callback);
  }

  it('should be able to install', () => {
    installPublisherRuntime(win);
    expect(win.PREFERRED_SOURCE).to.not.be.undefined;
    expect(win.PREFERRED_SOURCE.push).to.be.a('function');
  });

  it('should supply a functioning PreferredSourceApi to callbacks', (done) => {
    dep((api) => {
      expect(api).to.not.be.undefined;
      expect(api.init).to.be.a('function');
      expect(api.addPreferredSource).to.be.a('function');
      done();
    });
    installPublisherRuntime(win);
  });

  it('should only install once if called multiple times', () => {
    const firstApi = installPublisherRuntime(win);
    const firstObj = win.PREFERRED_SOURCE;
    const secondApi = installPublisherRuntime(win);

    expect(win.PREFERRED_SOURCE).to.equal(firstObj);
    expect(secondApi).to.equal(firstApi);
  });

  it('should auto-init by default if no script attributes are present', () => {
    const pubInitStub = sandbox.stub(PublisherRuntime.prototype, 'init');
    const script = win.document.createElement('script');
    script.src = 'https://news.google.com/swg/js/v1/publisher.js';
    win.document.body.appendChild(script);

    installPublisherRuntime(win);
    expect(pubInitStub).to.have.been.calledOnce;
    script.remove();
  });

  it('should not auto-init if script has preferred-sources-control="manual"', () => {
    const pubInitStub = sandbox.stub(PublisherRuntime.prototype, 'init');
    const script = win.document.createElement('script');
    script.src = 'https://news.google.com/swg/js/v1/publisher.js';
    script.setAttribute('preferred-sources-control', 'manual');
    win.document.body.appendChild(script);

    win.PREFERRED_SOURCE = undefined; // reset
    installPublisherRuntime(win);
    expect(pubInitStub).to.not.have.been.called;
    script.remove();
  });

  it('should return the public API directly and via .ready() promise', async () => {
    win.PREFERRED_SOURCE = undefined;
    const api = installPublisherRuntime(win);
    const promiseApi = await win.PREFERRED_SOURCE.ready();

    expect(Object.keys(api)).to.deep.equal(['init', 'addPreferredSource']);
    expect(api.init).to.be.a('function');
    expect(api.addPreferredSource).to.be.a('function');
    expect(promiseApi).to.equal(api);
  });

  it('should suppress auto-init when options.autoStart is false', () => {
    const pubInitStub = sandbox.stub(PublisherRuntime.prototype, 'init');
    win.PREFERRED_SOURCE = undefined;

    installPublisherRuntime(win, {autoStart: false});

    expect(pubInitStub).to.not.have.been.called;
  });

  it('should emit 0 analytics events and inject 0 iframes when installed on a 0-button page', () => {
    const logSwgEventSpy = sandbox.spy(
      ClientEventManager.prototype,
      'logSwgEvent'
    );
    const analyticsStartSpy = sandbox.spy(AnalyticsService.prototype, 'start');
    win.PREFERRED_SOURCE = undefined;

    installPublisherRuntime(win);

    expect(logSwgEventSpy).to.not.have.been.called;
    expect(analyticsStartSpy).to.not.have.been.called;
    expect(win.document.querySelectorAll('iframe').length).to.equal(0);
  });

  it('should emit 0 analytics events and inject 0 iframes with preferred-sources-control="manual" until api.init() is invoked', async () => {
    const executeSpy = sandbox.spy();
    sandbox.stub(ActivityPorts.prototype, 'openIframe').resolves({
      on: sandbox.stub(),
      whenReady: () => Promise.resolve(),
      execute: executeSpy,
    });
    const logSwgEventSpy = sandbox.spy(
      ClientEventManager.prototype,
      'logSwgEvent'
    );
    const script = win.document.createElement('script');
    script.setAttribute('preferred-sources-control', 'manual');
    const button = win.document.createElement('div');
    button.setAttribute('google-add-preferred-source-btn', '');
    win.document.body.appendChild(script);
    win.document.body.appendChild(button);

    win.PREFERRED_SOURCE = undefined;
    const api = installPublisherRuntime(win);

    expect(logSwgEventSpy).to.not.have.been.called;
    expect(win.document.querySelectorAll('iframe').length).to.equal(0);

    api.init();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(win.document.querySelectorAll('iframe').length).to.equal(1);
    expect(logSwgEventSpy).to.have.been.calledOnceWithExactly(
      AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON,
      false,
      sandbox.match.any
    );
    expect(executeSpy).to.have.been.calledOnce;
    expect(executeSpy.firstCall.args[0].getEvent()).to.equal(
      AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON
    );
    script.remove();
    button.remove();
  });

  it('should emit 0 analytics events and inject 0 iframes with preferred-sources-control="manual" until api.addPreferredSource() is invoked', async () => {
    sandbox.stub(ActivityPorts.prototype, 'openIframe').resolves({
      on: sandbox.stub(),
      whenReady: () => Promise.resolve(),
      execute: sandbox.stub(),
    });
    sandbox.stub(AddPreferredSourceFlow.prototype, 'start').callsFake(() => {
      const response = new AddPreferredSourceResponse();
      response.setStatus(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      response.setSiteName('TestSite');
      return Promise.resolve(response);
    });
    sandbox.stub(Toast.prototype, 'open').resolves();
    const logSwgEventSpy = sandbox.spy(
      ClientEventManager.prototype,
      'logSwgEvent'
    );
    const script = win.document.createElement('script');
    script.setAttribute('preferred-sources-control', 'manual');
    const button = win.document.createElement('div');
    button.setAttribute('google-add-preferred-source-btn', '');
    win.document.body.appendChild(script);
    win.document.body.appendChild(button);

    win.PREFERRED_SOURCE = undefined;
    const api = installPublisherRuntime(win);

    expect(logSwgEventSpy).to.not.have.been.called;
    expect(win.document.querySelectorAll('iframe').length).to.equal(0);

    api.addPreferredSource();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(win.document.querySelectorAll('iframe').length).to.equal(1);
    expect(logSwgEventSpy).to.have.been.calledOnceWith(
      AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCE,
      false,
      sandbox.match(
        (params) =>
          params.getPreferredSourcesAddSourceTrigger() ===
            PreferredSourcesAddSourceTrigger.PREFERRED_SOURCES_ADD_SOURCE_TRIGGER_API &&
          params.getPreferredSourcesInstallType() === null
      )
    );
    script.remove();
    button.remove();
  });

  it('should remain silent on api.init({lang, theme}) on a 0-button page while preserving options for api.addPreferredSource()', async () => {
    sandbox.stub(ActivityPorts.prototype, 'openIframe').resolves({
      on: sandbox.stub(),
      whenReady: () => Promise.resolve(),
      execute: sandbox.stub(),
    });
    const openPopupStub = sandbox.stub(
      ActivityPorts.prototype,
      'openPopupWithMessaging'
    );
    const toastOpenStub = sandbox.stub(Toast.prototype, 'open').resolves();
    let pendingOnResponse;
    sandbox
      .stub(AddPreferredSourceFlow, 'configurePending')
      .callsFake((_deps, onResponse) => {
        pendingOnResponse = onResponse;
      });
    sandbox
      .stub(AddPreferredSourceFlow.prototype, 'start')
      .callsFake(function () {
        openPopupStub(this.deps_.clientConfigManager().getLanguage());
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
        );
        response.setSiteName('TestSite');
        pendingOnResponse(response);
        return Promise.resolve();
      });
    const logSwgEventSpy = sandbox.spy(
      ClientEventManager.prototype,
      'logSwgEvent'
    );

    win.PREFERRED_SOURCE = undefined;
    const api = installPublisherRuntime(win, {autoStart: false});
    api.init({lang: 'fr', theme: 'dark'});

    expect(logSwgEventSpy).to.not.have.been.called;
    expect(win.document.querySelectorAll('iframe').length).to.equal(0);

    api.addPreferredSource();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(openPopupStub).to.have.been.calledOnceWithExactly('fr');
    expect(toastOpenStub).to.have.been.calledOnce;
    const toastInstance = toastOpenStub.getCall(0).thisValue;
    expect(toastInstance.src_).to.include('hl=fr');
    expect(toastInstance.src_).to.include('theme=dark');
  });

  it('should start AnalyticsService before attaching buttons so IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON is delivered', async () => {
    const executeSpy = sandbox.spy();
    sandbox.stub(ActivityPorts.prototype, 'openIframe').resolves({
      on: sandbox.stub(),
      whenReady: () => Promise.resolve(),
      execute: executeSpy,
    });
    const setReadySpy = sandbox.spy(
      AnalyticsService.prototype,
      'setReadyForLogging'
    );
    const analyticsStartSpy = sandbox.spy(AnalyticsService.prototype, 'start');
    const attachSpy = sandbox.spy(AddPreferredSourceButton.prototype, 'attach');
    const button = win.document.createElement('div');
    button.setAttribute('google-add-preferred-source-btn', '');
    win.document.body.appendChild(button);

    win.PREFERRED_SOURCE = undefined;
    installPublisherRuntime(win);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setReadySpy).to.have.been.calledOnce;
    expect(attachSpy).to.have.been.calledOnce;
    expect(setReadySpy).to.have.been.calledBefore(attachSpy);
    expect(analyticsStartSpy).to.have.been.calledBefore(attachSpy);
    expect(executeSpy).to.have.been.calledOnce;
    expect(executeSpy.firstCall.args[0].getEvent()).to.equal(
      AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON
    );
    button.remove();
  });

  it('should return defensive fallback dummy object if PREFERRED_SOURCE is initialized without an api property', () => {
    win.PREFERRED_SOURCE = {};
    const api = installPublisherRuntime(win);
    expect(api).to.not.be.undefined;
    expect(api.init).to.be.a('function');
    expect(api.addPreferredSource).to.be.a('function');
    expect(() => api.init()).to.not.throw();
    expect(() => api.addPreferredSource()).to.not.throw();
  });

  it('should return existing api object when PREFERRED_SOURCE has api property', () => {
    const mockApi = {
      init: () => {},
      addPreferredSource: () => {},
    };
    win.PREFERRED_SOURCE = {api: mockApi};
    const api = installPublisherRuntime(win);
    expect(api).to.equal(mockApi);
  });

  it('should handle non-function callbacks in initial PREFERRED_SOURCE array', () => {
    let callbackInvoked = false;
    win.PREFERRED_SOURCE = [
      null,
      123,
      (api) => {
        callbackInvoked = true;
        expect(api).to.not.be.undefined;
      },
    ];
    installPublisherRuntime(win);
    expect(callbackInvoked).to.be.true;
  });

  it('should handle non-function arguments pushed after installation', () => {
    installPublisherRuntime(win);
    expect(() => {
      win.PREFERRED_SOURCE.push('invalid', null, 456);
    }).to.not.throw();
  });

  it('should execute functions pushed after installation', () => {
    installPublisherRuntime(win);
    let callbackInvoked = false;
    win.PREFERRED_SOURCE.push((api) => {
      callbackInvoked = true;
      expect(api).to.not.be.undefined;
    });
    expect(callbackInvoked).to.be.true;
  });

  describe('Deps implementation', () => {
    let runtime;

    beforeEach(() => {
      runtime = new PublisherRuntime(win);
    });

    it('implements core Deps accessors and lazily caches AnalyticsService singleton', () => {
      expect(win.document.querySelectorAll('iframe').length).to.equal(0);
      expect(runtime.win()).to.equal(win);
      expect(runtime.doc().getWin()).to.equal(win);
      expect(runtime.pageConfig().getPublicationId()).to.equal(
        'publication-id-free'
      );
      expect(runtime.activities()).to.be.an.instanceOf(ActivityPorts);
      const firstAnalytics = runtime.analytics();
      const secondAnalytics = runtime.analytics();
      expect(firstAnalytics).to.be.an.instanceOf(AnalyticsService);
      expect(secondAnalytics).to.equal(firstAnalytics);
      expect(win.document.querySelectorAll('iframe').length).to.equal(1);
      expect(runtime.eventManager()).to.be.an.instanceOf(ClientEventManager);
      expect(runtime.creationTimestamp()).to.be.a('number');
      expect(runtime.config()).to.deep.equal({enableSwgAnalytics: true});
      expect(runtime.isPublisher()).to.be.true;
    });

    it('implements storage with no-op promises', async () => {
      const storage = runtime.storage();
      expect(await storage.get('key')).to.be.null;
      expect(await storage.set('key', 'value')).to.be.undefined;
      expect(await storage.remove('key')).to.be.undefined;
    });

    it('implements clientConfigManager delegating to resolveLanguage_', () => {
      runtime.init({lang: 'it'});
      expect(runtime.clientConfigManager().getLanguage()).to.equal('it');
    });

    it('returns null/undefined for unused full-runtime subsystems', () => {
      expect(runtime.entitlementsManager()).to.be.null;
      expect(runtime.dialogManager()).to.be.null;
      expect(runtime.jserror()).to.be.null;
      expect(runtime.payClient()).to.be.null;
      expect(runtime.callbacks()).to.be.null;
      expect(runtime.gisInteropManager()).to.be.undefined;
    });
  });

  describe('API methods', () => {
    let api;
    let toastOpenStub;
    let capturedButtonOptions;
    let pendingOnResponse;
    let flowResultHandler;

    beforeEach(() => {
      capturedButtonOptions = undefined;
      sandbox
        .stub(AddPreferredSourceButton.prototype, 'attach')
        .callsFake(function () {
          capturedButtonOptions = this.options_;
          this.container_.appendChild(win.document.createElement('iframe'));
          return Promise.resolve();
        });
      toastOpenStub = sandbox.stub(Toast.prototype, 'open').resolves();
      sandbox
        .stub(AddPreferredSourceFlow, 'configurePending')
        .callsFake((_deps, onResponse) => {
          pendingOnResponse = onResponse;
        });
      flowResultHandler = () => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
        );
        response.setSiteName('TestSite');
        pendingOnResponse(response);
      };
      sandbox.stub(AddPreferredSourceFlow.prototype, 'start').callsFake(() => {
        flowResultHandler();
        return Promise.resolve();
      });
      api = installPublisherRuntime(win);
    });

    it('should inject iframe for buttons when init is called', () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button);

      api.init({theme: 'dark'});

      expect(button.getAttribute('data-initialized')).to.equal('true');
      expect(button.querySelector('iframe')).to.not.be.null;
    });

    it('should parse data-theme and data-lang from button element', () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      button.setAttribute('data-theme', 'dark');
      button.setAttribute('data-lang', 'es');
      win.document.body.appendChild(button);

      api.init();

      expect(capturedButtonOptions).to.not.be.undefined;
      expect(capturedButtonOptions.theme).to.equal('dark');
      expect(capturedButtonOptions.lang).to.equal('es');
    });

    it('should prioritize data attributes over init options', () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      button.setAttribute('data-theme', 'light');
      button.setAttribute('data-lang', 'fr');
      win.document.body.appendChild(button);

      api.init({theme: 'dark', lang: 'en'});

      expect(capturedButtonOptions).to.not.be.undefined;
      expect(capturedButtonOptions.theme).to.equal('light');
      expect(capturedButtonOptions.lang).to.equal('fr');
    });

    it('should call updateStatus on injected buttons if currentStatus_ is already defined', () => {
      const updateStatusStub = sandbox.stub(
        AddPreferredSourceButton.prototype,
        'updateStatus'
      );

      api.addPreferredSource();

      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button);

      api.init({theme: 'dark'});

      expect(updateStatusStub).to.have.been.calledWith(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
    });

    it('should trigger addPreferredSource when button iframe attach callback is invoked', async () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button);

      api.init({theme: 'dark'});

      expect(AddPreferredSourceButton.prototype.attach).to.have.been.called;
      const onResultCallback =
        AddPreferredSourceButton.prototype.attach.getCall(0).args[0];

      AddPreferredSourceFlow.prototype.start.resetHistory();
      const res = await onResultCallback();
      expect(AddPreferredSourceFlow.prototype.start).to.have.been.calledOnce;
      expect(res).to.be.true;
    });

    it('should show toast when addPreferredSource is called', () => {
      api.addPreferredSource();

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('flavor=preferred_source');
      expect(toastInstance.src_).to.include('sourceName=TestSite');
      expect(toastInstance.src_).to.include('confirmationType=3');
    });

    it('should include theme parameter in toast URL when theme option is set in init', () => {
      api.init({theme: 'dark'});
      api.addPreferredSource();

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('theme=dark');
    });

    it('should use clicked button data-lang and data-theme for toast on multi-button pages without affecting api.addPreferredSource()', async () => {
      const button1 = win.document.createElement('div');
      button1.setAttribute('google-add-preferred-source-btn', '');
      button1.setAttribute('data-lang', 'es');
      button1.setAttribute('data-theme', 'light');
      win.document.body.appendChild(button1);

      const button2 = win.document.createElement('div');
      button2.setAttribute('google-add-preferred-source-btn', '');
      button2.setAttribute('data-lang', 'fr');
      button2.setAttribute('data-theme', 'dark');
      win.document.body.appendChild(button2);

      api.init({lang: 'de', theme: 'light'});

      const button2ClickCallback =
        AddPreferredSourceButton.prototype.attach.getCall(1).args[0];
      await button2ClickCallback();

      expect(toastOpenStub).to.have.been.calledOnce;
      const button2Toast = toastOpenStub.getCall(0).thisValue;
      expect(button2Toast.src_).to.include('hl=fr');
      expect(button2Toast.src_).to.include('theme=dark');

      toastOpenStub.resetHistory();
      api.addPreferredSource();

      expect(toastOpenStub).to.have.been.calledOnce;
      const apiToast = toastOpenStub.getCall(0).thisValue;
      expect(apiToast.src_).to.include('hl=de');
      expect(apiToast.src_).to.include('theme=light');
    });

    it('should swallow rejected AddPreferredSourceFlow.start() promises without unhandled rejections', async () => {
      AddPreferredSourceFlow.prototype.start.callsFake(() =>
        Promise.reject(new Error('Popup failed'))
      );
      let unhandled = false;
      const onUnhandled = () => {
        unhandled = true;
      };
      win.addEventListener('unhandledrejection', onUnhandled);

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));

      win.removeEventListener('unhandledrejection', onUnhandled);
      expect(unhandled).to.be.false;
      expect(toastOpenStub).to.not.have.been.called;
    });

    it('should ignore toast if response status is UNSPECIFIED', () => {
      flowResultHandler = () => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_UNSPECIFIED
        );
        pendingOnResponse(response);
      };

      api.addPreferredSource();

      expect(toastOpenStub).to.not.have.been.called;
    });

    it('should show toast with alternate flavor if status is ALREADY_ADDED', () => {
      flowResultHandler = () => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED
        );
        response.setSiteName('TestSite');
        pendingOnResponse(response);
      };

      api.addPreferredSource();

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('flavor=preferred_source');
      expect(toastInstance.src_).to.include('sourceName=TestSite');
      expect(toastInstance.src_).to.include('confirmationType=1');
    });

    it('should show toast with ineligible flavor if status is INELIGIBLE', () => {
      flowResultHandler = () => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE
        );
        response.setSiteName('TestSite');
        pendingOnResponse(response);
      };

      api.addPreferredSource();

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('flavor=preferred_source');
      expect(toastInstance.src_).to.include('sourceName=TestSite');
      expect(toastInstance.src_).to.include('confirmationType=2');
    });

    it('should update all registered button components when addPreferredSource completes', () => {
      const updateStatusStub = sandbox.stub(
        AddPreferredSourceButton.prototype,
        'updateStatus'
      );
      const button1 = win.document.createElement('div');
      button1.setAttribute('google-add-preferred-source-btn', '');
      const button2 = win.document.createElement('div');
      button2.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button1);
      win.document.body.appendChild(button2);

      api.init();
      api.addPreferredSource();

      expect(updateStatusStub).to.have.been.calledWith(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(updateStatusStub.callCount).to.be.at.least(2);
    });

    it('should use lang option when specified in init options', () => {
      api.init({lang: 'fr'});
      api.addPreferredSource();

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=fr');
    });

    it('should use navigator.language when no explicit language option is given', () => {
      sandbox.stub(win.navigator, 'language').get(() => 'ja');
      const runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=ja');
    });

    it('should fallback to documentElement.lang or "en" when navigator.language is unavailable', () => {
      sandbox.stub(win.navigator, 'language').get(() => undefined);
      win.document.documentElement.lang = 'de';

      let runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      let toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=de');

      win.document.documentElement.lang = '';
      toastOpenStub.resetHistory();
      runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=en');
    });

    it('should default sourceName to empty string when calling showToast without sourceName parameter', () => {
      const runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.match(/[\?&]sourceName=(&|$)/);
    });

    it('should pass empty string to showToast when response.getSiteName() is empty or undefined', () => {
      flowResultHandler = () => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
        );
        pendingOnResponse(response);
      };

      api.addPreferredSource();

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.match(/[\?&]sourceName=(&|$)/);
    });

    it('should trigger addPreferredSource with button language and theme when attach callback is invoked', async () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      button.setAttribute('data-lang', 'es');
      button.setAttribute('data-theme', 'dark');
      win.document.body.appendChild(button);

      api.init();

      const onResultCallback =
        AddPreferredSourceButton.prototype.attach.getCall(0).args[0];

      toastOpenStub.resetHistory();
      await onResultCallback();

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=es');
      expect(toastInstance.src_).to.include('theme=dark');
    });

    it('should prioritize options.language and options.theme in showToast', () => {
      const runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
        'Site',
        {language: 'es', theme: 'dark'}
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=es');
      expect(toastInstance.src_).to.include('theme=dark');
    });

    it('should default theme to light in showToast when none is configured', () => {
      const runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('theme=light');
    });

    it('should default theme to light when invalid theme string is provided', () => {
      const runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
        'Site',
        {theme: 'invalid-theme'}
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('theme=light');
    });

    it('should fallback to en when documentElement has no lang attribute and navigator.language is unavailable', () => {
      sandbox.stub(win.navigator, 'language').get(() => undefined);
      win.document.documentElement.removeAttribute('lang');

      const runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=en');
    });

    it('should allow init to be called with no arguments', () => {
      const runtime = new PublisherRuntime(win);
      expect(() => runtime.init()).to.not.throw();
    });

    it('should log ACTION_ADD_PREFERRED_SOURCE with trigger=API and null installType when called via api.addPreferredSource', () => {
      const logSwgEventSpy = sandbox.spy(
        ClientEventManager.prototype,
        'logSwgEvent'
      );
      api.addPreferredSource();

      expect(logSwgEventSpy).to.have.been.calledWith(
        AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCE,
        false,
        sandbox.match((params) => {
          return (
            params.getPreferredSourcesAddSourceTrigger() ===
              PreferredSourcesAddSourceTrigger.PREFERRED_SOURCES_ADD_SOURCE_TRIGGER_API &&
            params.getPreferredSourcesInstallType() === null
          );
        })
      );
    });

    it('should sanitize isFromInflatedButton to false when called via api.addPreferredSource', () => {
      const logSwgEventSpy = sandbox.spy(
        ClientEventManager.prototype,
        'logSwgEvent'
      );
      api.addPreferredSource({isFromInflatedButton: true});

      expect(logSwgEventSpy).to.have.been.calledWith(
        AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCE,
        false,
        sandbox.match((params) => {
          return (
            params.getPreferredSourcesAddSourceTrigger() ===
            PreferredSourcesAddSourceTrigger.PREFERRED_SOURCES_ADD_SOURCE_TRIGGER_API
          );
        })
      );
    });

    it('should log ACTION_ADD_PREFERRED_SOURCE with trigger=INFLATED_BUTTON and null installType when button attach callback is invoked', async () => {
      const logSwgEventSpy = sandbox.spy(
        ClientEventManager.prototype,
        'logSwgEvent'
      );
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button);

      api.init({theme: 'dark'});

      const onResultCallback =
        AddPreferredSourceButton.prototype.attach.getCall(0).args[0];

      logSwgEventSpy.resetHistory();
      await onResultCallback();

      expect(logSwgEventSpy).to.have.been.calledWith(
        AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCE,
        true,
        sandbox.match((params) => {
          return (
            params.getPreferredSourcesAddSourceTrigger() ===
              PreferredSourcesAddSourceTrigger.PREFERRED_SOURCES_ADD_SOURCE_TRIGGER_INFLATED_BUTTON &&
            params.getPreferredSourcesInstallType() === null
          );
        })
      );
    });

    it('should truncate canonicalUrl to HTTP(S) origin in ACTION_ADD_PREFERRED_SOURCE and AnalyticsContext', () => {
      const canonicalLink = win.document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute(
        'href',
        'https://www.example.com/news/article-123?utm_source=newsletter'
      );
      win.document.head.appendChild(canonicalLink);

      const runtime = new PublisherRuntime(win);
      const logSwgEventSpy = sandbox.spy(runtime.eventManager(), 'logSwgEvent');
      runtime.addPreferredSource();

      expect(logSwgEventSpy).to.have.been.calledOnceWith(
        AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCE,
        false,
        sandbox.match(
          (params) => params.getCanonicalUrl() === 'https://www.example.com'
        )
      );
      const context = runtime.analytics().getContext();
      expect(context.getUrl()).to.equal('https://www.example.com');
      expect(context.getUrlFromMarkup()).to.be.null;
      expect(context.getUtmSource()).to.be.null;
      expect(context.getUtmMedium()).to.be.null;
      expect(context.getUtmCampaign()).to.be.null;

      canonicalLink.remove();
    });
  });

  describe('redirect #__WA_RES__ handling', () => {
    let referrer;
    let toastOpenStub;
    let updateStatusStub;
    let replaceStateCalls;

    async function installWithRedirect(payload) {
      win.location.hash =
        '#__WA_RES__=' + encodeURIComponent(JSON.stringify(payload));
      installPublisherRuntime(win);
      expect(replaceStateCalls).to.deep.equal(['#']);
      expect(win.location.hash).to.equal('');
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    beforeEach(() => {
      referrer = 'https://news.google.com/';
      replaceStateCalls = [];
      sandbox.stub(win.document, 'referrer').get(() => referrer);
      sandbox
        .stub(win.history, 'replaceState')
        .callsFake((_state, _title, url) => {
          replaceStateCalls.push(url);
          win.location.hash = url;
        });
      sandbox
        .stub(AddPreferredSourceButton.prototype, 'attach')
        .callsFake(function () {
          this.container_.appendChild(win.document.createElement('iframe'));
          return Promise.resolve();
        });
      updateStatusStub = sandbox.stub(
        AddPreferredSourceButton.prototype,
        'updateStatus'
      );
      toastOpenStub = sandbox.stub(Toast.prototype, 'open').resolves();
    });

    it('synchronously strips #__WA_RES__ and renders toast in manual buttonless mode (e.g. COOP: same-origin)', async () => {
      const script = win.document.createElement('script');
      script.setAttribute('preferred-sources-control', 'manual');
      win.document.body.appendChild(script);
      dep((api) => {
        api.init({lang: 'de', theme: 'dark'});
      });

      await installWithRedirect({
        requestId: 'addPreferredSource',
        origin: 'https://news.google.com',
        code: 'ok',
        data: [
          'AddPreferredSourceResponse',
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
          'TestSite',
        ],
      });

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('flavor=preferred_source');
      expect(toastInstance.src_).to.include('sourceName=TestSite');
      expect(toastInstance.src_).to.include('confirmationType=3');
      expect(toastInstance.src_).to.include('hl=de');
      expect(toastInstance.src_).to.include('theme=dark');
    });

    it('updates Google button without data attributes and shows ALREADY_ADDED toast on redirect return', async () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button);

      await installWithRedirect({
        requestId: 'addPreferredSource',
        origin: 'https://news.google.com',
        code: 'ok',
        data: [
          'AddPreferredSourceResponse',
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED,
          'TestSite',
        ],
      });

      expect(updateStatusStub).to.have.been.calledWith(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('confirmationType=1');
      expect(toastInstance.src_).to.include('sourceName=TestSite');
    });

    it('falls back to button data-lang and data-theme on redirect return', async () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      button.setAttribute('data-lang', 'es');
      button.setAttribute('data-theme', 'dark');
      win.document.body.appendChild(button);

      await installWithRedirect({
        requestId: 'addPreferredSource',
        origin: 'https://news.google.com',
        code: 'ok',
        data: [
          'AddPreferredSourceResponse',
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE,
          '',
        ],
      });

      expect(updateStatusStub).to.have.been.calledWith(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('confirmationType=2');
      expect(toastInstance.src_).to.include('hl=es');
      expect(toastInstance.src_).to.include('theme=dark');
    });

    it('strips #__WA_RES__ without showing toast when redirect result is canceled', async () => {
      await installWithRedirect({
        requestId: 'addPreferredSource',
        origin: 'https://news.google.com',
        code: 'canceled',
        data: null,
      });

      expect(toastOpenStub).to.not.have.been.called;
      expect(updateStatusStub).to.not.have.been.called;
    });

    it('strips #__WA_RES__ and rejects spoofed payload when document.referrer is unverified', async () => {
      referrer = 'https://evil.example/';

      await installWithRedirect({
        requestId: 'addPreferredSource',
        origin: 'https://news.google.com',
        code: 'ok',
        data: [
          'AddPreferredSourceResponse',
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
          'SpoofedSite',
        ],
      });

      expect(toastOpenStub).to.not.have.been.called;
      expect(updateStatusStub).to.not.have.been.called;
    });

    it('waits for document ready before showing redirect toast when installed in <head> before <body> or manual init()', async () => {
      let readyState = 'loading';
      sandbox.stub(win.document, 'readyState').get(() => readyState);

      const script = win.document.createElement('script');
      script.setAttribute('preferred-sources-control', 'manual');
      win.document.head.appendChild(script);

      win.location.hash =
        '#__WA_RES__=' +
        encodeURIComponent(
          JSON.stringify({
            requestId: 'addPreferredSource',
            origin: 'https://news.google.com',
            code: 'ok',
            data: [
              'AddPreferredSourceResponse',
              AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
              'TestSite',
            ],
          })
        );

      const api = installPublisherRuntime(win);
      expect(replaceStateCalls).to.deep.equal(['#']);
      expect(win.location.hash).to.equal('');

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(toastOpenStub).to.not.have.been.called;

      // Body scripts execute and call init() before readystatechange completes.
      api.init({lang: 'de', theme: 'dark'});
      readyState = 'interactive';
      win.document.dispatchEvent(new Event('readystatechange'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=de');
      expect(toastInstance.src_).to.include('theme=dark');
    });
  });
});
