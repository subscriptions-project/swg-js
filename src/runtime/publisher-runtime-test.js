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
import {AddPreferredSourceButtonIframe} from '../ui/add-preferred-source-button-iframe';
import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {
  AddPreferredSourceResponse,
  AddPreferredSourceStatus,
} from '../proto/api_messages';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
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

  describe('API methods', () => {
    let api;
    let toastOpenStub;

    beforeEach(async () => {
      sandbox
        .stub(AddPreferredSourceButtonIframe.prototype, 'attach')
        .callsFake(function () {
          this.container_.appendChild(win.document.createElement('iframe'));
          return Promise.resolve();
        });
      toastOpenStub = sandbox.stub(Toast.prototype, 'open').resolves();
      sandbox
        .stub(PageConfigResolver.prototype, 'resolveConfig')
        .resolves(new PageConfig('pub1', true));
      sandbox.stub(AddPreferredSourceFlow.prototype, 'start').callsFake(() => {
        const response = new AddPreferredSourceResponse();
        response.setStatus(
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
        );
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

    it('should show toast when addPreferredSource is called', async () => {
      api.addPreferredSource();

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(toastOpenStub).to.have.been.calledOnce;
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
        return Promise.resolve(response);
      });

      api.addPreferredSource();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(toastOpenStub).to.have.been.calledOnce;
    });
  });
});
