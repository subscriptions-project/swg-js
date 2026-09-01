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
import {AddPreferredSourceButton} from '../ui/add-preferred-source-button-iframe';
import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {
  AddPreferredSourceResponse,
  AddPreferredSourceStatus,
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

    it('implements core Deps accessors', () => {
      expect(runtime.win()).to.equal(win);
      expect(runtime.doc().getWin()).to.equal(win);
      expect(runtime.pageConfig().getPublicationId()).to.equal(
        'publication-id-free'
      );
      expect(runtime.activities()).to.be.an.instanceOf(ActivityPorts);
      expect(runtime.analytics()).to.be.an.instanceOf(AnalyticsService);
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

    beforeEach(async () => {
      sandbox
        .stub(AddPreferredSourceButton.prototype, 'attach')
        .callsFake(function () {
          this.container_.appendChild(win.document.createElement('iframe'));
          return Promise.resolve();
        });
      toastOpenStub = sandbox.stub(Toast.prototype, 'open').resolves();
      sandbox.stub(AddPreferredSourceFlow.prototype, 'start').callsFake(() => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
        );
        response.setSiteName('TestSite');
        return Promise.resolve(response);
      });
      installPublisherRuntime(win);

      return new Promise((resolve) => {
        dep((installedApi) => {
          api = installedApi;
          resolve();
        });
      });
    });

    it('should inject iframe for buttons when init is called', async () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button);

      api.init({theme: 'dark'});

      // Needs a tick for getConfiguredRuntime_ promise resolution
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(button.getAttribute('data-initialized')).to.equal('true');
      expect(button.querySelector('iframe')).to.not.be.null; // Iframe injected
    });

    it('should parse data-theme and data-lang from button element', async () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      button.setAttribute('data-theme', 'dark');
      button.setAttribute('data-lang', 'es');
      win.document.body.appendChild(button);

      let capturedOptions;
      AddPreferredSourceButton.prototype.attach.restore();
      sandbox
        .stub(AddPreferredSourceButton.prototype, 'attach')
        .callsFake(function () {
          capturedOptions = this.options_;
          this.container_.appendChild(win.document.createElement('iframe'));
          return Promise.resolve();
        });

      api.init();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(capturedOptions).to.not.be.undefined;
      expect(capturedOptions.theme).to.equal('dark');
      expect(capturedOptions.lang).to.equal('es');
    });

    it('should prioritize data attributes over init options', async () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      button.setAttribute('data-theme', 'light');
      button.setAttribute('data-lang', 'fr');
      win.document.body.appendChild(button);

      let capturedOptions;
      AddPreferredSourceButton.prototype.attach.restore();
      sandbox
        .stub(AddPreferredSourceButton.prototype, 'attach')
        .callsFake(function () {
          capturedOptions = this.options_;
          this.container_.appendChild(win.document.createElement('iframe'));
          return Promise.resolve();
        });

      api.init({theme: 'dark', lang: 'en'});
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(capturedOptions).to.not.be.undefined;
      expect(capturedOptions.theme).to.equal('light');
      expect(capturedOptions.lang).to.equal('fr');
    });

    it('should call updateStatus on injected buttons if currentStatus_ is already defined', async () => {
      const updateStatusStub = sandbox.stub(
        AddPreferredSourceButton.prototype,
        'updateStatus'
      );

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button);

      api.init({theme: 'dark'});
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(updateStatusStub).to.have.been.calledWith(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
    });

    it('should trigger addPreferredSource when button iframe attach callback is invoked', async () => {
      const button = win.document.createElement('div');
      button.setAttribute('google-add-preferred-source-btn', '');
      win.document.body.appendChild(button);

      api.init({theme: 'dark'});
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(AddPreferredSourceButton.prototype.attach).to.have.been.called;
      const onResultCallback =
        AddPreferredSourceButton.prototype.attach.getCall(0).args[0];

      AddPreferredSourceFlow.prototype.start.resetHistory();
      const res = await onResultCallback();
      expect(AddPreferredSourceFlow.prototype.start).to.have.been.calledOnce;
      expect(res).to.be.true;
    });

    it('should show toast when addPreferredSource is called', async () => {
      api.addPreferredSource();

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('flavor=preferred_source');
      expect(toastInstance.src_).to.include('sourceName=TestSite');
      expect(toastInstance.src_).to.include('confirmationType=3');
    });

    it('should include theme parameter in toast URL when theme option is set in init', async () => {
      api.init({theme: 'dark'});
      await new Promise((resolve) => setTimeout(resolve, 0));

      api.addPreferredSource();

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('theme=dark');
    });

    it('should ignore toast if addPreferredSource is cancelled or fails', async () => {
      AddPreferredSourceFlow.prototype.start.restore(); // override the beforeEach stub
      sandbox
        .stub(AddPreferredSourceFlow.prototype, 'start')
        .rejects(new Error('canceled'));

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(toastOpenStub).to.not.have.been.called; // No toast
    });

    it('should show toast with alternate flavor if status is ALREADY_ADDED', async () => {
      AddPreferredSourceFlow.prototype.start.restore();
      sandbox.stub(AddPreferredSourceFlow.prototype, 'start').callsFake(() => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED
        );
        response.setSiteName('TestSite');
        return Promise.resolve(response);
      });

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('flavor=preferred_source');
      expect(toastInstance.src_).to.include('sourceName=TestSite');
      expect(toastInstance.src_).to.include('confirmationType=1');
    });

    it('should show toast with ineligible flavor if status is INELIGIBLE', async () => {
      AddPreferredSourceFlow.prototype.start.restore();
      sandbox.stub(AddPreferredSourceFlow.prototype, 'start').callsFake(() => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE
        );
        response.setSiteName('TestSite');
        return Promise.resolve(response);
      });

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('flavor=preferred_source');
      expect(toastInstance.src_).to.include('sourceName=TestSite');
      expect(toastInstance.src_).to.include('confirmationType=2');
    });

    it('should update all registered button components when addPreferredSource completes', async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 0));

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(updateStatusStub).to.have.been.calledWith(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(updateStatusStub.callCount).to.be.at.least(2);
    });

    it('should use lang option when specified in init options', async () => {
      api.init({lang: 'fr'});
      await new Promise((resolve) => setTimeout(resolve, 0));

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.include('hl=fr');
    });

    it('should fallback to documentElement.lang or "en" when no language is specified', () => {
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

    it('should default sourceName to empty string when calling showToast without sourceName parameter', async () => {
      const runtime = new PublisherRuntime(win);
      runtime.showToast(
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
      );
      expect(toastOpenStub).to.have.been.calledOnce;
      const toastInstance = toastOpenStub.getCall(0).thisValue;
      expect(toastInstance.src_).to.match(/[\?&]sourceName=(&|$)/);
    });

    it('should pass empty string to showToast when response.getSiteName() is empty or undefined', async () => {
      AddPreferredSourceFlow.prototype.start.restore();
      sandbox.stub(AddPreferredSourceFlow.prototype, 'start').callsFake(() => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
        );
        return Promise.resolve(response);
      });

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
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
      await new Promise((resolve) => setTimeout(resolve, 0));

      const onResultCallback =
        AddPreferredSourceButton.prototype.attach.getCall(0).args[0];

      toastOpenStub.resetHistory();
      await onResultCallback();

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

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

    it('should fallback to en when documentElement has no lang attribute', () => {
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
  });
});
