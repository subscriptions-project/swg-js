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

import {ActivityIframePort, ActivityPorts} from '../components/activities';
import {AddPreferredSourceButtonIframe} from './add-preferred-source-button-iframe';

describes.realWin('AddPreferredSourceButtonIframe', (env) => {
  let win;
  let doc;
  let deps;
  let activityPorts;
  let iframeComponent;
  let container;
  let portStub;

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;

    portStub = sandbox.createStubInstance(ActivityIframePort);
    portStub.onResizeRequest.callsFake((cb) => {
      // simulate resize
      cb(200);
    });
    portStub.whenReady.resolves();
    portStub.acceptResult.resolves(true);
    portStub.on.callsFake((ctor, cb) => {
      cb({});
    });

    activityPorts = sandbox.createStubInstance(ActivityPorts);
    activityPorts.openIframe.resolves(portStub);

    deps = {
      doc: () => ({getWin: () => win}),
      activities: () => activityPorts,
    };

    container = doc.createElement('div');
    doc.body.appendChild(container);

    iframeComponent = new AddPreferredSourceButtonIframe(deps, container, {
      lang: 'en',
      theme: 'dark',
    });
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should attach iframe to container', async () => {
    let resultCalled = false;
    await iframeComponent.attach(() => {
      resultCalled = true;
    });

    const iframe = container.querySelector('iframe');
    expect(iframe).to.not.be.null;
    expect(iframe.style.height).to.equal('200px'); // Resized
    expect(iframe.getAttribute('frameborder')).to.equal('0');
    expect(iframe.getAttribute('scrolling')).to.equal('no');

    expect(activityPorts.openIframe).to.have.been.calledOnce;
    const openIframeArgs = activityPorts.openIframe.getCall(0).args;
    expect(openIframeArgs[0]).to.equal(iframe);
    expect(openIframeArgs[1]).to.match(/\/addpreferredsourcebuttoniframe/);
    expect(resultCalled).to.be.true;
  });

  it('should pass exact URL parameters to the iframe component', async () => {
    await iframeComponent.attach(() => {});

    expect(activityPorts.openIframe).to.have.been.calledOnce;
    const url = activityPorts.openIframe.getCall(0).args[1];

    expect(url).to.contain('hl=en');
    expect(url).to.contain('theme=dark');
    expect(url).to.contain('source=' + encodeURIComponent(win.location.href));
    expect(url).to.contain('origin=');
  });

  it('should handle iframe rejected results silently', async () => {
    portStub.on.callsFake(() => {}); // Does not invoke callback
    let resultCalled = false;
    await iframeComponent.attach(() => {
      resultCalled = true;
    });

    expect(resultCalled).to.be.false;
  });

  it('should gracefully handle openIframe exceptions', async () => {
    activityPorts.openIframe.rejects(new Error('Blocked!'));

    let resultCalled = false;
    await iframeComponent.attach(() => {
      resultCalled = true;
    });

    expect(resultCalled).to.be.false; // Exception handled gracefully in attach
  });
});
